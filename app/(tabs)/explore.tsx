import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { technicianApi } from '@/lib/technician-api';
import type { TechnicianNotification } from '@/types/api';

const NotificationCard = ({ notification, onPress }: { notification: TechnicianNotification; onPress: () => void }) => {
  const createdAt = notification.createdAt ? dayjs(notification.createdAt).format('DD MMM, h:mm A') : '';
  const isUnread = !notification.readAt;
  const payloadObject = (notification.payload ?? undefined) as Record<string, unknown> | undefined;
  const payloadSummary = (() => {
    if (!payloadObject) {
      return 'Tap to open';
    }
    const orderCode = payloadObject['orderCode'];
    if (typeof orderCode === 'string' && orderCode.length) {
      return orderCode;
    }
    const customerName = payloadObject['customerName'];
    if (typeof customerName === 'string' && customerName.length) {
      return customerName;
    }
    const message = payloadObject['message'];
    if (typeof message === 'string' && message.length) {
      return message;
    }
    return 'Tap to open';
  })();

  return (
    <Pressable style={[styles.card, isUnread && styles.cardUnread]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{notification.event?.replace(/_/g, ' ') || 'Update'}</Text>
          <Text style={styles.cardTimestamp}>{createdAt}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
      {notification.payload?.message ? (
        <Text style={styles.cardBody}>{String(notification.payload.message)}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardPayloadLabel}>Payload</Text>
        <Text style={styles.cardPayloadValue} numberOfLines={1}>
          {payloadSummary}
        </Text>
      </View>
    </Pressable>
  );
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TechnicianNotification[]>({
    queryKey: ['technicianNotifications'],
    queryFn: () => technicianApi.listNotifications(),
    staleTime: 20_000
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => technicianApi.markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianNotifications'] });
    }
  });

  const handleOpen = (notification: TechnicianNotification) => {
    if (!notification.id || notification.readAt) {
      return;
    }
    markReadMutation.mutate(notification.id);
  };

  const renderContent = () => {
    if (isLoading && !data?.length) {
      return <ActivityIndicator style={{ marginTop: 32 }} />;
    }

    if (!data?.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>Stay tuned for dispatch updates, approvals, and reminders.</Text>
        </View>
      );
    }

    return data.map((item) => (
      <NotificationCard key={item.id} notification={item} onPress={() => handleOpen(item)} />
    ));
  };

  const unreadCount = data?.filter((notification) => !notification.readAt).length ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <LinearGradient colors={['#050b18', '#0a1427', '#10203a']} style={styles.heroPanel}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>Notifications</Text>
              <Text style={styles.heroSubtitle}>Signals from dispatch and finance in real-time.</Text>
            </View>
            <Pressable style={styles.refreshButton} onPress={() => refetch()}>
              <Text style={styles.refreshButtonText}>Sync</Text>
            </Pressable>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Unread</Text>
              <Text style={styles.heroStatValue}>{unreadCount}</Text>
            </View>
            <View style={[styles.heroStatCard, styles.heroStatCardLast]}>
              <Text style={styles.heroStatLabel}>Total alerts</Text>
              <Text style={styles.heroStatValue}>{data?.length ?? 0}</Text>
            </View>
          </View>
        </LinearGradient>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Latest updates</Text>
          <Text style={styles.sectionSubtitle}>Tap an alert to acknowledge and mark it read.</Text>
        </View>
        {renderContent()}
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
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff'
  },
  heroSubtitle: {
    color: 'rgba(226,232,240,0.8)',
    marginTop: 6
  },
  refreshButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 20
  },
  heroStatCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginRight: 12
  },
  heroStatCardLast: {
    marginRight: 0
  },
  heroStatLabel: {
    color: 'rgba(226,232,240,0.6)',
    fontSize: 13
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 16
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc'
  },
  sectionSubtitle: {
    color: 'rgba(148,163,184,0.85)',
    marginTop: 4
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)'
  },
  cardUnread: {
    borderColor: 'rgba(14,165,233,0.5)'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff'
  },
  cardTimestamp: {
    marginTop: 4,
    color: 'rgba(148,163,184,0.7)',
    fontSize: 12
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38bdf8'
  },
  cardBody: {
    marginTop: 16,
    color: '#e2e8f0',
    lineHeight: 20
  },
  cardFooter: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
    paddingTop: 12
  },
  cardPayloadLabel: {
    color: 'rgba(148,163,184,0.7)',
    fontSize: 12,
    marginBottom: 4
  },
  cardPayloadValue: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
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
    color: 'rgba(148,163,184,0.85)',
    textAlign: 'center'
  }
});
