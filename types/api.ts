export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  permissions?: string[];
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export interface SendOtpResult {
  reqId: string;
}

export interface VerifyOtpResult {
  preAuthToken: string;
  needsFaceEnrollment: boolean;
  user: AuthUser;
  /** Present when face is already enrolled — use instead of pre-auth + biometrics. */
  session?: LoginResult;
}

export interface TechnicianAttendanceRow {
  id: string;
  date: string;
  status: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  note?: string | null;
  source?: string;
}

/** One day in a payroll period (from GET /technician/attendance/month-summary). */
export interface AttendanceMonthDayRow {
  date: string;
  dayOfWeek: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  punchInLabel: string;
  punchOutLabel: string;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  hoursLabel: string;
  overtimeLabel: string;
  remarks: string;
  status: string;
  payroll?: {
    payVisible: boolean;
    attendanceNet: number | null;
    lines: Array<{ code: string; amount: number; label: string }>;
    holidayPremiumMultiplier: number | null;
    compOffEarnDays: number;
    holidayName: string | null;
    dayTag: 'regular' | 'public_holiday' | 'sunday';
  } | null;
}

export interface AttendanceMonthPayrollRollup {
  netMonthly: number;
  grossMonthly: number;
  calendarDaysInMonth: number;
  payrollPeriodDays: number;
  netDailyAllocation: number;
  grossHourlyForOvertime: number | null;
  overtimeMultiplier: number;
  attendanceNetPayTotal: number;
  overtimePayTotal: number;
  combinedIndicativeNet: number;
  publishedOvertimeMinutes?: number;
  petrolAllowancePerDay?: number | null;
  petrolAllowanceTotal?: number;
  petrolAllowanceDays?: number;
}

export interface AttendanceMonthSummary {
  year: number;
  month: number;
  monthLabel: string;
  payrollPeriodLabel?: string;
  payrollPeriodStart?: string;
  payrollPeriodEnd?: string;
  payrollPeriodDays?: number;
  payrollPeriodPolicyNote?: string;
  technicianName: string;
  hasSalaryConfigured?: boolean;
  hasPetrolAllowanceConfigured?: boolean;
  petrolAllowancePerDay?: number | null;
  rows: AttendanceMonthDayRow[];
  totals: {
    workedMinutes: number;
    overtimeMinutes: number;
    workedLabel: string;
    overtimeLabel: string;
  };
  overtimePolicyNote: string;
  payEstimateDisclaimer?: string;
  payrollPublishPolicyNote?: string;
  payroll: AttendanceMonthPayrollRollup | null;
  compOff: {
    balanceDays: number;
    note: string;
  };
}

export interface TechnicianLeaveRow {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
  leaveType?: 'standard' | 'comp_off';
  status: string;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
}

export interface TechnicianProfileResponse {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  profile?: {
    experienceYears?: number;
    averageRating?: number;
    workingHours?: {
      start?: string;
      end?: string;
    };
    baseLocation?: {
      type?: string;
      coordinates?: [number, number];
    };
    serviceCategories?: ServiceRef[];
    serviceItems?: ServiceRef[];
    /** Server stores a perceptual hash only — the selfie itself is not kept or shown. */
    faceLoginEnrolled?: boolean;
    faceLoginEnrolledAt?: string | null;
  };
}

export interface ServiceRef {
  id?: string;
  name?: string;
  description?: string;
}

export interface TechnicianJobSummary {
  id: string;
  status: string;
  estimateAmount?: number;
  finalAmount?: number;
  order: {
    id?: string;
    code?: string;
    status?: string;
    customer?: {
      name?: string;
      phone?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
    /** Normalized service location (from CustomerAddress or embedded customer). */
    serviceAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      label?: string;
    };
    customerAddress?: unknown;
    scheduledAt?: string;
    timeWindowStart?: string;
    timeWindowEnd?: string;
    serviceItem?: ServiceRef | null;
    serviceCategory?: ServiceRef | null;
    issueDescription?: string;
    /** Variant label when service has variants (e.g. "2 BHK") */
    serviceVariantLabel?: string | null;
    serviceVariantPrice?: number | null;
    tentativeSqFt?: number | null;
    /** For multi-service orders, each line may have serviceName and serviceVariantLabel */
    services?: Array<{
      serviceName?: string;
      serviceVariantLabel?: string;
      serviceVariantPrice?: number;
      tentativeSqFt?: number | null;
      estimatedCost?: number;
    }>;
  } | null;
  lastCheckInAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface TechnicianJobDetail {
  order: (TechnicianJobSummary['order'] & {
    media?: Array<{
      _id?: string;
      url: string;
      kind?: 'image' | 'video' | 'document';
      name?: string;
    }>;
    history?: Array<{
      action?: string;
      message?: string;
      metadata?: Record<string, unknown>;
      performedAt?: string;
      performedBy?: {
        name?: string;
        role?: string;
      } | null;
    }>;
    followUp?: Record<string, unknown> | null;
  }) | null;
  jobCard: {
    id: string;
    status: string;
    estimateAmount?: number;
    additionalCharges?: number;
    finalAmount?: number;
    customAmount?: number;
    customBillItems?: Array<{ description: string; amount: number }>;
    discountType?: 'none' | 'fixed' | 'percent';
    discountValue?: number;
    discountNote?: string;
    paymentStatus?: JobPaymentStatus;
    /** Primary assignee user id (ObjectId string); used when legacy rows omit `technician`. */
    technician?: string | { _id?: string; id?: string; name?: string; mobile?: string } | null;
    visits?: Array<{
      id?: string;
      technician?: string | { _id?: string; id?: string };
      visitDate?: string;
      status?: 'scheduled' | 'checked_in' | 'checked_out' | 'missed' | string;
      checkInAt?: string;
      checkOutAt?: string;
      workNoteStart?: string;
      workNoteEnd?: string;
      durationMinutes?: number;
      finalDay?: boolean;
    }>;
    checkIns?: Array<{
      technician?: string | { _id?: string; id?: string };
      timestamp: string;
      note?: string;
    }>;
    extraWork?: Array<{
      description: string;
      amount: number;
      serviceCategory?: ServiceRef | null;
      serviceItem?: ServiceRef | null;
    }>;
    sparePartsUsed?: Array<{
      part?: {
        _id?: string;
        name?: string;
        sku?: string;
        unitPrice?: number;
      };
      quantity?: number;
      unitPrice?: number;
    }>;
  } | null;
  paymentBreakdown?: {
    servicePrice: number;
    sparePartsSubtotal: number;
    extraWorksSubtotal: number;
    customAmount: number;
    customBillItems?: Array<{ description: string; amount: number }>;
    preDiscountSubtotal: number;
    discountAmount: number;
    discountLabel?: string;
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
  };
  technicianCalendar?: Array<{
    id: string;
    date: string;
    start: string;
    end: string;
    status: 'blocked' | 'completed' | 'cancelled';
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    status: string;
    transactionRef?: string;
    paidAt?: string;
    createdAt?: string;
  }>;
  /** AMC subscription onsite inventory checklist (survey lines expanded per count). */
  amcInspection?: {
    subscriptionId: string;
    planNameSnapshot: string;
    surveyStatus: string;
    items: Array<{
      itemKey: string;
      displayLabel: string;
      lineId: string;
      lineLabel: string;
      instanceIndex: number;
      instanceCount: number;
      note: string;
      completed: boolean;
      photos: Array<{ id?: string; url: string; name?: string }>;
    }>;
  } | null;
  /** Same-day lock after day-checkout or completed session (server `TIMEZONE`). */
  technicianVisitControls?: {
    businessCalendarDate: string;
    timezone: string;
    hasActiveVisit: boolean;
    hasEndedOnSiteSessionToday: boolean;
    canCheckIn: boolean;
    canUseOtpCheckout: boolean;
  };
}

export interface TechnicianNotification {
  id: string;
  event: string;
  payload?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SparePartSummary {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
}

export type JobClosureResolution = 'completed' | 'follow_up';
export type JobPaymentStatus = 'paid' | 'pending' | 'partial';

export interface ServiceCatalogCategory {
  id: string;
  name: string;
  description?: string;
  items: Array<{
    id: string;
    name: string;
    description?: string;
    basePrice?: number;
  }>;
}
