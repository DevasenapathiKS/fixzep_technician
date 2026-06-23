import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { settleFaceInlineCapture } from '@/lib/face-inline-capture-bridge';

const QUALITY = 0.34;

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Only loaded when `ExpoCamera` native module exists (see host). Shutter → base64 immediately, no OS confirm UI.
 */
export default function FaceInlineCameraInner({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCameraReady(false);
      setCapturing(false);
      return;
    }
    if (permission && !permission.granted) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const closeAndCancel = useCallback(() => {
    settleFaceInlineCapture({ ok: false, reason: 'canceled' });
    onClose();
  }, [onClose]);

  const takePhoto = useCallback(async () => {
    if (!camRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      const photo = await camRef.current.takePictureAsync({
        base64: true,
        quality: QUALITY,
        exif: false,
      });
      let raw = photo.base64;
      if (!raw && photo.uri) {
        raw = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      if (raw && String(raw).trim()) {
        settleFaceInlineCapture({ ok: true, base64: raw });
        onClose();
        return;
      }
      /* No second confirm: stay on camera so user can tap shutter again */
    } catch {
      /* Transient capture error — keep preview open */
    } finally {
      setCapturing(false);
    }
  }, [cameraReady, capturing, onClose]);

  useEffect(() => {
    if (!visible || !permission) return;
    if (permission.granted === false && permission.canAskAgain === false) {
      settleFaceInlineCapture({ ok: false, reason: 'no_permission' });
      onClose();
    }
  }, [visible, permission, onClose]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeAndCancel}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            ref={camRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            mirror
            mode="picture"
            animateShutter={false}
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permissionPane]}>
            <Text style={styles.permissionTitle}>Camera</Text>
            <Text style={styles.permissionBody}>Allow camera to take your face photo.</Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void requestPermission()}
            >
              <Text style={styles.primaryBtnText}>Allow</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={closeAndCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {permission?.granted ? (
          <View
            style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 8 }]}
            pointerEvents="box-none"
          >
            <Pressable onPress={closeAndCancel} hitSlop={12} style={styles.cancelHit}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {permission?.granted ? (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            {!cameraReady ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Pressable
                onPress={() => void takePhoto()}
                disabled={capturing}
                style={[styles.shutterOuter, capturing && styles.shutterMuted]}
                accessibilityLabel="Take photo"
              >
                <View style={styles.shutterInner} />
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permissionPane: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#0f172a',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 10,
    fontFamily: Fonts.bold,
  },
  permissionBody: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Fonts?.sans,
  },
  primaryBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: Fonts.bold },
  secondaryBtn: { padding: 12 },
  secondaryBtnText: { color: '#94a3b8', fontSize: 16, fontFamily: Fonts?.sans },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  cancelHit: { alignSelf: 'flex-start', padding: 8 },
  cancelText: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', fontFamily: Fonts?.sans },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 16,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterMuted: { opacity: 0.5 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
});
