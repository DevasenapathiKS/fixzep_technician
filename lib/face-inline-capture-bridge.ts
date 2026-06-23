import { requireOptionalNativeModule } from 'expo-modules-core';

export type FaceInlineCaptureResult =
  | { ok: true; base64: string }
  | { ok: false; reason: 'canceled' | 'no_permission' | 'empty' | 'unavailable' };

let openModal: (() => void) | null = null;
let pending: ((r: FaceInlineCaptureResult) => void) | null = null;

export function isExpoCameraNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoCamera') != null;
}

export function registerFaceInlineCaptureOpener(fn: (() => void) | null) {
  openModal = fn;
}

export function canUseFaceInlineCapture(): boolean {
  return isExpoCameraNativeAvailable() && openModal != null;
}

/**
 * Opens the in-app camera (no post-capture confirm sheet). Resolves when the user
 * captures or cancels. If the host is not mounted or native module is missing, resolves to `unavailable`.
 */
export function requestFaceInlineCapture(): Promise<FaceInlineCaptureResult> {
  if (!canUseFaceInlineCapture()) {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }
  return new Promise((resolve) => {
    pending = resolve;
    openModal!();
  });
}

export function settleFaceInlineCapture(result: FaceInlineCaptureResult) {
  const p = pending;
  pending = null;
  p?.(result);
}
