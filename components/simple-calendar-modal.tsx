import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  visible: boolean;
  title: string;
  /** Selected day as YYYY-MM-DD */
  valueYmd: string;
  /** Inclusive; omit for no lower bound */
  minimumYmd?: string;
  /** Inclusive; omit for no upper bound */
  maximumYmd?: string;
  onClose: () => void;
  /** Called with YYYY-MM-DD when user confirms a day */
  onSelectYmd: (ymd: string) => void;
};

function parseYmd(ymd: string) {
  const d = dayjs(ymd);
  return d.isValid() ? d : dayjs();
}

function buildWeeks(monthCursor: dayjs.Dayjs): dayjs.Dayjs[][] {
  const monthStart = monthCursor.startOf('month');
  const firstSunday = monthStart.subtract(monthStart.day(), 'day');
  const weeks: dayjs.Dayjs[][] = [];
  let cell = firstSunday;
  for (let w = 0; w < 6; w++) {
    const row: dayjs.Dayjs[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(cell);
      cell = cell.add(1, 'day');
    }
    weeks.push(row);
  }
  return weeks;
}

export function SimpleCalendarModal({
  visible,
  title,
  valueYmd,
  minimumYmd,
  maximumYmd,
  onClose,
  onSelectYmd,
}: Props) {
  const insets = useSafeAreaInsets();
  const minD = minimumYmd ? parseYmd(minimumYmd).startOf('day') : null;
  const maxD = maximumYmd ? parseYmd(maximumYmd).endOf('day') : null;

  const [monthCursor, setMonthCursor] = useState(() => parseYmd(valueYmd).startOf('month'));

  useEffect(() => {
    if (visible) {
      setMonthCursor(parseYmd(valueYmd).startOf('month'));
    }
  }, [visible, valueYmd]);

  const weeks = buildWeeks(monthCursor);
  const selected = parseYmd(valueYmd).format('YYYY-MM-DD');

  const isDisabled = (d: dayjs.Dayjs) => {
    const dayStart = d.startOf('day');
    if (minD && dayStart.isBefore(minD, 'day')) return true;
    if (maxD && dayStart.isAfter(maxD, 'day')) return true;
    return false;
  };

  const prevMonthEnd = monthCursor.subtract(1, 'month').endOf('month');
  const canPrevMonth = !minD || !prevMonthEnd.isBefore(minD, 'day');

  const nextMonthStart = monthCursor.add(1, 'month').startOf('month');
  const canNextMonth = !maxD || !nextMonthStart.isAfter(maxD, 'day');

  const onDayPress = (d: dayjs.Dayjs) => {
    if (isDisabled(d)) return;
    onSelectYmd(d.format('YYYY-MM-DD'));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.flexFill} onPress={onClose} accessibilityLabel="Close calendar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.toolbar}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.toolbarBtn}>Cancel</Text>
            </Pressable>
            <Text style={styles.toolbarTitle}>{title}</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={styles.monthRow}>
            <Pressable
              style={[styles.monthNav, !canPrevMonth && styles.monthNavDisabled]}
              disabled={!canPrevMonth}
              onPress={() => setMonthCursor((c) => c.subtract(1, 'month'))}
            >
              <Text style={styles.monthNavText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthCursor.format('MMMM YYYY')}</Text>
            <Pressable
              style={[styles.monthNav, !canNextMonth && styles.monthNavDisabled]}
              disabled={!canNextMonth}
              onPress={() => setMonthCursor((c) => c.add(1, 'month'))}
            >
              <Text style={styles.monthNavText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekdayCell}>
                {w}
              </Text>
            ))}
          </View>

          {weeks.map((row, wi) => (
            <View key={wi} style={styles.dayRow}>
              {row.map((d) => {
                const ymd = d.format('YYYY-MM-DD');
                const inMonth = d.month() === monthCursor.month();
                const disabled = isDisabled(d);
                const isSelected = ymd === selected;
                return (
                  <Pressable
                    key={`${ymd}-${wi}`}
                    style={styles.dayCell}
                    disabled={disabled}
                    onPress={() => onDayPress(d)}
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isSelected && styles.dayInnerSelected,
                        disabled && styles.dayInnerDisabled,
                        !inMonth && styles.dayInnerMuted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          disabled && styles.dayTextDisabled,
                          !inMonth && styles.dayTextMuted,
                        ]}
                      >
                        {d.date()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  flexFill: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    maxHeight: '88%',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  toolbarBtn: {
    fontSize: 17,
    color: '#6b7280',
    width: 56,
    fontFamily: Fonts?.sans,
  },
  toolbarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  monthNav: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavDisabled: { opacity: 0.35 },
  monthNavText: { fontSize: 22, fontWeight: '600', color: '#111827', fontFamily: Fonts?.sans },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    paddingVertical: 6,
    fontFamily: Fonts?.sans,
  },
  dayRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    padding: 2,
    aspectRatio: 1,
    maxHeight: 48,
  },
  dayInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerSelected: {
    backgroundColor: '#1d4ed8',
  },
  dayInnerDisabled: {
    opacity: 0.35,
  },
  dayInnerMuted: {
    opacity: 0.45,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: Fonts?.sans,
  },
  dayTextSelected: {
    color: '#ffffff',
  },
  dayTextDisabled: {
    color: '#9ca3af',
  },
  dayTextMuted: {
    color: '#9ca3af',
  },
});
