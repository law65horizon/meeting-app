import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  initAuth: () => void;
}

export const useNewAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,

  initAuth: () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        set({ isAuthenticated: true, user });
      } catch (error) {
        console.error('Failed to parse user from localStorage', error);
        localStorage.removeItem('user');
      }
    }
  },

  login: async (email: string, password: string) => {
    try {
      // In a real app, this would be an API call
      // Here we're using mock data for demonstration
      const response = await fetch('/mock/users.json');
      const users: User[] = await response.json();
      
      // Find user by email (in a real app, we'd validate password too)
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (user) {
        // Store user in localStorage for persistence
        localStorage.setItem('user', JSON.stringify(user));
        set({ isAuthenticated: true, user });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login failed', error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('user');
    set({ isAuthenticated: false, user: null });
  }
}));