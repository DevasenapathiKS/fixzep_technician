import axios from 'axios';
import { Platform } from 'react-native';

const DEFAULT_BASE_URL = 'https://admin.fixzep.com/api';

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
export const apiBaseUrl = (envBaseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');

if (__DEV__) {
  console.log('[API]', apiBaseUrl, Platform.OS);
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
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
    const status = error?.response?.status;
    const reqUrl = String(error?.config?.url ?? '');
    const method = String(error?.config?.method ?? '').toLowerCase();
    const path = reqUrl.replace(/\/$/, '');
    const isPunchAttendance = method === 'post' && path.endsWith('/technician/attendance');
    const isCompleteLogin = method === 'post' && path.endsWith('/auth/technician/complete-login');

    if (status === 401 && unauthorizedHandler && !isPunchAttendance && !isCompleteLogin) {
      unauthorizedHandler();
    }

    if (__DEV__) {
      const logPath = reqUrl || error?.config?.baseURL || '?';
      const serverMsg = error?.response?.data?.message;
      const hint =
        typeof serverMsg === 'string'
          ? serverMsg
          : error?.message || error?.code || 'Request failed';
      console.warn(`[API] ${status ?? '—'} ${method.toUpperCase()} ${logPath} — ${hint}`);
    }

    return Promise.reject(error);
  }
);
