import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

import { technicianApi } from '@/lib/technician-api';

/**
 * Downloads CSV payslip from API and opens the system share sheet (Save to Files, Drive, etc.).
 * Uses React Native Share only — avoids expo-sharing so dev clients without that native module still work.
 */
export async function shareMonthlyPayslipCsv(year: number, month: number): Promise<void> {
  const csv = await technicianApi.fetchAttendancePayslipCsv(year, month);
  const fileName = `fixzep-payslip-${year}-${String(month).padStart(2, '0')}.csv`;
  const base = cacheDirectory;
  if (!base) {
    throw new Error('Cache directory is not available');
  }
  const path = `${base}${fileName}`;
  await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });

  if (Platform.OS === 'ios') {
    const url = path.startsWith('file://') ? path : `file://${path}`;
    await Share.share({ url, title: 'Save or share payslip' });
    return;
  }

  await Share.share({
    message: csv,
    title: 'Save or share payslip',
  });
}
