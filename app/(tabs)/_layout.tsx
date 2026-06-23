import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const Loader = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator size="large" color="#111827" />
  </View>
);

export default function TabLayout() {
  const { isAuthenticated, bootstrapping } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const iconSize = isSmallScreen ? 22 : 24;

  if (bootstrapping) {
    return <Loader />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  const bottomPadding = Platform.OS === 'ios' ? Math.max(insets.bottom, 4) : 6;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: [styles.tabBar, { paddingBottom: bottomPadding }],
        tabBarLabelStyle: [styles.tabLabel, isSmallScreen && { fontSize: 10 }],
        tabBarIconStyle: { marginBottom: -2 },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <IconSymbol size={iconSize} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={iconSize} name="person.crop.circle" color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Jobs "Details" can open /profile/attendance while Jobs stays focused;
            // tapping Profile should always land on profile home, not a nested screen.
            navigation.navigate('profile', { screen: 'index' });
          },
        })}
      />
      <Tabs.Screen
        name="all-jobs"
        options={{
          title: 'All jobs',
          tabBarIcon: ({ color }) => <IconSymbol size={iconSize} name="clock" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => <IconSymbol size={iconSize} name="bell.badge" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
  },
});
