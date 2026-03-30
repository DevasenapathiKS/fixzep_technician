/**
 * SecureStore-only bridge so background push handling can flag a data refresh
 * without importing expo-task-manager (native module may be absent in Expo Go / old dev clients).
 */
import * as SecureStore from 'expo-secure-store';

const PENDING_REFRESH_KEY = 'technician_bg_push_invalidate_v1';

export async function markPendingNotificationDataRefresh(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_REFRESH_KEY, String(Date.now()));
  } catch (e) {
    console.warn('[Push][BG] SecureStore write failed', e);
  }
}

/** Returns true if a background push requested a data refresh (and clears the flag). */
export async function consumePendingNotificationDataRefresh(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(PENDING_REFRESH_KEY);
    if (v == null || v === '') return false;
    await SecureStore.deleteItemAsync(PENDING_REFRESH_KEY);
    return true;
  } catch {
    return false;
  }
}
