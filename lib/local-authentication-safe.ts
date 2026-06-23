/**
 * Lazy-load expo-local-authentication so the app runs when the native module
 * is missing (e.g. Expo Go without the module, or dev client not rebuilt after install).
 * Callers should always fall back to face-camera verification.
 */

type LocalAuthModule = typeof import('expo-local-authentication');

function tryRequireModule(): LocalAuthModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

export async function getBiometricAvailability(): Promise<{
  moduleLoaded: boolean;
  canUseBiometrics: boolean;
}> {
  const mod = tryRequireModule();
  if (!mod) {
    return { moduleLoaded: false, canUseBiometrics: false };
  }
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      mod.hasHardwareAsync(),
      mod.isEnrolledAsync(),
    ]);
    return { moduleLoaded: true, canUseBiometrics: Boolean(hasHardware && isEnrolled) };
  } catch {
    return { moduleLoaded: true, canUseBiometrics: false };
  }
}

export async function authenticateWithBiometrics(options: {
  promptMessage: string;
  cancelLabel?: string;
  fallbackLabel?: string;
}): Promise<{ ok: true } | { ok: false; reason: 'unavailable' | 'failed' | 'cancelled' }> {
  const mod = tryRequireModule();
  if (!mod) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const result = await mod.authenticateAsync({
      promptMessage: options.promptMessage,
      cancelLabel: options.cancelLabel,
      fallbackLabel: options.fallbackLabel,
    });
    if (result.success) {
      return { ok: true };
    }
    if (result.error === 'user_cancel') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
