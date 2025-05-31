import { useCallback } from "react";
import { db, onMeetingUpdate, addIceCandidate, setReady, addOffer, addAnswer, } from "./firebase";
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";

let localstream: MediaStream | null = null;
let localVideo: HTMLVideoElement | null = null;
let startButton: HTMLButtonElement | null = null;
let leaveCallButton: HTMLButtonElement | null = null;
let remoteContainer: HTMLDivElement | null = null;
let pppsts: any;
let pppstssss: any;

const peerConnections: { [peerId: string]: RTCPeerConnection } = {};
const candidateQueues: { [peerId: string]: RTCIceCandidateInit } = {};
let myId: string
let roomId:string
let unsubscribe: (() => void) | null = null;
let isHost: boolean = false;
const processedAnswerVersions: { [peerId: string]: number } = {};
const initiatedCalls: Set<string> = new Set();
const processingAnswers: Set<string> = new Set(); // Lock for concurrent answer processing
let isStreamStarted: boolean = false; // Prevent multiple start calls

export function initController(local: any, participants: any, meetingId: string) {
  if (!local || !participants || !Array.isArray(participants) || participants.length === 0) {
    console.error('Invalid initialization data:', { local, participants });
    return;
  }

  // Retry finding DOM elements
  const maxRetries = 5;
  let retryCount = 0;
  const findElements = () => {
    localVideo = document.getElementById(`${local?.name}`) as HTMLVideoElement;
    remoteContainer = document.getElementById('remoteContainer') as HTMLDivElement;
    startButton = document.getElementById('startButton') as HTMLButtonElement;
    leaveCallButton = document.getElementById('leaveCallButton') as HTMLButtonElement;

    if (!localVideo || !remoteContainer || !startButton || !leaveCallButton) {
      console.error('DOM elements missing:', {
        localVideo: !!localVideo,
        remoteContainer: !!remoteContainer,
        startButton: !!startButton,
        leaveCallButton: !!leaveCallButton,
      });
    }

    pppsts = local;
    myId = local?.id;
    pppstssss = participants;
    roomId = meetingId

    if (localstream) {
      localVideo.srcObject = localstream;
    }

    // setupSignaling();
     joinRoom()
    listenForSignals()
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
  console.log('Setup signaling:', { roomId, myId });

  let lastUpdateTime = 0;
  const debounceDelay = 200; // Increased to 200ms

  unsubscribe = onMeetingUpdate(roomId, async (data) => {
    console.log('working')
    if(!localstream) {
      console.log('Local stream not ready yet')
      return;
    }
    if (data.from === myId) {
      console.log('ddata.from === myId')
      return
    }
    const now = Date.now();
    if (now - lastUpdateTime < debounceDelay) {
      console.log('Debouncing meeting update');
      return;
    }
    lastUpdateTime = now;


    if (data.target === myId) console.log('Meeting update received:', {
      participants: data.participants,
      hasOffer: !!data.offer,
      hasAnswer: !!data.answer,
      hostCandidates: data.hostCandidates?.length || 0,
      recipientCandidates: data.recipientCandidates?.length || 0,
      answerVersion: data.answerVersion,
      from: data.from,
      target: data.target,
    });


    console.log('data.from', data.from, myId, data['ready_' + data.from])
    if (
      data['ready_' + data.from] && data.from !== myId && !peerConnections[data.from] && 
      !initiatedCalls.has(data.from) 
    ) {
      initiatedCalls.add(data.from)
      await makeCall(data.from)
    }

    // if (data.offer &&) {
    if (data.offer && data.target === myId) {
      console.log('offer', data.from, data.target)
      const existingConnection = peerConnections[data.from];
      if (!existingConnection || existingConnection.signalingState === 'stable') {
        console.log('Handling offer from host:', data.hostId, myId, data.from);
        await handleOffer({
          from: data.from,
          sdp: data.offer.sdp,
          // version: data.offerVersion || 0,
        });
      } else {
        console.log('Skipping offer: connection exists or not in stable state', {
          signalingState: existingConnection?.signalingState,
        });
      }
    }

    // if (data.answer &) {

    // if (data.answer && data.target === myId) {
    //   console.log('answer', data)
    //   const remotePeerId = data.from
    //   const existingConnection = peerConnections[remotePeerId];
    //   if (existingConnection && existingConnection.signalingState === 'have-local-offer') {
    //     const currentVersion = data.answerVersion || 0;
    //     const lastVersion = processedAnswerVersions[remotePeerId] || 0;
    //     if (currentVersion > lastVersion && !processingAnswers.has(remotePeerId)) {
    //       console.log('Handling answer from:', remotePeerId, 'version:', currentVersion);
    //       processingAnswers.add(remotePeerId);
    //       await handleAnswer({
    //         from: remotePeerId,
    //         sdp: data.answer.sdp,
    //         version: currentVersion,
    //       });
    //       processingAnswers.delete(remotePeerId);
    //     } else {
    //       console.log('Skipping answer:', {
    //         remotePeerId,
    //         currentVersion,
    //         lastVersion,
    //         isProcessing: processingAnswers.has(remotePeerId),
    //       });
    //     }
    //   } else {
    //     console.log('Skipping answer: no connection or wrong state', {
    //       remotePeerId,
    //       signalingState: existingConnection?.signalingState,
    //     });
    //   }
    // }

    if (data.answer && data.target === myId) {
      const remotePeerId = data.from;
      const existingConnection = peerConnections[remotePeerId];
      if (existingConnection && existingConnection.signalingState === 'have-local-offer') {
        console.log('Handling answer from:', remotePeerId);
        await handleAnswer({
          from: remotePeerId,
          sdp: data.answer.sdp,
        });
      } else {
        console.log('Skipping answer: no connection or wrong state', {
          remotePeerId,
          signalingState: existingConnection?.signalingState,
        });
      }
    }

    // const candidates  ? data.recipientCandidates : data.hostCandidates;
    if (data.candidates && data.candidates.length > 0 && data.target == myId) {
      const remotePeerId = data.from
      for (const candidate of data.candidates) {
        console.log('Handling ICE candidate from:', remotePeerId);
        await handleCandidate({ from: remotePeerId, candidate });
      }
    }
  });
}

// function listenForSignals() {
//   const signalsRef = collection(db, 'rooms', roomId, 'signals');
//   console.log('soidowiewopi', signalsRef)
//   onSnapshot(signalsRef, (snapshot:any) => {
//     console.log('isoiowioe')
//     snapshot.docChanges().forEach((change) => {
//       console.log('change' ,change)
//       console.log('soisoiso')
//       const signalId = doc.id;
//       if (signalId.endsWith(`_to_${myId}`)) {
//         const data = doc.data();
//         const senderPeerId = signalId.split('_to_')[0];

//         // Handle offer
//         if (data.offer) {
//           handleOffer({ from: senderPeerId, sdp: data.offer});
//         }

//         // Handle answer
//         if (data.answer) {
//           handleAnswer({ from: senderPeerId, sdp: data.answer});
//         }

//         // Handle ICE candidates
//         if (data.iceCandidates) {
//           handleCandidate({from: senderPeerId, candidate: data.iceCandidates});
//         }
//       }
//       console.log('readdd', doc.data().message['ready_' + doc.data().message.from])
//       if (
//         doc.data().message['ready_' + doc.data().message.from] && doc.data().message.from !== myId 
//         && !peerConnections[doc.data().message.from] && !initiatedCalls.has(doc.data().message.from) 
//       )
//       {
//          makeCall(doc.data().message.from)
//         console.log('making call')
//         initiatedCalls.add(doc.data().message.from)
//       }
//     });
//   });
// }

function listenForSignals() {
  const signalsRef = collection(db, 'meetings', roomId, 'signals');
  const meetingRef = doc(db, 'meetings', roomId)
  // const queryRef = query(signalsRef, where('__name__', '>=', `to_${localPeerId}`), where('__name__', '<=', `to_${localPeerId}\uf8ff`));
  const queryRef = query(signalsRef)
  onSnapshot(queryRef, (snapshot:any) => {
    console.log('soisoi', roomId, snapshot)
    snapshot.docChanges().forEach((change: any) => {
     if(change.type === 'added' || change.type === 'modified') {
      console.log('change' ,change.doc.data())
      console.log('soisoiso')
      const signalId = change.doc.id;
      console.log(signalId, myId)
      const data = change.doc.data()
      if (signalId.endsWith(`_to_${myId}`)) {
        const senderPeerId = signalId.split('_to_')[0];
        console.log('ddsos', data)
        // Handle offer
        if (data.offer) {
          handleOffer({ from: senderPeerId, sdp: data.offer.sdp});
        }

        // Handle answer
        if (data.answer) {
          handleAnswer({ from: senderPeerId, sdp: data.answer.sdp});
        }

        // Handle ICE candidates
        if (data.iceCandidates) {
          handleCandidate({from: senderPeerId, candidate: data.iceCandidates});
        }
      } else {
        console.log('ssosio')
      }
     }
    });
  });
  // onSnapshot(meetingRef, (snapshot: any) => {
  //   console.log(snapshot, snapshot.data())
  //   if (snapshot.data().ready.from = myId) return
  //      console.log('change' ,snapshot.data())
  //      console.log('soisoiso')
  //      const signalId = snapshot.id;
  //      console.log(signalId, myId)
  //      const data = snapshot.data()
  //      if (
  //        data.ready.from === data.from && data.from !== myId 
  //        && !peerConnections[data.from] && !initiatedCalls.has(data.from) 
  //      )
  //      {
  //        console.log('readdd', snapshot.data()['ready_' + snapshot.data().from])
  //        makeCall(data.from)
  //        console.log('making call')
  //        initiatedCalls.add(data.from)
  //      }
  //    });
}


function joinRoom() {
  // const roomRef = doc(db, 'rooms', roomId);
  // const peerRef = doc(collection(roomRef, 'peers'),);

  const peerRef = collection(db, 'meetings', roomId, 'peers');
  const queryRef = query(peerRef)
  // Listen for other peers
  onSnapshot(queryRef, (snapshot:any) => {
    snapshot.forEach((doc:any) => {
      const otherPeerId = doc.id;
      if (otherPeerId === myId) return;
      console.log('sse', snapshot, myId < otherPeerId, otherPeerId < myId, myId == otherPeerId, myId, otherPeerId)
      if(myId < otherPeerId) {
        console.log('good')
      }else {
        console.log(myId, otherPeerId)
      }
      if (otherPeerId !== myId && !peerConnections[otherPeerId] && myId < otherPeerId) {
        console.log('working')
        makeCall(otherPeerId);
      }
    });
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
      // setReady(roomId, myId)
    }
    return localstream;
  } catch (err) {
    console.error('Error accessing media devices.', err);
    return null;
  }
};

export const ready = async (meetingId:string) => {
  if(!roomId || !myId) return

  try {
    console.log('Local stream started',myId, roomId);
    if(roomId) {
      console.log(roomId, meetingId)
      setReady(roomId, myId)
    }
  } catch (err) {
    console.error('Error accessing media devices.', err);
    return null;
  }
};

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
  console.log('Meeting ended');
};

// export const closeConnection = (cc: any) => {};

// export const initializeLocalStream = (cc: any) => {};

export const createPeerConnection = async (peerId: string) => {
  if (peerConnections[peerId] && peerConnections[peerId].signalingState !== 'closed') {
    console.log('Reusing existing peer connection for:', peerId);
    return peerConnections[peerId];
  }

  const pc = new RTCPeerConnection();
  peerConnections[peerId] = pc;

  pc.onicecandidate = async (e: RTCPeerConnectionIceEvent) => {
    if (e.candidate) {
      const candidateData = e.candidate.toJSON();
      console.log('Sending ICE candidate for:', peerId);
      await addIceCandidate(roomId, candidateData, myId, peerId);
    }
  };

  pc.ontrack = (e: RTCTrackEvent) => {
    const stream = e.streams[0];
    const participant = pppstssss?.find((item: any) => item.id === peerId);
    const containerId = participant ? `remote_${participant.name}` : `remote_${peerId}`;
    let remoteContainer = document.getElementById(containerId) as HTMLDivElement;
    let remoteVideo = document.getElementById('remote_' + peerId) as HTMLVideoElement;

    if (!participant) {
      console.warn('Participant not found for peerId:', peerId, 'using fallback container ID:', containerId);
    }

    if (!remoteVideo) {
      remoteVideo = document.createElement('video');
      remoteVideo.id = 'remote_' + peerId;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      if (remoteContainer) {
        remoteContainer.appendChild(remoteVideo);
      } else {
        console.warn('Remote container not found:', containerId);
      }
    }
    if (remoteVideo.srcObject !== stream) {
      remoteVideo.srcObject = stream;
      remoteVideo.play().catch(error => {
        console.error("Playback error:", error);
      });
    }
  };

  localstream?.getTracks().forEach((track: MediaStreamTrack) => {
    pc.addTrack(track, localstream as MediaStream);
  });

  return pc;
};

export const closeConnection = async (cc: any) => {return cc}

export const makeCall = async (peerId: string) => {
  if (peerConnections[peerId] && peerConnections[peerId].signalingState !== 'stable') {
    console.log('Skipping makeCall: connection already exists and not stable for', peerId);
    return;
  }

  const pc = await createPeerConnection(peerId);
  if (!pc) return;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log('Creating offer for:', peerId);
  await addOffer(roomId, offer, myId, peerId);
};

async function hangup(peerId: string) {
  const pc = peerConnections[peerId];
  if (pc) {
    pc.close();
    delete peerConnections[peerId];
  }
  const remoteVideo = document.getElementById('remote_' + peerId);
  if (remoteVideo && remoteContainer) {
    remoteContainer.removeChild(remoteVideo);
  }
  console.log('Hung up connection with:', peerId);
}

async function handleOffer(message: any) {
  console.log(message, peerConnections[message.from])
  try {
    const remotePeerId = message.from;
    if (peerConnections[remotePeerId]) {
      console.warn('Existing peer connection with', remotePeerId);
      return;
    }
    console.log('handleoffer', remotePeerId)
    const pc = await createPeerConnection(remotePeerId);
    if (!pc) return;

    console.log('Setting remote offer from:', remotePeerId);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: message.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('Sending answer to:', remotePeerId);
    await addAnswer(roomId, answer, myId, remotePeerId);
    console.log('offer succesfull', remotePeerId)
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

async function handleAnswer(message: any) {
  const remotePeerId = message.from;
  const pc = peerConnections[remotePeerId];
  if (!pc) {
    console.error('No peer connection for answer from', remotePeerId);
    return;
  }

  if (pc.signalingState !== 'have-local-offer') {
    console.warn(`Unexpected signaling state (${pc.signalingState}) for peer ${remotePeerId}`);
    return;
  }

  try {
    console.log('Setting remote answer from:', remotePeerId, 'version:', message.version);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: message.sdp }));
    console.log('remote successful', remotePeerId)
    processedAnswerVersions[remotePeerId] = message.version; // Update version after success
  } catch (error) {
    console.error("Error setting remote description:", error);
  }
}

async function handleCandidate(message: any) {
  const remotePeerId = message.from;
  const pc = peerConnections[remotePeerId];
  if (!pc) {
    console.error('No peer connection for ICE candidate from', remotePeerId);
    return;
  }

  const candidates = Array.isArray(message.candidate) ? message.candidate : [message.candidate];
  for (const candidate of candidates) {
    if (candidate) {
      try {
        console.log('Adding ICE candidate from:', remotePeerId);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding received ICE candidate', e);
      }
    }
  }
}

