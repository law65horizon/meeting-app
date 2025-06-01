import { create } from 'zustand';
import { User } from '../types';
import { createUser, logout, signIn } from '../lib/firebase';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tempUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
  setUser: (user: User | null) => void;
  setTempUser: (tempUser: User | null) => void;
}

// In a real app, this would be handled by an API call

const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  tempUser: null,
  
  login: async (email, password) => {
    try {
      const user:any = await signIn(email, password);
      
      if (user) {
        set({ isAuthenticated: true, user });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  
  signup: async (email, password) => {
    try {
      const user:any = await createUser(email, password)
      set({ isAuthenticated: true, user });
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  },
  
  logout: () => {
    logout()
    set({ isAuthenticated: false, user: null });
  },

  setUser: async (user) => set({user}),
  setTempUser: async (tempUser) => set({tempUser}),
  
  checkAuth: () => {
    const authData = localStorage.getItem('auth');
    
    if (authData) {
      try {
        const { user, isAuthenticated } = JSON.parse(authData);
        set({ user, isAuthenticated });
      } catch (error) {
        console.error('Error parsing auth data:', error);
        localStorage.removeItem('auth');
      }
    }
  },
}));

export default useAuthStore;