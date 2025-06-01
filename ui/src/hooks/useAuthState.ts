import { useState, useEffect } from "react";
import { auth } from '../lib/firebase' // Adjust the import path to your Firebase config
import { onAuthStateChanged } from "firebase/auth";

export function useAuthState() {
  const [user, setUser] = useState(null); // Current user
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state

  useEffect(() => {
    // Set up the auth state listener
    console.log(loading)
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser:any) => {
        setUser(currentUser); // Update user state
        setLoading(false); // Authentication state resolved
      },
      (err:any) => {
        setError(err); // Capture any errors
        setLoading(false);
      }
    );

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

  return { user, loading, error };
}