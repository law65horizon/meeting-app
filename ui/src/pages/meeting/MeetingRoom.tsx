/**
 * App.tsx — Meeting page
 *
 * Critical fix: ALL socket.on() listeners are registered at the TOP of start(),
 * before any socket.emit() calls. This prevents the race where the server fires
 * "newProducer" in response to "getProducers" before the listener is attached.
 *
 * Flow:
 *  1. Register all listeners (newProducer, peerLeft, etc.)
 *  2. Create send transport → produce local tracks
 *  3. LAST: call getProducers (so any newProducer events it triggers hit the listener)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { ArrowLeft, Clock } from "lucide-react";
import VideoGrid from "../../components/video/VideoGrid";
import MeetingControls from "../../components/meeting/MeetingControls";
import useMeetingStore from "../../store/meetingStore";
// import { onMeetingUpdate } from "../../lib/firebase";
import useAuthStore from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { useNewMeetingStore } from "../../store/newMeetingStore";
import { ChatMessage, Participant, User } from "../../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransportData {
  id: string;
  iceParameters: mediasoupClient.types.IceParameters;
  iceCandidates: mediasoupClient.types.IceCandidate[];
  dtlsParameters: mediasoupClient.types.DtlsParameters;
  iceServers?: RTCIceServer[];
  error?: string;
}

interface ConsumerData {
  id: string;
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
  rtpParameters: mediasoupClient.types.RtpParameters;
  appData?: any;
  error?: string;
}

interface NewProducerData {
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
  appData?: Record<string, any>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const tempUser = useAuthStore((s) => s.tempUser);
  const pps = useMeetingStore((s) => s.participants);
  const title = useMeetingStore((s) => s.title);
  const setPPs = useMeetingStore((s) => s.setParticipants);
  const setCallbacks = useNewMeetingStore((s) => s.setCallbacks);
  const receiveMessage = useNewMeetingStore((s) => s.receiveMessage);
  const setSendChatCallback = useNewMeetingStore((s) => s.setSendChatCallback);
  const unreadMessageCount = useNewMeetingStore((s) => s.unreadMessageCount);

  const setTempUser = useAuthStore((s) => s.setTempUser)

  console.log({pps})

  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ── WebRTC infra refs ──────────────────────────────────────────────────────
  const socketRef = useRef<typeof Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const videoProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const consumerMapRef = useRef<Map<string, mediasoupClient.types.Consumer>>(new Map());
  const peerProducersRef = useRef<Map<string, Set<string>>>(new Map());
  

  // ── State ──────────────────────────────────────────────────────────────────
  const [streams, setStreams] = useState<{ [peerId: string]: MediaStream }>({});
  console.log('videostreams', Object.values(streams))
  // const [participants, setParticipants] = useState<Participant[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading] = useState(false);
  const [unreadMessages] = useState(0);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tempUser) {
      const id = user?.uid || sessionStorage.getItem('guestUserId')
      if (!id) {
        console.log('check id failed', {user}) 
        return
      }
      const getTempUser: User = {
        id,
        name: user?.displayName || user?.email?.split('@')[0] || sessionStorage.getItem('guestFullname') || 'Guest'
      }
      console.log('check', {getTempUser})
      setTempUser(getTempUser)
    }
  }, [user])

  const formatElapsedTime = () => {
    const h = Math.floor(elapsedTime / 3600);
    const m = Math.floor((elapsedTime % 3600) / 60);
    const s = elapsedTime % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ── Participants ───────────────────────────────────────────────────────────
  // useEffect(() => setParticipants(pps), [pps]);

  // useEffect(() => {
  //   if (!roomId) return;
  //   const unsub = onMeetingUpdate(roomId, (data) => {
  //     if (data.participants_data) setPPs(data.participants_data);
  //   });
  //   return unsub;
  // }, [roomId]);

  // ── upsertTrack ────────────────────────────────────────────────────────────
  // Always creates a NEW MediaStream so React's reference check triggers re-render.
  const upsertTrack = useCallback((peerId: string, track: MediaStreamTrack) => {
    setStreams((prev) => {
      const old = prev[peerId];
      const kept = old ? old.getTracks().filter((t) => t.kind !== track.kind) : [];
      console.log('videostreams', {old, kept})
      const next = new MediaStream([...kept, track]);
      console.log(
        `%c[streams] upsert peerId=${peerId} kind=${track.kind} total=${next.getTracks().length}`,
        "color:#6ee7b7; font-weight:bold"
      );
      return { ...prev, [peerId]: next };
    });
  }, []);

  // ── Media controls ─────────────────────────────────────────────────────────

  const handleToggleAudio = useCallback(async (muted: boolean) => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !muted;
    const p = audioProducerRef.current;
    if (!p) return;
    if (muted) { p.pause(); socketRef.current?.emit("pauseProducer", { roomId, producerId: p.id }); }
    else { p.resume(); socketRef.current?.emit("resumeProducer", { roomId, producerId: p.id }); }
  }, [roomId]);

  const handleToggleVideo = useCallback(async (enabled: boolean) => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) track.enabled = enabled;
    const p = videoProducerRef.current;
    if (!p) return;
    if (!enabled) { 
      p.pause(); 
      socketRef.current?.emit("pauseProducer", { roomId, producerId: p.id }); 
    } else {
      p.resume(); 
      socketRef.current?.emit("resumeProducer", { roomId, producerId: p.id }); 
    }
  }, [roomId]);

  const handleToggleScreenShare = useCallback(async (sharing: boolean) => {
  const p = videoProducerRef.current;
  if (!p || !tempUser) return;

  const restoreCam = async () => {
    const screenStream = screenStreamRef.current;
    screenStreamRef.current = null;
    screenStream?.getTracks().forEach((t) => t.stop());

    // ✅ Always get a fresh camera stream — the old track may have ended
    const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const freshTrack = freshStream.getVideoTracks()[0];

    // Replace the ended track in localStreamRef so future restores also work
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        localStreamRef.current!.removeTrack(t);
        t.stop();
      });
      localStreamRef.current.addTrack(freshTrack);
    }

    const producer = videoProducerRef.current;
    if (producer) {
      await producer.replaceTrack({ track: freshTrack });
    }
    upsertTrack(tempUser.id, freshTrack);
  };

  if (sharing) {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      screenTrack.onended = async () => {
        useNewMeetingStore.getState().setScreenSharing(false);
        await restoreCam();
      };

      await p.replaceTrack({ track: screenTrack });
      upsertTrack(tempUser.id, screenTrack);
    } catch (err) {
      console.error("Screen share error:", err);
      useNewMeetingStore.getState().setScreenSharing(false);
    }
  } else {
    await restoreCam();
  }
}, [tempUser, upsertTrack]);

  useEffect(() => {
    setCallbacks({
      onToggleAudio: handleToggleAudio,
      onToggleVideo: handleToggleVideo,
      onToggleScreenShare: handleToggleScreenShare,
    });
  }, [handleToggleAudio, handleToggleVideo, handleToggleScreenShare, setCallbacks]);

  // ── start() ────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!socketRef.current || !deviceRef.current || !tempUser) {
      console.warn("[start] prerequisites missing — tempUser:", tempUser);
      return;
    }

    const socket = socketRef.current;
    const device = deviceRef.current;
    const myPeerId = tempUser.id;

    socket.removeListener("newProducer");
    socket.removeListener("peerLeft");
    socket.removeListener("consumerClosed");
    socket.removeListener("producerClosed");

    // Recv transport (closure-local)
    let recvTransport: mediasoupClient.types.Transport | null = null;
    let recvTransportId: string | null = null;
    let recvTransportCreating: Promise<void> | null = null;

    function ensureRecvTransport(): Promise<void> {
      if (recvTransport) return Promise.resolve();
      if (recvTransportCreating) return recvTransportCreating;

      recvTransportCreating = new Promise<void>((resolve, reject) => {
        socket.emit(
          "createWebRtcTransport",
          { roomId, direction: "recv" },
          (params: TransportData) => {
            if (params.error) { console.error("[recv] create error:", params.error); return reject(new Error(params.error)); }
            console.log("%c[recv transport] created id=" + params.id, "color:#a78bfa");
            recvTransportId = params.id;

            const t = device.createRecvTransport({
              id: params.id,
              iceParameters: params.iceParameters,
              iceCandidates: params.iceCandidates,
              dtlsParameters: params.dtlsParameters,
              iceServers: params.iceServers ?? [],
            });

            t.on("connect", ({ dtlsParameters: dp }, cb, errback) => {
              socket.emit("connectTransport", { roomId, transportId: params.id, dtlsParameters: dp },
                (res: any) => res.error ? errback(new Error(res.error)) : cb());
            });
            t.on("connectionstatechange", (s) => console.log("[recv transport] state:", s));

            recvTransport = t;
            resolve();
          }
        );
      });
      return recvTransportCreating;
    }

    async function consume(producerId: string, kind: string, peerId: string): Promise<void> {
      // ensureRecvTransport must be awaited before this is called
      if (!recvTransport || !recvTransportId) {
        console.error("[consume] called before recvTransport was ready — this is a bug");
        return;
      }

      console.log(`%c[consume] producerId=${producerId} kind=${kind} peerId=${peerId}`, "color:#f59e0b; font-weight:bold");

      return new Promise<void>((resolve) => {
        socket.emit("consume", {
          roomId,
          consumerTransportId: recvTransportId,
          producerId,
          clientRtpCapabilities: device.rtpCapabilities,
        }, async (params: ConsumerData) => {
          if (params.error) { console.error("[consume] server error:", params.error); return resolve(); }

          const consumer = await recvTransport!.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
          });

          consumerMapRef.current.set(producerId, consumer);
          if (!peerProducersRef.current.has(peerId)) peerProducersRef.current.set(peerId, new Set());
          peerProducersRef.current.get(peerId)!.add(producerId);

          socket.emit("consumerResume", { roomId, consumerId: consumer.id }, async (res: any) => {
            if (res.error) { console.error("[consumerResume] error:", res.error); return resolve(); }

            await consumer.resume();
            console.log(
              `%c[consume] ✅ resumed kind=${consumer.track.kind} readyState=${consumer.track.readyState} peerId=${peerId}`,
              "color:#6ee7b7; font-weight:bold"
            );

            if (kind === "video") {
              setTimeout(() => socket.emit("requestKeyFrame", { roomId, consumerId: consumer.id }), 150);
            }

            upsertTrack(peerId, consumer.track);

            consumer.track.onunmute = () => {
              console.log(`[track] onunmute kind=${consumer.track.kind} peerId=${peerId}`);
              upsertTrack(peerId, consumer.track);
            };

            resolve();
          });
        });
      });
    }

    // ── STEP 1: Register ALL listeners BEFORE any emit ─────────────────────
    // This is critical — getProducers will cause the server to immediately
    // emit newProducer events, which must already have a listener attached.

    socket.on("newProducer", async ({ producerId, kind, appData: ad }: NewProducerData) => {
      const peerId: string = ad?.peerId ?? "unknown";
      console.log(`%c[newProducer] producerId=${producerId} kind=${kind} peerId=${peerId}`, "color:#f59e0b; font-weight:bold");

      if (peerId === myPeerId) {
        console.log("[newProducer] skipping own producer");
        return;
      }

      await ensureRecvTransport();
      await consume(producerId, kind, peerId);
    });

    socket.on("peerJoined", ({ peerId, peerUserName }: { peerId: string; peerUserName: string }) => {
      console.log('pps peer joined')
      if (peerId) {
        // setPPs([...pps, {id: peerId, name: peerUserName ?? 'Guest'}])
        setPPs((prev) => [...prev, { id: peerId, name: peerUserName ?? 'Guest' }])
      }
    })

    socket.on("peerLeft", ({ peerId, producerIds }: { peerId: string; producerIds: string[] }) => {
      if (peerId === myPeerId) return;
      console.log(`[peerLeft] peerId=${peerId}`, producerIds);
      const tracked = peerProducersRef.current.get(peerId);
      const toClose = tracked ? [...tracked] : (producerIds ?? []);
      toClose.forEach((pid) => { consumerMapRef.current.get(pid)?.close(); consumerMapRef.current.delete(pid); });
      peerProducersRef.current.delete(peerId);
      setStreams((prev) => { const next = { ...prev }; delete next[peerId]; return next; });
      console.log('peerLeft', {pps, peerId})
      const pp = pps.filter(particpant => particpant.id !== peerId )
      console.log('peerLeft', {pps, pp, peerId})
      setPPs((prev:Participant[]) => prev.filter((p:Participant) => p.id !== peerId));
      // setPPs(pps.filter(particpant => particpant.id !== peerId ))
      // setPPs((prev) => prev.filter((p) => p.id !== peerId));
      // useNewMeetingStore.getState().setScreenSharing(false)
      // setPPs((prev) => prev.filter((p) => p.id !== peerId));
    });

    socket.on("consumerClosed", ({ producerId }: { producerId: string }) => {
      consumerMapRef.current.get(producerId)?.close();
      consumerMapRef.current.delete(producerId);
    });

    socket.on("producerClosed", ({ producerId }: { producerId: string }) => {
      consumerMapRef.current.get(producerId)?.close();
      consumerMapRef.current.delete(producerId);
    });

    socket.on("chatMessage", (msg: ChatMessage) => {
      receiveMessage(msg);
    });

    setSendChatCallback((text: string) => {
      if (!text.trim() || !tempUser) return;
      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: myPeerId,
        senderName: tempUser.name,
        content: text.trim(),
        timestamp: Date.now(),
        isPrivate: false
      }
      receiveMessage(msg)
      socket.emit("sendMessage", {roomId, message: msg})
    })

    //  Capture local media ────────────────────────────────────────
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      setStreams((prev) => ({ ...prev, [myPeerId]: stream }));
      console.log("%c[start] local stream ready peerId=" + myPeerId, "color:#6ee7b7; font-weight:bold");
    } catch (err) {
      console.error("[start] getUserMedia error:", err);
    }

    try {
      // Create send transport + produce tracks ─────────────────────
      await new Promise<void>((resolveSendTransport) => {
        socket.emit("createWebRtcTransport", { roomId, direction: "send" }, async (params: TransportData) => {
          if (params.error) { console.error("[send transport] error:", params.error); return resolveSendTransport(); }
          console.log("%c[send transport] created id=" + params.id, "color:#a78bfa");
  
          const sendTransportId = params.id;
  
          const t = device.createSendTransport({
            id: params.id,
            iceParameters: params.iceParameters,
            iceCandidates: params.iceCandidates,
            dtlsParameters: params.dtlsParameters,
            iceServers: params.iceServers ?? [],
          });
  
          t.on("connect", ({ dtlsParameters: dp }, cb, errback) => {
            socket.emit("connectTransport", { roomId, transportId: sendTransportId, dtlsParameters: dp },
              (res: any) => res.error ? errback(new Error(res.error)) : cb());
          });
  
          t.on("produce", ({ kind, rtpParameters, appData: ad }, cb, errback) => {
            console.log({myPeerId})
            socket.emit("produce", {
              roomId,
              transportId: sendTransportId,
              kind,
              rtpParameters,
              appData: { ...ad, peerId: myPeerId },
            }, (res: any) => res.error ? errback(new Error(res.error)) : cb({ id: res.id }));
          });
  
          t.on("connectionstatechange", (s) => console.log("[send transport] state:", s));
  
          // Produce local tracks
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
  
            if (audioTrack) {
              try {
                audioProducerRef.current = await t.produce({ track: audioTrack });
                console.log("[produce] audio id=", audioProducerRef.current.id);
              } catch (e) { console.error("[produce] audio failed:", e); }
            }
  
            if (videoTrack) {
              try {
                videoProducerRef.current = await t.produce({
                  track: videoTrack,
                  encodings: [
                    { maxBitrate: 100_000, scaleResolutionDownBy: 4 },
                    { maxBitrate: 300_000, scaleResolutionDownBy: 2 },
                    { maxBitrate: 900_000 },
                  ],
                  codecOptions: { videoGoogleStartBitrate: 1000 },
                });
                console.log("[produce] video id=", videoProducerRef.current.id);
              } catch (e) { console.error("[produce] video failed:", e); }
            }
          }
  
          resolveSendTransport();
        });
      });
  
      // LAST — fetch existing producers ────────────────────────────
      // newProducer listener is already registered (step 1), so events won't be missed.
      console.log("[getProducers] requesting...");
      socket.emit(
        "getProducers",
        { roomId, clientRtpCapabilities: device.rtpCapabilities },
        (res: any) => {
          if (res?.error) console.error("[getProducers] error:", res.error);
          else console.log("[getProducers] ✅ done");
        }
      );
    } catch (error) {
      console.error(error)
       setTimeout(() => {
    navigate('/', { replace: true });
  }, 0);
    }

  }, [roomId, tempUser, upsertTrack]);

  // ── Socket bootstrap ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !tempUser) {
      console.log('check start failed', user,)
      return
    }  else {
      console.log('check start passed')
    }// wait for user identity before connecting
    console.log('check', {authLoading, user, tempUser, storage: sessionStorage.getItem('guestUserId'), storageName: sessionStorage.getItem('guestFullname')})

    const socket = io("http://localhost:3000", {
      reconnection: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;
    deviceRef.current = new mediasoupClient.Device();

    socket.on("connect", () => {
      console.log("[socket] connected id=", socket.id, tempUser);
      // Pass our app-level user ID so the server can inject it into all
      // newProducer events — this is the single source of truth for peerId.
      socket.emit("joinRoom", { roomId, rtpCapabilities: null, appUserId: tempUser?.id ?? socket.id, appUserName: tempUser.name },
        async (res: { rtpCapabilities: any, peers: any }) => {
          try {
            setPPs(res.peers)
            await deviceRef.current!.load({ routerRtpCapabilities: res.rtpCapabilities });
            console.log("[device] loaded");
            await start();
          } catch (e) {
            console.error("[device/start] error:", e);
          }
        }
      );
    },);

    socket.on("connect_error", (e: Error) => console.error("[socket] connect_error:", e.message));

    return () => {
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, start, tempUser]);

  // ── Derived ────────────────────────────────────────────────────────────────
  // const screenShareParticipant = useMemo(
  //   () => participants.find((p) => p.isScreenSharing),
  //   [participants]
  // );

//   const screenShareParticipant = useMemo(() => {
//   return participants.find((p) => {
//     const stream = streams[p.id];
//     if (!stream) return false;

//     const videoTrack = stream.getVideoTracks()[0];
//     if (!videoTrack) return false;

//     // Detect screen track
//     return videoTrack.label.toLowerCase().includes("screen");
//   });
// }, [participants, streams]);
const screenShareParticipant = useMemo(() => {
  return pps.find((p) => {
    const stream = streams[p.id];
    if (!stream) return false;

    const track = stream.getVideoTracks()[0];
    if (!track) return false;

    const settings = track.getSettings();
    return !!settings.displaySurface;
  });
}, [pps, streams]);

console.log({screenShareParticipant})

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", gap: 2, bgcolor: "#0a0a0f" }}>
        <CircularProgress sx={{ color: "#6ee7b7" }} />
        <Typography sx={{ color: "#94a3b8" }}>Joining meeting…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", bgcolor: "#0a0a0f", flexDirection: "column" }}>
      <AppBar position="static" elevation={0}
        sx={{ bgcolor: "rgba(15,15,25,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => navigate("/dashboard")}
            sx={{ color: "#94a3b8", "&:hover": { color: "#fff" } }}>
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", color: "#e2e8f0", letterSpacing: "-0.01em" }}>
            {title || "Meeting"}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 2, px: 1.5, py: 0.5 }}>
            <Clock size={14} color="#6ee7b7" />
            <Typography variant="body2" sx={{ color: "#6ee7b7", fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.05em" }}>
              {formatElapsedTime()}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <VideoGrid
          participants={pps}
          layout={screenShareParticipant ? "presentation" : "grid"}
          screenShareParticipantId={screenShareParticipant?.id}
          streams={streams}
        />
      </Box>

      <MeetingControls
        onLeave={() => navigate("/dashboard")}
        onToggleChat={() => {}}
        onToggleParticipants={() => {}}
        unreadMessages={unreadMessages}
      />
    </Box>
  );
};

export default App;