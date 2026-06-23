import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { router } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { useTechnicianSocket } from '@/context/TechnicianSocketContext';

export const TechnicianNotificationBanner = () => {
  const { lastEvent } = useTechnicianSocket();
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const translateY = useState(new Animated.Value(-120))[0];

  useEffect(() => {
    if (!lastEvent) return;

    const { event, payload } = lastEvent;
    let message = 'New update';
    let sub: string | null = null;

    switch (event) {
      case 'TECHNICIAN_ASSIGNED':
        message = 'New job assigned';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'JOB_UPDATED':
        message = 'Job card updated';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'ORDER_RESCHEDULED':
        message = 'Job rescheduled';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'CUSTOMER_APPROVAL_REQUIRED':
        message = 'Customer approval required';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'CUSTOMER_APPROVAL_UPDATED':
        message = 'Customer approval updated';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'ORDER_CANCELLATION_REQUESTED':
        message = 'Cancellation requested';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'ORDER_CANCELLED':
        message = 'Order cancelled';
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
        break;
      case 'ORDER_CHAT_MESSAGE':
        message = 'New message';
        sub =
          typeof payload?.message === 'string' && payload.message.length
            ? payload.message.slice(0, 50) + (payload.message.length > 50 ? '…' : '')
            : payload?.orderCode
              ? `#${payload.orderCode}`
              : null;
        break;
      default:
        sub = payload?.orderCode ? `#${payload.orderCode}` : null;
    }

    setLabel(message);
    setSubtitle(sub);
    setOrderId(typeof payload?.orderId === 'string' ? payload.orderId : null);
    setVisible(true);

    Animated.sequence([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.delay(3500),
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => {
      setVisible(false);
    });
  }, [lastEvent, translateY]);

  if (!visible || !label) return null;

  const topOffset = Platform.OS === 'ios' ? 56 : 44;

  const handlePress = () => {
    const jobCardId = typeof lastEvent?.payload?.jobCardId === 'string' ? lastEvent.payload.jobCardId : null;
    if (jobCardId) {
      router.push(`/job-card/${jobCardId}`);
    } else if (orderId) {
      router.push(`/job-card/${orderId}`);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          top: topOffset
        }
      ]}
    >
      <Pressable style={styles.inner} onPress={handlePress} android_ripple={{ color: 'rgba(255,255,255,0.15)' }}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Fixzep</Text>
        </View>
        <Text style={styles.message}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {orderId ? <Text style={styles.tapHint}>Tap to open job</Text> : null}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50
  },
  inner: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8
  },
  badgeText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.bold,
  },
  message: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.bold,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 13,
    marginTop: 4,
    fontFamily: Fonts.regular,
  },
  tapHint: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 6,
    fontFamily: Fonts.regular,
  },
});
