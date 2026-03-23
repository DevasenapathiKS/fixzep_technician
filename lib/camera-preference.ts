import * as SecureStore from 'expo-secure-store';

const JOB_CARD_CAMERA_ENABLED_KEY = 'fixzep_job_card_camera_enabled';

/** Default true: camera allowed for job photos when preference not set. */
export async function getJobCardCameraEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(JOB_CARD_CAMERA_ENABLED_KEY);
    if (value === null) return true;
    return value === 'true';
  } catch {
    return true;
  }
}

export async function setJobCardCameraEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(JOB_CARD_CAMERA_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to save camera preference', e);
  }
}
