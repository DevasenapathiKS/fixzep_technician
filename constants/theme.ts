/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * Font family is Inter (loaded via @expo-google-fonts/inter in root layout).
 */

import { Platform } from 'react-native';

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

/** Inter font family names (loaded in app/_layout.tsx). Use these for Text styles. */
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  sans: 'Inter_400Regular',
  serif: Platform.OS === 'web' ? "Georgia, 'Times New Roman', serif" : 'serif',
  mono: Platform.OS === 'web' ? "ui-monospace, monospace" : 'monospace',
};
