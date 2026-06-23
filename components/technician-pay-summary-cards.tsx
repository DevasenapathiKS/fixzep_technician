import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { formatInr } from '@/lib/format-inr';
import type { AttendanceMonthPayrollRollup } from '@/types/api';

type Props = {
  payroll: AttendanceMonthPayrollRollup | null;
  monthLabel?: string;
  loading?: boolean;
  /** Dashboard home — larger header + optional details link */
  variant?: 'dashboard' | 'compact';
  onViewDetails?: () => void;
};

export function TechnicianPaySummaryCards({
  payroll,
  monthLabel,
  loading,
  variant = 'compact',
  onViewDetails,
}: Props) {
  const isDashboard = variant === 'dashboard';
  const valueSize = isDashboard ? 24 : 22;

  if (loading) {
    return (
      <View style={[styles.wrap, isDashboard && styles.wrapDashboard]}>
        <ActivityIndicator color="#111827" />
      </View>
    );
  }

  if (!payroll) {
    if (isDashboard) {
      return (
        <View style={[styles.wrap, styles.wrapDashboard]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>Your earnings</Text>
              <Text style={styles.sectionTitle}>{monthLabel ? monthLabel : 'This month'}</Text>
            </View>
            {onViewDetails ? (
              <Pressable onPress={onViewDetails} style={styles.detailsChip} hitSlop={8}>
                <Text style={styles.detailsChipText}>Details</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.payCardsRow}>
            <View style={[styles.miniCard, styles.miniCardAttendance, { flex: 1 }]}>
              <Text style={styles.cardTitle}>Attendance pay</Text>
              <Text style={[styles.cardValue, { fontSize: valueSize }]}>₹0</Text>
            </View>
            <View style={[styles.miniCard, styles.miniCardOvertime, { flex: 1 }]}>
              <Text style={styles.cardTitle}>Overtime pay</Text>
              <Text style={[styles.cardValue, styles.cardValueOt, { fontSize: valueSize }]}>₹0</Text>
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.wrap, isDashboard && styles.wrapDashboard]}>
        <View style={styles.noPayrollCard}>
          <Text style={styles.cardTitle}>Earnings estimate</Text>
          <Text style={styles.muted}>
            Payroll is not set up on your profile yet—ask HR to add your salary structure in admin.
          </Text>
        </View>
      </View>
    );
  }

  const attendanceTotal = Math.round(payroll.attendanceNetPayTotal);
  const overtimeTotal = Math.round(payroll.overtimePayTotal);
  const hasCombined = payroll.combinedIndicativeNet > 0;

  return (
    <View style={[styles.wrap, isDashboard && styles.wrapDashboard]}>
      {isDashboard ? (
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>Your earnings</Text>
            <Text style={styles.sectionTitle}>{monthLabel ? monthLabel : 'This month'}</Text>
            {isDashboard ? null : (
              <Text style={styles.sectionHint}>Published after each Mon–Sun week closes</Text>
            )}
          </View>
          {onViewDetails ? (
            <Pressable onPress={onViewDetails} style={styles.detailsChip} hitSlop={8}>
              <Text style={styles.detailsChipText}>Details</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.payCardsRow}>
        <View style={[styles.miniCard, styles.miniCardAttendance, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Attendance pay</Text>
          <Text style={[styles.cardValue, { fontSize: valueSize }]}>₹{formatInr(attendanceTotal)}</Text>
          {attendanceTotal > 0 ? (
            <Text style={styles.cardFoot}>
              Published weeks · ₹{formatInr(Math.round(payroll.netMonthly))} ÷ {payroll.calendarDaysInMonth} days
            </Text>
          ) : null}
        </View>

        <View style={[styles.miniCard, styles.miniCardOvertime, { flex: 1 }]}>
          <Text style={styles.cardTitle}>Overtime pay</Text>
          <Text style={[styles.cardValue, styles.cardValueOt, { fontSize: valueSize }]}>
            ₹{formatInr(overtimeTotal)}
          </Text>
          {overtimeTotal > 0 ? (
            <Text style={styles.cardFootOt}>
              ₹{formatInr(Number(payroll.grossHourlyForOvertime ?? 0))}/h × {payroll.overtimeMultiplier} OT
            </Text>
          ) : null}
        </View>
      </View>

      {hasCombined ? (
        <Text style={styles.combinedLine}>
          Combined (published): <Text style={styles.combinedStrong}>₹{formatInr(Math.round(payroll.combinedIndicativeNet))}</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  wrapDashboard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: Fonts?.sans,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
    fontFamily: Fonts?.sans,
  },
  sectionHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 16,
    fontFamily: Fonts?.sans,
  },
  detailsChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  detailsChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    fontFamily: Fonts?.sans,
  },
  payCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    minWidth: 140,
  },
  miniCardAttendance: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  miniCardOvertime: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  noPayrollCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: Fonts?.sans,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065f46',
    marginTop: 8,
    fontFamily: Fonts?.sans,
  },
  cardValueOt: {
    color: '#3730a3',
  },
  cardFoot: {
    marginTop: 6,
    fontSize: 11,
    color: '#047857',
    lineHeight: 15,
    fontFamily: Fonts?.sans,
  },
  cardFootOt: {
    marginTop: 6,
    fontSize: 11,
    color: '#4338ca',
    lineHeight: 15,
    fontFamily: Fonts?.sans,
  },
  muted: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    fontFamily: Fonts?.sans,
  },
  combinedLine: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
    fontFamily: Fonts?.sans,
  },
  combinedStrong: {
    fontWeight: '800',
    color: '#111827',
    fontFamily: Fonts.bold,
  },
});
