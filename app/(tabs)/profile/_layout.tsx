import { Stack } from 'expo-router';

import { Fonts } from '@/constants/theme';

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerBackTitle: 'Profile',
        headerTitleStyle: { fontFamily: Fonts.bold, fontWeight: '700', fontSize: 17 },
        headerBackTitleStyle: { fontFamily: Fonts.regular, fontSize: 17 },
        headerTintColor: '#111827',
        contentStyle: { backgroundColor: '#ffffff' },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="leave-apply"
        options={{
          title: 'Apply for leave',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="leave-requests"
        options={{
          title: 'Leave requests',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  );
}
