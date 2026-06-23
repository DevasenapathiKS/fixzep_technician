/**
 * App typography: every file under assets/fonts is registered here for expo-font
 * and referenced by family name in UI styles (see theme.ts → Fonts).
 */

export const fontAssets = {
  'EuclidCircularB-Light': require('../assets/fonts/Euclid-Circular-B-Light.ttf'),
  'EuclidCircularB-Regular': require('../assets/fonts/Euclid-Circular-B-Regular.ttf'),
  'EuclidCircularB-Medium': require('../assets/fonts/Euclid-Circular-B-Medium.ttf'),
  'EuclidCircularB-SemiBold': require('../assets/fonts/Euclid-Circular-B-SemiBold.ttf'),
  'EuclidCircularB-Bold': require('../assets/fonts/Euclid-Circular-B-Bold.ttf'),
  'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
} as const;

/** Keys passed to useFonts / PostScript names for fontFamily in styles */
export type AppFontPostScriptName = keyof typeof fontAssets;

/** Use these in StyleSheet / Text: must match keys of fontAssets */
export const FontFamily = {
  light: 'EuclidCircularB-Light',
  regular: 'EuclidCircularB-Regular',
  medium: 'EuclidCircularB-Medium',
  semiBold: 'EuclidCircularB-SemiBold',
  bold: 'EuclidCircularB-Bold',
  /** Default UI sans (same file as regular) */
  sans: 'EuclidCircularB-Regular',
  mono: 'SpaceMono-Regular',
} as const satisfies Record<string, AppFontPostScriptName>;

// When adding a font file: extend fontAssets above and add the same path under
// expo.plugins → ["expo-font", { fonts: [...] }] in app.json (native embed).
