// src/utils/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

export const API_BASE = 'http://136.113.7.146:3000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('Failed to get token from storage', e);
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  response => response,
  async (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.error || '';

    // Token expired or invalid — force logout
    if (status === 401 && message.toLowerCase().includes('expired')) {
      console.log('Token expired — logging out');
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);