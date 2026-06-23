import type {
    ApiResponse,
    AttendanceMonthSummary,
    JobClosureResolution,
    JobPaymentStatus,
    LoginResult,
    SendOtpResult,
    ServiceCatalogCategory,
    SparePartSummary,
    TechnicianAttendanceRow,
    TechnicianJobDetail,
    TechnicianJobSummary,
    TechnicianLeaveRow,
    TechnicianNotification,
    TechnicianProfileResponse,
    VerifyOtpResult
} from '@/types/api';
import type { AxiosResponse } from 'axios';
import { api } from './api-client';

const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>) => response.data.data;

export const technicianApi = {
  login: (email: string, password: string) =>
    api
      .post<ApiResponse<LoginResult>>('/auth/login', { email, password, role: 'technician' })
      .then(unwrap),

  sendOtp: (phone: string) =>
    api
      .post<ApiResponse<SendOtpResult>>('/auth/technician/send-otp', { phone })
      .then(unwrap),

  verifyOtp: (phone: string, otp: string, reqId: string) =>
    api
      .post<ApiResponse<VerifyOtpResult>>('/auth/technician/verify-otp', { phone, otp, reqId })
      .then(unwrap),

  completeLogin: (
    preAuthToken: string,
    body: { method: 'device_biometric' | 'face_image'; faceImageBase64?: string }
  ) =>
    api
      .post<ApiResponse<LoginResult>>('/auth/technician/complete-login', body, {
        headers: { Authorization: `Bearer ${preAuthToken}` },
      })
      .then(unwrap),

  getProfile: () =>
    api.get<ApiResponse<TechnicianProfileResponse>>('/technician/profile').then(unwrap),

  updateFaceReference: (payload: { faceImageBase64: string }) =>
    api
      .post<ApiResponse<{ faceLoginEnrolled: boolean; faceLoginEnrolledAt: string }>>(
        '/technician/profile/face-reference',
        payload
      )
      .then(unwrap),

  listActiveJobsToday: (params?: { status?: string }) =>
    api.get<ApiResponse<TechnicianJobSummary[]>>('/technician/jobcards/active-today', { params }).then(unwrap),

  listJobCards: (params?: { status?: string }) =>
    api.get<ApiResponse<TechnicianJobSummary[]>>('/technician/jobcards', { params }).then(unwrap),

  getJobCard: (jobCardId: string) =>
    api.get<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}`).then(unwrap),

  checkIn: (jobCardId: string, payload: { lat: number; lng: number; note?: string }) =>
    api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/check-in`, payload).then(unwrap),

  /** End today’s on-site session (no OTP). Body: optional lat/lng, optional note. */
  dayCheckout: (jobCardId: string, payload?: { lat?: number; lng?: number; note?: string }) => {
    const body: Record<string, string | number> = {};
    if (payload != null) {
      if (typeof payload.lat === 'number' && !Number.isNaN(payload.lat)) body.lat = payload.lat;
      if (typeof payload.lng === 'number' && !Number.isNaN(payload.lng)) body.lng = payload.lng;
      if (typeof payload.note === 'string' && payload.note.trim()) body.note = payload.note.trim();
    }
    return api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/day-checkout`, body).then(unwrap);
  },

  addExtraWork: (
    jobCardId: string,
    payload: Array<{ description?: string; amount?: number; serviceCategory: string; serviceItem: string }>
  ) =>
    api
      .post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/extra-work`, { items: payload })
      .then(unwrap),

  addSpareParts: (
    jobCardId: string,
    payload: Array<{ part: string; quantity: number; unitPrice: number }>
  ) => api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/spare-parts`, { parts: payload }).then(unwrap),

  removeExtraWork: (jobCardId: string, itemIndex: number) =>
    api.delete<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/extra-work/${itemIndex}`).then(unwrap),

  removeSparePart: (jobCardId: string, itemIndex: number) =>
    api.delete<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/spare-parts/${itemIndex}`).then(unwrap),

  updateEstimate: (jobCardId: string, estimateAmount: number) =>
    api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/estimate`, { estimateAmount }).then(unwrap),

  updateTentativeSqFt: (
    jobCardId: string,
    payload: { tentativeSqFt: number | null; serviceLineIndex?: number }
  ) =>
    api
      .patch<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/tentative-sqft`, payload)
      .then(unwrap),

  completeJob: (
    jobCardId: string,
    payload: {
      otp: string;
      resolution?: JobClosureResolution;
      paymentStatus?: JobPaymentStatus;
      followUpNote?: string;
    }
  ) => api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/complete`, payload).then(unwrap),

  checkout: (jobCardId: string, otp: string) =>
    api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/checkout`, { otp }).then(unwrap),

  uploadJobMedia: (
    jobCardId: string,
    media: Array<{ url: string; kind?: string; name?: string }>
  ) => api.post<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/media`, { media }).then(unwrap),

  /** AMC property checklist — attach photos to one survey instance (`itemKey` from job detail). */
  uploadAmcChecklistPhotos: (
    jobCardId: string,
    payload: { itemKey: string; media: Array<{ url: string; kind?: string; name?: string }> }
  ) =>
    api.post<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/amc-checklist/photos`, payload).then(unwrap),

  patchAmcChecklistItem: (
    jobCardId: string,
    payload: { itemKey: string; note?: string; completed?: boolean }
  ) =>
    api
      .patch<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/amc-checklist/item`, payload)
      .then(unwrap),

  deleteAmcChecklistPhoto: (jobCardId: string, payload: { itemKey: string; photoId: string }) =>
    api
      .post<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/amc-checklist/delete-photo`, payload)
      .then(unwrap),

  deleteJobMedia: (jobCardId: string, mediaId: string) =>
    api.delete<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/media/${mediaId}`).then(unwrap),

  sendOrderMessage: (jobCardId: string, message: string) =>
    api
      .post<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}/message`, { message })
      .then(unwrap),

  listNotifications: (params?: { unreadOnly?: boolean; limit?: number }) =>
    api.get<ApiResponse<TechnicianNotification[]>>('/technician/notifications', { params }).then(unwrap),

  markNotificationRead: (notificationId: string) =>
    api.post<ApiResponse<TechnicianNotification>>(`/technician/notifications/${notificationId}/read`).then(unwrap),

  registerPushToken: (payload: {
    token: string;
    platform?: 'ios' | 'android' | 'web' | 'unknown';
    provider?: 'expo' | 'fcm';
  }) =>
    api
      .post<ApiResponse<{ token: string; platform: string; provider: string }>>('/technician/push-token', payload)
      .then(unwrap),

  listSpareParts: () => api.get<ApiResponse<SparePartSummary[]>>('/technician/spare-parts').then(unwrap),

  listServiceCatalog: () => api.get<ApiResponse<ServiceCatalogCategory[]>>('/technician/services/catalog').then(unwrap),

  upsertAttendance: (payload: {
    action: 'check_in' | 'check_out';
    faceImageBase64: string;
    lat?: number;
    lng?: number;
    note?: string;
  }) => api.post<ApiResponse<TechnicianAttendanceRow>>('/technician/attendance', payload).then(unwrap),

  listMyAttendance: (params?: { from?: string; to?: string }) =>
    api
      .get<ApiResponse<TechnicianAttendanceRow[]>>('/technician/attendance', { params })
      .then(unwrap),

  getAttendanceMonthSummary: (year: number, month: number) =>
    api
      .get<ApiResponse<AttendanceMonthSummary>>('/technician/attendance/month-summary', {
        params: { year, month },
      })
      .then(unwrap),

  /** Raw CSV (UTF-8 with BOM). Use for file download / share. */
  fetchAttendancePayslipCsv: async (year: number, month: number): Promise<string> => {
    const res = await api.get<string>('/technician/attendance/payslip', {
      params: { year, month },
      responseType: 'text',
      transformResponse: [(data) => data],
      headers: { Accept: 'text/csv' },
    });
    return typeof res.data === 'string' ? res.data : String(res.data ?? '');
  },

  createLeaveRequest: (payload: {
    startDate: string;
    endDate: string;
    reason?: string;
    leaveType?: 'standard' | 'comp_off';
  }) => api.post<ApiResponse<TechnicianLeaveRow>>('/technician/leave-requests', payload).then(unwrap),

  listMyLeaveRequests: () =>
    api.get<ApiResponse<TechnicianLeaveRow[]>>('/technician/leave-requests').then(unwrap),

  cancelLeaveRequest: (leaveId: string) =>
    api.delete<ApiResponse<{ id: string; status: string }>>(`/technician/leave-requests/${leaveId}`).then(unwrap),

  postLiveLocation: (payload: { lat: number; lng: number; accuracy?: number; heading?: number; speed?: number }) =>
    api.post<ApiResponse<unknown>>('/technician/live-location', payload).then(unwrap)
};
