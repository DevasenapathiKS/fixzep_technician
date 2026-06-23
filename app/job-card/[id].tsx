import { useTechnicianSocket } from '@/context/TechnicianSocketContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JobCardTentativeSqFtField } from '@/components/job-card-tentative-sqft-field';
import { Fonts } from '@/constants/theme';
import { DEFAULT_BUSINESS_TIMEZONE, visitsShowEndedSessionToday } from '@/lib/business-calendar';
import { getJobCardCameraEnabled } from '@/lib/camera-preference';
import {
  getTechnicianAddressAreaCity,
  getTechnicianAddressLine1,
  hasTechnicianServiceLocation
} from '@/lib/format-service-address';
import { resolveJobDetailHeroTheme } from '@/lib/job-card-status-theme';
import { technicianApi } from '@/lib/technician-api';
import { useAuth } from '@/hooks/useAuth';
import type {
    JobClosureResolution,
    JobPaymentStatus,
    ServiceCatalogCategory,
    SparePartSummary,
    TechnicianJobDetail
} from '@/types/api';

const userRefId = (ref: unknown): string => {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object') {
    const o = ref as { _id?: unknown; id?: unknown };
    if (o._id != null) return String(o._id);
    if (o.id != null) return String(o.id);
  }
  return String(ref);
};

/** Calendar / visit day comparison (local YYYY-MM-DD). */
function rosterDayKey(value: string | Date | undefined | null): string | null {
  if (value == null || value === '') return null;
  const d = dayjs(value);
  if (!d.isValid()) return null;
  return d.format('YYYY-MM-DD');
}

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(value ?? 0);

type PendingMedia = {
  uri: string;
  base64?: string | null;
  name?: string;
  kind: 'image' | 'video';
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionAccent} />
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const ActionButton = ({
  label,
  onPress,
  loading,
  variant = 'primary',
  disabled
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}) => (
  <TouchableOpacity
    style={[
      styles.actionButton,
      variant === 'outline' && styles.actionButtonOutline,
      (loading || disabled) && styles.actionButtonDisabled
    ]}
    onPress={onPress}
    disabled={loading || disabled}
    activeOpacity={0.85}
  >
    {loading ? (
      <ActivityIndicator color={variant === 'outline' ? '#374151' : '#ffffff'} />
    ) : (
      <Text style={[styles.actionButtonText, variant === 'outline' && styles.actionButtonTextOutline]}>{label}</Text>
    )}
  </TouchableOpacity>
);

const MediaGallery = ({
  media,
  header,
  footer
}: {
  media?: Array<{ url: string; kind?: string; name?: string }>;
  header?: ReactNode;
  footer?: ReactNode;
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const images = (media || []).filter((item) => (item.kind ?? 'image') === 'image' && !!item.url);

  return (
    <Section title="Job photos">
      {header}
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroll}>
          {images.map((item, index) => (
            <TouchableOpacity
              key={item.url || `${index}`}
              style={styles.imageThumbWrap}
              onPress={() => setPreviewUrl(item.url)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.url }} style={styles.imageThumb} />
              <Text style={styles.imageCaption}>{item.name || `Photo ${index + 1}`}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.mediaEmptyState}>
          <Text style={styles.mediaEmptyText}>No photos yet. Add images from the buttons above.</Text>
        </View>
      )}

      {footer}

      <Modal
        visible={Boolean(previewUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.imageModalBackdrop}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setPreviewUrl(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.imageModalCloseText}>Close</Text>
          </TouchableOpacity>
          {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.imageFull} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </Section>
  );
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();

  const {
    data,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TechnicianJobDetail>({
    queryKey: ['jobDetail', id],
    queryFn: () => technicianApi.getJobCard(id as string),
    enabled: Boolean(id)
  });

  const queryClient = useQueryClient();
  const { joinOrder, leaveOrder } = useTechnicianSocket();
  const jobCardIdFromRoute = Array.isArray(id) ? id[0] : id;
  const orderIdFromData = data?.order && typeof (data.order as { id?: string }).id === 'string' ? (data.order as { id: string }).id : null;

  useEffect(() => {
    if (orderIdFromData) {
      joinOrder(orderIdFromData);
      return () => leaveOrder(orderIdFromData);
    }
  }, [orderIdFromData, joinOrder, leaveOrder]);

  const [checkInNote, setCheckInNote] = useState('');
  const [extraModalVisible, setExtraModalVisible] = useState(false);
  const [extraDescription, setExtraDescription] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraQuantity, setExtraQuantity] = useState('1');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [spareModalVisible, setSpareModalVisible] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePartSummary | null>(null);
  const [spareQuantity, setSpareQuantity] = useState('1');
  const [spareUnitPrice, setSpareUnitPrice] = useState('');
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutResolution, setCheckoutResolution] = useState<JobClosureResolution>('completed');
  const [paymentStatusChoice, setPaymentStatusChoice] = useState<JobPaymentStatus>('paid');
  const [followUpNote, setFollowUpNote] = useState('');
  const [checkoutOtp, setCheckoutOtp] = useState('');
  const [activityMessage, setActivityMessage] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingAmcItemKey, setUploadingAmcItemKey] = useState<string | null>(null);
  const [amcPreviewUrl, setAmcPreviewUrl] = useState<string | null>(null);
  const [amcNoteEditor, setAmcNoteEditor] = useState<{ itemKey: string } | null>(null);
  const [amcNoteDraft, setAmcNoteDraft] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  /** Refs block same-frame double taps before mutation isPending flips true. */
  const checkInLockRef = useRef(false);
  const requestCompleteLockRef = useRef(false);
  const dayCheckoutLockRef = useRef(false);
  const submitCheckoutLockRef = useRef(false);
  const [checkInPrepBusy, setCheckInPrepBusy] = useState(false);
  const [checkoutPrepBusy, setCheckoutPrepBusy] = useState(false);
  const [dayCheckoutPrepBusy, setDayCheckoutPrepBusy] = useState(false);

  useEffect(() => {
    getJobCardCameraEnabled().then(setCameraEnabled);
  }, []);

  const { data: spareParts, isFetching: loadingParts } = useQuery<SparePartSummary[]>({
    queryKey: ['technicianSpareParts'],
    queryFn: () => technicianApi.listSpareParts(),
    enabled: spareModalVisible,
    staleTime: 60_000
  });

  const { data: serviceCatalog, isFetching: loadingCatalog } = useQuery<ServiceCatalogCategory[]>({
    queryKey: ['technicianServiceCatalog'],
    queryFn: () => technicianApi.listServiceCatalog(),
    enabled: extraModalVisible,
    staleTime: 300_000
  });

  const closeExtraModal = () => {
    setExtraModalVisible(false);
    setExtraDescription('');
    setExtraAmount('');
    setExtraQuantity('1');
    setSelectedCategoryId(null);
    setSelectedServiceId(null);
  };

  const closeSpareModal = () => {
    setSpareModalVisible(false);
    setSelectedPart(null);
    setSpareQuantity('1');
    setSpareUnitPrice('');
  };

  const closeCheckoutModal = () => {
    setCheckoutModalVisible(false);
    setCheckoutResolution('completed');
    setPaymentStatusChoice('paid');
    setFollowUpNote('');
    setCheckoutOtp('');
  };

  const selectedCategory = useMemo(() => {
    if (!serviceCatalog || !selectedCategoryId) return null;
    return serviceCatalog.find((category) => category.id === selectedCategoryId) ?? null;
  }, [serviceCatalog, selectedCategoryId]);

  const selectedService = useMemo(() => {
    if (!selectedCategory || !selectedServiceId) return null;
    return selectedCategory.items.find((item) => item.id === selectedServiceId) ?? null;
  }, [selectedCategory, selectedServiceId]);

  useEffect(() => {
    if (!extraModalVisible || !serviceCatalog?.length) return;
    const categoryExists = selectedCategoryId
      ? serviceCatalog.some((category) => category.id === selectedCategoryId)
      : false;
    if (categoryExists) return;
    setSelectedCategoryId(serviceCatalog[0].id);
  }, [extraModalVisible, serviceCatalog, selectedCategoryId]);

  useEffect(() => {
    if (!extraModalVisible) return;
    if (!selectedCategory || !selectedCategory.items.length) {
      setSelectedServiceId(null);
      setExtraDescription('');
      setExtraAmount('');
      return;
    }
    const exists = selectedCategory.items.find((item) => item.id === selectedServiceId);
    if (!exists) {
      const fallback = selectedCategory.items[0];
      if (fallback) {
        setSelectedServiceId(fallback.id);
        setExtraDescription(fallback.name);
        setExtraAmount(typeof fallback.basePrice === 'number' ? String(fallback.basePrice) : '');
        setExtraQuantity('1');
      }
    }
  }, [extraModalVisible, selectedCategory, selectedServiceId]);


  const jobCardId = data?.jobCard?.id ?? jobCardIdFromRoute ?? '';

  const invalidateJobData = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
  };

  const checkInMutation = useMutation({
    mutationFn: async (payload: { lat: number; lng: number; note?: string }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.checkIn(jobCardId, payload);
    },
    onSuccess: () => {
      setCheckInNote('');
      invalidateJobData();
      Alert.alert('Check-in recorded', 'Your location has been captured successfully.');
    },
    onError: (error) => {
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Unable to capture your check-in right now. Try again.';
      Alert.alert('Check-in failed', msg);
    }
  });

  const dayCheckoutMutation = useMutation({
    mutationFn: async (payload?: { lat?: number; lng?: number; note?: string }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.dayCheckout(jobCardId, payload);
    },
    onSuccess: () => {
      invalidateJobData();
    }
  });

  const extraWorkMutation = useMutation({
    mutationFn: async (
      items: Array<{ description?: string; amount?: number; serviceCategory: string; serviceItem: string }>
    ) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.addExtraWork(jobCardId, items);
    },
    onSuccess: () => {
      closeExtraModal();
      invalidateJobData();
      Alert.alert('Added', 'Additional service submitted for approval.');
    },
    onError: () => Alert.alert('Failed', 'Could not add the service. Please retry.')
  });

  const sparePartMutation = useMutation({
    mutationFn: async (parts: Array<{ part: string; quantity: number; unitPrice: number }>) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.addSpareParts(jobCardId, parts);
    },
    onSuccess: () => {
      closeSpareModal();
      invalidateJobData();
      Alert.alert('Spare parts recorded', 'Usage submitted for customer approval.');
    },
    onError: () => Alert.alert('Failed', 'Unable to add spare parts right now.')
  });

  const removeExtraWorkMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.removeExtraWork(jobCardId, index);
    },
    onSuccess: () => {
      invalidateJobData();
      Alert.alert('Removed', 'Extra service entry deleted.');
    },
    onError: () => Alert.alert('Failed', 'Could not remove this service right now.')
  });

  const updateTentativeSqFtMutation = useMutation({
    mutationFn: async (payload: { tentativeSqFt: number | null; serviceLineIndex?: number }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.updateTentativeSqFt(jobCardId, payload);
    },
    onSuccess: (updated) => {
      if (id) {
        queryClient.setQueryData(['jobDetail', id], updated);
      }
      queryClient.invalidateQueries({ queryKey: ['technicianJobs'] });
    },
    onError: (error) => {
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Unable to update tentative sq.ft.';
      Alert.alert('Failed', msg);
    }
  });

  const removeSparePartMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.removeSparePart(jobCardId, index);
    },
    onSuccess: () => {
      invalidateJobData();
      Alert.alert('Removed', 'Spare part entry deleted.');
    },
    onError: () => Alert.alert('Failed', 'Could not remove this spare part right now.')
  });

  const patchAmcChecklistMutation = useMutation({
    mutationFn: async (args: { itemKey: string; note?: string; completed?: boolean }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.patchAmcChecklistItem(jobCardId, args);
    },
    onSuccess: () => {
      invalidateJobData();
    },
    onError: (error) => {
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Could not update the checklist.';
      Alert.alert('Update failed', msg);
    }
  });

  const deleteAmcChecklistPhotoMutation = useMutation({
    mutationFn: async (payload: { itemKey: string; photoId: string }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.deleteAmcChecklistPhoto(jobCardId, payload);
    },
    onSuccess: () => invalidateJobData(),
    onError: () => Alert.alert('Failed', 'Could not delete that photo right now.')
  });

  const closeAmcNoteModal = () => {
    setAmcNoteEditor(null);
    setAmcNoteDraft('');
  };

  const saveAmcNoteFromModal = () => {
    if (!amcNoteEditor) return;
    const text = amcNoteDraft.trim();
    const existing = data?.amcInspection?.items?.find((i) => i.itemKey === amcNoteEditor.itemKey);
    if (!existing) {
      closeAmcNoteModal();
      return;
    }
    if (text === (existing.note || '').trim()) {
      closeAmcNoteModal();
      return;
    }
    const photoCountBefore = existing.photos?.length ?? 0;
    const shouldAutoComplete =
      Boolean(text.length) && photoCountBefore > 0 && !existing.completed;
    patchAmcChecklistMutation.mutate(
      shouldAutoComplete
        ? { itemKey: amcNoteEditor.itemKey, note: text, completed: true }
        : { itemKey: amcNoteEditor.itemKey, note: text },
      { onSuccess: () => closeAmcNoteModal() }
    );
  };

  const checkoutMutation = useMutation({
    mutationFn: async (payload: {
      resolution: JobClosureResolution;
      paymentStatus: JobPaymentStatus;
      followUpNote?: string;
      otp: string;
    }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      // Server verifies OTP inside completeJob — never complete before OTP.
      return technicianApi.completeJob(jobCardId, {
        resolution: payload.resolution,
        paymentStatus: payload.paymentStatus,
        followUpNote: payload.followUpNote,
        otp: payload.otp
      });
    },
    onSuccess: () => {
      closeCheckoutModal();
      invalidateJobData();
      Alert.alert('Job closed', 'OTP verified and job card closed successfully.');
    },
    onError: (error) => {
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Unable to verify OTP and close the job card.';
      Alert.alert('Failed', msg);
    }
  });

  const jobStatus = data?.jobCard?.status ?? 'pending';
  const visits = data?.jobCard?.visits || [];
  const checkIns = data?.jobCard?.checkIns || [];
  const myTechId = user?.id ?? '';
  const primaryTechnicianId = userRefId(data?.jobCard?.technician);

  /** Same attribution as server: row technician, else job card primary. */
  const visitRowTechnicianId = (visit: (typeof visits)[number]) =>
    visit.technician != null ? userRefId(visit.technician) : primaryTechnicianId;
  const checkInRowTechnicianId = (entry: (typeof checkIns)[number]) =>
    entry.technician != null ? userRefId(entry.technician) : primaryTechnicianId;

  const visitIsMine = (visit: (typeof visits)[number]) =>
    Boolean(myTechId) && visitRowTechnicianId(visit) === myTechId;
  const checkInIsMine = (entry: (typeof checkIns)[number]) =>
    Boolean(myTechId) && checkInRowTechnicianId(entry) === myTechId;

  const myActiveVisit = visits.find(
    (visit) => visit.status === 'checked_in' && !visit.checkOutAt && visitIsMine(visit)
  );
  const myHasEverCheckedIn = Boolean(
    checkIns.some((c) => checkInIsMine(c)) || visits.some((v) => Boolean(v.checkInAt) && visitIsMine(v))
  );
  const jobHasAnyCheckIn = Boolean(
    checkIns.length > 0 || visits.some((visit) => Boolean(visit.checkInAt))
  );
  const myHasActiveVisit = Boolean(myActiveVisit);
  const isJobClosed = jobStatus === 'completed' || jobStatus === 'follow_up';
  /** Matches server: no visit mutations when job card is locked (see `buildTechnicianVisitDayControls`). */
  const isJobVisitDisabled = isJobClosed || jobStatus === 'locked';
  const calendarSlots = data?.technicianCalendar ?? [];

  /**
   * True when this tech still has roster or visit work on a calendar day after today.
   * Only `blocked` (or unset) calendar rows count; `completed`/`cancelled` do not.
   * Visits: only this tech’s rows; future `scheduled` or open `checked_in` sessions count.
   * Slot end date after today catches overnight windows without relying on `timeWindowEnd`.
   */
  const hasScheduledWorkOnFutureDays = useMemo(() => {
    const serverToday = data?.technicianVisitControls?.businessCalendarDate?.trim();
    const todayKey =
      serverToday && /^\d{4}-\d{2}-\d{2}$/.test(serverToday)
        ? serverToday
        : dayjs().format('YYYY-MM-DD');
    const upcomingCalendarSlots = calendarSlots.filter((s) => {
      const st = s.status;
      return st == null || st === 'blocked';
    });
    for (const s of upcomingCalendarSlots) {
      const startK = rosterDayKey(s.date ?? s.start);
      const endK = s.end ? rosterDayKey(s.end) : null;
      if (startK && startK > todayKey) return true;
      if (endK && endK > todayKey) return true;
    }
    const relevantVisits = visits.filter((v) => {
      if (!myTechId) return false;
      const vt = v.technician != null ? userRefId(v.technician) : primaryTechnicianId;
      return vt === myTechId;
    });
    for (const v of relevantVisits) {
      const d = rosterDayKey(v.visitDate ?? v.checkInAt);
      if (!d || d <= todayKey) continue;
      if (v.status === 'scheduled') return true;
      if (v.status === 'checked_in' && !v.checkOutAt) return true;
    }
    return false;
  }, [calendarSlots, visits, myTechId, primaryTechnicianId, data?.technicianVisitControls?.businessCalendarDate]);

  const businessTz = data?.technicianVisitControls?.timezone ?? DEFAULT_BUSINESS_TIMEZONE;
  const fallbackEndedSessionToday = useMemo(
    () =>
      visitsShowEndedSessionToday(visits, (v) => visitIsMine(v), businessTz),
    [visits, businessTz, myTechId, primaryTechnicianId]
  );
  const visitControls = data?.technicianVisitControls;
  const hasEndedSessionToday =
    visitControls?.hasEndedOnSiteSessionToday ?? fallbackEndedSessionToday;

  const effectiveHasActiveVisit =
    visitControls?.hasActiveVisit !== undefined && visitControls?.hasActiveVisit !== null
      ? Boolean(visitControls.hasActiveVisit)
      : myHasActiveVisit;

  const canCheckIn =
    visitControls?.canCheckIn !== undefined && visitControls?.canCheckIn !== null
      ? Boolean(visitControls.canCheckIn)
      : !isJobVisitDisabled &&
        !effectiveHasActiveVisit &&
        !(visitControls?.hasEndedOnSiteSessionToday ?? fallbackEndedSessionToday);

  /**
   * API `canUseOtpCheckout` is false while checked in (multi-day: end session first).
   * For jobs with no future roster/visit days, `completeJob` auto-closes open visits server-side —
   * so we expose Check out via `canProceedOtpCheckout` even while checked in.
   */
  const canProceedOtpCheckout = useMemo(() => {
    if (isJobVisitDisabled) return false;
    if (!jobHasAnyCheckIn) return false;
    if (hasEndedSessionToday) return false;
    if (effectiveHasActiveVisit && hasScheduledWorkOnFutureDays) return false;
    return true;
  }, [
    isJobVisitDisabled,
    jobHasAnyCheckIn,
    hasEndedSessionToday,
    effectiveHasActiveVisit,
    hasScheduledWorkOnFutureDays
  ]);

  /** Multi-day: end on-site session for today before OTP. Single-day: Check out runs OTP; server closes the visit. */
  const showEndTodayWorkRow =
    effectiveHasActiveVisit && !isJobVisitDisabled && hasScheduledWorkOnFutureDays;
  const showCheckOutButton = canProceedOtpCheckout;

  const actionLocked = isJobVisitDisabled || !effectiveHasActiveVisit;
  const canModifyEntries = !actionLocked;

  useEffect(() => {
    if (!isJobVisitDisabled) return;
    if (extraModalVisible) {
      setExtraModalVisible(false);
      setExtraDescription('');
      setExtraAmount('');
      setSelectedCategoryId(null);
      setSelectedServiceId(null);
    }
    if (spareModalVisible) {
      setSpareModalVisible(false);
      setSelectedPart(null);
      setSpareQuantity('1');
      setSpareUnitPrice('');
    }
    if (checkoutModalVisible) {
      setCheckoutModalVisible(false);
      setCheckoutResolution('completed');
      setPaymentStatusChoice('paid');
      setFollowUpNote('');
      setCheckoutOtp('');
    }
  }, [isJobVisitDisabled, extraModalVisible, spareModalVisible, checkoutModalVisible]);

  const activityHistory = data?.order?.history || [];
  const combinedActivity = useMemo(() => {
    const list = [...activityHistory];
    list.sort((a, b) => {
      const tA = a.performedAt ? new Date(a.performedAt).getTime() : 0;
      const tB = b.performedAt ? new Date(b.performedAt).getTime() : 0;
      return tA - tB;
    });
    return list;
  }, [activityHistory]);

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => technicianApi.sendOrderMessage(jobCardIdFromRoute as string, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobDetail', jobCardIdFromRoute] });
      setActivityMessage('');
    }
  });

  const handleAddActivityNote = useCallback(() => {
    const note = activityMessage.trim();
    if (!note || !jobCardIdFromRoute) return;
    sendMessageMutation.mutate(note);
  }, [activityMessage, jobCardIdFromRoute, sendMessageMutation]);

  if (!id) {
    router.back();
    return null;
  }

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Job not found.</Text>
      </SafeAreaView>
    );
  }

  const { order, jobCard, payments, paymentBreakdown: paymentBreakdownFromApi, amcInspection } = data;
  const heroTheme = resolveJobDetailHeroTheme(jobCard?.status, order?.status);
  const paymentStatusDisplay: JobPaymentStatus = (jobCard?.paymentStatus as JobPaymentStatus) || 'pending';
  const paymentStyleKey: 'paid' | 'partial' | 'pending' =
    paymentStatusDisplay === 'paid'
      ? 'paid'
      : paymentStatusDisplay === 'partial'
        ? 'partial'
        : 'pending';
  const paymentStatusLabel =
    paymentStatusDisplay === 'paid'
      ? 'Paid'
      : paymentStatusDisplay === 'partial'
        ? 'Partially paid'
        : 'Pending';

  const paymentBadgeContainerStyle = {
    paid: styles.paymentBadge_paid,
    partial: styles.paymentBadge_partial,
    pending: styles.paymentBadge_pending
  } as const;

  const paymentBadgeTextStyle = {
    paid: styles.paymentBadge_paid_text,
    partial: styles.paymentBadge_partial_text,
    pending: styles.paymentBadge_pending_text
  } as const;

  const paymentBannerStyle = {
    paid: styles.heroPaymentBanner_paid,
    partial: styles.heroPaymentBanner_partial,
    pending: styles.heroPaymentBanner_pending
  } as const;

  const sparePartsUsed = jobCard?.sparePartsUsed || [];
  const sparePartsSubtotal = sparePartsUsed.reduce((sum, part) => {
    const quantity = part.quantity ?? 0;
    const unitPrice = part.unitPrice ?? (typeof part.part === 'object' ? part.part?.unitPrice ?? 0 : 0);
    return sum + quantity * unitPrice;
  }, 0);

  const extraWorks = jobCard?.extraWork || [];
  const extraWorksSubtotal = extraWorks.reduce((sum, work) => sum + (work.amount ?? 0), 0);

  const servicePriceLump =
    jobCard?.estimateAmount ??
    (typeof data?.order?.serviceItem === 'object' && 'basePrice' in (data?.order?.serviceItem || {})
      ? (data?.order?.serviceItem as Record<string, number | undefined>).basePrice ?? 0
      : 0);

  const customAmount = (jobCard?.customAmount != null && jobCard.customAmount > 0) ? jobCard.customAmount : 0;
  const visitingCharge = Math.round(
    (Number((order as { visitingCharge?: number } | null | undefined)?.visitingCharge) || 0) * 100,
  ) / 100;

  const pb = paymentBreakdownFromApi as
    | {
        preDiscountSubtotal?: number;
        discountAmount?: number;
        discountLabel?: string;
        subtotal?: number;
        taxAmount?: number;
        grandTotal?: number;
        servicePrice?: number;
        visitingCharge?: number;
        sparePartsSubtotal?: number;
        extraWorksSubtotal?: number;
        customAmount?: number;
      }
    | undefined;

  const lumpForServiceLine = pb?.servicePrice ?? servicePriceLump;
  /** When visiting is stored on the order, the job estimate usually includes it — show service net + visiting rows. */
  const displayServicePriceNet =
    visitingCharge > 0
      ? Math.max(0, Math.round((lumpForServiceLine - visitingCharge) * 100) / 100)
      : lumpForServiceLine;

  const linesSubtotalFallback =
    (visitingCharge > 0 ? displayServicePriceNet + visitingCharge : servicePriceLump) +
    sparePartsSubtotal +
    extraWorksSubtotal +
    customAmount;

  const subtotal = pb?.subtotal ?? linesSubtotalFallback;
  const tax = pb?.taxAmount ?? subtotal * 0.18;
  const grandTotal = pb?.grandTotal ?? subtotal + tax;
  const displayServicePrice = displayServicePriceNet;
  const displaySpareSub = pb?.sparePartsSubtotal ?? sparePartsSubtotal;
  const displayExtraSub = pb?.extraWorksSubtotal ?? extraWorksSubtotal;
  const displayCustom = pb?.customAmount ?? customAmount;

  const spareQuantityNumber = Number.isNaN(parseFloat(spareQuantity)) ? 0 : parseFloat(spareQuantity);
  const spareUnitPriceNumber = Number.isNaN(parseFloat(spareUnitPrice || `${selectedPart?.unitPrice ?? 0}`))
    ? 0
    : parseFloat(spareUnitPrice || `${selectedPart?.unitPrice ?? 0}`);
  const sparePreviewTotal = spareQuantityNumber * spareUnitPriceNumber;

  const extraQuantityNumber = Number.isNaN(parseFloat(extraQuantity)) ? 0 : parseFloat(extraQuantity);
  const extraBasePriceNumber = Number.isNaN(parseFloat(extraAmount)) ? 0 : parseFloat(extraAmount);
  const extraPreviewTotal = extraQuantityNumber * (extraBasePriceNumber || 0);


  const appendPendingAssets = (assets: ImagePickerAsset[]) => {
    if (!assets?.length) return;
    setPendingMedia((prev) => [
      ...prev,
      ...assets.map((asset, index) => ({
        uri: asset.uri,
        base64: asset.base64 ?? null,
        name: asset.fileName || asset.assetId || `Photo ${prev.length + index + 1}`,
        kind: 'image' as const
      }))
    ]);
  };

  const loadImagePicker = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      if (
        typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function' ||
        typeof ImagePicker.requestCameraPermissionsAsync !== 'function'
      ) {
        Alert.alert('Image picker unavailable', 'Please rebuild the app to enable photo uploads.');
        return null;
      }
      return ImagePicker;
    } catch (error) {
      console.warn('Image picker unavailable', error);
      Alert.alert('Image picker unavailable', 'Please rebuild the app to enable photo uploads.');
      return null;
    }
  };

  const handleAddFromLibrary = async () => {
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'Photos cannot be updated while the job is closed or locked.');
      return;
    }

    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;

    let permission;
    try {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch (error) {
      console.warn('Image picker permissions failed', error);
      Alert.alert('Image picker unavailable', 'Please rebuild the app to enable photo uploads.');
      return;
    }
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach job photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true
    });

    if (result.canceled || !result.assets?.length) return;
    appendPendingAssets(result.assets);
  };

  const handleCapturePhoto = async () => {
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'Photos cannot be updated while the job is closed or locked.');
      return;
    }

    const enabled = await getJobCardCameraEnabled();
    if (!enabled) {
      Alert.alert(
        'Camera disabled',
        'Camera is turned off in Profile settings. Use "From gallery" to add job photos.'
      );
      return;
    }

    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;

    let permission;
    try {
      const existing = await ImagePicker.getCameraPermissionsAsync?.();
      if (existing?.status === 'denied') {
        Alert.alert(
          'Camera disabled',
          'Camera access is denied. Use "From gallery" to add job photos.'
        );
        return;
      }
      permission = await ImagePicker.requestCameraPermissionsAsync();
    } catch (error) {
      console.warn('Image picker permissions failed', error);
      Alert.alert('Image picker unavailable', 'Please rebuild the app to enable photo uploads.');
      return;
    }
    if (permission.status !== 'granted') {
      Alert.alert(
        'Camera disabled',
        'Camera access was denied. Use "From gallery" to add job photos.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true
    });

    if (result.canceled || !result.assets?.length) return;
    appendPendingAssets(result.assets);
  };

  const handleRemovePendingMedia = (index: number) => {
    setPendingMedia((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadPendingMedia = async () => {
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (!pendingMedia.length) return;
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'Photos cannot be updated while the job is closed or locked.');
      return;
    }

    try {
      setUploadingMedia(true);
      const mediaPayload = pendingMedia.map((item, index) => ({
        url: item.base64 ? `data:image/jpeg;base64,${item.base64}` : item.uri,
        kind: item.kind,
        name: item.name || `Photo ${index + 1}`
      }));

      await technicianApi.uploadJobMedia(jobCardId, mediaPayload);
      setPendingMedia([]);
      invalidateJobData();
      Alert.alert('Uploaded', 'Photos have been attached to this job.');
    } catch (error) {
      console.warn('Job media upload failed', error);
      Alert.alert('Upload failed', 'Unable to upload photos right now. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const uploadAmcChecklistPhotosForItem = async (itemKey: string, assets: ImagePickerAsset[]) => {
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (!assets.length) return;
    if (isJobVisitDisabled) {
      Alert.alert(
        'Job unavailable',
        'Checklist photos cannot be updated while the job is closed or locked.'
      );
      return;
    }
    const itemBefore = data?.amcInspection?.items?.find((i) => i.itemKey === itemKey);
    const hadNoteTrimmed = Boolean((itemBefore?.note || '').trim());
    const prevPhotoCount = itemBefore?.photos?.length ?? 0;
    const totalPhotosAfter = prevPhotoCount + assets.length;

    const mediaPayload = assets.map((asset, index) => ({
      url: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri,
      kind: 'image' as const,
      name: asset.fileName || asset.assetId || `Photo ${index + 1}`
    }));
    try {
      setUploadingAmcItemKey(itemKey);
      await technicianApi.uploadAmcChecklistPhotos(jobCardId, { itemKey, media: mediaPayload });
      if (
        hadNoteTrimmed &&
        totalPhotosAfter > 0 &&
        jobCardId &&
        itemBefore &&
        !itemBefore.completed
      ) {
        try {
          await patchAmcChecklistMutation.mutateAsync({ itemKey, completed: true });
        } catch {
          invalidateJobData();
        }
      } else {
        invalidateJobData();
      }
      Alert.alert('Uploaded', 'Checklist photo(s) saved.');
    } catch (error) {
      console.warn('AMC checklist upload failed', error);
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Unable to upload checklist photos.';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingAmcItemKey(null);
    }
  };

  const handleAmcAddFromLibrary = async (itemKey: string) => {
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'Photos cannot be updated while the job is closed or locked.');
      return;
    }
    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;

    let permission;
    try {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch (error) {
      console.warn('Image picker permissions failed', error);
      Alert.alert('Image picker unavailable', 'Please rebuild the app to enable photo uploads.');
      return;
    }
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach checklist photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true
    });

    if (result.canceled || !result.assets?.length) return;
    await uploadAmcChecklistPhotosForItem(itemKey, result.assets);
  };

  const handleAmcCapturePhoto = async (itemKey: string) => {
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'Photos cannot be updated while the job is closed or locked.');
      return;
    }

    const enabled = await getJobCardCameraEnabled();
    if (!enabled) {
      Alert.alert(
        'Camera disabled',
        'Camera is turned off in Profile settings. Use Gallery to add checklist photos.'
      );
      return;
    }

    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;

    let permission;
    try {
      const existing = await ImagePicker.getCameraPermissionsAsync?.();
      if (existing?.status === 'denied') {
        Alert.alert('Camera disabled', 'Camera access is denied. Use Gallery to add checklist photos.');
        return;
      }
      permission = await ImagePicker.requestCameraPermissionsAsync();
    } catch (error) {
      console.warn('Image picker permissions failed', error);
      Alert.alert('Image picker unavailable', 'Please rebuild the app to enable photo uploads.');
      return;
    }
    if (permission.status !== 'granted') {
      Alert.alert('Camera disabled', 'Camera access was denied. Use Gallery to add checklist photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true
    });

    if (result.canceled || !result.assets?.length) return;
    await uploadAmcChecklistPhotosForItem(itemKey, result.assets);
  };

  const confirmRemoveAmcPhoto = (itemKey: string, photoId: string | undefined) => {
    if (!photoId) return;
    Alert.alert('Remove checklist photo', 'Delete this photo from the AMC checklist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteAmcChecklistPhotoMutation.mutate({ itemKey, photoId })
      }
    ]);
  };


  const handleCheckIn = async () => {
    if (checkInLockRef.current || checkInMutation.isPending || checkInPrepBusy) return;
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'This job card is closed or locked.');
      return;
    }
    if (!canCheckIn) {
      if (hasEndedSessionToday) {
        Alert.alert(
          'Available tomorrow',
          'You already ended your on-site session for today. Check in is available again on the next calendar day.'
        );
      }
      return;
    }
    checkInLockRef.current = true;
    setCheckInPrepBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to check in.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      await checkInMutation.mutateAsync({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        note: checkInNote.trim() || undefined
      });
    } catch (error) {
      console.warn('Check-in failed', error);
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Unable to capture your location.';
      Alert.alert('Check-in failed', msg);
    } finally {
      checkInLockRef.current = false;
      setCheckInPrepBusy(false);
    }
  };

  const handleRequestComplete = () => {
    if (
      requestCompleteLockRef.current ||
      checkoutMutation.isPending ||
      dayCheckoutMutation.isPending ||
      checkoutPrepBusy
    ) {
      return;
    }
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (!jobHasAnyCheckIn) {
      Alert.alert('Check-in required', 'Please check in before closing the job.');
      return;
    }
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'This job card is closed or locked.');
      return;
    }
    if (effectiveHasActiveVisit && hasScheduledWorkOnFutureDays) {
      Alert.alert(
        'End today’s work first',
        'More days are scheduled on this job. Tap End today work when you leave the site, then tap Check out to enter the customer OTP.'
      );
      return;
    }
    if (!canProceedOtpCheckout) {
      Alert.alert(
        'Available tomorrow',
        'You already ended your on-site session for today. OTP checkout is available again on the next calendar day.'
      );
      return;
    }
    requestCompleteLockRef.current = true;
    setCheckoutPrepBusy(true);
    try {
      setCheckoutResolution('completed');
      setPaymentStatusChoice('paid');
      setFollowUpNote('');
      setCheckoutModalVisible(true);
    } finally {
      requestCompleteLockRef.current = false;
      setCheckoutPrepBusy(false);
    }
  };

  const handleDayCheckout = async () => {
    if (
      dayCheckoutLockRef.current ||
      dayCheckoutMutation.isPending ||
      dayCheckoutPrepBusy
    ) {
      return;
    }
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (isJobVisitDisabled) {
      Alert.alert('Job unavailable', 'This job card is closed or locked.');
      return;
    }
    if (!effectiveHasActiveVisit) {
      Alert.alert('No active visit', 'You are already checked out for today.');
      return;
    }
    dayCheckoutLockRef.current = true;
    setDayCheckoutPrepBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await dayCheckoutMutation.mutateAsync({ note: 'Checked out without location permission' });
      } else {
        const position = await Location.getCurrentPositionAsync({});
        await dayCheckoutMutation.mutateAsync({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }
      Alert.alert('Day ended', 'Today work has been checked out. You can continue another day or close the job.');
    } catch (error) {
      console.warn('Day checkout failed', error);
      const ax = error as { response?: { data?: { message?: string } } };
      const msg =
        typeof ax?.response?.data?.message === 'string' && ax.response.data.message.trim()
          ? ax.response.data.message.trim()
          : 'Unable to end today work right now. Try again.';
      Alert.alert('Day checkout failed', msg);
    } finally {
      dayCheckoutLockRef.current = false;
      setDayCheckoutPrepBusy(false);
    }
  };

  const handleSubmitExtraWork = () => {
    if (!selectedCategory || !selectedService) {
      Alert.alert('Select service', 'Pick a category and service before submitting.');
      return;
    }

    const description = (extraDescription.trim() || selectedService.name).trim();
    const baseAmount = selectedService.basePrice ?? 0;
    const parsedAmount = parseFloat(extraAmount || `${baseAmount}`);
    const quantity = parseFloat(extraQuantity || '1');
    if (!description || Number.isNaN(parsedAmount) || parsedAmount <= 0 || Number.isNaN(quantity) || quantity <= 0) {
      Alert.alert('Add service', 'Provide a valid amount for the selected service.');
      return;
    }

    const totalAmount = parsedAmount * quantity;
    const paddedDescription = quantity > 1 ? `${description} (x${quantity})` : description;

    extraWorkMutation.mutate([
      {
        description: paddedDescription,
        amount: totalAmount,
        serviceCategory: selectedCategory.id,
        serviceItem: selectedService.id
      }
    ]);
  };

  const handleSubmitSparePart = () => {
    if (!selectedPart) {
      Alert.alert('Select part', 'Choose a spare part from the catalog.');
      return;
    }
    const quantity = parseFloat(spareQuantity);
    const unitPrice = parseFloat(spareUnitPrice || String(selectedPart.unitPrice || 0));
    if (Number.isNaN(quantity) || quantity <= 0) {
      Alert.alert('Quantity', 'Enter a valid quantity.');
      return;
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      Alert.alert('Unit price', 'Enter a valid unit price.');
      return;
    }
    sparePartMutation.mutate([
      {
        part: selectedPart.id,
        quantity,
        unitPrice
      }
    ]);
  };

  const handleSubmitCheckout = () => {
    if (submitCheckoutLockRef.current || checkoutMutation.isPending) return;
    if (!canProceedOtpCheckout) {
      Alert.alert(
        'Available tomorrow',
        'You already ended your on-site session for today. OTP checkout is available again on the next calendar day.'
      );
      return;
    }
    if (checkoutResolution === 'follow_up' && !followUpNote.trim()) {
      Alert.alert('Follow-up note', 'Provide a short note about the follow-up needed.');
      return;
    }
    if (checkoutResolution === 'completed' && paymentStatusChoice !== 'paid') {
      Alert.alert('Payment required', 'Mark the payment as paid before completing the job.');
      return;
    }
    if (!checkoutOtp.trim()) {
      Alert.alert('OTP required', 'Enter the OTP to verify and close the job card.');
      return;
    }
    submitCheckoutLockRef.current = true;
    checkoutMutation.mutate(
      {
        resolution: checkoutResolution,
        paymentStatus: paymentStatusChoice,
        followUpNote: checkoutResolution === 'follow_up' ? followUpNote.trim() : undefined,
        otp: checkoutOtp.trim()
      },
      {
        onSettled: () => {
          submitCheckoutLockRef.current = false;
        }
      }
    );
  };

  const confirmRemoveExtraWork = (index: number) => {
    Alert.alert('Remove service', 'Delete this additional service entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeExtraWorkMutation.mutate(index)
      }
    ]);
  };

  const confirmRemoveSparePart = (index: number) => {
    Alert.alert('Remove spare part', 'Delete this spare part entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeSparePartMutation.mutate(index)
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.pageHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.pageTitle}>Job details</Text>
            <Text style={styles.pageSubtitle}>{order?.code ? `Order ${order.code}` : 'Service job overview'}</Text>
          </View>
        </View>
        <View
          style={[
            styles.heroPanel,
            { backgroundColor: heroTheme.panelBackground, borderColor: heroTheme.panelBorder }
          ]}
        >
          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroBadgePill, { backgroundColor: heroTheme.badgeBackground }]}>
              <Text style={[styles.heroBadge, { color: heroTheme.badgeText }]}>
                {jobCard?.status?.toUpperCase() || 'PENDING'}
              </Text>
            </View>
            <Text style={styles.heroCode}>{order?.code}</Text>
          </View>
          <View style={[styles.heroPaymentBanner, paymentBannerStyle[paymentStyleKey]]}>
            <Text style={styles.heroPaymentBannerKicker}>Payment status</Text>
            <Text style={[styles.heroPaymentBannerTitle, paymentBadgeTextStyle[paymentStyleKey]]}>
              {paymentStatusDisplay === 'paid' ? '✓ ' : ''}
              {paymentStatusLabel}
            </Text>
          </View>
          <Text style={styles.heroTitle}>
            {order?.serviceVariantLabel
              ? `${order?.serviceItem?.name || 'Service'} – ${order.serviceVariantLabel}`
              : (order?.serviceItem?.name || 'Service job')}
          </Text>
          <Text style={styles.heroSubtitle}>{order?.serviceCategory?.name || 'General service'}</Text>
          <View style={styles.heroMetaRow}>
            <View>
              <Text style={styles.heroMetaLabel}>Scheduled</Text>
              <Text style={styles.heroMetaValue}>
                {order?.scheduledAt
                  ? dayjs(order.scheduledAt).format('DD MMM, h:mm A')
                  : 'Awaiting confirmation'}
              </Text>
            </View>
            <View>
              <Text style={styles.heroMetaLabel}>Estimate (pre-GST)</Text>
              <Text style={styles.heroMetaValue}>
                ₹{(order as { estimatedCost?: number })?.estimatedCost ?? jobCard?.estimateAmount ?? 0}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>On-site actions</Text>
          <Text style={styles.actionsSubtitle}>
            {hasEndedSessionToday && !isJobVisitDisabled
              ? 'You ended your on-site session for today. Check in and Check out (OTP) are available again on the next calendar day.'
              : hasScheduledWorkOnFutureDays && effectiveHasActiveVisit
                ? 'More days are scheduled. End today’s work when you leave the site; use Check out after your session ends (or on the last day when no future days remain).'
                : hasScheduledWorkOnFutureDays && !effectiveHasActiveVisit
                  ? 'Today’s session has ended. Use Check out if the job is fully done, or check in again on your next scheduled day.'
                  : 'When work is finished today, use Check out to end your session and close the job with OTP.'}
          </Text>
          {!myHasEverCheckedIn && !effectiveHasActiveVisit && !isJobVisitDisabled ? (
            <Text style={styles.actionHint}>Check in to enable service additions and spare tracking.</Text>
          ) : null}
          {myHasEverCheckedIn && !effectiveHasActiveVisit && !isJobVisitDisabled && hasScheduledWorkOnFutureDays && !hasEndedSessionToday ? (
            <Text style={styles.actionHint}>
              Finished early? Tap Check out to close with OTP — you don’t need to wait for later roster days.
            </Text>
          ) : null}
          {myHasEverCheckedIn && !effectiveHasActiveVisit && !isJobVisitDisabled && !hasScheduledWorkOnFutureDays ? (
            <Text style={styles.actionHint}>
              {hasEndedSessionToday
                ? 'Today’s session is ended. You can check in again tomorrow for another visit.'
                : 'Today’s work is ended. Check in again if you return for another visit.'}
            </Text>
          ) : null}
          {effectiveHasActiveVisit && !isJobVisitDisabled && !hasScheduledWorkOnFutureDays ? (
            <Text style={styles.actionHint}>
              Tap Check out when done — your on-site session will end first, then you’ll enter the OTP.
            </Text>
          ) : null}
          {isJobVisitDisabled ? (
            <Text style={styles.actionHint}>This job is closed or locked. Actions are read-only.</Text>
          ) : null}
          <TextInput
            style={[styles.noteInput, isJobVisitDisabled && styles.inputDisabled]}
            placeholder="Check-in note (optional)"
            placeholderTextColor="#9ca3af"
            value={checkInNote}
            onChangeText={setCheckInNote}
            multiline
            editable={!isJobVisitDisabled}
          />
          <View style={styles.actionsGrid}>
            <ActionButton
              label={effectiveHasActiveVisit ? 'Checked in' : 'Check in now'}
              onPress={handleCheckIn}
              loading={checkInMutation.isPending || checkInPrepBusy}
              disabled={!canCheckIn || checkInMutation.isPending || checkInPrepBusy}
            />
            <ActionButton
              label="Add service"
              onPress={() => setExtraModalVisible(true)}
              loading={extraWorkMutation.isPending}
              variant="outline"
              disabled={actionLocked}
            />
            <ActionButton
              label="Add spare part"
              onPress={() => setSpareModalVisible(true)}
              loading={sparePartMutation.isPending}
              variant="outline"
              disabled={actionLocked}
            />
            {showEndTodayWorkRow ? (
              <ActionButton
                label="End today work"
                onPress={() => void handleDayCheckout()}
                loading={dayCheckoutMutation.isPending || dayCheckoutPrepBusy}
                variant="outline"
                disabled={
                  isJobVisitDisabled ||
                  !effectiveHasActiveVisit ||
                  dayCheckoutMutation.isPending ||
                  dayCheckoutPrepBusy
                }
              />
            ) : null}
            {showCheckOutButton ? (
              <ActionButton
                label={isJobVisitDisabled ? 'Unavailable' : 'Check out'}
                onPress={() => void handleRequestComplete()}
                loading={
                  checkoutMutation.isPending ||
                  dayCheckoutMutation.isPending ||
                  checkoutPrepBusy
                }
                disabled={
                  isJobVisitDisabled ||
                  !jobHasAnyCheckIn ||
                  checkoutMutation.isPending ||
                  dayCheckoutMutation.isPending ||
                  checkoutPrepBusy
                }
              />
            ) : null}
          </View>
        </View>

        <Section title="Service details">
          <View style={[styles.servicePaymentHighlight, paymentBannerStyle[paymentStyleKey]]}>
            <Text style={styles.servicePaymentHighlightLabel}>Payment</Text>
            <View style={[styles.paymentBadge, paymentBadgeContainerStyle[paymentStyleKey]]}>
              <Text style={[styles.paymentBadgeText, paymentBadgeTextStyle[paymentStyleKey]]}>
                {paymentStatusLabel}
              </Text>
            </View>
          </View>
          <View style={styles.sectionRowColumn}>
            <Text style={styles.rowLabel}>Service</Text>
            <Text style={styles.rowValue}>
              {typeof order?.serviceItem === 'string'
                ? order?.serviceItem
                : order?.serviceVariantLabel
                  ? `${order?.serviceItem?.name || 'Service'} – ${order.serviceVariantLabel}`
                  : (order?.serviceItem?.name || 'Service job')}
            </Text>
          </View>
          <View style={styles.sectionRowColumn}>
            <Text style={styles.rowLabel}>Category</Text>
            <Text style={styles.rowValue}>
              {typeof order?.serviceCategory === 'string'
                ? order?.serviceCategory
                : order?.serviceCategory?.name || '—'}
            </Text>
          </View>
          <View style={styles.sectionRowColumn}>
            <Text style={styles.rowLabel}>Issue details</Text>
            <Text style={styles.rowValue}>
              {order?.issueDescription ||
                (typeof order?.serviceItem === 'object' ? order?.serviceItem?.description : '') ||
                'No description provided.'}
            </Text>
          </View>
          {order?.services && order.services.length > 0
            ? order.services.map((line, idx) => (
                <View key={`sqft-line-${idx}`}>
                  <JobCardTentativeSqFtField
                    value={line.tentativeSqFt ?? null}
                    disabled={isJobVisitDisabled}
                    saving={updateTentativeSqFtMutation.isPending}
                    onSave={(tentativeSqFt) =>
                      updateTentativeSqFtMutation.mutateAsync({ tentativeSqFt, serviceLineIndex: idx })
                    }
                  />
                  {typeof line.estimatedCost === 'number' ? (
                    <Text style={styles.rowValueMuted}>
                      Line estimate: ₹{Math.round(line.estimatedCost).toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>
              ))
            : (
                <View>
                  <JobCardTentativeSqFtField
                    value={order?.tentativeSqFt ?? null}
                    disabled={isJobVisitDisabled}
                    saving={updateTentativeSqFtMutation.isPending}
                    onSave={(tentativeSqFt) => updateTentativeSqFtMutation.mutateAsync({ tentativeSqFt })}
                  />
                  {typeof order?.estimatedCost === 'number' ? (
                    <Text style={styles.rowValueMuted}>
                      Order estimate: ₹{Math.round(order.estimatedCost).toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                </View>
              )}
        </Section>

        {!!amcInspection?.items?.length ? (
          <Section title="AMC checklist">
            {amcInspection.items.map((item, idx, arr) => {
              const busyThis = uploadingAmcItemKey === item.itemKey;
              const checklistLocks =
                !canModifyEntries ||
                patchAmcChecklistMutation.isPending ||
                deleteAmcChecklistPhotoMutation.isPending ||
                busyThis;
              const hasNote = Boolean((item.note || '').trim());
              const photoCount = (item.photos || []).length;
              const isLastRow = idx === arr.length - 1;
              return (
                <View
                  key={item.itemKey}
                  style={[styles.amcItemWrap, isLastRow ? styles.amcItemWrapLast : null]}
                >
                  <View style={styles.amcRowTop}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={checklistLocks}
                      onPress={() =>
                        patchAmcChecklistMutation.mutate({
                          itemKey: item.itemKey,
                          completed: !item.completed
                        })
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <View style={[styles.amcCheckbox, item.completed ? styles.amcCheckboxChecked : null]}>
                        {item.completed ? (
                          <Ionicons name="checkmark" size={13} color="#ffffff" />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.amcRowLabel} numberOfLines={2}>
                      {item.displayLabel}
                    </Text>
                    {canModifyEntries ? (
                      <View style={styles.amcIconRow}>
                        {busyThis ? (
                          <ActivityIndicator size="small" color="#059669" style={styles.amcIconBusy} />
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.amcIconBtn}
                              accessibilityLabel="Note"
                              activeOpacity={0.7}
                              disabled={checklistLocks}
                              onPress={() => {
                                setAmcNoteDraft(item.note ?? '');
                                setAmcNoteEditor({ itemKey: item.itemKey });
                              }}
                            >
                              <Ionicons
                                name="document-text-outline"
                                size={20}
                                color={hasNote ? '#059669' : '#6b7280'}
                              />
                            </TouchableOpacity>
                            {cameraEnabled ? (
                              <TouchableOpacity
                                style={styles.amcIconBtn}
                                accessibilityLabel="Take photo"
                                activeOpacity={0.7}
                                disabled={busyThis || deleteAmcChecklistPhotoMutation.isPending}
                                onPress={() => void handleAmcCapturePhoto(item.itemKey)}
                              >
                                <Ionicons name="camera-outline" size={20} color="#374151" />
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              style={styles.amcIconBtn}
                              accessibilityLabel="Gallery"
                              activeOpacity={0.7}
                              disabled={busyThis || deleteAmcChecklistPhotoMutation.isPending}
                              onPress={() => void handleAmcAddFromLibrary(item.itemKey)}
                            >
                              <Ionicons name="images-outline" size={20} color="#374151" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ) : null}
                  </View>

                  {!canModifyEntries && hasNote ? (
                    <Text style={styles.amcNotePreview} numberOfLines={3}>
                      {item.note}
                    </Text>
                  ) : null}

                  {photoCount > 0 ? (
                    <View style={styles.amcPhotoRowFlex}>
                      {(item.photos || []).map((ph, pIdx) => (
                        <View key={ph.id ?? `${item.itemKey}-p-${pIdx}`} style={styles.amcPhotoThumbWrap}>
                          <TouchableOpacity
                            onPress={() => setAmcPreviewUrl(ph.url)}
                            activeOpacity={0.85}
                            disabled={!ph.url}
                          >
                            <Image source={{ uri: ph.url }} style={styles.amcThumbS} />
                          </TouchableOpacity>
                          {canModifyEntries && ph.id ? (
                            <TouchableOpacity
                              style={styles.amcRemovePhoto}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              onPress={() => confirmRemoveAmcPhoto(item.itemKey, ph.id)}
                              disabled={
                                deleteAmcChecklistPhotoMutation.isPending ||
                                patchAmcChecklistMutation.isPending ||
                                busyThis
                              }
                            >
                              <Text style={styles.amcRemovePhotoText}>×</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Section>
        ) : null}

        <MediaGallery
          media={order?.media || []}
          header={
            <View style={styles.mediaActionsRow}>
              {cameraEnabled ? (
                <TouchableOpacity
                  style={styles.mediaActionButton}
                  onPress={handleCapturePhoto}
                  activeOpacity={0.85}
                  disabled={uploadingMedia || isJobVisitDisabled}
                >
                  <Text style={styles.mediaActionButtonText}>Take photo</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={cameraEnabled ? styles.mediaActionButtonSecondary : styles.mediaActionButton}
                onPress={handleAddFromLibrary}
                activeOpacity={0.85}
                  disabled={uploadingMedia || isJobVisitDisabled}
              >
                <Text
                  style={
                    cameraEnabled
                      ? styles.mediaActionButtonSecondaryText
                      : styles.mediaActionButtonText
                  }
                >
                  From gallery
                </Text>
              </TouchableOpacity>
            </View>
          }
          footer={
            pendingMedia.length > 0 ? (
              <View style={styles.pendingMediaContainer}>
                <Text style={styles.pendingMediaTitle}>Pending upload</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pendingMediaScroll}
                >
                  {pendingMedia.map((item, index) => (
                    <View key={`${item.uri}-${index}`} style={styles.pendingMediaThumbWrap}>
                      <Image source={{ uri: item.uri }} style={styles.pendingMediaThumb} />
                      <TouchableOpacity
                        style={styles.pendingMediaRemove}
                        onPress={() => handleRemovePendingMedia(index)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pendingMediaRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <ActionButton
                  label={uploadingMedia ? 'Uploading…' : `Upload ${pendingMedia.length} photo${pendingMedia.length > 1 ? 's' : ''}`}
                  onPress={handleUploadPendingMedia}
                  loading={uploadingMedia}
                  disabled={uploadingMedia || isJobVisitDisabled}
                />
              </View>
            ) : null
          }
        />

        <Section title="Customer">
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{order?.customer?.name || 'N/A'}</Text>
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{order?.customer?.phone || '-'}</Text>
          </View>
          {hasTechnicianServiceLocation(order) || order?.serviceAddress?.label ? (
            <View style={styles.sectionRowColumn}>
              <Text style={styles.rowLabel}>Service address</Text>
              {order?.serviceAddress?.label ? (
                <Text style={styles.rowValueMuted}>{order.serviceAddress.label}</Text>
              ) : null}
              {getTechnicianAddressLine1(order) ? (
                <Text style={styles.rowValue}>{getTechnicianAddressLine1(order)}</Text>
              ) : null}
              {getTechnicianAddressAreaCity(order) ? (
                <Text style={[styles.rowValue, styles.addressAreaLine]}>{getTechnicianAddressAreaCity(order)}</Text>
              ) : null}
            </View>
          ) : null}
        </Section>

        <Section title="Schedule & technician">
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Slot</Text>
            <Text style={styles.rowValue}>{(order as any)?.preferredSlot?.label || 'Scheduled slot'}</Text>
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Time window</Text>
            <Text style={styles.rowValue}>
              {order?.timeWindowStart
                ? `${dayjs(order.timeWindowStart).format('DD MMM, h:mm A')} → ${order?.timeWindowEnd ? dayjs(order.timeWindowEnd).format('DD MMM, h:mm A') : '—'}`
                : order?.scheduledAt
                  ? dayjs(order.scheduledAt).format('DD MMM, h:mm A')
                  : '—'}
            </Text>
          </View>
          {jobCard?.technician ? (
            <View style={styles.sectionRow}>
              <Text style={styles.rowLabel}>Technician</Text>
              <Text style={styles.rowValue}>
                {typeof jobCard.technician === 'string'
                  ? jobCard.technician
                  : `${jobCard.technician?.name || 'Technician'}${jobCard.technician?.mobile ? ` · ${jobCard.technician.mobile}` : ''}`}
              </Text>
            </View>
          ) : null}
          {(order as any)?.followUp?.reason ? (
            <View style={styles.followUpCard}>
              <Text style={styles.followUpTitle}>Follow-up flagged</Text>
              <Text style={styles.followUpText}>{(order as any)?.followUp?.reason}</Text>
            </View>
          ) : null}
        </Section>

        <Section title="Visit timeline">
          {!!visits.length ? (
            <View style={styles.timeline}>
              {visits.map((visit, index) => (
                <View key={visit.id || `${visit.visitDate}-${index}`} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.rowLabel}>
                      {visit.visitDate ? dayjs(visit.visitDate).format('DD MMM YYYY') : `Visit ${index + 1}`} ·{' '}
                      {(visit.status || 'scheduled').replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.rowValue}>
                      In: {visit.checkInAt ? dayjs(visit.checkInAt).format('h:mm A') : '—'} · Out:{' '}
                      {visit.checkOutAt ? dayjs(visit.checkOutAt).format('h:mm A') : '—'}
                    </Text>
                    {typeof visit.durationMinutes === 'number' && visit.durationMinutes > 0 ? (
                      <Text style={styles.extraMeta}>Duration: {visit.durationMinutes} mins</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.catalogHelper}>No visits started yet. Check in to begin the first visit.</Text>
          )}
        </Section>

        <Section title="Activity tracking">
          <View style={styles.chatComposer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Add a note for the team"
              placeholderTextColor="#9ca3af"
              value={activityMessage}
              onChangeText={setActivityMessage}
              multiline
            />
            <View style={styles.chatActions}>
              <TouchableOpacity
                style={[styles.chatSendBtn, (!activityMessage.trim() || sendMessageMutation.isPending) && styles.chatSendBtnDisabled]}
                onPress={handleAddActivityNote}
                disabled={!activityMessage.trim() || sendMessageMutation.isPending}
                activeOpacity={0.85}
              >
                {sendMessageMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.chatSendText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {!!combinedActivity.length ? (
            <View style={styles.timeline}>
              {combinedActivity.map((entry, index) => {
                const actionLabel =
                  entry.action === 'chat_message'
                    ? 'Customer'
                    : entry.action === 'ADMIN_NOTE'
                      ? 'Admin'
                      : entry.action === 'TECHNICIAN_NOTE'
                        ? 'Technician'
                        : entry.performedBy?.role ?? 'System';
                return (
                  <View key={(entry as { id?: string }).id || entry.performedAt || `${index}`} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.rowLabel}>
                        <Text style={styles.rowLabelBold}>{actionLabel}</Text>
                        {entry.performedAt ? ` · ${dayjs(entry.performedAt).format('DD MMM, h:mm A')}` : ''}
                      </Text>
                      {entry.message ? <Text style={styles.rowValue}>{entry.message}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.catalogHelper}>No activity yet. Start the thread above.</Text>
          )}
        </Section>

        {/* <Section title="Job summary">
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Final amount</Text>
            <Text style={styles.rowValue}>₹{jobCard?.finalAmount ?? 0}</Text>
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Additional charges</Text>
            <Text style={styles.rowValue}>₹{jobCard?.additionalCharges ?? 0}</Text>
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.rowLabel}>Payment status</Text>
            <View style={[styles.paymentBadge, paymentBadgeContainerStyle[paymentStyleKey]]}>
              <Text style={[styles.paymentBadgeText, paymentBadgeTextStyle[paymentStyleKey]]}>
                {paymentStatusLabel}
              </Text>
            </View>
          </View>
          {!!jobCard?.checkIns?.length && (
            <View style={styles.timeline}>
              {jobCard.checkIns.map((entry, index) => (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.rowLabel}>{dayjs(entry.timestamp).format('DD MMM, h:mm A')}</Text>
                    {entry.note ? <Text style={styles.rowValue}>{entry.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section> */}

        {!!jobCard?.sparePartsUsed?.length && (
          <Section title="Spare parts used">
            {jobCard.sparePartsUsed.map((item, index) => (
              <View key={`${item.part?._id ?? index}-${index}`} style={styles.extraServiceRow}>
                <View style={styles.extraServiceInfo}>
                  <Text style={styles.rowLabel}>{item.part?.name || 'Part'}</Text>
                  {item.part?.sku ? <Text style={styles.extraMeta}>{item.part.sku}</Text> : null}
                </View>
                <View style={styles.entryActions}>
                  <Text style={styles.rowValue}>
                    {item.quantity} × ₹{item.unitPrice}
                  </Text>
                  {canModifyEntries ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => confirmRemoveSparePart(index)}
                      disabled={removeSparePartMutation.isPending}
                    >
                      <Text style={styles.removeBadgeText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </Section>
        )}

        {!!jobCard?.extraWork?.length && (
          <Section title="Extra work">
            {jobCard.extraWork.map((item, index) => (
              <View key={`${item.serviceItem?.id ?? index}-${index}`} style={styles.extraServiceRow}>
                <View style={styles.extraServiceInfo}>
                  <Text style={styles.rowLabel}>{item.serviceCategory?.name || 'Additional service'}</Text>
                  <Text style={styles.extraMeta}>{item.serviceItem?.name || item.description}</Text>
                  {item.description && item.description !== item.serviceItem?.name ? (
                    <Text style={styles.extraMeta}>{item.description}</Text>
                  ) : null}
                </View>
                <View style={styles.entryActions}>
                  <Text style={styles.rowValue}>₹{item.amount}</Text>
                  {canModifyEntries ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => confirmRemoveExtraWork(index)}
                      disabled={removeExtraWorkMutation.isPending}
                    >
                      <Text style={styles.removeBadgeText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section title="Cost breakdown">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {visitingCharge > 0 ? 'Service price (excl. visiting)' : 'Service price'}
            </Text>
            <Text style={styles.summaryValue}>{formatCurrency(displayServicePrice)}</Text>
          </View>
          {visitingCharge > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Visiting charge (excl. GST)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(visitingCharge)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Spare parts subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(displaySpareSub)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Additional services</Text>
            <Text style={styles.summaryValue}>{formatCurrency(displayExtraSub)}</Text>
          </View>
          {jobCard?.customBillItems?.length
            ? jobCard.customBillItems.map((row, idx) => (
                <View key={`custom-bill-${idx}`} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.description}</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(row.amount)}</Text>
                </View>
              ))
            : displayCustom > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Custom amount</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(displayCustom)}</Text>
                </View>
              ) : null}
          {pb && (pb.discountAmount ?? 0) > 0 ? (
            <>
              <View style={[styles.summaryRow, styles.summaryDivider]}>
                <Text style={styles.summaryLabel}>Subtotal (before discount)</Text>
                <Text style={styles.summaryValue}>{formatCurrency(pb.preDiscountSubtotal ?? subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Discount{pb.discountLabel ? ` (${pb.discountLabel})` : ''}
                </Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                  −{formatCurrency(pb.discountAmount ?? 0)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryDivider]}>
                <Text style={styles.summaryLabel}>Amount (excl. GST)</Text>
                <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
              </View>
            </>
          ) : (
            <View style={[styles.summaryRow, styles.summaryDivider]}>
              <Text style={styles.summaryLabel}>Subtotal (excl. GST)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {visitingCharge > 0 ? 'Tax (18% incl. visiting)' : 'Tax (18%)'}
            </Text>
            <Text style={styles.summaryValue}>{formatCurrency(tax)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Grand total</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </Section>

        {/* {!!payments?.length && (
          <Section title="Payments">
            {payments.map((payment) => (
              <View key={payment.id} style={styles.sectionRow}>
                <Text style={styles.rowLabel}>{payment.method}</Text>
                <Text style={styles.rowValue}>₹{payment.amount}</Text>
              </View>
            ))}
          </Section>
        )} */}
      </ScrollView>

      <Modal visible={checkoutModalVisible} transparent animationType="slide" onRequestClose={closeCheckoutModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close this job card</Text>
            <Text style={styles.modalSubtitle}>Choose the right outcome and payment status before checking out.</Text>
            <Text style={styles.modalLabel}>Outcome</Text>
            <View style={styles.optionPillRow}>
              {[
                { id: 'completed', label: 'Completed' },
                { id: 'follow_up', label: 'Follow-up' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionPill,
                    checkoutResolution === option.id && styles.optionPillActive
                  ]}
                  onPress={() => setCheckoutResolution(option.id as JobClosureResolution)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      checkoutResolution === option.id && styles.optionPillTextActive
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {checkoutResolution === 'follow_up' ? (
              <TextInput
                style={styles.modalInput}
                placeholder="Describe what needs to be followed up"
                placeholderTextColor="#9ca3af"
                value={followUpNote}
                onChangeText={setFollowUpNote}
                multiline
              />
            ) : null}

            <Text style={styles.modalLabel}>Payment status</Text>
            <View style={styles.optionPillRow}>
              {[
                { id: 'paid', label: 'Paid' },
                { id: 'partial', label: 'Partial' },
                { id: 'pending', label: 'Pending' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionPill,
                    paymentStatusChoice === option.id && styles.optionPillActive
                  ]}
                  onPress={() => setPaymentStatusChoice(option.id as JobPaymentStatus)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      paymentStatusChoice === option.id && styles.optionPillTextActive
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>OTP verification</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter OTP"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              value={checkoutOtp}
              onChangeText={setCheckoutOtp}
            />

            {hasScheduledWorkOnFutureDays && effectiveHasActiveVisit ? (
              <View style={styles.endDayBanner}>
                <Text style={styles.endDayBannerText}>
                  End today’s work first, then open Check out again. More days are scheduled on this job.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.endDayButton,
                    (dayCheckoutMutation.isPending || dayCheckoutPrepBusy) && { opacity: 0.6 }
                  ]}
                  onPress={async () => {
                    await handleDayCheckout();
                    closeCheckoutModal();
                  }}
                  disabled={
                    dayCheckoutMutation.isPending ||
                    dayCheckoutPrepBusy ||
                    isJobVisitDisabled
                  }
                  activeOpacity={0.7}
                >
                  {dayCheckoutMutation.isPending || dayCheckoutPrepBusy ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.endDayButtonText}>End today work</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={closeCheckoutModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalPrimary,
                  hasScheduledWorkOnFutureDays && effectiveHasActiveVisit && { opacity: 0.4 }
                ]}
                onPress={handleSubmitCheckout}
                disabled={
                  checkoutMutation.isPending || (hasScheduledWorkOnFutureDays && effectiveHasActiveVisit)
                }
                activeOpacity={0.8}
              >
                {checkoutMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={extraModalVisible} transparent animationType="slide" onRequestClose={closeExtraModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add additional service</Text>
            <Text style={styles.modalSubtitle}>Capture billable extra work performed onsite.</Text>
            <Text style={styles.modalLabel}>Service category</Text>
            {loadingCatalog ? (
              <ActivityIndicator />
            ) : !serviceCatalog?.length ? (
              <Text style={styles.catalogHelper}>No service categories found.</Text>
            ) : (
              <ScrollView
                style={styles.catalogPillScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catalogPillRow}
              >
                {(serviceCatalog || []).map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.catalogPill, selectedCategoryId === category.id && styles.catalogPillActive]}
                    onPress={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedServiceId(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.catalogPillText,
                        selectedCategoryId === category.id && styles.catalogPillTextActive
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.modalLabel}>Service sub-category</Text>
            <View style={styles.catalogListContainer}>
              {!selectedCategory ? (
                <Text style={styles.catalogHelper}>Choose a category to view services.</Text>
              ) : selectedCategory.items.length === 0 ? (
                <Text style={styles.catalogHelper}>No services available for this category.</Text>
              ) : (
                <ScrollView style={styles.catalogList}>
                  {selectedCategory.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.catalogListItem,
                        selectedServiceId === item.id && styles.catalogListItemActive
                      ]}
                      onPress={() => {
                        setSelectedServiceId(item.id);
                        setExtraDescription(item.name);
                        setExtraAmount(typeof item.basePrice === 'number' ? String(item.basePrice) : '');
                      }}
                    >
                      <View>
                        <Text style={styles.partName}>{item.name}</Text>
                        {item.description ? <Text style={styles.partSku}>{item.description}</Text> : null}
                      </View>
                      {typeof item.basePrice === 'number' ? (
                        <Text style={styles.catalogPrice}>₹{item.basePrice}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Description"
              placeholderTextColor="#9ca3af"
              value={extraDescription}
              onChangeText={setExtraDescription}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Quantity"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={extraQuantity}
              onChangeText={setExtraQuantity}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={extraAmount}
              onChangeText={setExtraAmount}
            />
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Line total</Text>
              <Text style={styles.previewValue}>{formatCurrency(extraPreviewTotal || 0)}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={closeExtraModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={handleSubmitExtraWork}
                disabled={extraWorkMutation.isPending}
                activeOpacity={0.8}
              >
                {extraWorkMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={spareModalVisible} transparent animationType="slide" onRequestClose={closeSpareModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add spare part</Text>
            <Text style={styles.modalSubtitle}>Select from catalog and specify the quantity used.</Text>
            <View style={styles.partListContainer}>
              {loadingParts ? (
                <ActivityIndicator />
              ) : (
                <ScrollView style={styles.partList}>
                  {(spareParts || []).map((part) => (
                    <TouchableOpacity
                      key={part.id}
                      style={[styles.partListItem, selectedPart?.id === part.id && styles.partListItemActive]}
                      onPress={() => {
                        setSelectedPart(part);
                        setSpareUnitPrice(String(part.unitPrice ?? ''));
                      }}
                    >
                      <Text style={styles.partName}>{part.name}</Text>
                      <Text style={styles.partSku}>{part.sku}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Quantity"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={spareQuantity}
              onChangeText={setSpareQuantity}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Unit price"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={spareUnitPrice}
              onChangeText={setSpareUnitPrice}
            />
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Line total</Text>
              <Text style={styles.previewValue}>{formatCurrency(sparePreviewTotal || 0)}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={closeSpareModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={handleSubmitSparePart}
                disabled={sparePartMutation.isPending}
                activeOpacity={0.8}
              >
                {sparePartMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={amcNoteEditor != null}
        transparent
        animationType="fade"
        onRequestClose={closeAmcNoteModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Note</Text>
            <TextInput
              style={[styles.modalInput, styles.amcNoteModalInput]}
              placeholder="Add a note…"
              placeholderTextColor="#9ca3af"
              value={amcNoteDraft}
              onChangeText={setAmcNoteDraft}
              multiline
              editable={!patchAmcChecklistMutation.isPending}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={closeAmcNoteModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalPrimary,
                  patchAmcChecklistMutation.isPending && styles.actionButtonDisabled
                ]}
                onPress={saveAmcNoteFromModal}
                disabled={patchAmcChecklistMutation.isPending}
              >
                {patchAmcChecklistMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(amcPreviewUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setAmcPreviewUrl(null)}
      >
        <View style={styles.imageModalBackdrop}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setAmcPreviewUrl(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.imageModalCloseText}>Close</Text>
          </TouchableOpacity>
          {amcPreviewUrl ? (
            <Image source={{ uri: amcPreviewUrl }} style={styles.imageFull} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
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
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff'
  },
  backButtonText: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151'
  },
  pageTitle: {
    fontFamily: Fonts?.sans,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827'
  },
  pageSubtitle: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  heroPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10
  },
  heroBadge: {
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: Fonts?.sans,
  },
  heroCode: {
    color: '#6b7280',
    fontFamily: Fonts?.sans,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    fontFamily: Fonts?.sans,
  },
  heroSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    fontFamily: Fonts?.sans,
  },
  heroMetaRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  heroMetaLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  heroMetaValue: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    fontFamily: Fonts?.sans,
  },
  heroPaymentBanner: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2
  },
  heroPaymentBanner_paid: {
    backgroundColor: '#ecfdf5',
    borderColor: '#34d399'
  },
  heroPaymentBanner_partial: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c'
  },
  heroPaymentBanner_pending: {
    backgroundColor: '#fffbeb',
    borderColor: '#fbbf24'
  },
  heroPaymentBannerKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontFamily: Fonts?.sans,
  },
  heroPaymentBannerTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Fonts?.sans,
  },
  servicePaymentHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 8
  },
  servicePaymentHighlightLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    fontFamily: Fonts?.sans,
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  actionsTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  actionsSubtitle: {
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 12,
    fontFamily: Fonts?.sans,
  },
  actionHint: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
    fontFamily: Fonts?.sans,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    minHeight: 60,
    marginBottom: 16,
    fontFamily: Fonts?.sans,
  },
  inputDisabled: {
    opacity: 0.5
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between'
  },
  actionButton: {
    flexBasis: '48%',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  actionButtonTextOutline: {
    color: '#374151',
    fontFamily: Fonts?.sans,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionAccent: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111827'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  sectionBody: {
    marginTop: 16
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionRowColumn: {
    marginTop: 8,
    marginBottom: 12
  },
  rowLabel: {
    color: '#6b7280',
    fontWeight: '500',
    fontFamily: Fonts?.sans,
  },
  rowLabelBold: {
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts.bold,
  },
  rowValue: {
    color: '#111827',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  rowValueMuted: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: Fonts?.sans,
  },
  addressAreaLine: {
    marginTop: 4,
    fontWeight: '500',
    color: '#4b5563',
    fontFamily: Fonts?.sans,
  },
  followUpCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  followUpTitle: {
    color: '#b91c1c',
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  followUpText: {
    marginTop: 4,
    color: '#b91c1c',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  paymentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999
  },
  paymentBadgeText: {
    fontWeight: '700',
    textTransform: 'capitalize',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  paymentBadge_paid: {
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  paymentBadge_partial: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  paymentBadge_pending: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  paymentBadge_paid_text: {
    color: '#047857'
  },
  paymentBadge_partial_text: {
    color: '#b45309'
  },
  paymentBadge_pending_text: {
    color: '#92400e'
  },
  timeline: {
    marginTop: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
    paddingLeft: 16
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
    marginRight: 12,
    marginTop: 6
  },
  timelineContent: {
    flex: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  modalTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  modalSubtitle: {
    color: '#6b7280',
    marginTop: 6,
    marginBottom: 16,
    fontFamily: Fonts?.sans,
  },
  modalLabel: {
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    fontFamily: Fonts?.sans,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 12,
    fontFamily: Fonts?.sans,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb'
  },
  previewLabel: {
    color: '#6b7280',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  previewValue: {
    color: '#111827',
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  chatComposer: {
    marginBottom: 12
  },
  chatInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    color: '#111827',
    backgroundColor: '#f9fafb',
    minHeight: 60,
    fontFamily: Fonts?.sans,
  },
  chatActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8
  },
  chatSendBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12
  },
  chatSendBtnDisabled: {
    backgroundColor: '#d1d5db'
  },
  chatSendText: {
    color: '#ffffff',
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  imageScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 8
  },
  imageThumbWrap: {
    width: 120,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  imageThumb: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: '#e5e7eb'
  },
  mediaEmptyState: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaEmptyText: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: Fonts?.sans,
    textAlign: 'center'
  },
  imageCaption: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  mediaActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  mediaActionButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center'
  },
  mediaActionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
    fontSize: 13
  },
  mediaActionButtonSecondary: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center'
  },
  mediaActionButtonSecondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
    fontSize: 13
  },
  pendingMediaContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  pendingMediaTitle: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
    marginBottom: 6
  },
  pendingMediaScroll: {
    paddingVertical: 4,
    paddingRight: 8
  },
  pendingMediaThumbWrap: {
    width: 80,
    height: 80,
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb'
  },
  pendingMediaThumb: {
    width: '100%',
    height: '100%'
  },
  pendingMediaRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pendingMediaRemoveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  imageFull: {
    width: '100%',
    height: '80%'
  },
  imageModalClose: {
    position: 'absolute',
    top: 32,
    right: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(17,24,39,0.85)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  imageModalCloseText: {
    color: '#ffffff',
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  catalogPillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 12
  },
  catalogPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  catalogPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827'
  },
  catalogPillText: {
    color: '#6b7280',
    fontWeight: '500',
    fontFamily: Fonts?.sans,
  },
  catalogPillTextActive: {
    color: '#ffffff',
    fontFamily: Fonts?.sans,
  },
  catalogPillScroll: {
    marginBottom: 12
  },
  catalogListContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    maxHeight: 180,
    marginBottom: 16
  },
  catalogList: {
    paddingVertical: 4
  },
  catalogListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  catalogListItemActive: {
    backgroundColor: '#f3f4f6'
  },
  catalogPrice: {
    color: '#111827',
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  catalogHelper: {
    color: '#6b7280',
    padding: 16,
    textAlign: 'center',
    fontFamily: Fonts?.sans,
  },
  optionPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  optionPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  optionPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827'
  },
  optionPillText: {
    color: '#6b7280',
    fontWeight: '500',
    fontFamily: Fonts?.sans,
  },
  optionPillTextActive: {
    color: '#ffffff',
    fontFamily: Fonts?.sans,
  },
  endDayBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    gap: 10,
  },
  endDayBannerText: {
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: Fonts?.sans,
  },
  endDayButton: {
    backgroundColor: '#d97706',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  endDayButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8
  },
  modalSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#ffffff'
  },
  modalSecondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    paddingVertical: 14
  },
  modalPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  partListContainer: {
    maxHeight: 180,
    marginBottom: 12
  },
  partList: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingVertical: 4
  },
  partListItem: {
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  partListItemActive: {
    backgroundColor: '#f3f4f6'
  },
  partName: {
    color: '#111827',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  partSku: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: Fonts?.sans,
  },
  extraServiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  extraServiceInfo: {
    flex: 1,
    marginRight: 12
  },
  entryActions: {
    alignItems: 'flex-end'
  },
  removeBadge: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2'
  },
  removeBadgeText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  extraMeta: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Fonts?.sans,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  summaryLabel: {
    color: '#6b7280',
    fontWeight: '600',
    fontFamily: Fonts?.sans,
  },
  summaryValue: {
    color: '#111827',
    fontWeight: '700',
    fontFamily: Fonts?.sans,
  },
  summaryDivider: {
    borderBottomColor: '#e5e7eb'
  },
  summaryTotalRow: {
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb'
  },
  summaryTotalLabel: {
    color: '#111827',
    fontWeight: '800',
    fontFamily: Fonts?.sans,
  },
  summaryTotalValue: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
    fontFamily: Fonts?.sans,
  },
  amcItemWrap: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb'
  },
  amcItemWrapLast: {
    borderBottomWidth: 0
  },
  amcRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  amcCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  amcCheckboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669'
  },
  amcRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans
  },
  amcIconRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  amcIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  amcIconBusy: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  amcNoteModalInput: {
    minHeight: 120,
    marginTop: 12,
    textAlignVertical: 'top'
  },
  amcNotePreview: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    fontFamily: Fonts?.sans,
    lineHeight: 18
  },
  amcPhotoRowFlex: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 0
  },
  amcPhotoThumbWrap: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  amcThumbS: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  amcRemovePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#b91c1c',
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amcRemovePhotoText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Fonts?.sans,
    lineHeight: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  }
});
