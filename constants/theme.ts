/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * UI fonts are Euclid Circular B; monospace is SpaceMono (loaded in app/_layout.tsx from assets/fonts).
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

/** Font family names registered in app/_layout.tsx via expo-font. Use these for Text styles. */
export const Fonts = {
  light: 'EuclidCircularB-Light',
  regular: 'EuclidCircularB-Regular',
  medium: 'EuclidCircularB-Medium',
  semiBold: 'EuclidCircularB-SemiBold',
  bold: 'EuclidCircularB-Bold',
  sans: 'EuclidCircularB-Regular',
  serif: Platform.OS === 'web' ? "Georgia, 'Times New Roman', serif" : 'serif',
  mono: 'SpaceMono-Regular',
};
