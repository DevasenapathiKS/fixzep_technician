import { useTechnicianSocket } from '@/context/TechnicianSocketContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { getJobCardCameraEnabled } from '@/lib/camera-preference';
import { technicianApi } from '@/lib/technician-api';
import type {
    JobClosureResolution,
    JobPaymentStatus,
    ServiceCatalogCategory,
    SparePartSummary,
    TechnicianJobDetail
} from '@/types/api';

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
  const [cameraEnabled, setCameraEnabled] = useState(true);

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
    onError: () => {
      Alert.alert('Check-in failed', 'Unable to capture your check-in right now. Try again.');
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

  const checkoutMutation = useMutation({
    mutationFn: async (payload: {
      resolution: JobClosureResolution;
      paymentStatus: JobPaymentStatus;
      followUpNote?: string;
      otp: string;
    }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      await technicianApi.completeJob(jobCardId, {
        resolution: payload.resolution,
        paymentStatus: payload.paymentStatus,
        followUpNote: payload.followUpNote
      });
      return technicianApi.checkout(jobCardId, payload.otp);
    },
    onSuccess: () => {
      closeCheckoutModal();
      invalidateJobData();
      Alert.alert('Job closed', 'OTP verified and job card closed successfully.');
    },
    onError: () => Alert.alert('Failed', 'Unable to verify OTP and close the job card.')
  });

  const jobStatus = data?.jobCard?.status ?? 'pending';
  const visits = data?.jobCard?.visits || [];
  const activeVisit = visits.find((visit) => visit.status === 'checked_in' && !visit.checkOutAt);
  const hasCheckIn = Boolean(data?.jobCard?.checkIns?.length || visits.some((visit) => Boolean(visit.checkInAt)));
  const hasActiveVisit = Boolean(activeVisit);
  const isJobClosed = jobStatus === 'completed' || jobStatus === 'follow_up';
  const calendarSlots = data?.technicianCalendar ?? [];
  const isMultiDay = visits.length > 1 || calendarSlots.some((slot) => {
    if (!slot.start || !slot.end) return false;
    return !dayjs(slot.start).isSame(dayjs(slot.end), 'day');
  });
  const actionLocked = isJobClosed || !hasCheckIn || !hasActiveVisit;
  const canModifyEntries = !actionLocked;

  useEffect(() => {
    if (!isJobClosed) return;
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
  }, [isJobClosed, extraModalVisible, spareModalVisible, checkoutModalVisible]);

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

  const { order, jobCard, payments } = data;
  const paymentStatusDisplay: JobPaymentStatus = (jobCard?.paymentStatus as JobPaymentStatus) || 'pending';
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

  const sparePartsUsed = jobCard?.sparePartsUsed || [];
  const sparePartsSubtotal = sparePartsUsed.reduce((sum, part) => {
    const quantity = part.quantity ?? 0;
    const unitPrice = part.unitPrice ?? (typeof part.part === 'object' ? part.part?.unitPrice ?? 0 : 0);
    return sum + quantity * unitPrice;
  }, 0);

  const extraWorks = jobCard?.extraWork || [];
  const extraWorksSubtotal = extraWorks.reduce((sum, work) => sum + (work.amount ?? 0), 0);

  const servicePrice =
    jobCard?.estimateAmount ??
    (typeof data?.order?.serviceItem === 'object' && 'basePrice' in (data?.order?.serviceItem || {})
      ? (data?.order?.serviceItem as Record<string, number | undefined>).basePrice ?? 0
      : 0);

  const customAmount = (jobCard?.customAmount != null && jobCard.customAmount > 0) ? jobCard.customAmount : 0;
  const subtotal = servicePrice + sparePartsSubtotal + extraWorksSubtotal + customAmount;
  const tax = subtotal * 0.18;
  const grandTotal = subtotal + tax;

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
    if (isJobClosed) {
      Alert.alert('Job closed', 'Photos cannot be updated on a closed job.');
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
    if (isJobClosed) {
      Alert.alert('Job closed', 'Photos cannot be updated on a closed job.');
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
    if (isJobClosed) {
      Alert.alert('Job closed', 'Photos cannot be updated on a closed job.');
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


  const handleCheckIn = async () => {
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (isJobClosed) {
      Alert.alert('Job closed', 'This job card is already closed.');
      return;
    }
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
      Alert.alert('Check-in failed', 'Unable to capture your location.');
    }
  };

  const handleRequestComplete = async () => {
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (!hasCheckIn) {
      Alert.alert('Check-in required', 'Please check in before closing the job.');
      return;
    }
    if (isJobClosed) {
      Alert.alert('Job closed', 'This job card is already closed.');
      return;
    }
    if (hasActiveVisit && isMultiDay) {
      setCheckoutResolution('completed');
      setPaymentStatusChoice('paid');
      setFollowUpNote('');
      setCheckoutModalVisible(true);
      return;
    }
    if (hasActiveVisit && !isMultiDay) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const payload: { lat?: number; lng?: number; note?: string } = {};
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          payload.lat = position.coords.latitude;
          payload.lng = position.coords.longitude;
        }
        await dayCheckoutMutation.mutateAsync(payload);
      } catch {
        Alert.alert('Checkout failed', 'Could not end today work automatically. Try again.');
        return;
      }
    }
    setCheckoutResolution('completed');
    setPaymentStatusChoice('paid');
    setFollowUpNote('');
    setCheckoutModalVisible(true);
  };

  const handleDayCheckout = async () => {
    if (!jobCardId) {
      Alert.alert('Missing job', 'Job reference unavailable.');
      return;
    }
    if (isJobClosed) {
      Alert.alert('Job closed', 'This job card is already closed.');
      return;
    }
    if (!hasActiveVisit) {
      Alert.alert('No active visit', 'You are already checked out for today.');
      return;
    }
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
      Alert.alert('Day checkout failed', 'Unable to end today work right now. Try again.');
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
    checkoutMutation.mutate({
      resolution: checkoutResolution,
      paymentStatus: paymentStatusChoice,
      followUpNote: checkoutResolution === 'follow_up' ? followUpNote.trim() : undefined,
      otp: checkoutOtp.trim()
    });
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
        <View style={styles.heroPanel}>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.heroBadge}>{jobCard?.status?.toUpperCase() || 'PENDING'}</Text>
            <Text style={styles.heroCode}>{order?.code}</Text>
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
              <Text style={styles.heroMetaLabel}>Estimate</Text>
              <Text style={styles.heroMetaValue}>₹{jobCard?.estimateAmount ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>On-site actions</Text>
          <Text style={styles.actionsSubtitle}>Check in for today, end day work, then close with OTP when fully done.</Text>
          {!hasCheckIn && !isJobClosed ? (
            <Text style={styles.actionHint}>Check in to enable service additions and spare tracking.</Text>
          ) : null}
          {hasCheckIn && !hasActiveVisit && !isJobClosed ? (
            <Text style={styles.actionHint}>Today work is ended. Check in again for a new day visit.</Text>
          ) : null}
          {isJobClosed ? <Text style={styles.actionHint}>Job is closed. Actions are read-only.</Text> : null}
          <TextInput
            style={[styles.noteInput, isJobClosed && styles.inputDisabled]}
            placeholder="Check-in note (optional)"
            placeholderTextColor="#9ca3af"
            value={checkInNote}
            onChangeText={setCheckInNote}
            multiline
            editable={!isJobClosed}
          />
          <View style={styles.actionsGrid}>
            <ActionButton
              label={hasActiveVisit ? 'Checked in' : 'Check in now'}
              onPress={handleCheckIn}
              loading={checkInMutation.isPending}
              disabled={isJobClosed || hasActiveVisit}
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
            <ActionButton
              label={isJobClosed ? 'Job closed' : 'Check out'}
              onPress={handleRequestComplete}
              loading={checkoutMutation.isPending || dayCheckoutMutation.isPending}
              disabled={isJobClosed || !hasCheckIn}
            />
          </View>
        </View>

        <Section title="Service details">
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
        </Section>

        <MediaGallery
          media={order?.media || []}
          header={
            <View style={styles.mediaActionsRow}>
              {cameraEnabled ? (
                <TouchableOpacity
                  style={styles.mediaActionButton}
                  onPress={handleCapturePhoto}
                  activeOpacity={0.85}
                  disabled={uploadingMedia || isJobClosed}
                >
                  <Text style={styles.mediaActionButtonText}>Take photo</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={cameraEnabled ? styles.mediaActionButtonSecondary : styles.mediaActionButton}
                onPress={handleAddFromLibrary}
                activeOpacity={0.85}
                disabled={uploadingMedia || isJobClosed}
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
                  disabled={uploadingMedia || isJobClosed}
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
          {order?.customer?.addressLine1 && (
            <View style={styles.sectionRowColumn}>
              <Text style={styles.rowLabel}>Address</Text>
              <Text style={styles.rowValue}>{order.customer.addressLine1}</Text>
            </View>
          )}
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
            <View style={[styles.paymentBadge, paymentBadgeContainerStyle[paymentStatusDisplay]]}>
              <Text style={[styles.paymentBadgeText, paymentBadgeTextStyle[paymentStatusDisplay]]}>
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
            <Text style={styles.summaryLabel}>Service price</Text>
            <Text style={styles.summaryValue}>{formatCurrency(servicePrice)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Spare parts subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(sparePartsSubtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Additional services</Text>
            <Text style={styles.summaryValue}>{formatCurrency(extraWorksSubtotal)}</Text>
          </View>
          {customAmount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Custom amount</Text>
              <Text style={styles.summaryValue}>{formatCurrency(customAmount)}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.summaryDivider]}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (18%)</Text>
            <Text style={styles.summaryValue}>{formatCurrency(tax)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Grand total</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </Section>

        {!!payments?.length && (
          <Section title="Payments">
            {payments.map((payment) => (
              <View key={payment.id} style={styles.sectionRow}>
                <Text style={styles.rowLabel}>{payment.method}</Text>
                <Text style={styles.rowValue}>₹{payment.amount}</Text>
              </View>
            ))}
          </Section>
        )}
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

            {isMultiDay && hasActiveVisit ? (
              <View style={styles.endDayBanner}>
                <Text style={styles.endDayBannerText}>
                  You still have an active visit Tomorrow. End today's work before closing the job.
                </Text>
                <TouchableOpacity
                  style={[styles.endDayButton, dayCheckoutMutation.isPending && { opacity: 0.6 }]}
                  onPress={async () => {
                    await handleDayCheckout();
                    closeCheckoutModal();
                  }}
                  disabled={dayCheckoutMutation.isPending || isJobClosed}
                  activeOpacity={0.7}
                >
                  {dayCheckoutMutation.isPending ? (
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
                style={[styles.modalPrimary, isMultiDay && hasActiveVisit && { opacity: 0.4 }]}
                onPress={handleSubmitCheckout}
                disabled={checkoutMutation.isPending || (isMultiDay && hasActiveVisit)}
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb'
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroBadge: {
    color: '#111827',
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
  },
  rowValue: {
    color: '#111827',
    fontWeight: '600',
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  }
});
