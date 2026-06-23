/** Shared React Query key for GET /technician/attendance/month-summary */
export function technicianAttendanceMonthQueryKey(year: number, month: number) {
  return ['technicianAttendanceMonth', year, month] as const;
}
