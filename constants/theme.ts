/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * UI fonts are loaded from assets/fonts via fontAssets in constants/fonts.ts (see app/_layout.tsx).
 */

import { Platform } from 'react-native';

import { FontFamily } from '@/constants/fonts';

const tintColorLight = '#111827';
const tintColorDark = '#111827';

export const Colors = {
  light: {
    text: '#111827',
    background: '#ffffff',
    tint: tintColorLight,
    icon: '#6b7280',
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintColorLight,
    surface: '#f9fafb',
    card: '#ffffff',
    border: '#e5e7eb',
    muted: '#6b7280',
    subtle: '#9ca3af',
    accent: '#111827',
  },
  dark: {
    text: '#111827',
    background: '#ffffff',
    tint: tintColorDark,
    icon: '#6b7280',
    tabIconDefault: '#9ca3af',
    tabIconSelected: tintColorDark,
    surface: '#f9fafb',
    card: '#ffffff',
    border: '#e5e7eb',
    muted: '#6b7280',
    subtle: '#9ca3af',
    accent: '#111827',
  },
};

/** Font family names from assets/fonts — use for Text / TextInput styles */
export const Fonts = {
  light: FontFamily.light,
  regular: FontFamily.regular,
  medium: FontFamily.medium,
  semiBold: FontFamily.semiBold,
  bold: FontFamily.bold,
  sans: FontFamily.sans,
  serif: Platform.OS === 'web' ? "Georgia, 'Times New Roman', serif" : 'serif',
  mono: FontFamily.mono,
};
