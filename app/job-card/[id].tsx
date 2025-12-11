import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { technicianApi } from '@/lib/technician-api';
import type {
  JobClosureResolution,
  JobPaymentStatus,
  ServiceCatalogCategory,
  SparePartSummary,
  TechnicianJobDetail
} from '@/types/api';

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
      <ActivityIndicator color={variant === 'outline' ? '#38bdf8' : '#fff'} />
    ) : (
      <Text style={[styles.actionButtonText, variant === 'outline' && styles.actionButtonTextOutline]}>{label}</Text>
    )}
  </TouchableOpacity>
);

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
  const jobCardIdFromRoute = Array.isArray(id) ? id[0] : id;
  const [checkInNote, setCheckInNote] = useState('');
  const [extraModalVisible, setExtraModalVisible] = useState(false);
  const [extraDescription, setExtraDescription] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
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

  const completeJobMutation = useMutation({
    mutationFn: async (payload: { resolution: JobClosureResolution; paymentStatus: JobPaymentStatus; followUpNote?: string }) => {
      if (!jobCardId) throw new Error('Missing job reference');
      return technicianApi.completeJob(jobCardId, payload);
    },
    onSuccess: () => {
      closeCheckoutModal();
      invalidateJobData();
      Alert.alert('Job updated', 'Checkout submitted successfully.');
    },
    onError: () => Alert.alert('Failed', 'Unable to update job status right now.')
  });

  const jobStatus = data?.jobCard?.status ?? 'pending';
  const hasCheckIn = Boolean(data?.jobCard?.checkIns?.length);
  const isJobClosed = jobStatus === 'completed' || jobStatus === 'follow_up';
  const actionLocked = isJobClosed || !hasCheckIn;
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
    }
  }, [isJobClosed, extraModalVisible, spareModalVisible, checkoutModalVisible]);

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

  const handleRequestComplete = () => {
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
    setCheckoutResolution('completed');
    setPaymentStatusChoice('paid');
    setFollowUpNote('');
    setCheckoutModalVisible(true);
  };

  const handleSubmitExtraWork = () => {
    if (!selectedCategory || !selectedService) {
      Alert.alert('Select service', 'Pick a category and service before submitting.');
      return;
    }

    const description = (extraDescription.trim() || selectedService.name).trim();
    const baseAmount = selectedService.basePrice ?? 0;
    const parsedAmount = parseFloat(extraAmount || `${baseAmount}`);
    if (!description || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Add service', 'Provide a valid amount for the selected service.');
      return;
    }

    extraWorkMutation.mutate([
      {
        description,
        amount: parsedAmount,
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
    completeJobMutation.mutate({
      resolution: checkoutResolution,
      paymentStatus: paymentStatusChoice,
      followUpNote: checkoutResolution === 'follow_up' ? followUpNote.trim() : undefined
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
        <LinearGradient colors={['#050b18', '#0a1427', '#10213c']} style={styles.heroPanel}>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.heroBadge}>{jobCard?.status?.toUpperCase() || 'PENDING'}</Text>
            <Text style={styles.heroCode}>{order?.code}</Text>
          </View>
          <Text style={styles.heroTitle}>{order?.serviceItem?.name || 'Service job'}</Text>
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
        </LinearGradient>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>On-site actions</Text>
          <Text style={styles.actionsSubtitle}>Share a quick note before you check in or file updates.</Text>
          {!hasCheckIn && !isJobClosed ? (
            <Text style={styles.actionHint}>Check in to enable service additions and spare tracking.</Text>
          ) : null}
          {isJobClosed ? <Text style={styles.actionHint}>Job is closed. Actions are read-only.</Text> : null}
          <TextInput
            style={[styles.noteInput, isJobClosed && styles.inputDisabled]}
            placeholder="Check-in note (optional)"
            placeholderTextColor="rgba(148,163,184,0.7)"
            value={checkInNote}
            onChangeText={setCheckInNote}
            multiline
            editable={!isJobClosed}
          />
          <View style={styles.actionsGrid}>
            <ActionButton
              label={hasCheckIn ? 'Checked in' : 'Check in now'}
              onPress={handleCheckIn}
              loading={checkInMutation.isPending}
              disabled={isJobClosed}
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
              loading={completeJobMutation.isPending}
              disabled={actionLocked}
            />
          </View>
        </View>

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

        <Section title="Job summary">
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
        </Section>

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
                placeholderTextColor="rgba(148,163,184,0.8)"
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

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={closeCheckoutModal}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={handleSubmitCheckout}
                disabled={completeJobMutation.isPending}
                activeOpacity={0.8}
              >
                {completeJobMutation.isPending ? (
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
              placeholderTextColor="rgba(148,163,184,0.8)"
              value={extraDescription}
              onChangeText={setExtraDescription}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              placeholderTextColor="rgba(148,163,184,0.8)"
              keyboardType="decimal-pad"
              value={extraAmount}
              onChangeText={setExtraAmount}
            />
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
              placeholderTextColor="rgba(148,163,184,0.8)"
              keyboardType="decimal-pad"
              value={spareQuantity}
              onChangeText={setSpareQuantity}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Unit price"
              placeholderTextColor="rgba(148,163,184,0.8)"
              keyboardType="decimal-pad"
              value={spareUnitPrice}
              onChangeText={setSpareUnitPrice}
            />
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
    backgroundColor: '#030712'
  },
  scrollContent: {
    paddingBottom: 32
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#030712'
  },
  heroPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroBadge: {
    color: '#38bdf8',
    fontWeight: '700',
    letterSpacing: 1.5
  },
  heroCode: {
    color: 'rgba(226,232,240,0.75)'
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12
  },
  heroSubtitle: {
    color: 'rgba(226,232,240,0.8)',
    marginTop: 4
  },
  heroMetaRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  heroMetaLabel: {
    color: 'rgba(226,232,240,0.7)',
    fontSize: 12
  },
  heroMetaValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4
  },
  actionsCard: {
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)'
  },
  actionsTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700'
  },
  actionsSubtitle: {
    color: 'rgba(148,163,184,0.85)',
    marginTop: 4,
    marginBottom: 12
  },
  actionHint: {
    color: 'rgba(248,250,252,0.7)',
    fontSize: 12,
    marginBottom: 8
  },
  noteInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 14,
    color: '#f8fafc',
    minHeight: 60,
    marginBottom: 16
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
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.6)'
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  actionButtonTextOutline: {
    color: '#60a5fa'
  },
  sectionCard: {
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)'
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
    backgroundColor: '#38bdf8'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc'
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
    color: 'rgba(148,163,184,0.8)',
    fontWeight: '500'
  },
  rowValue: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  paymentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999
  },
  paymentBadgeText: {
    fontWeight: '700',
    textTransform: 'capitalize',
    color: '#f8fafc'
  },
  paymentBadge_paid: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.5)'
  },
  paymentBadge_partial: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.5)'
  },
  paymentBadge_pending: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)'
  },
  paymentBadge_paid_text: {
    color: '#4ade80'
  },
  paymentBadge_partial_text: {
    color: '#fb923c'
  },
  paymentBadge_pending_text: {
    color: '#fbbf24'
  },
  timeline: {
    marginTop: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(148,163,184,0.4)',
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
    backgroundColor: '#38bdf8',
    marginRight: 12,
    marginTop: 6
  },
  timelineContent: {
    flex: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)'
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  modalSubtitle: {
    color: 'rgba(148,163,184,0.85)',
    marginTop: 6,
    marginBottom: 16
  },
  modalLabel: {
    color: '#e2e8f0',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 14,
    color: '#f8fafc',
    marginBottom: 12
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
    borderColor: 'rgba(148,163,184,0.4)'
  },
  catalogPillActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3b82f6'
  },
  catalogPillText: {
    color: 'rgba(148,163,184,0.9)',
    fontWeight: '500'
  },
  catalogPillTextActive: {
    color: '#bfdbfe'
  },
  catalogPillScroll: {
    marginBottom: 12
  },
  catalogListContainer: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
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
    backgroundColor: 'rgba(59,130,246,0.12)'
  },
  catalogPrice: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  catalogHelper: {
    color: 'rgba(148,163,184,0.8)',
    padding: 16,
    textAlign: 'center'
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
    borderColor: 'rgba(148,163,184,0.4)'
  },
  optionPillActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3b82f6'
  },
  optionPillText: {
    color: 'rgba(148,163,184,0.9)',
    fontWeight: '500'
  },
  optionPillTextActive: {
    color: '#bfdbfe'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8
  },
  modalSecondary: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    alignItems: 'center',
    paddingVertical: 14
  },
  modalSecondaryText: {
    color: 'rgba(148,163,184,0.9)',
    fontWeight: '600'
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    paddingVertical: 14
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '600'
  },
  partListContainer: {
    maxHeight: 180,
    marginBottom: 12
  },
  partList: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 16,
    paddingVertical: 4
  },
  partListItem: {
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  partListItemActive: {
    backgroundColor: 'rgba(59,130,246,0.15)'
  },
  partName: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  partSku: {
    color: 'rgba(148,163,184,0.7)',
    fontSize: 12
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
    borderColor: 'rgba(248,113,113,0.6)'
  },
  removeBadgeText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600'
  },
  extraMeta: {
    color: 'rgba(148,163,184,0.7)',
    fontSize: 12,
    marginTop: 2
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc'
  }
});
