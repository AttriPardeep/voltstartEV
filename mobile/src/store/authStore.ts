// src/store/authStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';

// Strongly typed User interface with vehicle/battery fields
export interface User {
  userId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  idTag?: string;
  
  //  Vehicle & charging preferences
  vehicleModel?: string;
  batteryCapacityKwh?: number;
  targetSocPercent?: number;
  
  //  Add more fields as your API evolves
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;  
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void; 
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,

  loadToken: async () => {
    try {
      const [token, userStr] = await Promise.all([
        AsyncStorage.getItem('auth_token'),
        AsyncStorage.getItem('auth_user'),
      ]);
      
      if (token) {
        const user = userStr ? (JSON.parse(userStr) as User) : null;
        set({ token, user });
      }
    } catch (err) {
      console.warn('Load token error:', err);
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/api/users/login', { username, password });
      const { token, user } = res.data.data;
      
      // Type assertion for safety
      const typedUser = user as User;
      
      await Promise.all([
        AsyncStorage.setItem('auth_token', token),
        AsyncStorage.setItem('auth_user', JSON.stringify(typedUser)),
      ]);
      
      set({ token, user: typedUser, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await Promise.all([
      AsyncStorage.removeItem('auth_token'),
      AsyncStorage.removeItem('auth_user'),
    ]);
    set({ token: null, user: null });
  },
  
  //  Update user locally (e.g., after profile edit)
  updateUser: (updates) => set((state) => {
    if (!state.user) return {};
    const updatedUser = { ...state.user, ...updates };
    AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
    return { user: updatedUser };
  }),
}));