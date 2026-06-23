import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { technicianAttendanceMonthQueryKey } from '@/lib/attendance-month-query';
import { formatInr } from '@/lib/format-inr';
import { shareMonthlyPayslipCsv } from '@/lib/share-payslip';
import { technicianApi } from '@/lib/technician-api';
import type { AttendanceMonthDayRow } from '@/types/api';

const COL = {
  date: 80,
  day: 38,
  kind: 80,
  pay: 64,
  in: 54,
  out: 54,
  hours: 64,
  ot: 56,
  remarks: 100,
  status: 56,
};

function kindCell(r: AttendanceMonthDayRow) {
  const p = r.payroll;
  if (!p) return '—';
  if (p.dayTag === 'public_holiday') return (p.holidayName || 'Holiday').slice(0, 14);
  if (p.dayTag === 'sunday') return 'Sun (paid)';
  return '—';
}

export default function ProfileAttendanceScreen() {
  const [monthCursor, setMonthCursor] = useState(() => dayjs().startOf('month'));
  const year = monthCursor.year();
  const month = monthCursor.month() + 1;
  const [payslipBusy, setPayslipBusy] = useState(false);

  const monthSummaryQuery = useQuery({
    queryKey: technicianAttendanceMonthQueryKey(year, month),
    queryFn: () => technicianApi.getAttendanceMonthSummary(year, month),
  });

  const summary = monthSummaryQuery.data;
  const rows = summary?.rows ?? [];

  const canGoNextMonth = useMemo(() => {
    const now = dayjs();
    return monthCursor.isBefore(now, 'month');
  }, [monthCursor]);

  // Payslip is downloadable only once the payroll period (26th–25th) for this month has ended.
  // Prefer the period end the server reports; fall back to the 25th of the selected month.
  const payrollPeriodComplete = useMemo(() => {
    const end = summary?.payrollPeriodEnd
      ? dayjs(summary.payrollPeriodEnd).endOf('day')
      : dayjs(new Date(year, month - 1, 25)).endOf('day');
    return dayjs().isAfter(end);
  }, [summary?.payrollPeriodEnd, year, month]);

  const onDownloadPayslip = async () => {
    if (!payrollPeriodComplete) {
      Alert.alert(
        'Payslip not ready',
        'You can download the payslip only after this month’s payroll period (26th–25th) is complete.'
      );
      return;
    }
    setPayslipBusy(true);
    try {
      await shareMonthlyPayslipCsv(year, month);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not download payslip.';
      Alert.alert('Payslip', msg);
    } finally {
      setPayslipBusy(false);
    }
  };

  const renderRow = (r: AttendanceMonthDayRow, idx: number) => {
    const hasData = Boolean(r.status || r.punchInLabel || r.punchOutLabel);
    const payTxt =
      r.payroll?.payVisible && r.payroll.attendanceNet != null
        ? `₹${formatInr(Math.round(r.payroll.attendanceNet))}`
        : r.payroll && !r.payroll.payVisible
          ? 'Pending'
          : '—';
    return (
      <View
        key={r.date}
        style={[styles.tr, idx % 2 === 0 ? styles.trAlt : undefined, !hasData ? styles.trMuted : undefined]}
      >
        <Text style={[styles.td, { width: COL.date }]}>{r.date.slice(8)}</Text>
        <Text style={[styles.td, { width: COL.day }]}>{r.dayOfWeek}</Text>
        <Text style={[styles.td, { width: COL.kind }]} numberOfLines={1}>
          {kindCell(r)}
        </Text>
        <Text style={[styles.td, { width: COL.pay }, styles.tdNum, !r.payroll?.payVisible && r.payroll ? styles.tdPending : undefined]}>
          {payTxt}
        </Text>
        <Text style={[styles.td, { width: COL.in }]}>{r.punchInLabel || '—'}</Text>
        <Text style={[styles.td, { width: COL.out }]}>{r.punchOutLabel || '—'}</Text>
        <Text style={[styles.td, { width: COL.hours }]}>{r.hoursLabel || '—'}</Text>
        <Text style={[styles.td, { width: COL.ot }]}>{r.overtimeLabel || '—'}</Text>
        <Text style={[styles.td, { width: COL.remarks }]} numberOfLines={2}>
          {r.remarks || '—'}
        </Text>
        <Text style={[styles.td, { width: COL.status }]} numberOfLines={1}>
          {r.status || '—'}
        </Text>
      </View>
    );
  };

  const tableWidth =
    COL.date +
    COL.day +
    COL.kind +
    COL.pay +
    COL.in +
    COL.out +
    COL.hours +
    COL.ot +
    COL.remarks +
    COL.status +
    24;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={monthSummaryQuery.isRefetching} onRefresh={() => monthSummaryQuery.refetch()} />
        }
      >
        <Text style={styles.lead}>
          Day-by-day breakdown and CSV export. Estimated pay for this month is on the Jobs home screen—amounts publish
          after each Mon–Sun week closes.
        </Text>

        <View style={styles.monthBar}>
          <Pressable onPress={() => setMonthCursor((c) => c.subtract(1, 'month'))} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>‹</Text>
          </Pressable>
          <View style={styles.monthCenter}>
            <Text style={styles.monthTitle}>{summary?.monthLabel ?? monthCursor.format('MMMM YYYY')}</Text>
            {monthSummaryQuery.isFetching ? <Text style={styles.mutedSmall}>Updating…</Text> : null}
          </View>
          <Pressable
            onPress={() => {
              if (canGoNextMonth) setMonthCursor((c) => c.add(1, 'month'));
            }}
            style={[styles.monthBtn, !canGoNextMonth && styles.monthBtnDisabled]}
            disabled={!canGoNextMonth}
          >
            <Text style={[styles.monthBtnText, !canGoNextMonth && styles.monthBtnTextDisabled]}>›</Text>
          </Pressable>
        </View>

        {summary ? (
          <>
            <View style={styles.totalsCard}>
              <Text style={styles.totalsText}>
                Month total{' '}
                <Text style={styles.totalsStrong}>{summary.totals.workedLabel || '0m'}</Text>
                <Text style={styles.totalsMid}> · OT </Text>
                <Text style={styles.totalsStrong}>{summary.totals.overtimeLabel || '0m'}</Text>
              </Text>
            </View>

            {summary.compOff ? (
              <View style={[styles.miniCard, { marginBottom: 10 }]}>
                <Text style={styles.miniCardTitle}>Comp‑off balance</Text>
                <Text style={styles.miniCardValue}>
                  {typeof summary.compOff.balanceDays === 'number'
                    ? `${summary.compOff.balanceDays} day${summary.compOff.balanceDays === 1 ? '' : 's'}`
                    : '—'}
                </Text>
                <Text style={styles.miniCardMuted}>{summary.compOff.note}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.policyNote} numberOfLines={6}>
          {summary?.overtimePolicyNote ?? 'Overtime = time beyond 9h 30m between punch in and out.'}{' '}
          {summary?.payrollPublishPolicyNote} {summary?.payEstimateDisclaimer}
        </Text>

        <Pressable
          style={[styles.downloadBtn, (payslipBusy || !payrollPeriodComplete) && styles.btnDisabled]}
          disabled={payslipBusy || !payrollPeriodComplete}
          onPress={onDownloadPayslip}
        >
          {payslipBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.downloadBtnText}>Download payslip (CSV)</Text>
          )}
        </Pressable>
        {!payrollPeriodComplete ? (
          <Text style={styles.payslipHint}>
            Payslip becomes available after this month’s payroll period (26th–25th) is complete.
          </Text>
        ) : null}

        {monthSummaryQuery.isError ? (
          <Text style={styles.errorText}>Could not load attendance. Pull to refresh or check connection.</Text>
        ) : null}

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={{ width: tableWidth }}>
              <View style={styles.trHeader}>
                <Text style={[styles.th, { width: COL.date }]}>Date</Text>
                <Text style={[styles.th, { width: COL.day }]}>Day</Text>
                <Text style={[styles.th, { width: COL.kind }]}>Kind</Text>
                <Text style={[styles.th, { width: COL.pay }]}>Pay ₹</Text>
                <Text style={[styles.th, { width: COL.in }]}>In</Text>
                <Text style={[styles.th, { width: COL.out }]}>Out</Text>
                <Text style={[styles.th, { width: COL.hours }]}>Hours</Text>
                <Text style={[styles.th, { width: COL.ot }]}>OT</Text>
                <Text style={[styles.th, { width: COL.remarks }]}>Remarks</Text>
                <Text style={[styles.th, { width: COL.status }]}>Status</Text>
              </View>
              {monthSummaryQuery.isLoading ? (
                <View style={styles.tableLoader}>
                  <ActivityIndicator color="#111827" />
                </View>
              ) : rows.length === 0 ? (
                <Text style={styles.emptyTable}>No rows for this month.</Text>
              ) : (
                rows.map(renderRow)
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  lead: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: Fonts?.sans,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthCenter: { flex: 1, alignItems: 'center' },
  monthBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnDisabled: { opacity: 0.35 },
  monthBtnText: { fontSize: 22, color: '#111827', fontWeight: '600', fontFamily: Fonts?.sans },
  monthBtnTextDisabled: { color: '#9ca3af', fontFamily: Fonts?.sans },
  monthTitle: { fontSize: 17, fontWeight: '700', color: '#111827', fontFamily: Fonts?.sans },
  mutedSmall: { fontSize: 12, color: '#9ca3af', fontFamily: Fonts?.sans },
  totalsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  totalsText: { fontSize: 14, color: '#4b5563', fontFamily: Fonts?.sans },
  totalsMid: { color: '#6b7280', fontFamily: Fonts?.sans },
  totalsStrong: { fontWeight: '700', color: '#111827', fontFamily: Fonts.bold },
  payCardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  miniCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  miniCardOvertime: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  miniCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: Fonts?.sans,
  },
  miniCardValue: { fontSize: 22, fontWeight: '800', color: '#065f46', marginTop: 6, fontFamily: Fonts?.sans },
  miniCardValueOt: { color: '#3730a3' },
  miniCardFootOt: { marginTop: 6, fontSize: 12, color: '#4338ca', fontFamily: Fonts?.sans },
  miniCardMuted: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    fontFamily: Fonts?.sans,
  },
  miniCardFoot: { marginTop: 6, fontSize: 12, color: '#047857', fontFamily: Fonts?.sans },
  policyNote: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginBottom: 12, fontFamily: Fonts?.sans },
  downloadBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadBtnText: { color: '#fff', fontWeight: '600', fontSize: 15, fontFamily: Fonts?.sans },
  btnDisabled: { opacity: 0.6 },
  payslipHint: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16,
    marginTop: -8,
    marginBottom: 16,
    fontFamily: Fonts?.sans,
  },
  errorText: { color: '#b91c1c', fontSize: 13, marginBottom: 12, fontFamily: Fonts?.sans },
  tableCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  trHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: 2,
    fontFamily: Fonts?.sans,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  trAlt: { backgroundColor: '#fafafa' },
  trMuted: { opacity: 0.72 },
  td: {
    fontSize: 12,
    color: '#111827',
    paddingHorizontal: 2,
    fontFamily: Fonts?.sans,
  },
  tdNum: { fontVariant: ['tabular-nums'] },
  tdPending: { color: '#9ca3af', fontStyle: 'italic' },
  emptyTable: { padding: 24, textAlign: 'center', color: '#9ca3af', fontFamily: Fonts?.sans },
  tableLoader: { padding: 24, alignItems: 'center' },
});
