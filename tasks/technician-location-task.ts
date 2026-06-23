import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

import { apiBaseUrl } from '@/lib/api-client';
import { buildLiveLocationPayload } from '@/lib/live-location-payload';

const TOKEN_KEY = 'fixzep_technician_token_v1';

/** Background live GPS task; OS invokes when new fixes arrive per `startLocationUpdatesAsync` (~5s in LocationTrackingContext). */
export const TECHNICIAN_LOCATION_TASK = 'TECHNICIAN_LIVE_LOCATION_BG';

type TaskBody = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask(TECHNICIAN_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }
  const { locations } = (data || {}) as TaskBody;
  if (!locations?.length) {
    return;
  }
  const loc = locations[locations.length - 1];
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return;
  }
  if (!token) {
    return;
  }

  const url = `${apiBaseUrl}/technician/live-location`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        buildLiveLocationPayload({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          heading: loc.coords.heading,
          speed: loc.coords.speed,
        }),
      ),
    });
  } catch {
    /* background — ignore */
  }
});
