import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppLogo from '@/components/ui/app-logo';
import { TechnicianPaySummaryCards } from '@/components/technician-pay-summary-cards';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { captureFaceImageBase64 } from '@/lib/capture-face-base64';
import {
  getTechnicianAddressAreaCity,
  getTechnicianAddressLine1,
  hasTechnicianServiceLocation
} from '@/lib/format-service-address';
import { resolveTechnicianJobListCardTheme } from '@/lib/job-card-status-theme';
import { technicianAttendanceMonthQueryKey } from '@/lib/attendance-month-query';
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianAttendanceRow, TechnicianJobSummary } from '@/types/api';

const JobCard = ({ job }: { job: TechnicianJobSummary }) => {
  const scheduledAt = job.order?.scheduledAt || job.order?.timeWindowStart;
  const scheduleLabel = scheduledAt ? dayjs(scheduledAt).format('DD MMM, h:mm A') : 'Awaiting schedule';
  const badgeStyle = resolveTechnicianJobListCardTheme(job);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: badgeStyle.cardBackground, borderColor: badgeStyle.cardBorder }]}
      onPress={() => router.push(`/job-card/${job.id}`)}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardCode}>{job.order?.code ?? job.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: badgeStyle.badgeBackground }]}>
          <Text style={[styles.statusText, { color: badgeStyle.text }]}>{job.status || 'Unknown'}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>
        {job.order?.serviceVariantLabel
          ? `${job.order?.serviceItem?.name || 'Service'} – ${job.order.serviceVariantLabel}`
          : (job.order?.serviceItem?.name || 'Service job')}
      </Text>
      <Text style={styles.cardSubtitle}>{job.order?.serviceCategory?.name || 'General service'}</Text>
      <View style={styles.cardDivider} />
      <View style={styles.cardRow}>
        <View>
          <Text style={styles.cardLabel}>Customer</Text>
          <Text style={styles.cardValue}>{job.order?.customer?.name || 'N/A'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardLabel}>Schedule</Text>
          <Text style={styles.cardValue}>{scheduleLabel}</Text>
        </View>
      </View>
      {hasTechnicianServiceLocation(job.order) ? (
        <View style={[styles.cardRow, { marginTop: 8, alignItems: 'flex-start' }]}>
          <Text style={styles.cardLabel}>Location</Text>
          <View style={{ flex: 1, marginLeft: 12, alignItems: 'flex-end' }}>
            {getTechnicianAddressLine1(job.order) ? (
              <Text style={[styles.cardValue, { textAlign: 'right' }]} numberOfLines={2}>
                {getTechnicianAddressLine1(job.order)}
              </Text>
            ) : null}
            {getTechnicianAddressAreaCity(job.order) ? (
              <Text style={[styles.cardValue, styles.cardLocationSub, { textAlign: 'right' }]} numberOfLines={2}>
                {getTechnicianAddressAreaCity(job.order)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
};

/** Punch: system camera via image-picker (no crop) → verify overlay → success. Works in Expo Go; expo-camera needs a rebuilt dev client. */
type PunchOverlayState =
  | { kind: 'hidden' }
  | { kind: 'verify'; action: 'check_in' | 'check_out' }
  | { kind: 'success'; action: 'check_in' | 'check_out' };

const PUNCH_SUCCESS_MS = 1600;

export default function JobListScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [punchOverlay, setPunchOverlay] = useState<PunchOverlayState>({ kind: 'hidden' });
  const punchSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (punchSuccessTimerRef.current) {
        clearTimeout(punchSuccessTimerRef.current);
      }
    };
  }, []);

  /** Warm location cache so punch GPS often resolves faster after the photo. */
  useEffect(() => {
    void Location.getLastKnownPositionAsync().catch(() => undefined);
  }, []);

  const monthYear = dayjs().year();
  const monthNumber = dayjs().month() + 1;

  const {
    data: jobs,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TechnicianJobSummary[]>({
    queryKey: ['technicianJobs'],
    queryFn: () => technicianApi.listActiveJobsToday(),
    staleTime: 30_000
  });

  const monthSummaryQuery = useQuery({
    queryKey: technicianAttendanceMonthQueryKey(monthYear, monthNumber),
    queryFn: () => technicianApi.getAttendanceMonthSummary(monthYear, monthNumber),
    staleTime: 60_000,
  });

  const attendanceQuery = useQuery({
    queryKey: ['technicianAttendance'],
    queryFn: () =>
      technicianApi.listMyAttendance({
        from: dayjs().subtract(60, 'day').toISOString(),
        to: dayjs().toISOString()
      }),
    staleTime: 60_000
  });

  const todayAttendance = useMemo(() => {
    const start = dayjs().startOf('day');
    const list = attendanceQuery.data || [];
    return list.find((r: TechnicianAttendanceRow) => dayjs(r.date).isSame(start, 'day'));
  }, [attendanceQuery.data]);

  const hasPunchIn = Boolean(todayAttendance?.checkInAt);
  const hasPunchOut = Boolean(todayAttendance?.checkOutAt);
  /** One punch-in per day in the app flow */
  const punchInBlocked = hasPunchIn;
  const punchOutBlocked = !hasPunchIn || hasPunchOut;

  const punchCaptureRef = useRef(false);

  const punchMutation = useMutation({
    mutationFn: async (input: { action: 'check_in' | 'check_out'; faceImageBase64: string }) => {
      const { action, faceImageBase64 } = input;
      setPunchOverlay({ kind: 'verify', action });
      const perm = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;
      if (perm.status === 'granted') {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
        if (last?.coords) {
          lat = last.coords.latitude;
          lng = last.coords.longitude;
        }
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          /* keep last-known if any */
        }
      }
      const data = await technicianApi.upsertAttendance({ action, faceImageBase64, lat, lng });
      return { action, data };
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['technicianAttendance'] });
      queryClient.invalidateQueries({
        queryKey: technicianAttendanceMonthQueryKey(monthYear, monthNumber),
      });
      setPunchOverlay({ kind: 'success', action: payload.action });
      if (punchSuccessTimerRef.current) {
        clearTimeout(punchSuccessTimerRef.current);
      }
      punchSuccessTimerRef.current = setTimeout(() => {
        setPunchOverlay({ kind: 'hidden' });
        punchSuccessTimerRef.current = null;
      }, PUNCH_SUCCESS_MS);
    },
    onError: (e: unknown) => {
      setPunchOverlay({ kind: 'hidden' });
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      Alert.alert('Attendance', msg || 'Could not record punch.');
    }
  });

  const handlePunchRequest = async (action: 'check_in' | 'check_out') => {
    if (action === 'check_in' && punchInBlocked) return;
    if (action === 'check_out' && punchOutBlocked) return;
    if (punchCaptureRef.current || punchMutation.isPending) return;
    punchCaptureRef.current = true;
    try {
      const captured = await captureFaceImageBase64();
      if (!captured.ok) {
        if (captured.reason === 'no_permission') {
          Alert.alert(
            'Camera needed',
            'Punch in and punch out need a quick face photo. Allow camera access to continue.'
          );
        }
        return;
      }
      punchMutation.mutate({ action, faceImageBase64: captured.base64 });
    } finally {
      punchCaptureRef.current = false;
    }
  };

  const handleRefresh = () => {
    void refetch();
    void monthSummaryQuery.refetch();
    void attendanceQuery.refetch();
  };

  const overlayCopy =
    punchOverlay.kind === 'verify'
      ? {
          title: 'Verifying',
          subtitle:
            punchOverlay.action === 'check_in'
              ? 'Checking your face and saving check-in…'
              : 'Checking your face and saving check-out…',
        }
      : punchOverlay.kind === 'success'
        ? punchOverlay.action === 'check_in'
          ? { title: 'Checked in', subtitle: 'Done.' }
          : { title: 'Checked out', subtitle: 'Done.' }
        : null;

  const renderJobCards = () => {
    if (isLoading) {
      return <ActivityIndicator style={{ marginTop: 32 }} />;
    }
    if (!jobs?.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No jobs yet</Text>
          <Text style={styles.emptySubtitle}>Assigned work will appear here once scheduled.</Text>
        </View>
      );
    }
    return jobs.map((job) => <JobCard key={job.id} job={job} />);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal
        visible={punchOverlay.kind !== 'hidden'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.punchModalBackdrop}>
          <View style={styles.punchModalCard}>
            {punchOverlay.kind === 'verify' ? (
              <>
                <ActivityIndicator size="large" color="#0f172a" style={styles.punchModalSpinner} />
                {overlayCopy ? (
                  <>
                    <Text style={styles.punchModalTitle}>{overlayCopy.title}</Text>
                    <Text style={styles.punchModalSubtitle}>{overlayCopy.subtitle}</Text>
                  </>
                ) : null}
              </>
            ) : punchOverlay.kind === 'success' ? (
              <>
                <View style={styles.punchSuccessIconWrap}>
                  <Text style={styles.punchSuccessIcon}>✓</Text>
                </View>
                {overlayCopy ? (
                  <>
                    <Text style={styles.punchModalTitle}>{overlayCopy.title}</Text>
                    <Text style={styles.punchModalSubtitle}>{overlayCopy.subtitle}</Text>
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || monthSummaryQuery.isRefetching}
            onRefresh={handleRefresh}
          />
        }
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderRow}>
            <View>
              <View style={styles.brandRow}>
                <AppLogo size={24} />
                <Text style={styles.brandText}>FixZep</Text>
              </View>
              <Text style={styles.pageTitle}>Jobs</Text>
              <Text style={styles.pageSubtitle}>Welcome back, {user?.name ?? 'Technician'}.</Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={() => logout().catch(() => null)}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
          <Text style={styles.pageLead}>Monitor schedules, capture check-ins, and close jobs with confidence.</Text>
        </View>
        <TechnicianPaySummaryCards
          variant="dashboard"
          loading={monthSummaryQuery.isLoading}
          payroll={monthSummaryQuery.data?.payroll ?? null}
          monthLabel={monthSummaryQuery.data?.monthLabel}
          onViewDetails={() => router.navigate('/(tabs)/profile/attendance')}
        />

        <View style={styles.punchCard}>
          {attendanceQuery.isLoading ? (
            <ActivityIndicator color="#111827" size="small" />
          ) : (
            <>
              <View style={styles.punchTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.punchLabel}>Today</Text>
                  <Text style={styles.punchFaceHint}>Front-camera photo, no crop step</Text>
                </View>
                <Text style={styles.punchTimes} numberOfLines={2}>
                  In {todayAttendance?.checkInAt ? dayjs(todayAttendance.checkInAt).format('HH:mm') : '—'} · Out{' '}
                  {todayAttendance?.checkOutAt ? dayjs(todayAttendance.checkOutAt).format('HH:mm') : '—'}
                </Text>
              </View>
              <View style={styles.punchBtnRow}>
                <Pressable
                  style={[
                    styles.punchBtnIn,
                    (punchMutation.isPending || punchInBlocked) && styles.punchBtnMuted,
                  ]}
                  disabled={punchMutation.isPending || punchInBlocked}
                  onPress={() => void handlePunchRequest('check_in')}
                >
                  {punchMutation.isPending ? (
                    <View style={styles.punchBtnInnerRow}>
                      <ActivityIndicator color="#ffffff" size="small" />
                      <Text style={styles.punchBtnInText}>Processing…</Text>
                    </View>
                  ) : (
                    <Text style={styles.punchBtnInText}>Punch in</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[
                    styles.punchBtnOut,
                    (punchMutation.isPending || punchOutBlocked) && styles.punchBtnMuted,
                  ]}
                  disabled={punchMutation.isPending || punchOutBlocked}
                  onPress={() => void handlePunchRequest('check_out')}
                >
                  {punchMutation.isPending ? (
                    <View style={styles.punchBtnInnerRow}>
                      <ActivityIndicator color="#ffffff" size="small" />
                      <Text style={styles.punchBtnOutText}>Processing…</Text>
                    </View>
                  ) : (
                    <Text style={styles.punchBtnOutText}>Punch out</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Active jobs</Text>
            <Text style={styles.sectionSubtitle}>Stay aligned with today’s dispatch plan.</Text>
          </View>
          <Pressable onPress={() => refetch()} style={styles.refreshChip}>
            <Text style={styles.refreshChipText}>Refresh</Text>
          </Pressable>
        </View>
        {renderJobCards()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  baseText: {
    fontFamily: Fonts?.sans,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  scrollContent: {
    paddingBottom: 32
  },
  pageHeader: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 4
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: Fonts?.sans,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  pageSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  pageLead: {
    color: '#6b7280',
    marginTop: 12,
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  punchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  punchTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  punchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  punchFaceHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 15,
    fontFamily: Fonts?.sans,
  },
  punchTimes: {
    maxWidth: '46%',
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    fontFamily: Fonts?.sans,
  },
  punchBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  punchBtnIn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  punchBtnInText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  punchBtnOut: {
    flex: 1,
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  punchBtnOutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  punchBtnMuted: {
    opacity: 0.4,
  },
  punchBtnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  punchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  punchModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  punchModalSpinner: {
    marginBottom: 20,
  },
  punchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    fontFamily: Fonts?.sans,
  },
  punchModalSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#64748b',
    textAlign: 'center',
    fontFamily: Fonts?.sans,
  },
  punchSuccessIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  punchSuccessIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#059669',
  },
  logoutButton: {
    borderRadius: 999,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  sectionSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    fontFamily: Fonts?.sans,
  },
  refreshChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  refreshChipText: {
    color: '#374151',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    fontFamily: Fonts?.sans,
  },
  cardSubtitle: {
    color: '#6b7280',
    marginTop: 2,
    fontFamily: Fonts?.sans,
  },
  cardCode: {
    color: '#9ca3af',
    fontSize: 13,
    letterSpacing: 0.4,
    fontFamily: Fonts?.sans,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  statusText: {
    fontWeight: '600',
    textTransform: 'capitalize',
    fontFamily: Fonts?.sans,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 12
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  cardValue: {
    color: '#111827',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  cardLocationSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: '#4b5563',
    fontFamily: Fonts?.sans,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    fontFamily: Fonts?.sans,
  },
  emptySubtitle: {
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: Fonts?.sans,
  }
});
