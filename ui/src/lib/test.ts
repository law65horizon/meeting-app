// https://grok.com/share/c2hhcmQtMg%3D%3D_c191e338-aadd-4639-8dbd-e69dd37db6c5

import { useCallback } from "react";
import {
  db,
  onMeetingUpdate,
  setMeetingOffer,
  setMeetingAnswer,
  addIceCandidate,
  setMessage,
} from "./firebase";
import { doc, getDoc } from "firebase/firestore";

let localstream: MediaStream | null = null;
let localVideo: HTMLVideoElement | null = null;
let startButton: HTMLButtonElement | null = null;
let leaveCallButton: HTMLButtonElement | null = null;
let remoteContainer: HTMLDivElement | null = null;
let pppsts: any;
let pppstssss: any;

const peerConnections: { [peerId: string]: RTCPeerConnection } = {};
let myId: string
let roomId: string
let unsubscribe: (() => void) | null = null;
let isHost: boolean = false;
const processedAnswerVersions: { [peerId: string]: number } = {};
const initiatedCalls: Set<string> = new Set();
const processingAnswers: Set<string> = new Set(); // Lock for concurrent answer processing
let isStreamStarted: boolean = false; // Prevent multiple start calls

export function initController(
  local: any,
  participants: any,
  meetingId: string,
) {
  if (
    !local ||
    !participants ||
    !Array.isArray(participants) ||
    participants.length === 0
  ) {
    console.error("Invalid initialization data:", { local, participants });
    return;
  }

  // Retry finding DOM elements
  const maxRetries = 5;
  let retryCount = 0;
  const findElements = () => {
    localVideo = document.getElementById(`${local?.name}`) as HTMLVideoElement;
    remoteContainer = document.getElementById(
      "remoteContainer",
    ) as HTMLDivElement;
    startButton = document.getElementById("startButton") as HTMLButtonElement;
    leaveCallButton = document.getElementById(
      "leaveCallButton",
    ) as HTMLButtonElement;

    if (!localVideo || !remoteContainer || !startButton || !leaveCallButton) {
      console.error("DOM elements missing:", {
        localVideo: !!localVideo,
        remoteContainer: !!remoteContainer,
        startButton: !!startButton,
        leaveCallButton: !!leaveCallButton,
      });
      // if (retryCount < maxRetries) {
      //   retryCount++;
      //   setTimeout(findElements, 100);
      // } else {
      //   console.error('Failed to find DOM elements after retries');
      // }
      // return;
    }

    pppsts = local;
    myId = local?.id;
    pppstssss = participants;
    roomId = meetingId || "default-room";

    if (localstream) {
      localVideo.srcObject = localstream;
    }

    setupSignaling();
  };

  findElements();
}

async function setupSignaling() {
  const meetingRef = doc(db, "meetings", roomId);
  const meetingDoc = await getDoc(meetingRef);
  if (!meetingDoc.exists()) {
    console.error("Meeting not found");
    return;
  }
  const meetingData = meetingDoc.data();
  isHost = meetingData.hostId === myId;
  console.log("Setup signaling:", { roomId, myId, isHost });

  let lastUpdateTime = 0;
  const debounceDelay = 200; // Increased to 200ms

  unsubscribe = onMeetingUpdate(roomId, async (data) => {
    if(!data.signaling_message) {
      return
    } else console.log('working')
    const signaling_message = data.signaling_message
    const now = Date.now();
    if (now - lastUpdateTime < debounceDelay) {
      console.log("Debouncing meeting update");
      return;
    }
    lastUpdateTime = now;

    if (!localstream) {
      console.log("Local stream not ready yet");
      return;
    }
    console.log('siiis', signaling_message, data)
    if(signaling_message.from === myId) return


    if (signaling_message.type === 'ready' && !peerConnections[signaling_message.from] && !initiatedCalls.has(signaling_message.from)) {
      initiatedCalls.add(signaling_message.from)
      await makeCall(signaling_message.from)
    }

    if(signaling_message.target === myId) {
      if (signaling_message.type === 'offer') {
        const existingConnection = peerConnections[data.hostId];
        if (
          !existingConnection ||
          existingConnection.signalingState === "stable"
        ) {
          console.log("Handling offer from host:", data.hostId);
          await handleOffer({
            from: signaling_message.from,
            sdp: signaling_message.offer.sdp,
            // version: signaling_message.offerVersion || 0,
          });
        } else {
          console.log(
            "Skipping offer: connection exists or not in stable state",
            {
              signalingState: existingConnection?.signalingState,
            },
          );
        }
      }
  
      if (signaling_message.type === 'answer') {
        const remotePeerId = data.participants.find((id: string) => id !== myId);
        const existingConnection = peerConnections[remotePeerId];
        if (
          existingConnection &&
          existingConnection.signalingState === "have-local-offer"
        ) {
          const currentVersion = data.answerVersion || 0;
          const lastVersion = processedAnswerVersions[remotePeerId] || 0;
          if (
            !processingAnswers.has(remotePeerId)
          ) {
            console.log(
              "Handling answer from:",
              remotePeerId,
              "version:",
              currentVersion,
            );
            processingAnswers.add(remotePeerId);
            await handleAnswer({
              from: remotePeerId,
              sdp: signaling_message.answer.sdp,
              // version: currentVersion,
            });
            processingAnswers.delete(remotePeerId);
          } else {
            console.log("Skipping answer:", {
              remotePeerId,
              currentVersion,
              lastVersion,
              isProcessing: processingAnswers.has(remotePeerId),
            });
          }
        } else {
          console.log("Skipping answer: no connection or wrong state", {
            remotePeerId,
            signalingState: existingConnection?.signalingState,
          });
        }
      }
  
      if (signaling_message.type === 'candidate') {
        const remotePeerId = signaling_message.from
        console.log("Handling ICE candidate from:", remotePeerId);
        await handleCandidate({ from: remotePeerId, candidate: signaling_message.candidate });
      }
    }
  });
}

export const getlocalStream = () => {
  return localstream;
};

export const start = async (meetingId: string, local_id: string) => {
  if (isStreamStarted) {
    console.log('Stream already started, skipping');
    return localstream;
  }
  // if(!roomId) {
  //   roomId = 
  // }
  if(!meetingId || !local_id) return
  console.log(meetingId)
  if(!roomId) roomId = meetingId
  if(!myId) myId = local_id

  try {
    localstream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    if (localVideo) {
      localVideo.srcObject = localstream;
    }
    isStreamStarted = true;
    console.log('Local stream started',myId, roomId);
    if(roomId) {
      console.log('roomId', roomId, meetingId)
      setMessage(roomId, {type: 'ready', from: myId})
    }
    return localstream;
  } catch (err) {
    console.error('Error accessing media devices.', err);
    return null;
  }
};

// export const start = async () => {
//   if (isStreamStarted) {
//     console.log("Stream already started, skipping");
//     return localstream;
//   }

//   try {
//     localstream = await navigator.mediaDevices.getUserMedia({
//       audio: true,
//       video: true,
//     });
//     if (localVideo) {
//       localVideo.srcObject = localstream;
//     }
//     isStreamStarted = true;
//     console.log("Local stream started");
//     if(roomId && myId) {
//       setMessage(roomId, {type: 'ready',from: myId})
//     }else {
//       throw new Error('mmosioiewo')
//       console.log('wtf going on')
//     }
//     return localstream;
//   } catch (err) {
//     console.error("Error accessing media devices.", err);
//     return null;
//   }
// };

export const end = async () => {
  for (const peerId in peerConnections) {
    hangup(peerId);
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  initiatedCalls.clear();
  processingAnswers.clear();
  isStreamStarted = false;
  console.log("Meeting ended");
};

export const closeConnection = (cc: any) => {
  return cc;
};

export const initializeLocalStream = (cc: any) => {
  return cc;
};

export const createPeerConnection = async (peerId: string) => {
  if (
    peerConnections[peerId] &&
    peerConnections[peerId].signalingState !== "closed"
  ) {
    console.log("Reusing existing peer connection for:", peerId);
    return peerConnections[peerId];
  }

  const pc = new RTCPeerConnection();
  peerConnections[peerId] = pc;

  pc.onicecandidate = async (e: RTCPeerConnectionIceEvent) => {
    if (e.candidate) {
      const candidateData = e.candidate.toJSON();
      console.log("Sending ICE candidate for:", peerId);
      // await addIceCandidate(roomId, candidateData, isHost, myId, peerId);
      await setMessage(roomId, {type: 'candidate', candidate: candidateData, from: myId, target: peerId})
    }
  };

  pc.ontrack = (e: RTCTrackEvent) => {
    const stream = e.streams[0];
    const participant = pppstssss?.find((item: any) => item.id === peerId);
    const containerId = participant
      ? `remote_${participant.name}`
      : `remote_${peerId}`;
    let remoteContainer = document.getElementById(
      containerId,
    ) as HTMLDivElement;
    let remoteVideo = document.getElementById(
      "remote_" + peerId,
    ) as HTMLVideoElement;

    if (!participant) {
      console.warn(
        "Participant not found for peerId:",
        peerId,
        "using fallback container ID:",
        containerId,
      );
    }

    if (!remoteVideo) {
      remoteVideo = document.createElement("video");
      remoteVideo.id = "remote_" + peerId;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      if (remoteContainer) {
        remoteContainer.appendChild(remoteVideo);
      } else {
        console.warn("Remote container not found:", containerId);
      }
    }
    if (remoteVideo.srcObject !== stream) {
      remoteVideo.srcObject = stream;
      remoteVideo.play().catch((error) => {
        console.error("Playback error:", error);
      });
    }
  };

  localstream?.getTracks().forEach((track: MediaStreamTrack) => {
    pc.addTrack(track, localstream as MediaStream);
  });

  return pc;
};

export const makeCall = async (peerId: string) => {
  if (
    peerConnections[peerId] &&
    peerConnections[peerId].signalingState !== "stable"
  ) {
    console.log(
      "Skipping makeCall: connection already exists and not stable for",
      peerId,
    );
    return;
  }

  const pc = await createPeerConnection(peerId);
  if (!pc) return;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // if (isHost) {
  //   console.log("Creating offer for:", peerId);
  //   await setMeetingOffer(roomId, offer, myId, peerId);
  // }
  await setMessage(roomId, {type: 'offer', offer: offer, from: myId, target: peerId})
};

async function hangup(peerId: string) {
  const pc = peerConnections[peerId];
  if (pc) {
    pc.close();
    delete peerConnections[peerId];
  }
  const remoteVideo = document.getElementById("remote_" + peerId);
  if (remoteVideo && remoteContainer) {
    remoteContainer.removeChild(remoteVideo);
  }
  console.log("Hung up connection with:", peerId);
}

async function handleOffer(message: any) {
  try {
    const remotePeerId = message.from;
    if (peerConnections[remotePeerId]) {
      console.warn("Existing peer connection with", remotePeerId);
      return;
    }
    const pc = await createPeerConnection(remotePeerId);
    if (!pc) return;

    console.log("Setting remote offer from:", remotePeerId);
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: "offer", sdp: message.sdp }),
    );
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log("Sending answer to:", remotePeerId);
    // await setMeetingAnswer(roomId, answer, myId, remotePeerId);
    await setMessage(roomId, {type: 'answer', answer: answer, from: myId, target: remotePeerId})
  } catch (error) {
    console.error("Error handling offer:", error);
  }
}

async function handleAnswer(message: any) {
  const remotePeerId = message.from;
  const pc = peerConnections[remotePeerId];
  if (!pc) {
    console.error("No peer connection for answer from", remotePeerId);
    return;
  }

  if (pc.signalingState !== "have-local-offer") {
    console.warn(
      `Unexpected signaling state (${pc.signalingState}) for peer ${remotePeerId}`,
    );
    return;
  }

  try {
    console.log(
      "Setting remote answer from:",
      remotePeerId,
      "version:",
      message.version,
    );
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: "answer", sdp: message.sdp }),
    );
    processedAnswerVersions[remotePeerId] = message.version; // Update version after success
  } catch (error) {
    console.error("Error setting remote description:", error);
  }
}

async function handleCandidate(message: any) {
  console.log("candidatemessage", message);
  const remotePeerId = message.from;
  const pc = peerConnections[remotePeerId];
  if (!pc) {
    console.error("No peer connection for ICE candidate from", remotePeerId);
    return;
  }
  if (message.candidate) {
    try {
      await pc.addIceCandidate(message.candidate);
    } catch (e) {
      console.error("Error adding received ICE candidate", e);
    }
  }
}
