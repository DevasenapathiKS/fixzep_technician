import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { technicianApi } from '@/lib/technician-api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

const getProjectId = () =>
  Constants?.expoConfig?.extra?.eas?.projectId ||
  Constants?.easConfig?.projectId ||
  undefined;

const resolveJobCardId = (data: Record<string, unknown> | undefined) => {
  const jobCardId = data?.jobCardId;
  if (typeof jobCardId === 'string' && jobCardId.length) return jobCardId;
  const orderId = data?.orderId;
  if (typeof orderId === 'string' && orderId.length) return orderId;
  return null;
};

const handleNotificationNavigation = (data: Record<string, unknown> | undefined) => {
  const id = resolveJobCardId(data);
  if (id) {
    router.push(`/job-card/${id}`);
    return;
  }
  router.push('/(tabs)/explore');
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const PushNotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const lastRegisteredToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      lastRegisteredToken.current = null;
      return;
    }

    let cancelled = false;

    const registerToken = async (attempt = 1): Promise<void> => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#111827',
            sound: 'default',
            enableVibrate: true,
            showBadge: true
          });
        }

        if (!Device.isDevice) {
          console.log('[Push] Must use physical device for push notifications');
          return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('[Push] Permission not granted');
          return;
        }

        const projectId = getProjectId();
        const pushToken = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const token = pushToken?.data;
        if (!token) {
          console.warn('[Push] No token returned');
          return;
        }

        if (token === lastRegisteredToken.current) return;

        await technicianApi.registerPushToken({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown'
        });
        lastRegisteredToken.current = token;
        console.log('[Push] Token registered successfully');
      } catch (error) {
        console.warn(`[Push] Registration attempt ${attempt} failed`, error);
        if (!cancelled && attempt < MAX_RETRIES) {
          await wait(RETRY_DELAY * attempt);
          if (!cancelled) return registerToken(attempt + 1);
        }
      }
    };

    void registerToken();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !cancelled) {
        void registerToken();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
      const id = resolveJobCardId(data);
      queryClient.invalidateQueries({ queryKey: ['technicianNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
      queryClient.invalidateQueries({ queryKey: ['technicianJobsAll'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['jobDetail', id] });
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      handleNotificationNavigation(data);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [isAuthenticated, queryClient]);

  return <>{children}</>;
};
