import axios from 'axios';
import { Platform } from 'react-native';

const DEFAULT_BASE_URL = 'http://localhost:4000/api';

// Prefer an env-based base URL so each build profile can target the right API
const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
export const apiBaseUrl = (envBaseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');

// Log configuration in production to help debug
console.log('[API Client] Configuration:', {
  baseURL: apiBaseUrl,
  platform: Platform.OS,
  version: Platform.Version,
  fromEnv: Boolean(envBaseUrl)
});

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000, // Increased timeout for slower networks
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
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

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('[API Request]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      headers: config.headers,
      data: config.data
    });
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log('[API Response Success]', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Comprehensive error logging for production debugging
    const errorDetails = {
      message: error?.message,
      url: error?.config?.url,
      method: error?.config?.method,
      baseURL: error?.config?.baseURL,
      fullURL: error?.config?.url ? `${error?.config?.baseURL}${error?.config?.url}` : 'unknown',
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      responseData: error?.response?.data,
      requestData: error?.config?.data,
      headers: error?.config?.headers,
      code: error?.code,
      isNetworkError: error?.message?.includes('Network Error') || error?.code === 'ECONNABORTED',
      isTimeout: error?.code === 'ECONNABORTED' && error?.message?.includes('timeout')
    };
    
    console.error('[API Response Error]', JSON.stringify(errorDetails, null, 2));
    
    if (error?.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);
