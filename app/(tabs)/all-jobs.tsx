import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppLogo from '@/components/ui/app-logo';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianJobSummary } from '@/types/api';

const statusTheme: Record<string, { badgeBackground: string; text: string; cardBackground: string; cardBorder: string }> = {
  pending: { badgeBackground: '#fff7ed', text: '#b45309', cardBackground: '#ffffff', cardBorder: '#e5e7eb' },
  assigned: { badgeBackground: '#eff6ff', text: '#1d4ed8', cardBackground: '#ffffff', cardBorder: '#e5e7eb' },
  inprogress: { badgeBackground: '#dbeafe', text: '#1d4ed8', cardBackground: '#eff6ff', cardBorder: '#93c5fd' },
  completed: { badgeBackground: '#dcfce7', text: '#166534', cardBackground: '#f0fdf4', cardBorder: '#86efac' },
  cancelled: { badgeBackground: '#fee2e2', text: '#b91c1c', cardBackground: '#fef2f2', cardBorder: '#fca5a5' }
};

const JobCard = ({ job }: { job: TechnicianJobSummary }) => {
  const scheduledAt = job.order?.scheduledAt || job.order?.timeWindowStart;
  const scheduleLabel = scheduledAt ? dayjs(scheduledAt).format('DD MMM, h:mm A') : 'Awaiting schedule';
  const normalizedStatus = (job.status || '').toLowerCase().replace(/[\s_-]/g, '');
  const badgeStyle = statusTheme[normalizedStatus] || {
    badgeBackground: '#f3f4f6',
    text: '#6b7280',
    cardBackground: '#ffffff',
    cardBorder: '#e5e7eb'
  };

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
      {job.order?.customer?.addressLine1 ? (
        <View style={[styles.cardRow, { marginTop: 8 }]}>
          <Text style={styles.cardLabel}>Location</Text>
          <Text style={[styles.cardValue, { textAlign: 'right', flex: 1, marginLeft: 12 }]} numberOfLines={1}>
            {job.order.customer.addressLine1}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

export default function AllJobsScreen() {
  const { user } = useAuth();

  const {
    data: jobs,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TechnicianJobSummary[]>({
    queryKey: ['technicianJobsAll'],
    queryFn: () => technicianApi.listJobCards(),
    staleTime: 60_000
  });

  const totalJobs = jobs?.length ?? 0;

  const renderJobCards = () => {
    if (isLoading) {
      return <ActivityIndicator style={{ marginTop: 32 }} />;
    }
    if (!jobs?.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No jobs found</Text>
          <Text style={styles.emptySubtitle}>You don't have any assigned jobs yet.</Text>
        </View>
      );
    }
    return jobs.map((job) => <JobCard key={job.id} job={job} />);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.pageHeader}>
          <View>
            <View style={styles.brandRow}>
              <AppLogo size={24} />
              <Text style={styles.brandText}>FixZep</Text>
            </View>
            <Text style={styles.pageTitle}>All jobs</Text>
            <Text style={styles.pageSubtitle}>
              {user?.name ? `${user.name}, here are all your jobs.` : 'View your full job history.'}
            </Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{totalJobs} total</Text>
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Job list</Text>
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
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans
  },
  pageSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    fontSize: 14,
    fontFamily: Fonts?.sans
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  chipText: {
    color: '#374151',
    fontWeight: '600',
    fontFamily: Fonts?.sans
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts?.sans
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
    fontFamily: Fonts?.sans
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
    fontFamily: Fonts?.sans
  },
  cardSubtitle: {
    color: '#6b7280',
    marginTop: 2,
    fontFamily: Fonts?.sans
  },
  cardCode: {
    color: '#9ca3af',
    fontSize: 13,
    letterSpacing: 0.4,
    fontFamily: Fonts?.sans
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  statusText: {
    fontWeight: '600',
    textTransform: 'capitalize',
    fontFamily: Fonts?.sans
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
    fontFamily: Fonts?.sans
  },
  cardValue: {
    color: '#111827',
    fontWeight: '600',
    fontFamily: Fonts?.sans
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
    fontFamily: Fonts?.sans
  },
  emptySubtitle: {
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: Fonts?.sans
  }
});
