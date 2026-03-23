import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { technicianApi } from '@/lib/technician-api';
import type { TechnicianNotification } from '@/types/api';

const eventLabels: Record<string, string> = {
  TECHNICIAN_ASSIGNED: 'New job assigned',
  JOB_UPDATED: 'Job updated',
  ORDER_RESCHEDULED: 'Job rescheduled',
  CUSTOMER_APPROVAL_REQUIRED: 'Customer approval needed',
  CUSTOMER_APPROVAL_UPDATED: 'Customer responded',
  ORDER_CANCELLATION_REQUESTED: 'Cancellation requested',
  ORDER_CANCELLED: 'Order cancelled',
  ORDER_CHAT_MESSAGE: 'New message'
};

const NotificationCard = ({ notification, onPress }: { notification: TechnicianNotification; onPress: () => void }) => {
  const createdAt = notification.createdAt ? dayjs(notification.createdAt).format('DD MMM, h:mm A') : '';
  const isUnread = !notification.readAt;
  const payloadObject = (notification.payload ?? undefined) as Record<string, unknown> | undefined;
  const orderCode = typeof payloadObject?.['orderCode'] === 'string' ? payloadObject.orderCode : null;
  const message = typeof payloadObject?.['message'] === 'string' ? payloadObject.message : null;
  const title = eventLabels[notification.event ?? ''] ?? notification.event?.replace(/_/g, ' ') ?? 'Update';

  return (
    <Pressable style={[styles.card, isUnread && styles.cardUnread]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, isUnread && styles.cardIconUnread]}>
          <Text style={styles.cardIconText}>{notification.event === 'ORDER_CHAT_MESSAGE' ? '💬' : '📋'}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardTimestamp}>{createdAt}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
      {(orderCode || message) ? (
        <Text style={styles.cardBody} numberOfLines={2}>
          {orderCode ? `#${orderCode}` : ''}
          {orderCode && message ? ' · ' : ''}
          {message ?? ''}
        </Text>
      ) : null}
      <Text style={styles.cardOpen}>Open job →</Text>
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
  const notifications: TechnicianNotification[] = data ?? [];

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => technicianApi.markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technicianNotifications'] });
    }
  });

  const handleOpen = (notification: TechnicianNotification) => {
    if (!notification.id) return;
    if (!notification.readAt) {
      markReadMutation.mutate(notification.id);
    }
    const payload = (notification.payload ?? {}) as Record<string, unknown>;
    const jobCardId = typeof payload.jobCardId === 'string' && payload.jobCardId.length ? payload.jobCardId : null;
    const orderId = typeof payload.orderId === 'string' && payload.orderId.length ? payload.orderId : null;
    if (jobCardId) {
      router.push(`/job-card/${jobCardId}`);
    } else if (orderId) {
      router.push(`/job-card/${orderId}`);
    }
  };

  const renderContent = () => {
    if (isLoading && !notifications.length) {
      return <ActivityIndicator style={{ marginTop: 32 }} />;
    }

    if (!notifications.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>Stay tuned for dispatch updates, approvals, and reminders.</Text>
        </View>
      );
    }

    return notifications.map((item) => (
      <NotificationCard key={item.id} notification={item} onPress={() => handleOpen(item)} />
    ));
  };

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderRow}>
            <View>
              <View style={styles.brandRow}>
                <AppLogo size={24} />
                <Text style={styles.brandText}>FixZep</Text>
              </View>
              <Text style={styles.pageTitle}>Notifications</Text>
              <Text style={styles.pageSubtitle}>Signals from dispatch and finance in real-time.</Text>
            </View>
            <Pressable style={styles.refreshButton} onPress={() => refetch()}>
              <Text style={styles.refreshButtonText}>Sync</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.statsPanel}>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Unread</Text>
              <Text style={styles.heroStatValue}>{unreadCount}</Text>
            </View>
            <View style={[styles.heroStatCard, styles.heroStatCardLast]}>
              <Text style={styles.heroStatLabel}>Total alerts</Text>
              <Text style={styles.heroStatValue}>{notifications.length}</Text>
            </View>
          </View>
        </View>
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
    padding: 4,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  pageSubtitle: {
    color: '#6b7280',
    marginTop: 6,
    fontFamily: Fonts?.sans,
  },
  refreshButton: {
    borderRadius: 999,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  statsPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb'
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 0
  },
  heroStatCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 12
  },
  heroStatCardLast: {
    marginRight: 0
  },
  heroStatLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  heroStatValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    fontFamily: Fonts?.sans,
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 16
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  sectionSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    fontFamily: Fonts?.sans,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  cardUnread: {
    borderColor: '#111827',
    backgroundColor: '#f8fafc'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  cardIconUnread: {
    backgroundColor: '#111827'
  },
  cardIconText: {
    fontSize: 18
  },
  cardHeaderText: {
    flex: 1
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  cardTimestamp: {
    marginTop: 2,
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
    marginLeft: 8
  },
  cardBody: {
    marginTop: 12,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts?.sans,
  },
  cardOpen: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 40,
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
