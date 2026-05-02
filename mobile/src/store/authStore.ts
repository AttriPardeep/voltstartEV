// src/store/authStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';

// SINGLE User interface — merged and corrected
export interface User {
  userId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  idTag: string | null;
  
  // Vehicle & charging preferences
  vehicleModel?: string | null;
  batteryCapacityKwh?: number | null;
  targetSocPercent?: number | null;
  
  primaryVehicle?: {
    id: number;
    brand: string;
    model: string;
    variant: string | null;
    batteryKwh: number;
    targetSoc: number;
    nickname: string | null;
  } | null;
  
  role: 'customer' | 'fleet_admin' | 'operator' | 'super_admin';
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

  // Load token + user from AsyncStorage on app start
  loadToken: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return;

    // Check if token is expired before using it
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();
      if (isExpired) {
        console.log('Stored token expired — clearing');
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_user');
        set({ token: null, user: null });
        return;
      }
    } catch (e) {
      // Invalid token format — clear it
      await AsyncStorage.removeItem('auth_token');
      set({ token: null, user: null });
      return;
    }

    const userStr = await AsyncStorage.getItem('auth_user');
    const user = userStr ? JSON.parse(userStr) : null;
    set({ token, user });
  },

  // LOGIN — map API response including idTag
  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/api/users/login', { username, password });
      const { token, user: apiUser } = res.data.data;

      //  Map API response to our User interface
      const userData: User = {
        userId: apiUser.userId,
        username: apiUser.username,
        email: apiUser.email,
        firstName: apiUser.firstName,
        lastName: apiUser.lastName,
        
        //  Map idTag (may be null for new users)
        idTag: apiUser.idTag ?? null,
        
        // Vehicle/charging preferences
        vehicleModel: apiUser.vehicleModel ?? null,
        batteryCapacityKwh: apiUser.batteryCapacityKwh ?? null,
        targetSocPercent: apiUser.targetSocPercent ?? null,
        
        // Optional nested vehicle data
        primaryVehicle: apiUser.primaryVehicle ?? null,
        
        // Metadata
        role: apiUser.role,
        createdAt: apiUser.createdAt,
        updatedAt: apiUser.updatedAt,
      };

      // Persist to AsyncStorage
      await Promise.all([
        AsyncStorage.setItem('auth_token', token),
        AsyncStorage.setItem('auth_user', JSON.stringify(userData)),
      ]);

      set({ token, user: userData, isLoading: false });
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

  // Update user locally (e.g., after profile edit or tag registration)
  /*
  updateUser: (updates) =>
    set((state) => {
      if (!state.user) return {};
      const updatedUser = { ...state.user, ...updates };
      AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
      return { user: updatedUser };
    }),
  */
  // In authStore.ts — add to store actions:
  updateUser: (partial: Partial<User>) => {
    set(state => ({
      user: state.user ? { ...state.user, ...partial } : null
    }));
    // Also persist to AsyncStorage
    const current = useAuthStore.getState().user;
    if (current) {
      AsyncStorage.setItem('auth_user', JSON.stringify({ ...current, ...partial }));
    }
  },
}));