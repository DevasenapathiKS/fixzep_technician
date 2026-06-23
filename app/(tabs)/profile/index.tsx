import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppLogo from '@/components/ui/app-logo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { getJobCardCameraEnabled, setJobCardCameraEnabled } from '@/lib/camera-preference';
import { captureFaceImageBase64 } from '@/lib/capture-face-base64';
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianProfileResponse } from '@/types/api';

type NavItem = {
  href: '/profile/attendance' | '/profile/leave-apply' | '/profile/leave-requests';
  title: string;
  subtitle: string;
  icon: 'calendar' | 'doc.text' | 'list.clipboard';
};

const WORK_LINKS: NavItem[] = [
  {
    href: '/profile/attendance',
    title: 'Attendance',
    subtitle: 'Monthly timesheet, hours, OT & payslip CSV',
    icon: 'calendar',
  },
  {
    href: '/profile/leave-apply',
    title: 'Apply for leave',
    subtitle: 'Submit a new leave request',
    icon: 'doc.text',
  },
  {
    href: '/profile/leave-requests',
    title: 'Leave requests',
    subtitle: 'View status and cancel pending requests',
    icon: 'list.clipboard',
  },
];

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const faceRetakeInFlightRef = useRef(false);
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
    staleTime: 60_000,
  });

  const updateFaceMutation = useMutation({
    mutationFn: (faceImageBase64: string) => technicianApi.updateFaceReference({ faceImageBase64 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['technicianProfile'] });
      Alert.alert('Updated', 'Your face sign-in reference was updated. Future logins will match this photo.');
    },
    onError: (err: unknown) => {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      Alert.alert('Could not update', msg || 'Try again with a clear, well-lit photo.');
    },
  });

  const handleUpdateFaceReference = async () => {
    if (faceRetakeInFlightRef.current || updateFaceMutation.isPending) return;
    faceRetakeInFlightRef.current = true;
    try {
      const captured = await captureFaceImageBase64();
      if (!captured.ok) {
        if (captured.reason === 'canceled' || captured.reason === 'busy') return;
        if (captured.reason === 'no_permission') {
          Alert.alert('Camera needed', 'Allow camera access to take a new reference photo.');
          return;
        }
        Alert.alert(
          'Photo error',
          'Could not read the photo from your device. Try again, or disable photo filters if any.'
        );
        return;
      }
      updateFaceMutation.mutate(captured.base64);
    } finally {
      faceRetakeInFlightRef.current = false;
    }
  };

  const profile = data;
  const stats = profile?.profile;
  const faceEnrolled = Boolean(stats?.faceLoginEnrolled);
  const faceEnrolledLabel = stats?.faceLoginEnrolledAt
    ? new Date(stats.faceLoginEnrolledAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <View style={styles.brandContainer}>
          <AppLogo size={28} />
          <Text style={styles.brandText}>FixZep</Text>
        </View>
        <View style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            {faceEnrolled ? (
              <View style={styles.avatarBadge} accessibilityLabel="Face sign-in enrolled">
                <IconSymbol name="checkmark.seal.fill" size={20} color="#059669" />
              </View>
            ) : null}
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.name}>{profile?.name || 'Technician'}</Text>
            {profile?.email ? <Text style={styles.subtle}>{profile.email}</Text> : null}
            {profile?.phone ? <Text style={styles.subtle}>{profile.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Face sign-in</Text>
          <Text style={styles.sectionHint}>
            First sign-in only: one enrollment selfie (fingerprint only on server). After that you sign in with OTP
            alone. Each punch In/Out on the home screen opens the camera for a quick face match against this reference.
          </Text>
          <View style={styles.faceRow}>
            <View style={styles.faceIconWrap}>
              <IconSymbol name="face.smiling" size={26} color="#1d4ed8" />
            </View>
            <View style={styles.faceTextWrap}>
              {faceEnrolled ? (
                <>
                  <Text style={styles.faceStatusOk}>Reference enrolled</Text>
                  {faceEnrolledLabel ? (
                    <Text style={styles.faceStatusSub}>Updated {faceEnrolledLabel}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.faceStatusWarn}>Not enrolled yet</Text>
                  <Text style={styles.faceStatusSub}>
                    Finish the camera step on your next sign-in, or update below if you already use the app.
                  </Text>
                </>
              )}
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.faceButton,
              pressed && styles.faceButtonPressed,
              updateFaceMutation.isPending && styles.faceButtonDisabled,
            ]}
            onPress={handleUpdateFaceReference}
            disabled={updateFaceMutation.isPending}
          >
            {updateFaceMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.faceButtonText}>
                {faceEnrolled ? 'Retake reference photo' : 'Enroll with camera now'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Work</Text>
          <Text style={styles.sectionHint}>Attendance, leave, and payslip exports.</Text>
          {WORK_LINKS.map((item) => (
            <Pressable
              key={item.href}
              style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
              onPress={() => router.push(item.href)}
            >
              <View style={styles.navIconWrap}>
                <IconSymbol name={item.icon} size={22} color="#1d4ed8" />
              </View>
              <View style={styles.navTextWrap}>
                <Text style={styles.navTitle}>{item.title}</Text>
                <Text style={styles.navSubtitle}>{item.subtitle}</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#9ca3af" />
            </Pressable>
          ))}
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
            <Text style={styles.toggleHint}>Camera is off. Only “From gallery” will be shown on job cards.</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overview</Text>
          {isLoading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color="#111827" />
          ) : (
            <>
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
            </>
          )}
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
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 32,
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
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 2,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  headerTextBlock: {
    marginLeft: 16,
    flex: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: Fonts?.sans,
  },
  subtle: {
    color: '#475569',
    fontSize: 14,
    marginTop: 4,
    fontFamily: Fonts?.sans,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    fontFamily: Fonts?.sans,
  },
  sectionHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
    lineHeight: 18,
    fontFamily: Fonts?.sans,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginHorizontal: -4,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  navRowPressed: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  navSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 18,
    fontFamily: Fonts?.sans,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    fontFamily: Fonts?.sans,
  },
  toggleHint: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 13,
    fontFamily: Fonts?.sans,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statBlock: {
    flex: 1,
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  statValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Fonts?.sans,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  rowLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontFamily: Fonts?.sans,
  },
  rowValue: {
    color: '#111827',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
  },
  chipText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  chipSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  chipSecondaryText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Fonts?.sans,
  },
  faceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  faceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceTextWrap: {
    flex: 1,
  },
  faceStatusOk: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
    fontFamily: Fonts?.sans,
  },
  faceStatusWarn: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b45309',
    fontFamily: Fonts?.sans,
  },
  faceStatusSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 18,
    fontFamily: Fonts?.sans,
  },
  faceButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  faceButtonPressed: {
    opacity: 0.9,
  },
  faceButtonDisabled: {
    opacity: 0.65,
  },
  faceButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
});
