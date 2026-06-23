import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { buildLiveLocationPayload } from '@/lib/live-location-payload';
import { technicianApi } from '@/lib/technician-api';
import { TECHNICIAN_LOCATION_TASK } from '@/tasks/technician-location-task';

type LocationTrackingContextValue = Record<string, never>;

const LocationTrackingContext = createContext<LocationTrackingContextValue | undefined>(undefined);

/** Target cadence for live location POSTs and OS background location task (matches server trail ~5s sampling). */
const LIVE_LOCATION_POST_INTERVAL_MS = 5_000;

export const LocationTrackingProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!isAuthenticated) {
        await Location.stopLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK).catch(() => undefined);
        return;
      }

      const fg = await Location.requestForegroundPermissionsAsync();
      if (!active || fg.status !== 'granted') {
        return;
      }

      await Location.requestBackgroundPermissionsAsync().catch(() => undefined);

      // Always stop then start so installs that previously used a slower interval pick up 5s after an update.
      await Location.stopLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK).catch(() => undefined);
      await Location.startLocationUpdatesAsync(TECHNICIAN_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LIVE_LOCATION_POST_INTERVAL_MS,
        // Omit distanceInterval so updates are driven by time (~5s) rather than movement.
        foregroundService: {
          notificationTitle: 'FixZep Crew',
          notificationBody: 'Live location is on for dispatch visibility',
          notificationColor: '#111827',
        },
      }).catch(() => undefined);
    };

    run();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const postLive = async () => {
      if (appStateRef.current !== 'active') return;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await technicianApi.postLiveLocation(
          buildLiveLocationPayload({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          }),
        );
      } catch {
        /* network / throttling — ignore */
      }
    };

    void postLive();
    interval = setInterval(postLive, LIVE_LOCATION_POST_INTERVAL_MS);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated]);

  return (
    <LocationTrackingContext.Provider value={{}}>{children}</LocationTrackingContext.Provider>
  );
};

export const useLocationTracking = () => useContext(LocationTrackingContext);
