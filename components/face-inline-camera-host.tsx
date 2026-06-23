import { lazy, Suspense, useCallback, useLayoutEffect, useState } from 'react';

import {
  isExpoCameraNativeAvailable,
  registerFaceInlineCaptureOpener,
} from '@/lib/face-inline-capture-bridge';

const FaceInlineCameraInner = isExpoCameraNativeAvailable()
  ? lazy(() => import('@/components/face-inline-camera-inner'))
  : null;

/**
 * Mount once at app root. When native `ExpoCamera` exists, face capture uses in-app shutter with no post-capture OS buttons.
 */
export function FaceInlineCameraHost() {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);

  useLayoutEffect(() => {
    if (!FaceInlineCameraInner) {
      registerFaceInlineCaptureOpener(null);
      return;
    }
    registerFaceInlineCaptureOpener(open);
    return () => registerFaceInlineCaptureOpener(null);
  }, [open]);

  if (!FaceInlineCameraInner) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FaceInlineCameraInner visible={visible} onClose={() => setVisible(false)} />
    </Suspense>
  );
}
