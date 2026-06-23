import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimpleCalendarModal } from '@/components/simple-calendar-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { technicianApi } from '@/lib/technician-api';

type PickerField = 'start' | 'end';

function formatDisplay(ymd: string) {
  const d = dayjs(ymd);
  return d.isValid() ? d.format('ddd, D MMM YYYY') : ymd;
}

export default function ProfileLeaveApplyScreen() {
  const queryClient = useQueryClient();
  const [leaveStart, setLeaveStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [leaveEnd, setLeaveEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState<'standard' | 'comp_off'>('standard');
  const [pickerField, setPickerField] = useState<PickerField | null>(null);

  const applyPickedYmd = (field: PickerField, ymd: string) => {
    if (field === 'start') {
      setLeaveStart(ymd);
      setLeaveEnd((prev) => (dayjs(prev).isBefore(dayjs(ymd), 'day') ? ymd : prev));
    } else {
      setLeaveEnd(ymd);
    }
  };

  const leaveMutation = useMutation({
    mutationFn: () =>
      technicianApi.createLeaveRequest({
        startDate: dayjs(leaveStart).startOf('day').toISOString(),
        endDate: dayjs(leaveEnd).endOf('day').toISOString(),
        reason: leaveReason.trim() || undefined,
        leaveType,
      }),
    onSuccess: () => {
      setLeaveReason('');
      queryClient.invalidateQueries({ queryKey: ['technicianLeave'] });
      Alert.alert('Leave', 'Your request was submitted for approval.');
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      Alert.alert('Leave', msg || 'Could not submit leave request.');
    },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.lead}>
          Submit a request for time off. Your manager will review and approve or decline.
        </Text>

        <Text style={styles.fieldLabel}>Leave type</Text>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setLeaveType('standard')}
            style={[styles.toggleBtn, leaveType === 'standard' && styles.toggleBtnOn]}
          >
            <Text style={[styles.toggleTxt, leaveType === 'standard' && styles.toggleTxtOn]}>Standard</Text>
          </Pressable>
          <Pressable
            onPress={() => setLeaveType('comp_off')}
            style={[styles.toggleBtn, leaveType === 'comp_off' && styles.toggleBtnOn]}
          >
            <Text style={[styles.toggleTxt, leaveType === 'comp_off' && styles.toggleTxtOn]}>Comp‑off</Text>
          </Pressable>
        </View>
        {leaveType === 'comp_off' ? (
          <Text style={styles.hintMuted}>
            Approved comp‑off leave debits your balance (calendar days inclusive). Ensure you earned comp‑off from working
            a configured holiday—see Profile → Attendance.
          </Text>
        ) : null}

        <Text style={styles.fieldLabel}>Start date</Text>
        <Pressable
          style={({ pressed }) => [styles.dateRow, pressed && styles.dateRowPressed]}
          onPress={() => setPickerField('start')}
        >
          <Text style={styles.dateRowText}>{formatDisplay(leaveStart)}</Text>
          <IconSymbol name="calendar" size={22} color="#6b7280" />
        </Pressable>

        <Text style={styles.fieldLabel}>End date</Text>
        <Pressable
          style={({ pressed }) => [styles.dateRow, pressed && styles.dateRowPressed]}
          onPress={() => setPickerField('end')}
        >
          <Text style={styles.dateRowText}>{formatDisplay(leaveEnd)}</Text>
          <IconSymbol name="calendar" size={22} color="#6b7280" />
        </Pressable>

        <Text style={styles.fieldLabel}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={leaveReason}
          onChangeText={setLeaveReason}
          placeholder="Brief reason for leave"
          placeholderTextColor="#9ca3af"
          multiline
        />

        <Pressable
          style={[styles.primaryBtn, leaveMutation.isPending && styles.btnDisabled]}
          disabled={leaveMutation.isPending}
          onPress={() => leaveMutation.mutate()}
        >
          <Text style={styles.primaryBtnText}>Submit request</Text>
        </Pressable>
      </ScrollView>

      <SimpleCalendarModal
        visible={pickerField === 'start'}
        title="Start date"
        valueYmd={leaveStart}
        onClose={() => setPickerField(null)}
        onSelectYmd={(ymd) => applyPickedYmd('start', ymd)}
      />

      <SimpleCalendarModal
        visible={pickerField === 'end'}
        title="End date"
        valueYmd={leaveEnd}
        minimumYmd={leaveStart}
        onClose={() => setPickerField(null)}
        onSelectYmd={(ymd) => applyPickedYmd('end', ymd)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: 16, paddingBottom: 32 },
  lead: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: Fonts?.sans,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  toggleBtnOn: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  toggleTxt: { fontSize: 14, fontWeight: '600', color: '#374151', fontFamily: Fonts?.sans },
  toggleTxtOn: { color: '#ffffff' },
  hintMuted: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 17,
    fontFamily: Fonts?.sans,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 8,
    fontFamily: Fonts?.sans,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
  },
  dateRowPressed: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  dateRowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
    fontFamily: Fonts?.sans,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 16, fontFamily: Fonts?.sans },
  btnDisabled: { opacity: 0.6 },
});
