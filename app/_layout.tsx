import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import '@/tasks/technician-location-task';

import { AuthProvider } from '@/context/AuthContext';
import { LocationTrackingProvider } from '@/context/LocationTrackingContext';
import { PushNotificationProvider } from '@/context/PushNotificationContext';
import { TechnicianSocketProvider } from '@/context/TechnicianSocketContext';
import { fontAssets } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import { FaceInlineCameraHost } from '@/components/face-inline-camera-host';
import { TechnicianNotificationBanner } from '@/components/TechnicianNotificationBanner';

/** Under the hood this toggles keep-awake; it can reject on web or during native init races. */
void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: 'FixZep',
};

const Loader = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator size="large" color="#111827" />
  </View>
);

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    primary: '#111827',
  },
};

const RootLayoutNav = () => {
  const { isAuthenticated, bootstrapping } = useAuth();

  if (bootstrapping) {
    return <Loader />;
  }

  return (
    <ThemeProvider value={AppTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)" options={{ title: 'Home' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="job-card/[id]" options={{ title: 'Job Detail' }} />
          </>
        ) : (
          <Stack.Screen name="login" options={{ title: 'Login' }} />
        )}
      </Stack>
      <TechnicianNotificationBanner />
      <FaceInlineCameraHost />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
};

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);

  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationTrackingProvider>
          <PushNotificationProvider>
            <TechnicianSocketProvider>
              <RootLayoutNav />
            </TechnicianSocketProvider>
          </PushNotificationProvider>
        </LocationTrackingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
