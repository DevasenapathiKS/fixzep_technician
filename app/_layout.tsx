import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/AuthContext';
import { PushNotificationProvider } from '@/context/PushNotificationContext';
import { TechnicianSocketProvider } from '@/context/TechnicianSocketContext';
import { useAuth } from '@/hooks/useAuth';
import { TechnicianNotificationBanner } from '@/components/TechnicianNotificationBanner';

SplashScreen.preventAutoHideAsync();

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
      <StatusBar style="dark" />
    </ThemeProvider>
  );
};

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);

  const [fontsLoaded, fontError] = useFonts({
    'EuclidCircularB-Light': require('../assets/fonts/Euclid-Circular-B-Light.ttf'),
    'EuclidCircularB-Regular': require('../assets/fonts/Euclid-Circular-B-Regular.ttf'),
    'EuclidCircularB-Medium': require('../assets/fonts/Euclid-Circular-B-Medium.ttf'),
    'EuclidCircularB-SemiBold': require('../assets/fonts/Euclid-Circular-B-SemiBold.ttf'),
    'EuclidCircularB-Bold': require('../assets/fonts/Euclid-Circular-B-Bold.ttf'),
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

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
        <PushNotificationProvider>
          <TechnicianSocketProvider>
            <RootLayoutNav />
          </TechnicianSocketProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
