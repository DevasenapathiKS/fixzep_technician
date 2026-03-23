import { setAuthToken, setUnauthorizedHandler } from '@/lib/api-client';
import { technicianApi } from '@/lib/technician-api';
import type { AuthUser } from '@/types/api';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<string>;
  verifyOtp: (phone: string, otp: string, reqId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = 'fixzep_technician_token_v1';
const USER_KEY = 'fixzep_technician_user_v1';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);
        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
        }
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.warn('Failed to bootstrap auth state', error);
      } finally {
        setBootstrapping(false);
      }
    };
    hydrate();
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    try {
      await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    } catch (error) {
      console.warn('Failed to clear auth cache', error);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout().catch(() => undefined);
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const persistAuth = useCallback(async (result: { token: string; user: AuthUser }) => {
    setUser(result.user);
    setToken(result.token);
    setAuthToken(result.token);
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, result.token),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user)),
      ]);
    } catch (error) {
      console.warn('[Auth] Failed to persist auth token', error);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await technicianApi.login(email.trim(), password);
    await persistAuth(result);
  }, [persistAuth]);

  const sendOtp = useCallback(async (phone: string): Promise<string> => {
    const result = await technicianApi.sendOtp(phone);
    return result.reqId;
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, reqId: string) => {
    const result = await technicianApi.verifyOtp(phone, otp, reqId);
    await persistAuth(result);
  }, [persistAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      bootstrapping,
      login,
      sendOtp,
      verifyOtp,
      logout,
    }),
    [bootstrapping, login, sendOtp, verifyOtp, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
