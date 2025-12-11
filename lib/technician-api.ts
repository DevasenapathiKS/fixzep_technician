import type { AxiosResponse } from 'axios';
import { api } from './api-client';
import type {
  ApiResponse,
  JobClosureResolution,
  JobPaymentStatus,
  LoginResult,
  ServiceCatalogCategory,
  SparePartSummary,
  TechnicianJobDetail,
  TechnicianJobSummary,
  TechnicianNotification
} from '@/types/api';

const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>) => response.data.data;

export const technicianApi = {
  login: (email: string, password: string) =>
    api
      .post<ApiResponse<LoginResult>>('/auth/login', { email, password, role: 'technician' })
      .then(unwrap),

  listJobCards: (params?: { status?: string }) =>
    api.get<ApiResponse<TechnicianJobSummary[]>>('/technician/jobcards', { params }).then(unwrap),

  getJobCard: (jobCardId: string) =>
    api.get<ApiResponse<TechnicianJobDetail>>(`/technician/jobcards/${jobCardId}`).then(unwrap),

  checkIn: (jobCardId: string, payload: { lat: number; lng: number; note?: string }) =>
    api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/check-in`, payload).then(unwrap),

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

  completeJob: (
    jobCardId: string,
    payload?: { resolution?: JobClosureResolution; paymentStatus?: JobPaymentStatus; followUpNote?: string }
  ) => api.post<ApiResponse<unknown>>(`/technician/jobcards/${jobCardId}/complete`, payload || {}).then(unwrap),

  listNotifications: (params?: { unreadOnly?: boolean; limit?: number }) =>
    api.get<ApiResponse<TechnicianNotification[]>>('/technician/notifications', { params }).then(unwrap),

  markNotificationRead: (notificationId: string) =>
    api.post<ApiResponse<TechnicianNotification>>(`/technician/notifications/${notificationId}/read`).then(unwrap),

  listSpareParts: () => api.get<ApiResponse<SparePartSummary[]>>('/technician/spare-parts').then(unwrap),

  listServiceCatalog: () => api.get<ApiResponse<ServiceCatalogCategory[]>>('/technician/services/catalog').then(unwrap)
};
