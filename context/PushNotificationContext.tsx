import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { NotificationTaskPayload } from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { technicianApi } from '@/lib/technician-api';
import {
  consumePendingNotificationDataRefresh,
  markPendingNotificationDataRefresh
} from '@/tasks/technicianPushRefreshBridge';
import {
  TECHNICIAN_NOTIFICATION_CHANNEL_ID,
  TECHNICIAN_NOTIFICATION_SOUND
} from '@/constants/notification-audio';

const TECHNICIAN_BG_NOTIFICATION_TASK = 'TECHNICIAN_BG_PUSH_TASK_V1';

/** Avoid `require('expo-task-manager')` when the native module is absent — that require throws before try/catch can suppress RedBox noise in dev. */
function isExpoTaskManagerNativeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  const nm = NativeModules as Record<string, unknown>;
  return nm.ExpoTaskManager != null || nm.ExponentTaskManager != null;
}

/**
 * Foreground / in-app: controls banner, list, sound, badge when the app is active.
 * Background / quit: OS shows the alert from the remote payload (title/body + high priority on server).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

const getProjectId = (): string | undefined => {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (fromConfig) return fromConfig;
  const manifest2 = Constants.manifest2 as
    | { extra?: { expoClient?: { extra?: { eas?: { projectId?: string } } } } }
    | undefined;
  const fromManifest2 = manifest2?.extra?.expoClient?.extra?.eas?.projectId;
  if (fromManifest2) return fromManifest2;
  return Constants.easConfig?.projectId;
};

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

function invalidateTechnicianQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  data: Record<string, unknown> | undefined
) {
  const id = resolveJobCardId(data);
  queryClient.invalidateQueries({ queryKey: ['technicianNotifications'] });
  queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
  queryClient.invalidateQueries({ queryKey: ['technicianJobsAll'] });
  if (id) {
    queryClient.invalidateQueries({ queryKey: ['jobDetail', id] });
  }
}

export const PushNotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, bootstrapping, token: authToken } = useAuth();
  const queryClient = useQueryClient();
  const lastRegisteredToken = useRef<string | null>(null);
  const backgroundPushTaskSetupRef = useRef(false);

  /**
   * Background headless task: only when ExpoTaskManager is linked (custom dev client / EAS build).
   * Expo Go does not ship this native module — we must not require() the JS package in that case.
   */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (backgroundPushTaskSetupRef.current) return;
    if (!isExpoTaskManagerNativeAvailable()) {
      if (__DEV__) {
        console.log(
          '[Push][BG] Skipped (ExpoTaskManager not in this binary). For headless refresh after kill, rebuild: npx expo prebuild → run ios/android, or eas build.'
        );
      }
      return;
    }

    let ExpoTaskManager: typeof import('expo-task-manager');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ExpoTaskManager = require('expo-task-manager');
    } catch (e) {
      console.warn('[Push][BG] expo-task-manager require failed', e);
      return;
    }

    try {
      ExpoTaskManager.defineTask<NotificationTaskPayload>(TECHNICIAN_BG_NOTIFICATION_TASK, async ({ error }) => {
        if (error) {
          console.warn('[Push][BG] task error', error);
          return;
        }
        await markPendingNotificationDataRefresh();
      });

      backgroundPushTaskSetupRef.current = true;

      void Notifications.registerTaskAsync(TECHNICIAN_BG_NOTIFICATION_TASK)
        .then(() => {
          if (__DEV__) console.log('[Push][BG] registerTaskAsync ok');
        })
        .catch((e) => {
          console.warn('[Push][BG] registerTaskAsync failed', e);
          backgroundPushTaskSetupRef.current = false;
        });
    } catch (e) {
      console.warn('[Push][BG] defineTask / register failed', e);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [isAuthenticated]);

  const flushPendingBackgroundRefresh = useCallback(async () => {
    const had = await consumePendingNotificationDataRefresh();
    if (!had) return;
    invalidateTechnicianQueries(queryClient, undefined);
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated || bootstrapping) return;
    void flushPendingBackgroundRefresh();
  }, [isAuthenticated, bootstrapping, flushPendingBackgroundRefresh]);

  /** If the user opened the app by tapping a notification, route after the router is ready. */
  useEffect(() => {
    if (!isAuthenticated || bootstrapping) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (cancelled || !last) return;
        const data = last.notification.request.content.data as Record<string, unknown> | undefined;
        timer = setTimeout(() => {
          if (cancelled) return;
          handleNotificationNavigation(data);
          void Notifications.clearLastNotificationResponseAsync();
        }, 450);
      } catch (e) {
        console.warn('[Push] Cold-start notification response failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, bootstrapping]);

  useEffect(() => {
    if (!isAuthenticated || bootstrapping || !authToken) {
      if (!isAuthenticated) lastRegisteredToken.current = null;
      return;
    }

    let cancelled = false;

    const registerToken = async (attempt = 1): Promise<void> => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(TECHNICIAN_NOTIFICATION_CHANNEL_ID, {
            name: 'Job alerts',
            description: 'Assignments, schedule changes, and crew updates',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#111827',
            sound: TECHNICIAN_NOTIFICATION_SOUND,
            enableVibrate: true,
            showBadge: true,
            bypassDnd: false
          });
        }

        if (!Device.isDevice) {
          console.log('[Push] Must use physical device for push notifications');
          return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true
            }
          });
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('[Push] Permission not granted');
          return;
        }

        const projectId = getProjectId();
        if (!projectId && __DEV__) {
          console.warn(
            '[Push] Missing EAS projectId in app config. Add expo.extra.eas.projectId in app.json and rebuild the native app.'
          );
        }

        /** Android: native FCM registration token (works when app is killed). iOS: Expo push via APNs. */
        let token: string;
        let provider: 'expo' | 'fcm';
        if (Platform.OS === 'android') {
          const native = await Notifications.getDevicePushTokenAsync();
          token = native.data;
          provider = 'fcm';
        } else {
          const pushToken = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );
          token = pushToken?.data ?? '';
          provider = 'expo';
        }

        if (!token) {
          console.warn('[Push] No token returned');
          return;
        }

        if (token === lastRegisteredToken.current) return;

        await technicianApi.registerPushToken({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
          provider
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
        void flushPendingBackgroundRefresh();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isAuthenticated, bootstrapping, authToken, flushPendingBackgroundRefresh]);

  useEffect(() => {
    if (!isAuthenticated || bootstrapping) return;

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
      invalidateTechnicianQueries(queryClient, data);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      handleNotificationNavigation(data);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [isAuthenticated, bootstrapping, queryClient]);

  return <>{children}</>;
};
