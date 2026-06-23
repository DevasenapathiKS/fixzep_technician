import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianLeaveRow } from '@/types/api';

export default function ProfileLeaveRequestsScreen() {
  const queryClient = useQueryClient();
  const leaveQuery = useQuery({
    queryKey: ['technicianLeave'],
    queryFn: () => technicianApi.listMyLeaveRequests(),
  });

  const cancelLeaveMutation = useMutation({
    mutationFn: (id: string) => technicianApi.cancelLeaveRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technicianLeave'] }),
  });

  const rows = leaveQuery.data || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={leaveQuery.isRefetching} onRefresh={() => leaveQuery.refetch()} />
        }
      >
        <Text style={styles.lead}>Track status of your leave requests. Pending items can be cancelled here.</Text>

        {leaveQuery.isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.muted}>When you apply for leave, it will show up here.</Text>
          </View>
        ) : (
          rows.map((row: TechnicianLeaveRow) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.dates}>
                  {dayjs(row.startDate).format('D MMM')} – {dayjs(row.endDate).format('D MMM YYYY')}
                </Text>
                <View style={[styles.badge, statusBadgeStyle(row.status)]}>
                  <Text style={styles.badgeText}>{row.status}</Text>
                </View>
              </View>
              {row.leaveType === 'comp_off' ? (
                <Text style={styles.compBadge}>Using comp‑off balance</Text>
              ) : null}
              {row.reason ? <Text style={styles.reason}>{row.reason}</Text> : null}
              {row.adminNote ? <Text style={styles.adminNote}>Admin: {row.adminNote}</Text> : null}
              {row.status === 'pending' ? (
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    Alert.alert('Cancel leave', 'Cancel this request?', [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Yes, cancel',
                        style: 'destructive',
                        onPress: () => cancelLeaveMutation.mutate(row.id),
                      },
                    ]);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel request</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusBadgeStyle(status: string) {
  const s = status?.toLowerCase() || '';
  if (s === 'approved') return { backgroundColor: '#dcfce7' };
  if (s === 'rejected' || s === 'declined') return { backgroundColor: '#fee2e2' };
  return { backgroundColor: '#fef3c7' };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: 16, paddingBottom: 32 },
  lead: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: Fonts?.sans,
  },
  muted: { fontSize: 14, color: '#9ca3af', fontFamily: Fonts?.sans },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    fontFamily: Fonts?.sans,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  dates: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827', fontFamily: Fonts?.sans },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151', textTransform: 'capitalize', fontFamily: Fonts?.sans },
  compBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#5b21b6',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: Fonts?.sans,
  },
  reason: { fontSize: 14, color: '#4b5563', marginBottom: 6, fontFamily: Fonts?.sans },
  adminNote: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', fontFamily: Fonts?.sans },
  cancelBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelBtnText: { color: '#b91c1c', fontWeight: '600', fontSize: 14, fontFamily: Fonts?.sans },
});
