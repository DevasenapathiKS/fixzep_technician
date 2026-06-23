import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { TECHNICIAN_NOTIFICATION_SOUND } from '@/constants/notification-audio';
import { useAuth } from '@/hooks/useAuth';
import { apiBaseUrl } from '@/lib/api-client';


const SOCKET_EVENTS = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_RESCHEDULED: 'ORDER_RESCHEDULED',
  TECHNICIAN_ASSIGNED: 'TECHNICIAN_ASSIGNED',
  JOB_UPDATED: 'JOB_UPDATED',
  CUSTOMER_ORDER_PLACED: 'CUSTOMER_ORDER_PLACED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  TECHNICIAN_CHECKED_IN: 'TECHNICIAN_CHECKED_IN',
  CUSTOMER_APPROVAL_REQUIRED: 'CUSTOMER_APPROVAL_REQUIRED',
  CUSTOMER_APPROVAL_UPDATED: 'CUSTOMER_APPROVAL_UPDATED',
  TECHNICIAN_UNASSIGNED: 'TECHNICIAN_UNASSIGNED',
  ORDER_CANCELLATION_REQUESTED: 'ORDER_CANCELLATION_REQUESTED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_CHAT_MESSAGE: 'ORDER_CHAT_MESSAGE'
} as const;

const ORDER_ACTIVITY = 'ORDER_ACTIVITY';

type SocketEventKey = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

interface TechnicianSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  lastEvent?: { event: SocketEventKey; payload: any } | null;
  joinOrder: (orderId: string) => void;
  leaveOrder: (orderId: string) => void;
}

const TechnicianSocketContext = createContext<TechnicianSocketContextValue | undefined>(undefined);

const SOCKET_URL = apiBaseUrl.replace(/\/api\/?$/, '');

export const TechnicianSocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ event: SocketEventKey; payload: any } | null>(null);
  const queryClient = useQueryClient();
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const playNotification = useCallback(() => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const instance: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    setSocket(instance);

    instance.on('connect', () => {
      setIsConnected(true);
      console.log('[TechnicianSocket] Connected', instance.id);
      instance.emit('technician:join', { userId: user.id });
    });

    instance.on('disconnect', () => {
      console.log('[TechnicianSocket] Disconnected');
      setIsConnected(false);
    });

    instance.on('connect_error', (error) => {
      console.log('[TechnicianSocket] Connection error', error.message);
      setIsConnected(false);
    });

    const handleEvent = (event: SocketEventKey, payload: any) => {
      console.log(`[TechnicianSocket] Received ${event}`, payload);

      // Always refresh in-app notification list
      queryClient.invalidateQueries({ queryKey: ['technicianNotifications'] });

       setLastEvent({ event, payload });

      playNotification();

      /** When app is not active, socket may still deliver briefly — show a system notification (remote push handles fully killed state). */
      if (event === SOCKET_EVENTS.ORDER_CHAT_MESSAGE) {
        const life = AppState.currentState;
        if (life === 'background' || life === 'inactive') {
          const p = payload as { message?: string; orderCode?: string };
          const code = p?.orderCode ? `#${p.orderCode}` : '';
          const msg = typeof p?.message === 'string' ? p.message : '';
          const body = msg
            ? `${msg}`
            : code
              ? `New message on order ${code}`
              : 'You have a new message';
          void Notifications.scheduleNotificationAsync({
            content: {
              title: 'New message',
              body,
              data: payload as Record<string, unknown>,
              sound: TECHNICIAN_NOTIFICATION_SOUND
            },
            trigger: null
          }).catch(() => undefined);
        }
      }

      if (
        event === SOCKET_EVENTS.TECHNICIAN_ASSIGNED ||
        event === SOCKET_EVENTS.TECHNICIAN_UNASSIGNED ||
        event === SOCKET_EVENTS.JOB_UPDATED ||
        event === SOCKET_EVENTS.ORDER_RESCHEDULED ||
        event === SOCKET_EVENTS.ORDER_CANCELLED ||
        event === SOCKET_EVENTS.ORDER_CANCELLATION_REQUESTED ||
        event === SOCKET_EVENTS.CUSTOMER_APPROVAL_UPDATED ||
        event === SOCKET_EVENTS.ORDER_CHAT_MESSAGE
      ) {
        queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
        queryClient.invalidateQueries({ queryKey: ['technicianJobsAll'] });
      }
    };

    (Object.values(SOCKET_EVENTS) as SocketEventKey[]).forEach((event) => {
      instance.on(event, (payload: any) => handleEvent(event, payload));
    });

    instance.on(ORDER_ACTIVITY, (payload: { orderId?: string }) => {
      if (payload?.orderId) {
        queryClient.invalidateQueries({ queryKey: ['jobDetail'] });
        queryClient.invalidateQueries({ queryKey: ['technicianNotifications'] });
      }
    });

    return () => {
      instance.off(ORDER_ACTIVITY);
      (Object.values(SOCKET_EVENTS) as SocketEventKey[]).forEach((event) => {
        instance.off(event);
      });
      instance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id, queryClient, playNotification]);

  const joinOrder = useCallback(
    (orderId: string) => {
      if (socket?.connected && user?.id && orderId) {
        socket.emit('order:join', { orderId, userId: user.id, role: 'technician' });
      }
    },
    [socket, user?.id]
  );

  const leaveOrder = useCallback(
    (orderId: string) => {
      if (socket?.connected && orderId) {
        socket.emit('order:leave', { orderId });
      }
    },
    [socket]
  );

  const value = useMemo<TechnicianSocketContextValue>(
    () => ({ socket, isConnected, lastEvent, joinOrder, leaveOrder }),
    [socket, isConnected, lastEvent, joinOrder, leaveOrder]
  );

  return <TechnicianSocketContext.Provider value={value}>{children}</TechnicianSocketContext.Provider>;
};

export const useTechnicianSocket = () => {
  const ctx = useContext(TechnicianSocketContext);
  if (!ctx) {
    throw new Error('useTechnicianSocket must be used within TechnicianSocketProvider');
  }
  return ctx;
};
