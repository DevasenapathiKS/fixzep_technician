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
  } | null;
  lastCheckInAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface TechnicianJobDetail {
  order: (TechnicianJobSummary['order'] & {
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
    paymentStatus?: JobPaymentStatus;
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
      };
      quantity?: number;
      unitPrice?: number;
    }>;
  } | null;
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
