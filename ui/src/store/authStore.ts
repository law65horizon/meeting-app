import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));

// import { create } from 'zustand';
// import {
//   signInWithPopup,
//   signInWithEmailAndPassword,
//   createUserWithEmailAndPassword,
//   signOut,
//   onAuthStateChanged,
//   updateProfile,
//   type User,
// } from 'firebase/auth';
// import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
// import { auth, db, googleProvider } from '../lib/firebase';
// import { connectSocket, disconnectSocket } from '../lib/socket';

// interface AuthState {
//   user: User | null;
//   token: string | null;
//   loading: boolean;
//   error: string | null;
//   // Actions
//   init: () => () => void;
//   signInGoogle: () => Promise<void>;
//   signInEmail: (email: string, password: string) => Promise<void>;
//   signUpEmail: (email: string, password: string, displayName: string) => Promise<void>;
//   logout: () => Promise<void>;
//   clearError: () => void;
//   refreshToken: () => Promise<string | null>;
// }

// async function upsertUserDoc(user: User): Promise<void> {
//   const ref = doc(db, 'users', user.uid);
//   const snap = await getDoc(ref);
//   if (!snap.exists()) {
//     await setDoc(ref, {
//       uid: user.uid,
//       displayName: user.displayName,
//       email: user.email,
//       photoURL: user.photoURL,
//       createdAt: serverTimestamp(),
//     });
//   }
// }

// export const useAuthStore = create<AuthState>((set, get) => ({
//   user: null,
//   token: null,
//   loading: true,
//   error: null,

//   init: () => {
//     const unsub = onAuthStateChanged(auth, async (user) => {
//       if (user) {
//         const token = await user.getIdToken();
//         set({ user, token, loading: false });
//         connectSocket(token);
//         await upsertUserDoc(user);
//       } else {
//         disconnectSocket();
//         set({ user: null, token: null, loading: false });
//       }
//     });
//     return unsub;
//   },

//   refreshToken: async () => {
//     const user = auth.currentUser;
//     if (!user) return null;
//     const token = await user.getIdToken(true);
//     set({ token });
//     connectSocket(token);
//     return token;
//   },

//   signInGoogle: async () => {
//     set({ error: null });
//     try {
//       await signInWithPopup(auth, googleProvider);
//     } catch (err) {
//       set({ error: (err as Error).message });
//     }
//   },

//   signInEmail: async (email, password) => {
//     set({ error: null });
//     try {
//       await signInWithEmailAndPassword(auth, email, password);
//     } catch (err) {
//       set({ error: (err as Error).message });
//     }
//   },

//   signUpEmail: async (email, password, displayName) => {
//     set({ error: null });
//     try {
//       const cred = await createUserWithEmailAndPassword(auth, email, password);
//       await updateProfile(cred.user, { displayName });
//     } catch (err) {
//       set({ error: (err as Error).message });
//     }
//   },

//   logout: async () => {
//     await signOut(auth);
//   },

//   clearError: () => set({ error: null }),
// }));

