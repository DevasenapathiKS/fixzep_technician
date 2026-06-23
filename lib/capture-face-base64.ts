import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Keyboard, Platform } from 'react-native';

import {
  isExpoCameraNativeAvailable,
  requestFaceInlineCapture,
} from '@/lib/face-inline-capture-bridge';

/**
 * Face verification only needs a coarse perceptual hash (server resizes to 9×8).
 * Lower quality = faster camera pipeline, base64 encode, and HTTP upload without hurting matching much.
 */
const FACE_JPEG_QUALITY = 0.34;

let launchLocked = false;

function afterNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export type CaptureFaceResult =
  | { ok: true; base64: string }
  | { ok: false; reason: 'busy' | 'canceled' | 'no_asset' | 'no_permission' | 'empty' };

/**
 * Single-flight face capture for login / punch / profile.
 * - Prefer in-app `expo-camera` when the native module is linked: one shutter tap, no “Use photo” / crop sheet.
 * - Otherwise `expo-image-picker` (system camera; OEM may still show a confirm step).
 */
export async function captureFaceImageBase64(): Promise<CaptureFaceResult> {
  if (launchLocked) {
    return { ok: false, reason: 'busy' };
  }
  launchLocked = true;
  try {
    Keyboard.dismiss();
    await afterNextFrame();

    if (isExpoCameraNativeAvailable()) {
      const inline = await requestFaceInlineCapture();
      if (inline.ok) {
        return { ok: true, base64: inline.base64 };
      }
      if (inline.reason === 'canceled') {
        return { ok: false, reason: 'canceled' };
      }
      if (inline.reason === 'no_permission') {
        return { ok: false, reason: 'no_permission' };
      }
      if (inline.reason === 'empty') {
        return { ok: false, reason: 'empty' };
      }
      /* unavailable: host not ready or Expo Go — fall through to image picker */
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: 'no_permission' };
    }

    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: FACE_JPEG_QUALITY,
      exif: false,
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: false,
      ...(Platform.OS === 'android' ? { legacy: true } : {}),
    });

    if (shot.canceled) {
      return { ok: false, reason: 'canceled' };
    }

    const asset = shot.assets?.[0];
    if (!asset) {
      return { ok: false, reason: 'no_asset' };
    }

    let raw = asset.base64;
    if (!raw && asset.uri) {
      try {
        raw = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        raw = undefined;
      }
    }

    if (!raw || !String(raw).trim()) {
      return { ok: false, reason: 'empty' };
    }

    return { ok: true, base64: raw };
  } finally {
    launchLocked = false;
  }
}
