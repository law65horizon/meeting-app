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
  query,
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

      // offer: null,
      // answer: null,
      // hostCandidates: [],
      // recipientCandidates: [],
      messages: []
    };

    await setDoc(meetingRef, meetingData);
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

export const setMeetingOffer = async (
  meetingId: string,
  offer: RTCSessionDescriptionInit,
  senderId: string,
  targetId: string
) => {
  console.log('offer', senderId, targetId, offer, meetingId)
  try {
    if (!meetingId || !senderId || targetId || offer) return
    const signalingRef = doc(db, "meetings", meetingId, "signaling", `${senderId}_to_${targetId}`);
    const signalingDoc = await getDoc(signalingRef);
    const currentVersion = signalingDoc.exists() ? signalingDoc.data().offerVersion || 0 : 0;
    // if (!meetingDoc.exists()) throw new Error("Meeting not found");

    // const meetingData = meetingDoc.data();
    // const currentVersion = meetingData.offerVersion || 0;

    await setDoc(signalingRef, {
      offer,
      offerVersion: currentVersion + 1,
      updatedAt: serverTimestamp(),
      // Clear previous answer when setting new offer
      from: senderId,
      target: targetId
    }, {merge: true});
  } catch (error: any) {
    throw new Error("Failed to set offer: " + error.message);
  }
};

export const setReady = async (
  meetingId: string,
  senderId: string,
) => {
  console.log('ready', senderId, meetingId)
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    const meetingDoc = await getDoc(meetingRef);
    console.log('set', meetingId, senderId)
    if (!meetingDoc.exists()) throw new Error("Meeting not found");

    const meetingData = meetingDoc.data();
    const currentVersion = meetingData.offerVersion || 0;

    await updateDoc(meetingRef, {
      updatedAt: serverTimestamp(),
      from: senderId,
      ['ready_' + senderId]: true
    });
  } catch (error: any) {
    throw new Error("Failed to set offer: " + error.message);
  }
};


export const setMeetingAnswer = async (
  meetingId: string,
  answer: RTCSessionDescriptionInit,
  senderId: string,
  targetId: string
) => {
  console.log('answer', senderId, targetId)
  try {
    console.log("Setting answer in database:", { meetingId });
    const signalingRef = doc(db, "meetings", meetingId, "signaling", `${senderId}_to_${targetId}`);

    // First get the current meeting data
    const signalingDoc = await getDoc(signalingRef);
    if (!signalingDoc.exists()) {
      throw new Error("Signaling doc not found");
    }

    const currentVersion = signalingDoc.data().answerVersion || 0;
    if (
      !signalingDoc.data().answer ||
      JSON.stringify(signalingDoc.data().answer) !== JSON.stringify(answer)
    ) {
      await setDoc(signalingRef, {
        answer,
        answerVersion: currentVersion + 1,
        updatedAt: serverTimestamp(),
        from: senderId,
        target: targetId,
      }, { merge: true });
    } else {
      console.log("Answer unchanged, skipping update");
    }
  } catch (error: any) {
    console.error("Error setting answer:", error);
    throw new Error("Failed to set answer: " + error.message);
  }
};

export const addIceCandidate = async (
  meetingId: string,
  candidate: RTCIceCandidateInit,
  senderId: string,
  targetId: string
) => {
  try {
    console.log("Adding ICE candidate:", { meetingId, senderId, targetId });
    const signalingRef = doc(db, "meetings", meetingId, "signaling", `${senderId}_to_${targetId}`);
    const signalingDoc = await getDoc(signalingRef);
    const candidates = signalingDoc.exists() ? signalingDoc.data().candidates || [] : [];

    const candidateExists = candidates.some(
      (existing: RTCIceCandidateInit) =>
        JSON.stringify(existing) === JSON.stringify(candidate),
    );

    if (!candidateExists) {
      await setDoc(signalingRef, {
        candidates: arrayUnion(candidate),
        updatedAt: serverTimestamp(),
        from: senderId,
        target: targetId,
      }, { merge: true });
    } else {
      console.log("Candidate already exists, skipping");
    }
  } catch (error: any) {
    console.error("Error adding ICE candidate:", error);
    throw new Error("Failed to add ICE candidate: " + error.message);
  }
};

export const onMeetingUpdate = (
  meetingId: string,
  callback: (data: any) => void,
) => {
  console.log("Setting up meeting listener:", meetingId);
  const signalingQuery = query(collection(db, "meetings", meetingId, "signaling"));

  return onSnapshot(
    signalingQuery,
    (snapshot : any) => {
      snapshot.docChanges().forEach((change : any) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();
          console.log("Signaling update received:", {
            id: change.doc.id,
            from: data.from,
            target: data.target,
            hasOffer: !!data.offer,
            hasAnswer: !!data.answer,
            candidates: data.candidates?.length || 0,
          });

          const formattedData = {
            ...data,
            updatedAt: data.updatedAt?.toDate(),
          };

          callback(formattedData);
        }
      });
    },
    (error: any) => {
      console.error("Error in signaling listener:", error);
    },
  );
};

export { auth, db };



// import { initializeApp } from "firebase/app";
// import {
//   getAuth,
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   signOut,
//   onAuthStateChanged,
//   type User,
// } from 'firebase/auth';
// import {
//   getFirestore,
//   collection,
//   doc,
//   setDoc,
//   getDoc,
//   updateDoc,
//   onSnapshot,
//   serverTimestamp,
//   arrayUnion,
//   type Timestamp,
// } from "firebase/firestore";
// import { nanoid } from "nanoid";

// // Firebase configuration
// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//   appId: import.meta.env.VITE_FIREBASE_APP_ID,
//   measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);

// // Auth functions
// export const createUser = async (email: string, password: string) => {
//   try {
//     const userCredential = await createUserWithEmailAndPassword(
//       auth,
//       email,
//       password,
//     );
//     return userCredential.user;
//   } catch (error: any) {
//     throw new Error(error.message);
//   }
// };

// export const signIn = async (email: string, password: string) => {
//   try {
//     const userCredential = await signInWithEmailAndPassword(
//       auth,
//       email,
//       password,
//     );
//     return userCredential.user;
//   } catch (error: any) {
//     throw new Error(error.message);
//   }
// };

// export const logout = async () => {
//   try {
//     await signOut(auth);
//   } catch (error: any) {
//     throw new Error(error.message);
//   }
// };

// export const onAuthStateChange = (callback: (user: User | null) => void) => {
//   return onAuthStateChanged(auth, callback);
// };

// // Meeting functions
// export const createMeeting = async (hostId: string, recipientEmail: string) => {
//   if (!auth.currentUser) {
//     throw new Error("User must be logged in to create a meeting");
//   }

//   try {
//     const meetingId = nanoid();
//     const meetingRef = doc(db, "meetings", meetingId);

//     const meetingData = {
//       id: meetingId,
//       hostId: auth.currentUser.uid, // Use current user's UID instead of passed hostId
//       hostEmail: auth.currentUser.email,
//       recipientEmail,
//       title: `Meeting with ${recipientEmail}`,
//       status: "pending",
//       createdAt: serverTimestamp(),
//       scheduledFor: serverTimestamp(),
//       participants: [auth.currentUser.uid],
//       participants_data: [
//         {
//           id: auth.currentUser.uid,
//           name: auth.currentUser?.email?.split("@")[0],
//         },
//       ],
//       isPrivate: false,
//       // Initialize signaling fields
//       offer: null,
//       answer: null,
//       hostCandidates: [],
//       recipientCandidates: [],
//       messages: []
//     };

//     await setDoc(meetingRef, meetingData);
//     return meetingId;
//   } catch (error: any) {
//     console.error("Error creating meeting:", error);
//     throw new Error("Failed to create meeting: " + error.message);
//   }
// };

// export const joinMeeting = async (meetingId: string, userId: string) => {
//   if (!auth.currentUser) {
//     throw new Error("User must be logged in to join a meeting");
//   }

//   try {
//     const meetingRef = doc(db, "meetings", meetingId);
//     const meetingDoc = await getDoc(meetingRef);

//     if (!meetingDoc.exists()) {
//       throw new Error("Meeting not found");
//     }

//     const meetingData = meetingDoc.data();
//     console.log(meetingData)

//     // Check if user is authorized to join
//     if (
//       meetingData.recipientEmail !== auth.currentUser.email &&
//       meetingData.hostId !== auth.currentUser.uid
//     ) {
//       // throw new Error("You are not authorized to join this meeting");
//       console.warn("You are not authorized to join this meeting");
//     }

//     // Add user to participants if not already present
//     if (!meetingData.participants.includes(auth.currentUser.uid)) {
//       await updateDoc(meetingRef, {
//         participants: arrayUnion(auth.currentUser.uid),
//         participants_data: arrayUnion(
//           {
//             id: auth.currentUser.uid,
//             name: auth.currentUser?.email?.split("@")[0],
//           }
//         ),
//         status: "active",
//         joinedAt: serverTimestamp(),
//       });
//       meetingData.participants.push({id: auth.currentUser.uid})
//       meetingData.participants_data.push({
//         id: auth.currentUser.uid,
//         name: auth.currentUser?.email?.split("@")[0],
//       })
//     }
//     console.log(meetingData.participants);
//     return {
//       ...meetingData,
//       createdAt: meetingData.createdAt?.toDate(),
//       scheduledFor: meetingData.scheduledFor?.toDate(),
//     };
//   } catch (error: any) {
//     console.error("Error joining xmeeting:", error);
//     throw new Error("Failed to join meeting: " + error.message);
//   }
// };

// export const endMeeting = async (meetingId: string) => {
//   try {
//     const meetingRef = doc(db, "meetings", meetingId);
//     await updateDoc(meetingRef, {
//       status: "ended",
//       endedAt: serverTimestamp(),
//       // Clear signaling data
//       offer: null,
//       answer: null,
//       hostCandidates: [],
//       recipientCandidates: [],
//     });
//   } catch (error: any) {
//     throw new Error("Failed to end meeting: " + error.message);
//   }
// };

// export const setMeetingOffer = async (
//   meetingId: string,
//   offer: RTCSessionDescriptionInit,
//   senderId: string,
//   targetId: string
// ) => {
//   console.log('offer', senderId, targetId, offer, meetingId)
//   try {
//     const meetingRef = doc(db, "meetings", meetingId);
//     const meetingDoc = await getDoc(meetingRef);
//     if (!meetingDoc.exists()) throw new Error("Meeting not found");

//     const meetingData = meetingDoc.data();
//     const currentVersion = meetingData.offerVersion || 0;

//     await updateDoc(meetingRef, {
//       offer,
//       offerVersion: currentVersion + 1,
//       updatedAt: serverTimestamp(),
//       // Clear previous answer when setting new offer
//       answer: null,
//       answerVersion: 0,
//       from: senderId,
//       target: targetId
//     });
//   } catch (error: any) {
//     throw new Error("Failed to set offer: " + error.message);
//   }
// };

// export const setReady = async (
//   meetingId: string,
//   senderId: string,
// ) => {
//   console.log('ready', senderId, meetingId)
//   try {
//     const meetingRef = doc(db, "meetings", meetingId);
//     const meetingDoc = await getDoc(meetingRef);
//     console.log('set', meetingId, senderId)
//     if (!meetingDoc.exists()) throw new Error("Meeting not found");

//     const meetingData = meetingDoc.data();
//     const currentVersion = meetingData.offerVersion || 0;

//     await updateDoc(meetingRef, {
//       updatedAt: serverTimestamp(),
//       from: senderId,
//       ready:true
//     });
//   } catch (error: any) {
//     throw new Error("Failed to set offer: " + error.message);
//   }
// };


// export const setMeetingAnswer = async (
//   meetingId: string,
//   answer: RTCSessionDescriptionInit,
//   senderId: string,
//   targetId: string
// ) => {
//   console.log('answer', senderId, targetId)
//   try {
//     console.log("Setting answer in database:", { meetingId });
//     const meetingRef = doc(db, "meetings", meetingId);

//     // First get the current meeting data
//     const meetingDoc = await getDoc(meetingRef);
//     if (!meetingDoc.exists()) {
//       throw new Error("Meeting not found");
//     }

//     const meetingData = meetingDoc.data();
//     const currentVersion = meetingData.answerVersion || 0;

//     // Only update if answer is different or not set
//     if (
//       !meetingData.answer ||
//       JSON.stringify(meetingData.answer) !== JSON.stringify(answer)
//     ) {
//       await updateDoc(meetingRef, {
//         answer,
//         answerVersion: currentVersion + 1,
//         updatedAt: serverTimestamp(),
//         from: senderId,
//         target: targetId
//       });
//     } else {
//       console.log("Answer unchanged, skipping update");
//     }
//   } catch (error: any) {
//     console.error("Error setting answer:", error);
//     throw new Error("Failed to set answer: " + error.message);
//   }
// };

// export const addIceCandidate = async (
//   meetingId: string,
//   candidate: RTCIceCandidateInit,
//   isHost: boolean,
//   senderId: string,
//   targetId: string
// ) => {
//   try {
//     console.log("Adding ICE candidate:", { meetingId, isHost });
//     const meetingRef = doc(db, "meetings", meetingId);
//     const field = isHost ? "hostCandidates" : "recipientCandidates";

//     // First get the current meeting data to check if candidate already exists
//     const meetingDoc = await getDoc(meetingRef);
//     if (!meetingDoc.exists()) {
//       throw new Error("Meeting not found");
//     }

//     const meetingData = meetingDoc.data();
//     const candidates = meetingData[field] || [];

//     // Check if this exact candidate already exists
//     const candidateExists = candidates.some(
//       (existing: RTCIceCandidateInit) =>
//         JSON.stringify(existing) === JSON.stringify(candidate),
//     );

//     if (!candidateExists) {
//       await updateDoc(meetingRef, {
//         [field]: arrayUnion(candidate),
//         updatedAt: serverTimestamp(),
//         from: senderId,
//         target: targetId
//       });
//     } else {
//       console.log("Candidate already exists, skipping");
//     }
//   } catch (error: any) {
//     console.error("Error adding ICE candidate:", error);
//     throw new Error("Failed to add ICE candidate: " + error.message);
//   }
// };

// export const onMeetingUpdate = (
//   meetingId: string,
//   callback: (data: any) => void,
// ) => {
//   console.log("Setting up meeting listener:", meetingId);
//   const meetingRef = doc(db, "meetings", meetingId);

//   return onSnapshot(
//     meetingRef,
//     (doc) => {
//       if (!doc.exists()) {
//         console.log("Meeting document not found");
//         return;
//       }

//       const data = doc.data();
//       console.log("Meeting update received:", {
//         id: doc.id,
//         status: data.status,
//         participants: data.participants,
//         hasOffer: !!data.offer,
//         hasAnswer: !!data.answer,
//         hostCandidates: data.hostCandidates?.length || 0,
//         recipientCandidates: data.recipientCandidates?.length || 0,
//         from: data.from,
//         target: data.target,
//       });

//       // Convert Timestamps to Dates
//       const formattedData = {
//         ...data,
//         createdAt: data.createdAt?.toDate(),
//         scheduledFor: data.scheduledFor?.toDate(),
//         joinedAt: data.joinedAt?.toDate(),
//         endedAt: data.endedAt?.toDate(),
//       };

//       callback(formattedData);
//     },
//     (error) => {
//       console.error("Error in meeting listener:", error);
//     },
//   );
// };

// export { auth, db };