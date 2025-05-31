


// import { useCallback } from "react";
// import { db, onMeetingUpdate, setMeetingOffer, setMeetingAnswer, addIceCandidate } from "./firebase";
// import { doc, getDoc } from "firebase/firestore";

// let localstream: MediaStream | null = null;
// let localVideo: HTMLVideoElement | null = null;
// let startButton: HTMLButtonElement | null = null;
// let leaveCallButton: HTMLButtonElement | null = null;
// let remoteContainer: HTMLDivElement | null = null;
// let pppsts: any;
// let pppstssss: any;

// const peerConnections: { [peerId: string]: RTCPeerConnection } = {};
// let myId: string = Math.random().toString(36).substring(2, 15);
// let roomId: string = "default-room";
// let unsubscribe: (() => void) | null = null;
// let isHost: boolean = false;
// const processedAnswerVersions: { [peerId: string]: number } = {};
// const initiatedCalls: Set<string> = new Set();
// const processingAnswers: Set<string> = new Set(); // Lock for concurrent answer processing
// let isStreamStarted: boolean = false; // Prevent multiple start calls

// export function initController(local: any, participants: any, meetingId: string) {
//   if (!local || !participants || !Array.isArray(participants) || participants.length === 0) {
//     console.error('Invalid initialization data:', { local, participants });
//     return;
//   }

//   // Retry finding DOM elements
//   const maxRetries = 5;
//   let retryCount = 0;
//   const findElements = () => {
//     localVideo = document.getElementById(`${local?.name}`) as HTMLVideoElement;
//     remoteContainer = document.getElementById('remoteContainer') as HTMLDivElement;
//     startButton = document.getElementById('startButton') as HTMLButtonElement;
//     leaveCallButton = document.getElementById('leaveCallButton') as HTMLButtonElement;

//     if (!localVideo || !remoteContainer || !startButton || !leaveCallButton) {
//       console.error('DOM elements missing:', {
//         localVideo: !!localVideo,
//         remoteContainer: !!remoteContainer,
//         startButton: !!startButton,
//         leaveCallButton: !!leaveCallButton,
//       });
//       // if (retryCount < maxRetries) {
//       //   retryCount++;
//       //   setTimeout(findElements, 100);
//       // } else {
//       //   console.error('Failed to find DOM elements after retries');
//       // }
//       // return;
//     }

//     pppsts = local;
//     myId = local?.id;
//     pppstssss = participants;
//     roomId = meetingId || "default-room";

//     if (localstream) {
//       localVideo.srcObject = localstream;
//     }

//     setupSignaling();
//   };

//   findElements();
// }

// async function setupSignaling() {
//   const meetingRef = doc(db, "meetings", roomId);
//   const meetingDoc = await getDoc(meetingRef);
//   if (!meetingDoc.exists()) {
//     console.error("Meeting not found");
//     return;
//   }
//   const meetingData = meetingDoc.data();
//   isHost = meetingData.hostId === myId;
//   console.log('Setup signaling:', { roomId, myId, isHost });

//   let lastUpdateTime = 0;
//   const debounceDelay = 200; // Increased to 200ms

//   unsubscribe = onMeetingUpdate(roomId, async (data) => {
//     const now = Date.now();
//     if (now - lastUpdateTime < debounceDelay) {
//       console.log('Debouncing meeting update');
//       return;
//     }
//     lastUpdateTime = now;

//     if (!localstream) {
//       console.log('Local stream not ready yet');
//       return;
//     }

//     console.log('Meeting update received:', {
//       participants: data.participants,
//       hasOffer: !!data.offer,
//       hasAnswer: !!data.answer,
//       hostCandidates: data.hostCandidates?.length || 0,
//       recipientCandidates: data.recipientCandidates?.length || 0,
//       answerVersion: data.answerVersion,
//     });

//     console.log('data', data)
//     const otherParticipants = data.participants.filter((id: string) => id !== myId);
//     for (const peerId of otherParticipants) {
//       if (!peerConnections[peerId] && isHost && !initiatedCalls.has(peerId)) {
//         console.log('Initiating call to', peerId);
//         initiatedCalls.add(peerId);
//         await makeCall(peerId);
//       }
//     }

//     if (data.offer && !isHost) {
//       const existingConnection = peerConnections[data.hostId];
//       if (!existingConnection || existingConnection.signalingState === 'stable') {
//         console.log('Handling offer from host:', data.hostId);
//         await handleOffer({
//           from: data.hostId,
//           sdp: data.offer.sdp,
//           version: data.offerVersion || 0,
//         });
//       } else {
//         console.log('Skipping offer: connection exists or not in stable state', {
//           signalingState: existingConnection?.signalingState,
//         });
//       }
//     }

//     if (data.answer && isHost) {
//       const remotePeerId = data.participants.find((id: string) => id !== myId);
//       const existingConnection = peerConnections[remotePeerId];
//       if (existingConnection && existingConnection.signalingState === 'have-local-offer') {
//         const currentVersion = data.answerVersion || 0;
//         const lastVersion = processedAnswerVersions[remotePeerId] || 0;
//         if (currentVersion > lastVersion && !processingAnswers.has(remotePeerId)) {
//           console.log('Handling answer from:', remotePeerId, 'version:', currentVersion);
//           processingAnswers.add(remotePeerId);
//           await handleAnswer({
//             from: remotePeerId,
//             sdp: data.answer.sdp,
//             version: currentVersion,
//           });
//           processingAnswers.delete(remotePeerId);
//         } else {
//           console.log('Skipping answer:', {
//             remotePeerId,
//             currentVersion,
//             lastVersion,
//             isProcessing: processingAnswers.has(remotePeerId),
//           });
//         }
//       } else {
//         console.log('Skipping answer: no connection or wrong state', {
//           remotePeerId,
//           signalingState: existingConnection?.signalingState,
//         });
//       }
//     }

//     const candidates = isHost ? data.recipientCandidates : data.hostCandidates;
//     if (candidates && candidates.length > 0) {
//       const remotePeerId = isHost
//         ? data.participants.find((id: string) => id !== myId)
//         : data.hostId;
//       for (const candidate of candidates) {
//         console.log('Handling ICE candidate from:', remotePeerId);
//         await handleCandidate({ from: remotePeerId, candidate });
//       }
//     }
//   });
// }

// export const getlocalStream = () => {
//   return localstream;
// };

// export const start = async () => {
//   if (isStreamStarted) {
//     console.log('Stream already started, skipping');
//     return localstream;
//   }

//   try {
//     localstream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
//     if (localVideo) {
//       localVideo.srcObject = localstream;
//     }
//     isStreamStarted = true;
//     console.log('Local stream started');
//     return localstream;
//   } catch (err) {
//     console.error('Error accessing media devices.', err);
//     return null;
//   }
// };

// export const end = async () => {
//   for (const peerId in peerConnections) {
//     hangup(peerId);
//   }
//   if (unsubscribe) {
//     unsubscribe();
//     unsubscribe = null;
//   }
//   initiatedCalls.clear();
//   processingAnswers.clear();
//   isStreamStarted = false;
//   console.log('Meeting ended');
// };

// export const closeConnection = (cc: any) => {};

// export const initializeLocalStream = (cc: any) => {};

// export const createPeerConnection = async (peerId: string) => {
//   if (peerConnections[peerId] && peerConnections[peerId].signalingState !== 'closed') {
//     console.log('Reusing existing peer connection for:', peerId);
//     return peerConnections[peerId];
//   }

//   const pc = new RTCPeerConnection();
//   peerConnections[peerId] = pc;

//   pc.onicecandidate = async (e: RTCPeerConnectionIceEvent) => {
//     if (e.candidate) {
//       const candidateData = e.candidate.toJSON();
//       console.log('Sending ICE candidate for:', peerId);
//       await addIceCandidate(roomId, candidateData, isHost);
//     }
//   };

//   pc.ontrack = (e: RTCTrackEvent) => {
//     const stream = e.streams[0];
//     const participant = pppstssss?.find((item: any) => item.id === peerId);
//     const containerId = participant ? `remote_${participant.name}` : `remote_${peerId}`;
//     let remoteContainer = document.getElementById(containerId) as HTMLDivElement;
//     let remoteVideo = document.getElementById('remote_' + peerId) as HTMLVideoElement;

//     if (!participant) {
//       console.warn('Participant not found for peerId:', peerId, 'using fallback container ID:', containerId);
//     }

//     if (!remoteVideo) {
//       remoteVideo = document.createElement('video');
//       remoteVideo.id = 'remote_' + peerId;
//       remoteVideo.autoplay = true;
//       remoteVideo.playsInline = true;
//       if (remoteContainer) {
//         remoteContainer.appendChild(remoteVideo);
//       } else {
//         console.warn('Remote container not found:', containerId);
//       }
//     }
//     if (remoteVideo.srcObject !== stream) {
//       remoteVideo.srcObject = stream;
//       remoteVideo.play().catch(error => {
//         console.error("Playback error:", error);
//       });
//     }
//   };

//   localstream?.getTracks().forEach((track: MediaStreamTrack) => {
//     pc.addTrack(track, localstream as MediaStream);
//   });

//   return pc;
// };

// export const makeCall = async (peerId: string) => {
//   if (peerConnections[peerId] && peerConnections[peerId].signalingState !== 'stable') {
//     console.log('Skipping makeCall: connection already exists and not stable for', peerId);
//     return;
//   }

//   const pc = await createPeerConnection(peerId);
//   if (!pc) return;

//   const offer = await pc.createOffer();
//   await pc.setLocalDescription(offer);
//   if (isHost) {
//     console.log('Creating offer for:', peerId);
//     await setMeetingOffer(roomId, offer);
//   }
// };

// async function hangup(peerId: string) {
//   const pc = peerConnections[peerId];
//   if (pc) {
//     pc.close();
//     delete peerConnections[peerId];
//   }
//   const remoteVideo = document.getElementById('remote_' + peerId);
//   if (remoteVideo && remoteContainer) {
//     remoteContainer.removeChild(remoteVideo);
//   }
//   console.log('Hung up connection with:', peerId);
// }

// async function handleOffer(message: any) {
//   try {
//     const remotePeerId = message.from;
//     if (peerConnections[remotePeerId]) {
//       console.warn('Existing peer connection with', remotePeerId);
//       return;
//     }
//     const pc = await createPeerConnection(remotePeerId);
//     if (!pc) return;

//     console.log('Setting remote offer from:', remotePeerId);
//     await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: message.sdp }));
//     const answer = await pc.createAnswer();
//     await pc.setLocalDescription(answer);
//     console.log('Sending answer to:', remotePeerId);
//     await setMeetingAnswer(roomId, answer);
//   } catch (error) {
//     console.error('Error handling offer:', error);
//   }
// }

// async function handleAnswer(message: any) {
//   const remotePeerId = message.from;
//   const pc = peerConnections[remotePeerId];
//   if (!pc) {
//     console.error('No peer connection for answer from', remotePeerId);
//     return;
//   }

//   if (pc.signalingState !== 'have-local-offer') {
//     console.warn(`Unexpected signaling state (${pc.signalingState}) for peer ${remotePeerId}`);
//     return;
//   }

//   try {
//     console.log('Setting remote answer from:', remotePeerId, 'version:', message.version);
//     await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: message.sdp }));
//     processedAnswerVersions[remotePeerId] = message.version; // Update version after success
//   } catch (error) {
//     console.error("Error setting remote description:", error);
//   }
// }

// async function handleCandidate(message: any) {
//   const remotePeerId = message.from;
//   const pc = peerConnections[remotePeerId];
//   if (!pc) {
//     console.error('No peer connection for ICE candidate from', remotePeerId);
//     return;
//   }
//   if (message.candidate) {
//     try {
//       await pc.addIceCandidate(message.candidate);
//     } catch (e) {
//       console.error('Error adding received ICE candidate', e);
//     }
//   }
// }


// import { useCallback } from "react";
// import { db, onMeetingUpdate, setMeetingOffer, setMeetingAnswer, addIceCandidate } from "./firebase";
// import { doc, getDoc } from "firebase/firestore";

// let localstream: MediaStream | null = null;
// let localVideo: HTMLVideoElement | null = null;
// let startButton: HTMLButtonElement | null = null;
// let leaveCallButton: HTMLButtonElement | null = null;
// let remoteContainer: HTMLDivElement | null = null;
// let pppsts: any;
// let pppstssss: any;

// const peerConnections: { [peerId: string]: RTCPeerConnection } = {};
// let myId: string = Math.random().toString(36).substring(2, 15);
// let roomId: string = "default-room";
// let unsubscribe: (() => void) | null = null;
// let isHost: boolean = false;
// let lastAnswerVersion: number = 0; // Track the latest processed answer version

// export function initController(local: any, participants: any, meetingId: string) {
//   if (!local || !participants || !Array.isArray(participants) || participants.length === 0) {
//     console.error('Invalid initialization data:', { local, participants });
//     return;
//   }

//   localVideo = document.getElementById(`${local?.name}`) as HTMLVideoElement;
//   remoteContainer = document.getElementById('remoteContainer') as HTMLDivElement;
//   startButton = document.getElementById('startButton') as HTMLButtonElement;
//   leaveCallButton = document.getElementById('leaveCallButton') as HTMLButtonElement;
//   pppsts = local;
//   myId = local?.id;
//   pppstssss = participants;
//   roomId = meetingId || "default-room";

//   if (!localVideo || !startButton || !leaveCallButton) {
//     console.error('Essential DOM elements not found during initialization');
//   }

//   if (localstream) {
//     localVideo.srcObject = localstream;
//   }

//   setupSignaling();
// }

// async function setupSignaling() {
//   const meetingRef = doc(db, "meetings", roomId);
//   const meetingDoc = await getDoc(meetingRef);
//   if (!meetingDoc.exists()) {
//     console.error("Meeting not found");
//     return;
//   }
//   const meetingData = meetingDoc.data();
//   isHost = meetingData.hostId === myId;
//   console.log('Setup signaling:', { roomId, myId, isHost }, meetingData.participants_data);

//   unsubscribe = onMeetingUpdate(roomId, async (data) => {
//     if (!localstream) {
//       console.log('Local stream not ready yet');
//       return;
//     }

//     console.log('Meeting update received:', {
//       participants: data.participants,
//       hasOffer: !!data.offer,
//       hasAnswer: !!data.answer,
//       hostCandidates: data.hostCandidates?.length || 0,
//       recipientCandidates: data.recipientCandidates?.length || 0,
//     });

//     // Handle new participants
//     const otherParticipants = data.participants.filter((id: string) => id !== myId);
//     console.log('data', data.participants_data)
//     pppstssss = data.participants_data
//     for (const peerId of otherParticipants) {
//       if (!peerConnections[peerId] && isHost) {
//         console.log('Initiating call to', peerId);
//         await makeCall(peerId);
//       }
//     }

//     // Handle offer (for recipient)
//     if (data.offer && !isHost) {
//       const existingConnection = peerConnections[data.hostId];
//       if (!existingConnection || existingConnection.signalingState === 'stable') {
//         console.log('Handling offer from host:', data.hostId);
//         await handleOffer({
//           from: data.hostId,
//           sdp: data.offer.sdp,
//           version: data.offerVersion || 0,
//         });
//       } else {
//         console.log('Skipping offer: connection exists or not in stable state', {
//           signalingState: existingConnection?.signalingState,
//         });
//       }
//     }

//     // Handle answer (for host)
//     if (data.answer && isHost) {
//       const remotePeerId = data.participants.find((id: string) => id !== myId);
//       const existingConnection = peerConnections[remotePeerId];
//       if (existingConnection && existingConnection.signalingState === 'have-local-offer') {
//         if (data.answerVersion > lastAnswerVersion) {
//           console.log('Handling answer from:', remotePeerId, 'version:', data.answerVersion);
//           await handleAnswer({
//             from: remotePeerId,
//             sdp: data.answer.sdp,
//             version: data.answerVersion,
//           });
//           lastAnswerVersion = data.answerVersion;
//         } else {
//           console.log('Skipping outdated or duplicate answer:', {
//             currentVersion: data.answerVersion,
//             lastProcessed: lastAnswerVersion,
//           });
//         }
//       } else {
//         console.log('Skipping answer: no connection or wrong state', {
//           remotePeerId,
//           signalingState: existingConnection?.signalingState,
//         });
//       }
//     }

//     // Handle ICE candidates
//     const candidates = isHost ? data.recipientCandidates : data.hostCandidates;
//     if (candidates && candidates.length > 0) {
//       const remotePeerId = isHost
//         ? data.participants.find((id: string) => id !== myId)
//         : data.hostId;
//       for (const candidate of candidates) {
//         console.log('Handling ICE candidate from:', remotePeerId);
//         await handleCandidate({ from: remotePeerId, candidate });
//       }
//     }
//   });
// }

// export const getlocalStream = () => {
//   return localstream;
// };

// export const start = async () => {
//   try {
//     localstream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
//     if (localVideo) {
//       localVideo.srcObject = localstream;
//     }
//     console.log('Local stream started');
//     return localstream;
//   } catch (err) {
//     console.error('Error accessing media devices.', err);
//     return null;
//   }
// };

// export const end = async () => {
//   for (const peerId in peerConnections) {
//     hangup(peerId);
//   }
//   if (unsubscribe) {
//     unsubscribe();
//     unsubscribe = null;
//   }
//   console.log('Meeting ended');
// };

// export const closeConnection = (cc: any) => {};

// export const initializeLocalStream = (cc: any) => {};

// export const createPeerConnection = async (peerId: string) => {
//   const pc = new RTCPeerConnection();
//   peerConnections[peerId] = pc;

//   pc.onicecandidate = async (e: RTCPeerConnectionIceEvent) => {
//     if (e.candidate) {
//       const candidateData = e.candidate.toJSON();
//       console.log('Sending ICE candidate for:', peerId);
//       await addIceCandidate(roomId, candidateData, isHost);
//     }
//   };

//   pc.ontrack = (e: RTCTrackEvent) => {
//     const stream = e.streams[0];
//     console.log(pppstssss)
//     const participant = pppstssss?.find((item: any) => item.id === peerId);
//     const containerId = participant ? `remote_${participant.name}` : `remote_${peerId}`;
//     let remoteContainer = document.getElementById(containerId) as HTMLDivElement;
//     let remoteVideo = document.getElementById('remote_' + peerId) as HTMLVideoElement;

//     if (!participant) {
//       console.warn('Participant not found for peerId:', peerId, 'using fallback container ID:', containerId);
//     }

//     if (!remoteVideo) {
//       remoteVideo = document.createElement('video');
//       remoteVideo.id = 'remote_' + peerId;
//       remoteVideo.autoplay = true;
//       remoteVideo.playsInline = true;
//       if (remoteContainer) {
//         remoteContainer.appendChild(remoteVideo);
//       } else {
//         console.warn('Remote container not found:', containerId);
//       }
//     }
//     if (remoteVideo.srcObject !== stream) {
//       remoteVideo.srcObject = stream;
//       remoteVideo.play().catch(error => {
//         console.error("Playback error:", error);
//       });
//     }
//   };

//   localstream?.getTracks().forEach((track: MediaStreamTrack) => {
//     pc.addTrack(track, localstream as MediaStream);
//   });

//   return pc;
// };

// export const makeCall = async (peerId: string) => {
//   const pc = await createPeerConnection(peerId);
//   if (!pc) return;

//   const offer = await pc.createOffer();
//   await pc.setLocalDescription(offer);
//   if (isHost) {
//     console.log('Creating offer for:', peerId);
//     await setMeetingOffer(roomId, offer);
//   }
// };

// async function hangup(peerId: string) {
//   const pc = peerConnections[peerId];


//  if (pc) {
//     pc.close();
//     delete peerConnections[peerId];
//   }
//   const remoteVideo = document.getElementById('remote_' + peerId);
//   if (remoteVideo && remoteContainer) {
//     remoteContainer.removeChild(remoteVideo);
//   }
//   console.log('Hung up connection with:', peerId);
// }

// async function handleOffer(message: any) {
//   try {
//     const remotePeerId = message.from;
//     if (peerConnections[remotePeerId]) {
//       console.warn('Existing peer connection with', remotePeerId);
//       return;
//     }
//     const pc = await createPeerConnection(remotePeerId);
//     if (!pc) return;

//     console.log('Setting remote offer from:', remotePeerId);
//     await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: message.sdp }));
//     const answer = await pc.createAnswer();
//     await pc.setLocalDescription(answer);
//     console.log('Sending answer to:', remotePeerId);
//     await setMeetingAnswer(roomId, answer);
//   } catch (error) {
//     console.error('Error handling offer:', error);
//   }
// }

// async function handleAnswer(message: any) {
//   const remotePeerId = message.from;
//   const pc = peerConnections[remotePeerId];
//   if (!pc) {
//     console.error('No peer connection for answer from', remotePeerId);
//     return;
//   }

//   if (pc.signalingState !== 'have-local-offer') {
//     console.warn(`Unexpected signaling state (${pc.signalingState}) for peer ${remotePeerId}`);
//     return;
//   }

//   try {
//     console.log('Setting remote answer from:', remotePeerId);
//     await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: message.sdp }));
//   } catch (error) {
//     console.error("Error setting remote description:", error);
//   }
// }

// async function handleCandidate(message: any) {
//   const remotePeerId = message.from;
//   const pc = peerConnections[remotePeerId];
//   if (!pc) {
//     console.error('No peer connection for ICE candidate from', remotePeerId);
//     return;
//   }
//   if (message.candidate) {
//     try {
//       await pc.addIceCandidate(message.candidate);
//     } catch (e) {
//       console.error('Error adding received ICE candidate', e);
//     }
//   }
// }



import { useEffect, useRef, useState, useCallback } from "react";
import {
  setMeetingOffer,
  setMeetingAnswer,
  addIceCandidate,
  onMeetingUpdate,
  endMeeting,
  auth,
} from "./firebase";
import { toast } from "sonner";

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(meetingId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const hasRemoteStreamRef = useRef(false);

  // Add refs to track processed signaling data
  const processedOfferRef = useRef<string | null>(null);
  const processedAnswerRef = useRef<string | null>(null);
  const processedCandidatesRef = useRef(new Set<string>());
  const bufferedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isCreatingOfferRef = useRef(false);
  const offerTimeoutRef = useRef<number | null>(null);
  const lastOfferTimeRef = useRef<number | null>(null);

  const processedOfferVersionRef = useRef(0);
  const processedAnswerVersionRef = useRef(0);

  const createPeerConnection = useCallback(() => {
    try {
      if (peerConnectionRef.current) {
        console.log("Closing existing peer connection");
        peerConnectionRef.current.close();
      }

      console.log("Creating new peer connection");
      const pc = new RTCPeerConnection(configuration);

      pc.ontrack = (event) => {
        console.log("Track received:", event.track.kind);

        if (!hasRemoteStreamRef.current) {
          console.log("Creating new remote stream");
          const stream = new MediaStream();
          remoteStreamRef.current = stream;
          setRemoteStream(stream);
          hasRemoteStreamRef.current = true;
        }

        if (remoteStreamRef.current) {
          console.log(`Adding ${event.track.kind} track to remote stream`);
          remoteStreamRef.current.addTrack(event.track);
        }
      };

      pc.onicecandidate = async (event) => {
        if (!meetingId || !event.candidate) return;

        try {
          const isHost = auth.currentUser?.uid === meetingId.split("-")[0];
          console.log("Sending ICE candidate:", {
            isHost,
            candidate: event.candidate,
          });
          await addIceCandidate(meetingId, event.candidate.toJSON(), isHost);
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        switch (pc.iceConnectionState) {
          case "connected":
          case "completed":
            setIsConnected(true);
            break;
          case "failed":
            setIsConnected(false);
            toast.error("Connection failed");
            break;
          case "disconnected":
            setIsConnected(false);
            toast.error("Peer disconnected");
            break;
        }
      };

      pc.onsignalingstatechange = () => {
        console.log("Signaling state changed:", pc.signalingState);
      };

      // Add existing local tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`Adding local ${track.kind} track to peer connection`);
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
          }
        });
      }

      peerConnectionRef.current = pc;
      return pc;
    } catch (err: any) {
      console.error("Error creating peer connection:", err);
      setError("Failed to create peer connection: " + err.message);
      return null;
    }
  }, [meetingId]);

  const initializeLocalStream = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      console.log("Requesting user media");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log(
        "Got local stream with tracks:",
        stream
          .getTracks()
          .map((t) => t.kind)
          .join(", "),
      );
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = peerConnectionRef.current || createPeerConnection();
      if (pc) {
        // Remove existing tracks
        const senders = pc.getSenders();
        senders.forEach((sender) => pc.removeTrack(sender));

        // Add new tracks
        stream.getTracks().forEach((track) => {
          console.log(`Adding ${track.kind} track to peer connection`);
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
          }
        });
      }

      return stream;
    } catch (err: any) {
      console.error("Media device error:", err);
      setError("Failed to access media devices: " + err.message);
      toast.error("Failed to access camera or microphone");
      return null;
    }
  }, [createPeerConnection]);

  const processBufferedCandidates = useCallback(() => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    const bufferedCandidates = bufferedCandidatesRef.current || [];
    if (bufferedCandidates.length > 0) {
      console.log(
        `Processing ${bufferedCandidates.length} buffered ICE candidates`,
      );

      bufferedCandidates.forEach((candidate) => {
        const candidateKey = JSON.stringify(candidate);
        if (!processedCandidatesRef.current.has(candidateKey)) {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .then(() => {
              processedCandidatesRef.current.add(candidateKey);
            })
            .catch((err) =>
              console.error("Error adding buffered ICE candidate:", err),
            );
        }
      });

      // Clear the buffer
      bufferedCandidatesRef.current = [];
    }
  }, []);

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      if (!meetingId) return null;

      // Generate a unique identifier for this offer to avoid processing it multiple times
      const offerKey = JSON.stringify(offer);
      if (processedOfferRef.current === offerKey) {
        console.log("Skipping already processed offer");
        return null;
      }

      try {
        const pc = peerConnectionRef.current || createPeerConnection();
        if (!pc) throw new Error("No peer connection");

        console.log("Setting remote description (offer):", offer.type);
        await pc.setRemoteDescription(offer);

        processBufferedCandidates();

        console.log("Creating answer");
        const answer = await pc.createAnswer();

        console.log("Setting local description (answer):", answer.type);
        await pc.setLocalDescription(answer);

        console.log("Sending answer to remote peer");
        await setMeetingAnswer(meetingId, answer);

        // Mark this offer as processed
        processedOfferRef.current = offerKey;
        return answer;
      } catch (err: any) {
        console.error("Error handling offer:", err);
        setError("Failed to handle offer: " + err.message);
        return null;
      }
    },
    [meetingId, createPeerConnection, processBufferedCandidates],
  );

  const handleAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      // Generate a unique identifier for this answer to avoid processing it multiple times
      const answerKey = JSON.stringify(answer);
      if (processedAnswerRef.current === answerKey) {
        console.log("Skipping already processed answer");
        return;
      }

      try {
        const pc = peerConnectionRef.current;
        if (!pc) throw new Error("No peer connection");

        if (pc.signalingState === "have-local-offer") {
          console.log("Setting remote description (answer):", answer.type);
          await pc.setRemoteDescription(answer);
          processedAnswerRef.current = answerKey;

          processBufferedCandidates();
        } else {
          console.warn(
            "Ignoring answer - not in have-local-offer state",
            pc.signalingState,
          );
        }
      } catch (err: any) {
        console.error("Error handling answer:", err);
        setError("Failed to handle answer: " + err.message);
      }
    },
    [processBufferedCandidates],
  );

  const handleIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    // Generate a unique identifier for this candidate
    const candidateKey = JSON.stringify(candidate);
    if (processedCandidatesRef.current.has(candidateKey)) {
      return;
    }

    try {
      // Only add if remote description is set
      if (pc.remoteDescription && pc.remoteDescription.type) {
        console.log("Adding ICE candidate to connection");
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .then(() => {
            processedCandidatesRef.current.add(candidateKey);
          })
          .catch((err) => console.error("Error adding ICE candidate:", err));
      } else {
        // Buffer the candidate for later
        console.log("Buffering ICE candidate - remote description not set yet");
        bufferedCandidatesRef.current = [
          ...(bufferedCandidatesRef.current || []),
          candidate,
        ];
      }
    } catch (err) {
      console.error("Failed to handle ICE candidate:", err);
    }
  }, []);

  const resetSignalingState = useCallback(() => {
    processedOfferRef.current = null;
    processedAnswerRef.current = null;
    bufferedCandidatesRef.current = []; // Clear buffered candidates too
    processedCandidatesRef.current.clear();
    isCreatingOfferRef.current = false;

    if (offerTimeoutRef.current !== null) {
      window.clearTimeout(offerTimeoutRef.current);
      offerTimeoutRef.current = null;
    }
  }, []);

  const closeConnection = useCallback(
    async (isInitiator = false) => {
      console.log("Closing WebRTC connection");

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }

      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
        setRemoteStream(null);
        hasRemoteStreamRef.current = false;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      resetSignalingState();

      if (meetingId && isInitiator) {
        await endMeeting(meetingId);
      }

      setIsConnected(false);
      setError(null);
    },
    [meetingId, resetSignalingState],
  );

  useEffect(() => {
    if (!meetingId) return;

    console.log("Setting up meeting listener for:", meetingId);
    resetSignalingState();

    const unsubscribe = onMeetingUpdate(meetingId, async (data) => {
      if (!data) {
        console.warn("Received empty meeting data");
        return;
      }

      if (data.status === "ended") {
        console.log("Meeting has ended, closing connection");
        closeConnection(false);
        return;
      }

      const pc = peerConnectionRef.current || createPeerConnection();
      if (!pc) return;

      try {
        const isHost = data.hostId === auth.currentUser?.uid;
        const currentSignalingState = pc.signalingState;

        console.log("Processing meeting update:", {
          isHost,
          signalingState: currentSignalingState,
          hasOffer: !!data.offer,
          hasAnswer: !!data.answer,
        });

        // Handle offer (for recipient only)
        if (
          !isHost &&
          data.offer &&
          data.offerVersion > processedOfferVersionRef.current
        ) {
          console.log(
            "Processing new offer as recipient, version:",
            data.offerVersion,
          );
          await handleOffer(data.offer);
          processedOfferVersionRef.current = data.offerVersion;
        }

        // Handle answer (for host only)
        if (
          isHost &&
          data.answer &&
          data.answerVersion > processedAnswerVersionRef.current
        ) {
          console.log(
            "Processing new answer as host, version:",
            data.answerVersion,
          );
          await handleAnswer(data.answer);
          processedAnswerVersionRef.current = data.answerVersion;
        }

        // Handle ICE candidates from remote peer
        const remoteCandidates = isHost
          ? data.recipientCandidates
          : data.hostCandidates;
        if (remoteCandidates?.length) {
          // Process any new candidates we haven't seen before
          const candidatesToProcess = remoteCandidates.filter((candidate) => {
            const candidateKey = JSON.stringify(candidate);
            return !processedCandidatesRef.current.has(candidateKey);
          });

          if (candidatesToProcess.length > 0) {
            console.log(
              `Processing ${candidatesToProcess.length} new ICE candidates`,
            );
            for (const candidate of candidatesToProcess) {
              await handleIceCandidate(candidate);
            }
          }
        }
      } catch (err) {
        console.error("Error processing meeting update:", err);
      }
    });

    return () => {
      console.log("Cleaning up meeting listener");
      unsubscribe();
      closeConnection(false);
    };
  }, [
    meetingId,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closeConnection,
    createPeerConnection,
    resetSignalingState,
  ]);

  const createOffer = useCallback(async () => {
    if (!meetingId || isCreatingOfferRef.current) return null;

    const pc = peerConnectionRef.current || createPeerConnection();
    if (!pc) return null;

    try {
      isCreatingOfferRef.current = true;

      // Add a timestamp check
      const now = Date.now();
      const lastOfferTime = lastOfferTimeRef.current || 0;
      if (lastOfferTime && now - lastOfferTime < 5000) {
        console.log("Skipping offer creation - too soon since last offer");
        isCreatingOfferRef.current = false;
        return null;
      }

      // Clear any existing timeout
      if (offerTimeoutRef.current !== null) {
        window.clearTimeout(offerTimeoutRef.current);
      }

      console.log("Creating offer, current state:", pc.signalingState);

      // Only create offer if we're in stable state or have no local description
      if (pc.signalingState !== "stable" && pc.localDescription) {
        console.warn("Not in stable state, cannot create offer");
        isCreatingOfferRef.current = false;
        return null;
      }

      console.log("Creating offer");
      const offer = await pc.createOffer();

      console.log("Setting local description (offer):", offer.type);
      await pc.setLocalDescription(offer);

      console.log("Sending offer to remote peer");
      await setMeetingOffer(meetingId, offer);

      // Update our tracking variables
      lastOfferTimeRef.current = now;
      processedOfferVersionRef.current++; // Increment our local version tracker
      processedAnswerVersionRef.current = 0; // Reset answer version since we're sending a new offer
      processedAnswerRef.current = null; // Reset the processed answer since we're sending a new offer

      // Set a timeout to prevent creating another offer too soon
      offerTimeoutRef.current = window.setTimeout(() => {
        isCreatingOfferRef.current = false;
        offerTimeoutRef.current = null;
      }, 2000);

      return offer;
    } catch (err: any) {
      console.error("Error creating offer:", err);
      isCreatingOfferRef.current = false;
      return null;
    }
  }, [meetingId, createPeerConnection]);

  return {
    localStream,
    remoteStream,
    isConnected,
    error,
    initializeLocalStream,
    createOffer,
    handleAnswer,
    handleOffer,
    handleIceCandidate,
    closeConnection,
  };
}
