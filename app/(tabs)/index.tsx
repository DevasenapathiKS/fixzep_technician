import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView
} from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianJobSummary } from '@/types/api';

const statusColors: Record<string, string> = {
  pending: '#fbbf24',
  assigned: '#38bdf8',
  inprogress: '#34d399',
  completed: '#22d3ee',
  cancelled: '#f87171'
};

const JobCard = ({ job }: { job: TechnicianJobSummary }) => {
  const scheduledAt = job.order?.scheduledAt || job.order?.timeWindowStart;
  const scheduleLabel = scheduledAt ? dayjs(scheduledAt).format('DD MMM, h:mm A') : 'Awaiting schedule';
  const normalizedStatus = (job.status || '').toLowerCase().replace(/[\s_-]/g, '');
  const badgeColor = statusColors[normalizedStatus] || '#94a3b8';

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/job-card/${job.id}`)}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardCode}>{job.order?.code ?? job.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.statusText}>{job.status || 'Unknown'}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{job.order?.serviceItem?.name || 'Service job'}</Text>
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

export default function JobListScreen() {
  const { user, logout } = useAuth();

  const {
    data: jobs,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TechnicianJobSummary[]>({
    queryKey: ['technicianJobs'],
    queryFn: () => technicianApi.listJobCards(),
    staleTime: 30_000
  });

  const totalJobs = jobs?.length ?? 0;
  const inProgressJobs = jobs?.filter((job) => job.status?.toLowerCase() === 'inprogress').length ?? 0;
  const pendingJobs = jobs?.filter((job) => job.status?.toLowerCase() === 'pending').length ?? 0;

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <LinearGradient colors={['#050b18', '#0a1427', '#0f1c33']} style={styles.heroPanel}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroGreeting}>Welcome back</Text>
              <Text style={styles.heroName}>{user?.name ?? 'Technician'}</Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={() => logout().catch(() => null)}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
          <Text style={styles.heroSubtitle}>Monitor schedules, capture check-ins, and close jobs with confidence.</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Total jobs</Text>
              <Text style={styles.heroStatValue}>{totalJobs}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>In progress</Text>
              <Text style={styles.heroStatValue}>{inProgressJobs}</Text>
            </View>
            <View style={[styles.heroStatCard, styles.heroStatCardLast]}>
              <Text style={styles.heroStatLabel}>Awaiting start</Text>
              <Text style={styles.heroStatValue}>{pendingJobs}</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Active jobs</Text>
            <Text style={styles.sectionSubtitle}>Stay aligned with today’s dispatch plan.</Text>
          </View>
          <Pressable onPress={refetch} style={styles.refreshChip}>
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
    backgroundColor: '#030712'
  },
  scrollContent: {
    paddingBottom: 32
  },
  heroPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroGreeting: {
    color: 'rgba(241,245,249,0.7)'
  },
  heroName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff'
  },
  heroSubtitle: {
    color: 'rgba(226,232,240,0.85)',
    marginTop: 16,
    marginBottom: 20
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  heroStatCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 12
  },
  heroStatCardLast: {
    marginRight: 0
  },
  heroStatLabel: {
    color: 'rgba(226,232,240,0.65)',
    fontSize: 12,
    letterSpacing: 0.4
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4
  },
  logoutButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600'
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
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700'
  },
  sectionSubtitle: {
    color: 'rgba(148,163,184,0.85)',
    marginTop: 4
  },
  refreshChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  refreshChipText: {
    color: '#60a5fa',
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
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
    color: '#fff',
    marginTop: 8
  },
  cardSubtitle: {
    color: 'rgba(226,232,240,0.7)',
    marginTop: 2
  },
  cardCode: {
    color: 'rgba(226,232,240,0.6)',
    fontSize: 13,
    letterSpacing: 0.4
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.2)',
    marginVertical: 12
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardLabel: {
    color: 'rgba(148,163,184,0.8)',
    fontSize: 12
  },
  cardValue: {
    color: '#e2e8f0',
    fontWeight: '600'
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    padding: 24,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8
  },
  emptySubtitle: {
    color: 'rgba(148,163,184,0.8)',
    textAlign: 'center'
  }
});
