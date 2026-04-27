/** Session-storage cache TTL for the bookings list (1 minute). */
export const BOOKING_CACHE_TTL_MS = 60_000;

/** Number of booking cards displayed per page in MyBookingsPage. */
export const BOOKING_PAGE_SIZE = 6;

/** Validates promo codes: uppercase A–Z, digits 0–9, hyphens, 1–32 chars. */
export const PROMO_CODE_REGEX = /^[A-Z0-9-]{1,32}$/;

/** Human-readable labels for all possible order statuses. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый',
  PENDING: 'Ожидает оплаты',
  CONFIRMED: 'Подтверждено',
  COMPLETED: 'Оплачено',
  CANCELLED: 'Отменено',
};
