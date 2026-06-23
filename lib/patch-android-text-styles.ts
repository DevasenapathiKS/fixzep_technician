/**
 * Must load before any app screen modules (see root index.ts).
 * Android: custom TTF + fontWeight often resolves to the system (Roboto) face.
 *
 * RN 0.81+ exposes `Text` / `TextInput` as read-only getters, so we cannot replace them.
 * Instead we patch `StyleSheet.create` and set `defaultProps` where allowed.
 */
import { Platform, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';

import { FontFamily } from '@/constants/fonts';

const baseTextDefaults: TextStyle =
  Platform.OS === 'android'
    ? { fontFamily: FontFamily.regular, includeFontPadding: false }
    : { fontFamily: FontFamily.regular };

const BAKED_WEIGHT_FACE =
  /^EuclidCircularB-(Light|Medium|SemiBold|Bold)$|^SpaceMono-/;

function patchAndroidTextStyle(s: TextStyle): TextStyle {
  const ff = s.fontFamily;
  if (typeof ff !== 'string') return s;

  if (BAKED_WEIGHT_FACE.test(ff)) {
    return { ...s, fontWeight: 'normal', fontStyle: 'normal' };
  }

  if (ff === FontFamily.regular || ff === 'EuclidCircularB-Regular') {
    return upgradeRegularWeightToFace(s);
  }

  return s;
}

function upgradeRegularWeightToFace(s: TextStyle): TextStyle {
  const w = s.fontWeight;
  if (w === 'normal' || w === '400' || w === 400 || w == null) {
    return s;
  }
  if (w === 'bold') {
    return { ...s, fontFamily: FontFamily.bold, fontWeight: 'normal', fontStyle: 'normal' };
  }

  const n = typeof w === 'number' ? w : typeof w === 'string' ? parseInt(w, 10) : NaN;
  if (!Number.isNaN(n)) {
    if (n >= 700) {
      return { ...s, fontFamily: FontFamily.bold, fontWeight: 'normal', fontStyle: 'normal' };
    }
    if (n >= 600) {
      return { ...s, fontFamily: FontFamily.semiBold, fontWeight: 'normal', fontStyle: 'normal' };
    }
    if (n >= 500) {
      return { ...s, fontFamily: FontFamily.medium, fontWeight: 'normal', fontStyle: 'normal' };
    }
    if (n <= 300 && n >= 100) {
      return { ...s, fontFamily: FontFamily.light, fontWeight: 'normal', fontStyle: 'normal' };
    }
  }

  if (w === '100' || w === '200' || w === '300' || w === 'light') {
    return { ...s, fontFamily: FontFamily.light, fontWeight: 'normal', fontStyle: 'normal' };
  }

  return s;
}

function looksLikeTextStyle(obj: Record<string, unknown>): boolean {
  if (obj.fontFamily != null || obj.fontSize != null) return true;
  // e.g. styles that only tune line height + weight on top of defaultProps font
  if (obj.lineHeight != null && obj.fontWeight != null) return true;
  return false;
}

function patchStyleSheetEntry(obj: Record<string, unknown>): Record<string, unknown> {
  if (!looksLikeTextStyle(obj)) return obj;
  const merged = { ...baseTextDefaults, ...obj } as TextStyle;
  if (Platform.OS !== 'android') return merged as Record<string, unknown>;
  return patchAndroidTextStyle(merged) as Record<string, unknown>;
}

const STYLE_SHEET_PATCH_KEY = '__fixzepTextStyleCreatePatched__' as const;

function installStyleSheetCreatePatch() {
  const create = StyleSheet.create as typeof StyleSheet.create & { [STYLE_SHEET_PATCH_KEY]?: boolean };
  if (create[STYLE_SHEET_PATCH_KEY]) return;

  const original = create.bind(StyleSheet) as (s: Record<string, unknown>) => ReturnType<typeof StyleSheet.create>;
  create[STYLE_SHEET_PATCH_KEY] = true;

  StyleSheet.create = ((styles: Record<string, unknown>) => {
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(styles)) {
      const v = styles[key];
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        next[key] = patchStyleSheetEntry(v as Record<string, unknown>);
      } else {
        next[key] = v;
      }
    }
    return original(next);
  }) as typeof StyleSheet.create;
}

function installTextDefaultProps() {
  try {
    const base = baseTextDefaults;
    const merge = (prev: unknown) =>
      StyleSheet.flatten([base, prev]) as TextStyle | TextStyle[] | undefined;

    const T = Text as typeof Text & { defaultProps?: { style?: unknown } };
    T.defaultProps = {
      ...T.defaultProps,
      style: merge(T.defaultProps?.style),
    };

    const TI = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
    TI.defaultProps = {
      ...TI.defaultProps,
      style: merge(TI.defaultProps?.style),
    };
  } catch {
    // defaultProps may be non-writable in some RN builds
  }
}

installStyleSheetCreatePatch();
installTextDefaultProps();
