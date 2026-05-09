// src/utils/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://136.113.7.146:3000',
  timeout: 30000,
});

// lazy import inside interceptor — not at module level
// This breaks the circular dependency
api.interceptors.request.use(config => {
  // Import lazily — only executed when a request is made, not at module load
  const { useAuthStore } = require('../store/authStore');
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const status  = error?.response?.status;
    const message = error?.response?.data?.error || '';

    if (status === 401 && message.toLowerCase().includes('expired')) {
      const { useAuthStore } = require('../store/authStore');
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);