import axios from 'axios';
import Constants from 'expo-constants';

const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants?.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'http://localhost:4000/api';

export const apiBaseUrl = DEFAULT_BASE_URL.replace(/\/$/, '');

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

let unauthorizedHandler: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);
