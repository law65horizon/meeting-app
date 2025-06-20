import React, { useEffect, useRef, useState } from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  IconButton, 
  Typography, 
  Badge, 
  Drawer, 
  Grid, 
  Paper, 
  Avatar, 
  Tooltip, 
  List, 
  ListItem, 
  TextField, 
  Button,
  Divider,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Share, 
  MoreVertical, 
  Users, 
  Pin, 
  ScreenShare,
  Settings,
  X,
  Send
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import userData from '../../mocks/users.json';
import chatData from '../../mocks/chat.json';
import { Participant, ChatMessage } from '../../types';
import io, { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import useAuthStore from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';

// Types for WebRTC and Mediasoup
interface TransportData {
  id: string;
  iceParameters: mediasoupClient.types.IceParameters;
  iceCandidates: mediasoupClient.types.IceCandidate[];
  dtlsParameters: mediasoupClient.types.DtlsParameters;
  error?: string;
}

interface ProducerResponse {
  id: string;
}

interface ConsumerData {
  id: string;
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
  rtpParameters: mediasoupClient.types.RtpParameters;
  error?: string;
}

interface NewProducerData {
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
  appData?: any;
}

interface RemoteStream {
  stream: MediaStream;
  consumerId: string | null;
}

interface VideoPlayerProps {
  stream: MediaStream;
  peerId: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, peerId }) => {
  console.log('earl',stream)
  const ref = useRef<HTMLVideoElement>(null);

  // Whenever the “stream” prop changes, reassign
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch((err) => console.error("Play error:", err));
      console.log(stream.getTracks())
    }
  }, [stream]);

  return (
    <video
      id={peerId}
      ref={ref}
      autoPlay
      muted={false}   // or true if you want to mute by default
      playsInline
      style={{ width: 200, height: 150, margin: 4, transform: 'scaleX(-1)' }} 
    />
  );
};


const App: React.FC = () => {
  const { user } = useAuth();
  

  const roomId = 'main-room'
  const socketRef = useRef<typeof Socket | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  // At top of your component:
  const [remoteStreams, setRemoteStreams] = useState<{[peerId: string]: MediaStream}>({});

  const [streams, setStreams] = useState<any>([])
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const producerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const consumerTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const sendTransport = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransport = useRef<mediasoupClient.types.Transport | null>(null);
  const sendTransportParams = useRef<TransportData | null>(null);
  const recvTransportParams = useRef<TransportData | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const consumerList = new Map()

  const [participants, setParticipants] = useState<Participant[]>(userData.participants);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(chatData.messages);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsTab, setSettingsTab] = useState(0);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { id } = useParams();
  const navigate = useNavigate();
  
  const drawerWidth = 320;
  
  // Auto-select the first few participants to be pinned
  const mainParticipants = isScreenSharing 
    ? participants.filter(p => p.isScreenSharing || p.id === 'u1')
    : participants.slice(0, isMobile ? 4 : 9);
  const extraParticipants = isScreenSharing 
    ? participants.filter(p => !p.isScreenSharing && p.id !== 'u1')
    : participants.slice(isMobile ? 4 : 9);

    console.log('remos', remoteStreams, user?.email)

  // Initialize Socket.IO and Mediasoup device
  useEffect(() => {
    const socketInstance = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    console.log('renene')
    socketRef.current = socketInstance;

    // Initialize Mediasoup device
    deviceRef.current = new mediasoupClient.Device();

    socketInstance.on('connect', () => {
      console.log('Connected to server via Socket.IO:', socketInstance.id);
      // Load Mediasoup device with router RTP capabilities
      socketInstance.emit('joinRoom', {roomId, rtpCapabilities: null}, (routerRtpCapabilities: any) => {
        deviceRef.current!.load({ routerRtpCapabilities: routerRtpCapabilities.rtpCapabilities })
          .then(async() => {
            console.log('Mediasoup device loaded');
            await start();
          })
          .catch((error) => {
            console.error('Failed to load Mediasoup device:', error);
          });
      });
    });

    socketInstance.on('connect_error', (error: Error) => {
      console.error('Socket.IO connection failed:', error.message);
      alert('Failed to connect to the server. Please check your network or server status.');
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.warn('Disconnected from server:', reason);
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    return () => {
      socketInstance.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      streams.forEach((stream:any) => stream.getTracks().forEach((track: any) => track.stop()));
      if (producerTransportRef.current) {
        producerTransportRef.current.close();
      }
      if (consumerTransportRef.current) {
        consumerTransportRef.current.close();
      }
    };
  }, [roomId]);

  // Start WebRTC setup
  const start = async () => {
    if (!socketRef.current || !deviceRef.current) {
        console.warn('Cannot start WebRTC setup: socket or device not initialized');
        return;
    }

    try {
      console.log('Attempting to capture local media (video and audio)');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log('Local media stream captured successfully');
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        console.log('Assigning media stream to local video element');
        localVideoRef.current.srcObject = stream;
        console.log(localVideoRef.current.srcObject.active, stream)
      }
    } catch (error) {
      console.error('Failed to capture local media:', error);
      alert('Could not access camera or microphone. Please grant permissions.');
      // return;
    }

    const iceServers = [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ];

    console.log('Emitting createWebRtcTransport for send transport, roomId:', roomId);
    socketRef.current.emit("createWebRtcTransport", {
        roomId,
        clientRtpCapabilities: deviceRef.current.rtpCapabilities,
        direction: "send"
    }, async (params: any) => {
        try {
            console.log('Received send transport parameters:', params, localStreamRef.current);
            sendTransportParams.current = params;
    
            console.log('Creating send transport with Mediasoup device', deviceRef.current);
            sendTransport.current = deviceRef.current!.createSendTransport({
                id: params.id,
                iceParameters: params.iceParameters,
                iceCandidates: params.iceCandidates,
                dtlsParameters: params.dtlsParameters,
                iceServers,
            });
            console.log('ddss', sendTransport.current)
            sendTransport.current.on("connect", ({ dtlsParameters }, callback, errback) => {
                console.log('Send transport connect event triggered, emitting connectTransport');
                socketRef.current?.emit("connectTransport", {
                roomId,
                transportId: sendTransportParams.current!.id,
                dtlsParameters
                }, (res: any) => {
                if (res.error) {
                    console.error('Failed to connect send transport:', res.error);
                    return errback(res.error);
                }
                console.log('Send transport connected successfully');
                callback();
                });
            });
    
            sendTransport.current.on("produce", async (parameters, callback, errback) => {
                if (!socketRef.current) {
                console.warn('Cannot produce: Socket not available');
                return;
                }
                console.log('Send transport produce event triggered for kind:', parameters.kind);
                socketRef.current.emit("produce", {
                    roomId,
                    transportId: sendTransportParams.current!.id,
                    kind: parameters.kind,
                    rtpParameters: parameters.rtpParameters,
                    appData: { clientId: socketRef.current.id, peerId: socketRef.current.id}
                }, (response: any) => {
                    if (response.error) {
                        console.error('Failed to produce:', response.error);
                        return errback(response.error);
                    }
                    console.log('Successfully produced, producer ID:', response.id);
                    callback({ id: response.id });
                });
            });

            sendTransport.current.on('connectionstatechange', (state) => {
              console.log('Send transport connection ICE state:', state);
            });
    
            sendTransport.current.on('icegatheringstatechange', (state) => {
              console.log('Send transport ICE gathering state:', state);
            });
            sendTransport.current.on('icecandidateerror', (state) => {
              console.log('Send error ICE state:', state);
            });

            // if (!localStreamRef.current) {
            //     console.warn('No local stream available for producing');
            //     return;
            // }
            console.log('Getting audio and video tracks from local stream');
            // … inside the callback for createWebRtcTransport …
            const audioTrack = localStreamRef.current!.getAudioTracks()[0];
            const videoTrack = localStreamRef.current!.getVideoTracks()[0];

            try {
              if (!localStreamRef.current) return;
              console.log('Producing audio track', audioTrack, deviceRef.current?.canProduce('audio'), videoTrack);
              const audioProducer = await sendTransport.current!.produce({ track: audioTrack });
              console.log('Audio producer created with ID:', audioProducer.id);

              console.log('Producing video track');
              const videoProducer = videoTrack && await sendTransport.current!.produce({ 
                track: videoTrack,
                encodings   :
                [
                  { maxBitrate: 100000 },
                  { maxBitrate: 300000 },
                  { maxBitrate: 900000 }
                ],
                codecOptions :
                {
                  videoGoogleStartBitrate : 1000
                }
              });
              console.log('Video producer created with ID:', videoProducer.id);
            } catch (err) {
              console.error('Error while producing tracks:', err);
              alert('failed to start audio or video streaming')
            }

        } catch (error) {
            console.error('Error setting up producer transport:', error);
        }
    });

    let creatingRecvTransport: Promise<void> | null = null;

    socketRef.current.on("newProducer", async ({ producerId, kind, appData }: NewProducerData) => {
      console.log('New producer event received, producerId:', producerId, 'kind:', kind);
      if (!recvTransport.current) {
        if (!creatingRecvTransport) {
          creatingRecvTransport = new Promise((resolve, reject) => {
            socketRef.current!.emit("createWebRtcTransport", {
              roomId,
              clientRtpCapabilities: deviceRef.current!.rtpCapabilities,
              direction: "recv"
            }, async (params: TransportData) => {
              try {
                console.log('Received receive transport parameters:', params);
                recvTransportParams.current = params;
                recvTransport.current = deviceRef.current!.createRecvTransport({
                  id: params.id,
                  iceParameters: params.iceParameters,
                  iceCandidates: params.iceCandidates,
                  dtlsParameters: params.dtlsParameters,
                  iceServers,
                });

                recvTransport.current.on("connect", ({ dtlsParameters }, callback, errback) => {
                  socketRef.current!.emit("connectTransport", {
                    roomId,
                    transportId: recvTransportParams.current!.id,
                    dtlsParameters
                  }, (res: any) => {
                  if (res.error) {
                      console.error('Failed to connect receive transport:', res.error);
                      return errback(res.error);
                    }
                    console.log('Receive transport connected successfully');
                    callback();
                  });
                });

                recvTransport.current.on('connectionstatechange', (state) => {
                  console.log('Receive transport connection state:', state);
                });
                resolve();
              } catch (error) {
                console.error('Error creating receive transport:', error);
                reject(error);
              }
            });
          });
        }
        await creatingRecvTransport;
      }
      console.log('Consuming producer with ID:', producerId);
      await consume(producerId, kind, appData.peerId);
    });

    socketRef.current.on("producerClosed", ({ producerId }: any) => {
      console.log('Producer closed event received, producerId:', producerId);
      const consumer = consumerList.get(producerId);
      if (consumer) {
        console.log('Closing consumer for producerId:', producerId);
        consumer.close();
        console.log('Removing consumer from consumerList');
        consumerList.delete(producerId);
      }
    });

    socketRef.current.emit('getProducers', {
      roomId,
      clientRtpCapabilities: deviceRef.current!.rtpCapabilities
    }, (response: any) => {
      if(response.error) {
        console.error(response.error)
      }
    })
  };

  async function consume(producerId: string, kind: string, peerId: string) {
   if (!socketRef.current) return;

   socketRef.current.emit(
    "consume",
    {
      roomId,
      consumerTransportId: recvTransportParams.current!.id,
      producerId,
      clientRtpCapabilities: deviceRef.current!.rtpCapabilities,
    },
    async (params: ConsumerData) => {
      if (params.error) {
        console.error(params.error);
        return;
      }

      // 1) Actually create the Consumer (paused:true on server side)
      const consumer = await recvTransport.current!.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
        streamId: `${peerId}-av`,
      });

      // Keep track so we can close later if needed
      consumerList.set(producerId, consumer);

      // 🛑 Do NOT add consumer.track to MediaStream yet!

      // 2) Ask the server to resume this consumer, then resume locally
      socketRef.current!.emit(
        "consumerResume",
        { roomId, consumerId: consumer.id },
        async (res: any) => {
          if (res.error) {
            console.error("Server failed to resume consumer:", res.error);
            return;
          }

          // Now that server‐side has unpaused, unpause client‐side
          await consumer.resume();

          // 📣 The track is now live. Do track‐level sanity checks:
          console.log(
            `Consumer ${consumer.id} resumed, track kind=${consumer.track.kind}, paused? ${consumer.paused} ${peerId}`
          );

          // Add a tiny timeout so the RTP pipelines are fully attached
          setTimeout(() => {
            if (consumer.kind === "video") {
              console.log("Client: emitting requestKeyFrame for", consumer.id);
              socketRef.current!.emit("requestKeyFrame", {
                roomId,
                consumerId: consumer.id,
              });
            }
          }, 50)

          // Listen for the 'unmute' event on the track
          consumer.track.onunmute = () => {
            console.log(`Track for consumer ${consumer.id} is unmuted and media should be playing.`);
          };

          // Listen for the 'mute' event if you want to detect interruptions
          consumer.track.onmute = () => {
            console.log(`Track for consumer ${consumer.id} is muted. Media stopped. ${consumer.kind} ${consumer.track}`);
          };

          // Optionally, listen for track end
          consumer.track.onended = () => {
            console.log(`Track for consumer ${consumer.id} has ended.`);
          };

          // 3) ONLY AFTER resume(), add the track to a fresh (or existing) MediaStream:
          setRemoteStreams((prev) => {
            // Copy the old map
            const newStreams = { ...prev };
            let ms = newStreams[peerId];

            // If no MediaStream existed yet, create it now
            if (!ms) {
                ms = new MediaStream();
            }
            // Add the freshly resumed track
            ms.addTrack(consumer.track);
            newStreams[peerId] = ms;

            // Return a brand‐new object so React re‑renders
            return newStreams;
          });
        }
      );
    }
   );
  }

  return (
  <Box flex="column">
    <video
      ref={localVideoRef}
      autoPlay
      playsInline
      style={{ zIndex: 10101, background: "white", transform: 'scaleX(-1)' }}
    />

    <Box id="remoteContainer">
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <VideoPlayer key={peerId} stream={stream} peerId={peerId} />
      ))}
    </Box>
  </Box>
);

};

export default App;