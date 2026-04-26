import { create } from 'zustand';
import { User, Deal, Message } from '../types';

interface AppState {
  // User
  user: User | null;
  isAuthenticated: boolean;

  // Current deal
  currentDeal: Deal | null;
  messages: Message[];

  // UI State
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark';

  // Actions
  setUser: (user: User | null) => void;
  setCurrentDeal: (deal: Deal | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  currentDeal: null,
  messages: [],
  isLoading: false,
  error: null,
  theme: 'light',

  // Actions
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false 
  }),

  setCurrentDeal: (deal) => set({ currentDeal: deal }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  setMessages: (messages) => set({ messages }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setTheme: (theme) => set({ theme }),

  logout: () => {
    localStorage.removeItem('auth_token');
    set({
      user: null,
      isAuthenticated: false,
      currentDeal: null,
      messages: [],
      error: null,
    });
  },
}));
