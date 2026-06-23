import type { TechnicianJobDetail, TechnicianJobSummary } from '@/types/api';

type OrderLike = TechnicianJobSummary['order'] | TechnicianJobDetail['order'] | null | undefined;

/** Street / building line for maps and list previews */
export function getTechnicianAddressLine1(order: OrderLike): string {
  if (!order) return '';
  const sa = order.serviceAddress;
  if (sa?.line1) return sa.line1.trim();
  return (order.customer?.addressLine1 || '').trim();
}

/**
 * Area (line2), city, state, PIN — for subtitle under the main line.
 */
export function getTechnicianAddressAreaCity(order: OrderLike): string {
  if (!order) return '';
  const sa = order.serviceAddress;
  const line2 = (sa?.line2 ?? order.customer?.addressLine2 ?? '').trim();
  const city = (sa?.city ?? order.customer?.city ?? '').trim();
  const state = (sa?.state ?? order.customer?.state ?? '').trim();
  const postal = (sa?.postalCode ?? order.customer?.postalCode ?? '').trim();
  const cityState = [city, state].filter(Boolean).join(', ');
  const parts = [line2, cityState, postal].filter(Boolean);
  return parts.join(' · ');
}

export function hasTechnicianServiceLocation(order: OrderLike): boolean {
  return Boolean(getTechnicianAddressLine1(order) || getTechnicianAddressAreaCity(order));
}
