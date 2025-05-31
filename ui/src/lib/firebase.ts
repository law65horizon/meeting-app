import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  addDoc,
  query,
  orderBy, 
  type Timestamp,
} from "firebase/firestore";
import { nanoid } from "nanoid";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth functions
export const createUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Meeting functions
export const createMeeting = async (hostId: string, recipientEmail: string) => {
  if (!auth.currentUser) {
    throw new Error("User must be logged in to create a meeting");
  }

  try {
    const meetingId = nanoid();
    const meetingRef = doc(db, "meetings", meetingId);
    const peerId = auth.currentUser.uid
    const peerRef = doc(collection(meetingRef, 'peers'), auth.currentUser.uid)

    const meetingData = {
      id: meetingId,
      hostId: auth.currentUser.uid, // Use current user's UID instead of passed hostId
      hostEmail: auth.currentUser.email,
      recipientEmail,
      title: `Meeting with ${recipientEmail}`,
      status: "pending",
      createdAt: serverTimestamp(),
      scheduledFor: serverTimestamp(),
      participants: [auth.currentUser.uid],
      participants_data: [
        {
          id: auth.currentUser.uid,
          name: auth.currentUser?.email?.split("@")[0],
        },
      ],
      isPrivate: false,
      // Initialize signaling fields
      offer: null,
      answer: null,
      hostCandidates: [],
      recipientCandidates: [],
      messages: []
    };

    await setDoc(meetingRef, meetingData);
    await setDoc(peerRef, { peerId, joinedAt: new Date() })
    return meetingId;
  } catch (error: any) {
    console.error("Error creating meeting:", error);
    throw new Error("Failed to create meeting: " + error.message);
  }
};

export const joinMeeting = async (meetingId: string, userId: string) => {
  if (!auth.currentUser) {
    throw new Error("User must be logged in to join a meeting");
  }

  try {
    const meetingRef = doc(db, "meetings", meetingId);
    const meetingDoc = await getDoc(meetingRef);

    if (!meetingDoc.exists()) {
      throw new Error("Meeting not found");
    }

    const meetingData = meetingDoc.data();
    console.log(meetingData)

    // Check if user is authorized to join
    if (
      meetingData.recipientEmail !== auth.currentUser.email &&
      meetingData.hostId !== auth.currentUser.uid
    ) {
      // throw new Error("You are not authorized to join this meeting");
      console.warn("You are not authorized to join this meeting");
    }

    // Add user to participants if not already present
    if (!meetingData.participants.includes(auth.currentUser.uid)) {
      await updateDoc(meetingRef, {
        participants: arrayUnion(auth.currentUser.uid),
        participants_data: arrayUnion(
          {
            id: auth.currentUser.uid,
            name: auth.currentUser?.email?.split("@")[0],
          }
        ),
        status: "active",
        joinedAt: serverTimestamp(),
      });
      const peerId = auth.currentUser.uid
      const peerRef = doc(collection(meetingRef, 'peers'), auth.currentUser.uid)
      // const signalRef = doc(db, "meetings", meetingId, 'peers', );
      await setDoc(peerRef, { peerId, joinedAt: new Date() })
      meetingData.participants.push({id: auth.currentUser.uid})
      meetingData.participants_data.push({
        id: auth.currentUser.uid,
        name: auth.currentUser?.email?.split("@")[0],
      })
    }
    console.log(meetingData.participants);
    return {
      ...meetingData,
      createdAt: meetingData.createdAt?.toDate(),
      scheduledFor: meetingData.scheduledFor?.toDate(),
    };
  } catch (error: any) {
    console.error("Error joining xmeeting:", error);
    throw new Error("Failed to join meeting: " + error.message);
  }
};

export const endMeeting = async (meetingId: string) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    await updateDoc(meetingRef, {
      status: "ended",
      endedAt: serverTimestamp(),
      // Clear signaling data
      offer: null,
      answer: null,
      hostCandidates: [],
      recipientCandidates: [],
    });
  } catch (error: any) {
    throw new Error("Failed to end meeting: " + error.message);
  }
};


export const setMessage = async (meetingId: string, message: any) => {
  try {
    console.log('Sending message:', { meetingId, message });

    const meetingRef = doc(db, 'meetings', meetingId);
    const meetingDoc = await getDoc(meetingRef);
    if (!meetingDoc.exists()) {
      throw new Error('Meeting not found');
    }

    // Store message in a subcollection
    const messagesRef = collection(db, 'meetings', meetingId, 'messages');
    await addDoc(messagesRef, {
      ...message,
      createdAt: serverTimestamp(),
    });

    console.log('Message sent to Firestore:', message);
  } catch (error: any) {
    console.error('Failed to set message:', error.message);
    throw new Error('Failed to set message: ' + error.message);
  }
};

export const addIceCandidate = async(
  meetingId: string, 
  candidate: RTCIceCandidateInit, 
  from: string,
  target: string
) => {
  try {
    const signalRef = doc(db, 'meetings', meetingId, 'signals', `${from}_to_${target}`)
    setDoc(signalRef, {
      iceCandidates: arrayUnion(candidate)
    }, {merge: true})
  } catch (error: any) {
    console.error('Failed to set message:', error.message);
    throw new Error('Failed to set message: ' + error.message);
  }
}

export const addOffer = async(
  meetingId: string, 
  offer: RTCSessionDescriptionInit, 
  from: string,
  target: string,
) => {
  const signalRef = doc(db, 'meetings', meetingId, 'signals', `${from}_to_${target}`)
  await setDoc(signalRef, { offer }, { merge: true });
}

export const addAnswer = async(
  meetingId: string, 
  answer: RTCSessionDescriptionInit, 
  from: string,
  target: string,
) => {
  const signalRef = doc(db, 'meetings', meetingId, 'signals', `${from}_to_${target}`)
  await setDoc(signalRef, {
    answer: answer,
    answerVersion: Date.now(), // Use timestamp as version
    from: from,
    target: target,
  }, { merge: true });
}

export const onMeetingUpdate = (
  meetingId: string,
  callback: (data: any) => void,
) => {
  console.log("Setting up meeting listener:", meetingId);
  const meetingRef = doc(db, "meetings", meetingId);

  return onSnapshot(
    meetingRef,
    (doc:any) => {
      if (!doc.exists()) {
        console.log("Meeting document not found");
        return;
      }

      const data = doc.data();
      console.log("Meeting update received:", {
        id: doc.id,
        status: data.status,
        participants: data.participants,
        hasOffer: !!data.offer,
        hasAnswer: !!data.answer,
        hostCandidates: data.hostCandidates?.length || 0,
        recipientCandidates: data.recipientCandidates?.length || 0,
      });

      // Convert Timestamps to Dates
      const formattedData = {
        ...data,
        createdAt: data.createdAt?.toDate(),
        scheduledFor: data.scheduledFor?.toDate(),
        joinedAt: data.joinedAt?.toDate(),
        endedAt: data.endedAt?.toDate(),
      };

      callback(formattedData);
    },
    (error: any) => {
      console.error("Error in meeting listener:", error);
    },
  );
};


// export const setReady = async (
//   meetingId: string,
//   senderId: string,
// ) => {
//   console.log('ready', senderId, meetingId)
//   try {
//     const signalRef = doc(db, "meetings", meetingId, 'signals', `_to_${senderId}`);
//     // const meetingDoc = await getDoc(meetingRef);
//     console.log('set', meetingId, senderId)
//     // if (!meetingDoc.exists()) throw new Error("Meeting not found");

//     // const meetingData = meetingDoc.data();
//     // const currentVersion = meetingData.offerVersion || 0;

//     // await updateDoc(signalRef, {
//     //   // updatedAt: serverTimestamp(),
//     //   message: {
//     //     from: senderId,
//     //     ['ready_' + senderId]: true
//     //   }
//     // });
//     await setDoc(signalRef, {from: senderId, ['ready_' + senderId]: true})
//   } catch (error: any) {
//     throw new Error("Failed to set offer: " + error.message);
//   }
// };

//

export { auth, db };