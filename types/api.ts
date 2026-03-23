export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export interface SendOtpResult {
  reqId: string;
}

export interface VerifyOtpResult {
  token: string;
  user: AuthUser;
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
    /** For multi-service orders, each line may have serviceName and serviceVariantLabel */
    services?: Array<{ serviceName?: string; serviceVariantLabel?: string; serviceVariantPrice?: number }>;
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
    paymentStatus?: JobPaymentStatus;
    technician?: {
      name?: string;
      mobile?: string;
    } | string | null;
    visits?: Array<{
      id?: string;
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
