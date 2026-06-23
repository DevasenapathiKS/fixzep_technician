import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { parseTentativeSqFt } from '@/lib/parse-tentative-sqft';

type Props = {
  value?: number | null;
  disabled?: boolean;
  saving?: boolean;
  onSave: (tentativeSqFt: number) => void | Promise<void>;
};

function hasTentativeSqFt(value?: number | null): value is number {
  return typeof value === 'number' && value > 0;
}

export function JobCardTentativeSqFtField({ value, disabled, saving, onSave }: Props) {
  const [local, setLocal] = useState(hasTentativeSqFt(value) ? String(value) : '');

  useEffect(() => {
    setLocal(hasTentativeSqFt(value) ? String(value) : '');
  }, [value]);

  if (!hasTentativeSqFt(value)) return null;

  const commit = async () => {
    const trimmed = local.trim();
    if (!trimmed) {
      setLocal(String(value));
      return;
    }
    const sq = parseTentativeSqFt(trimmed);
    if (sq == null) {
      Alert.alert('Invalid', 'Enter a valid sq.ft (positive number).');
      setLocal(value != null ? String(value) : '');
      return;
    }
    if (sq === value) return;
    await onSave(sq);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Tentative sq.ft</Text>
      <TextInput
        style={[styles.input, (disabled || saving) && styles.inputDisabled]}
        keyboardType="decimal-pad"
        placeholder="e.g. 1200"
        value={local}
        editable={!disabled && !saving}
        onChangeText={setLocal}
        onBlur={() => void commit()}
        onSubmitEditing={() => void commit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    maxWidth: 160,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
  },
});
