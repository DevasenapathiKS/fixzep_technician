import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppLogo from '@/components/ui/app-logo';
import { Colors, Fonts } from '@/constants/theme';
import {
  getJobCardCameraEnabled,
  setJobCardCameraEnabled
} from '@/lib/camera-preference';
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianProfileResponse } from '@/types/api';

export default function ProfileScreen() {
  const [cameraEnabled, setCameraEnabledState] = useState(true);

  useEffect(() => {
    getJobCardCameraEnabled().then(setCameraEnabledState);
  }, []);

  const onCameraToggle = async (value: boolean) => {
    setCameraEnabledState(value);
    await setJobCardCameraEnabled(value);
  };

  const { data, isLoading, isRefetching, refetch } = useQuery<TechnicianProfileResponse>({
    queryKey: ['technicianProfile'],
    queryFn: () => technicianApi.getProfile(),
    staleTime: 60_000
  });

  const profile = data;
  const stats = profile?.profile;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.brandContainer}>
          <AppLogo size={28} />
          <Text style={styles.brandText}>FixZep</Text>
        </View>
        <View style={styles.headerCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.name}>{profile?.name || 'Technician'}</Text>
            {profile?.email ? <Text style={styles.subtle}>{profile.email}</Text> : null}
            {profile?.phone ? <Text style={styles.subtle}>{profile.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Job photos</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Use camera for job photos</Text>
            <Switch
              value={cameraEnabled}
              onValueChange={onCameraToggle}
              trackColor={{ false: '#d1d5db', true: Colors.light?.tint ?? '#3b82f6' }}
              thumbColor="#ffffff"
            />
          </View>
          {!cameraEnabled ? (
            <Text style={styles.toggleHint}>Camera is off. Only "From gallery" will be shown on job cards.</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Experience</Text>
              <Text style={styles.statValue}>{stats?.experienceYears ?? 0} yrs</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statValue}>{stats?.averageRating?.toFixed(1) ?? '5.0'}</Text>
            </View>
          </View>
          {stats?.workingHours ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Working hours</Text>
              <Text style={styles.rowValue}>
                {stats.workingHours.start || '08:00'} - {stats.workingHours.end || '20:00'}
              </Text>
            </View>
          ) : null}
        </View>

        {!!stats?.serviceCategories?.length && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Service categories</Text>
            <View style={styles.chipRow}>
              {stats.serviceCategories.map((cat) => (
                <View key={cat.id} style={styles.chip}>
                  <Text style={styles.chipText}>{cat.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!!stats?.serviceItems?.length && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.chipRow}>
              {stats.serviceItems.map((item) => (
                <View key={item.id} style={styles.chipSecondary}>
                  <Text style={styles.chipSecondaryText}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  scrollContent: {
    paddingBottom: 32
  },
  brandContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: Fonts?.sans,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.light?.tint ?? '#11182710'
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts?.sans
  },
  headerTextBlock: {
    marginLeft: 16
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffffff',
    fontFamily: Fonts?.sans
  },
  subtle: {
    color: '#ffffffff',
    marginTop: 2,
    fontFamily: Fonts?.sans
  },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    fontFamily: Fonts?.sans
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toggleLabel: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    fontFamily: Fonts?.sans
  },
  toggleHint: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 13,
    fontFamily: Fonts?.sans
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  statBlock: {
    flex: 1
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: Fonts?.sans
  },
  statValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Fonts?.sans
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12
  },
  rowLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: Fonts?.sans
  },
  rowValue: {
    color: '#111827',
    fontWeight: '600',
    fontFamily: Fonts?.sans
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eff6ff'
  },
  chipText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts?.sans
  },
  chipSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6'
  },
  chipSecondaryText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts?.sans
  }
});
