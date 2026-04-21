import {
  Analytics,
  AuditLog,
  AuditLogFilters,
  AvailabilitySlot,
  AuthTokens,
  Booking,
  CreateBookingData,
  CreateHallData,
  CreatePaymentData,
  CreatePromoCodeData,
  DemandPrediction,
  Hall,
  LoginCredentials,
  Order,
  Payment,
  PromoCode,
  RegisterData,
  User,
} from '../types';
import { getHallPresentation } from '../data/studio';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;
export const AUTH_STATE_EVENT = 'photostudia-auth-changed';

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type BackendHall = {
  id: number;
  name: string;
  capacity: number;
  price_per_hour: number | string;
  image?: string | null;
};

type BackendBooking = {
  id: number;
  hall: BackendHall;
  start_time: string;
  end_time: string;
};

type BackendOrder = {
  id: number;
  booking: BackendBooking;
  user_id?: number;
  username?: string;
  user_email?: string;
  total_amount: number | string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
};

type BackendPayment = {
  id: number;
  order: BackendOrder;
  amount: number | string;
  method: 'card' | 'cash' | 'online';
  is_successful: boolean;
  created_at: string;
};

type BackendAnalytics = {
  total_users?: number;
  total_halls?: number;
  total_bookings?: number;
  total_orders?: number;
  total_revenue: number | string;
};

type BackendAuditLog = {
  id: number;
  user: number | null;
  username: string;
  user_email: string;
  action: string;
  details?: string | null;
  timestamp: string;
};

type BackendAvailabilityPayload =
  | {
      slots?: Array<{ start?: string; end?: string; available?: boolean }>;
      busy_slots?: Array<{ start?: string; end?: string } | string>;
      occupied_slots?: Array<{ start?: string; end?: string } | string>;
    }
  | Array<{ start?: string; end?: string; available?: boolean }>;

type BackendPromoCode = {
  id: number;
  code: string;
  description?: string | null;
  discount_percent: number | string;
  is_active: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
};

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('access_token'),
  getRefreshToken: () => localStorage.getItem('refresh_token'),
  setTokens: (tokens: AuthTokens) => {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    window.dispatchEvent(new Event(AUTH_STATE_EVENT));
  },
  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.dispatchEvent(new Event(AUTH_STATE_EVENT));
  },
};

function getAuthHeaders(options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers && !Array.isArray(options.headers) && !(options.headers instanceof Headers)) {
    Object.assign(headers, options.headers);
  }

  const token = tokenStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function unwrapList<T>(payload: T[] | PaginatedResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

function normalizeMediaUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return `${BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function normalizeHall(raw: BackendHall): Hall {
  const presentation = getHallPresentation(raw.name, raw.id);
  const image = presentation.image || normalizeMediaUrl(raw.image);

  return {
    id: raw.id,
    name: presentation.title,
    capacity: raw.capacity,
    price_per_hour: Number(raw.price_per_hour),
    image,
    images: image ? [image] : [],
    description: presentation.description,
  };
}

function normalizeBooking(raw: BackendBooking): Booking {
  return {
    id: raw.id,
    hall: normalizeHall(raw.hall),
    start_time: raw.start_time,
    end_time: raw.end_time,
  };
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${API_URL}${path}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function normalizeOrder(raw: BackendOrder): Order {
  return {
    id: raw.id,
    booking: normalizeBooking(raw.booking),
    user_id: raw.user_id,
    username: raw.username,
    user_email: raw.user_email,
    total_amount: Number(raw.total_amount),
    status: raw.status,
    created_at: raw.created_at,
  };
}

function normalizePromoCode(raw: BackendPromoCode): PromoCode {
  return {
    id: raw.id,
    code: raw.code,
    description: raw.description || '',
    discount_percent: Number(raw.discount_percent),
    is_active: raw.is_active,
    valid_from: raw.valid_from || null,
    valid_to: raw.valid_to || null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function detailsToMessage(details: unknown): string {
  if (!details) return 'Произошла ошибка запроса';
  if (typeof details === 'string') return details;
  if (Array.isArray(details)) return details.map(detailsToMessage).join(' ');
  if (typeof details === 'object') {
    return Object.values(details as Record<string, unknown>)
      .map(detailsToMessage)
      .join(' ');
  }
  return 'Произошла ошибка запроса';
}

async function getErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    if (payload?.error && payload?.details) {
      return `${payload.error}: ${detailsToMessage(payload.details)}`;
    }
    if (payload?.detail) {
      return payload.detail;
    }
    return detailsToMessage(payload);
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function request(url: string, options: RequestInit = {}, withAuth = false) {
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: withAuth
        ? getAuthHeaders(options)
        : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) },
    });
  } catch {
    throw new Error('Backend недоступен. Запустите Django API на http://127.0.0.1:8000.');
  }

  if (response.status === 401 && withAuth && tokenStorage.getRefreshToken()) {
    try {
      const nextTokens = await refreshAccessToken(tokenStorage.getRefreshToken()!);
      tokenStorage.setTokens(nextTokens);

      const retry = await fetch(url, {
        ...options,
        headers: getAuthHeaders(options),
      });

      if (!retry.ok) {
        throw new Error(await getErrorMessage(retry));
      }

      if (retry.status === 204) return null;
      return retry.json();
    } catch {
      tokenStorage.clearTokens();
      throw new Error('Сессия истекла. Войдите снова.');
    }
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function register(data: RegisterData): Promise<AuthTokens> {
  await request(
    `${API_URL}/auth/register/`,
    {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        password: data.password,
      }),
    },
    false,
  );

  return login({ username: data.username, password: data.password });
}

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const tokens = (await request(
    `${API_URL}/auth/login/`,
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
    false,
  )) as AuthTokens;

  tokenStorage.setTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  return (await request(
    `${API_URL}/auth/refresh/`,
    {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    },
    false,
  )) as AuthTokens;
}

export async function getProfile(): Promise<User> {
  try {
    return (await request(`${API_URL}/auth/profile/`, {}, true)) as User;
  } catch {
    return (await request(`${API_URL}/auth/user/`, {}, true)) as User;
  }
}

export async function getUsers(filters: { search?: string; role?: string } = {}): Promise<User[]> {
  const payload = (await request(
    buildUrl('/auth/users/', {
      search: filters.search,
      role: filters.role,
    }),
    {},
    true,
  )) as User[] | PaginatedResponse<User>;

  return unwrapList(payload);
}

export interface CreateUserData {
  username: string;
  password: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_staff?: boolean;
  is_manager?: boolean;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  is_staff?: boolean;
  is_manager?: boolean;
  is_active?: boolean;
}

export async function createUser(data: CreateUserData): Promise<User> {
  return request(`${API_URL}/auth/users/`, { method: 'POST', body: JSON.stringify(data) }, true) as Promise<User>;
}

export async function updateUser(id: number, data: UpdateUserData): Promise<User> {
  return request(`${API_URL}/auth/users/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }, true) as Promise<User>;
}

export async function deleteUser(id: number): Promise<void> {
  await request(`${API_URL}/auth/users/${id}/`, { method: 'DELETE' }, true);
}

export async function logout(): Promise<void> {
  const refresh = tokenStorage.getRefreshToken();

  try {
    if (refresh) {
      await request(
        `${API_URL}/auth/logout/`,
        {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        },
        true,
      );
    }
  } finally {
    tokenStorage.clearTokens();
  }
}

export async function getHalls(): Promise<Hall[]> {
  const payload = (await request(`${API_URL}/halls/`)) as BackendHall[] | PaginatedResponse<BackendHall>;
  return unwrapList(payload).map(normalizeHall);
}

export async function getHall(id: number): Promise<Hall> {
  const payload = (await request(`${API_URL}/halls/${id}/`)) as BackendHall;
  return normalizeHall(payload);
}

export async function createHall(data: CreateHallData): Promise<Hall> {
  const payload = (await request(
    `${API_URL}/halls/`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        capacity: data.capacity,
        price_per_hour: data.price_per_hour,
      }),
    },
    true,
  )) as BackendHall;

  return normalizeHall(payload);
}

export async function updateHall(id: number, data: Partial<CreateHallData>): Promise<Hall> {
  const payload = (await request(
    `${API_URL}/halls/${id}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name,
        capacity: data.capacity,
        price_per_hour: data.price_per_hour,
      }),
    },
    true,
  )) as BackendHall;

  return normalizeHall(payload);
}

export async function deleteHall(id: number): Promise<void> {
  await request(
    `${API_URL}/halls/${id}/`,
    {
      method: 'DELETE',
    },
    true,
  );
}

export async function getBookings(): Promise<Booking[]> {
  const payload = (await request(`${API_URL}/bookings/`, {}, true)) as BackendBooking[] | PaginatedResponse<BackendBooking>;
  return unwrapList(payload).map(normalizeBooking);
}

export async function getOrders(): Promise<Order[]> {
  const payload = (await request(`${API_URL}/orders/`, {}, true)) as BackendOrder[] | PaginatedResponse<BackendOrder>;
  return unwrapList(payload).map(normalizeOrder);
}

export async function updateOrderStatus(orderId: number, statusValue: Order['status']): Promise<Order> {
  const payload = (await request(
    `${API_URL}/orders/${orderId}/status/`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: statusValue }),
    },
    true,
  )) as BackendOrder;

  return normalizeOrder(payload);
}

export async function createBooking(data: CreateBookingData): Promise<Booking> {
  const payload = (await request(
    `${API_URL}/bookings/`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    true,
  )) as BackendBooking;

  return normalizeBooking(payload);
}

export async function cancelBooking(id: number): Promise<void> {
  await request(
    `${API_URL}/bookings/${id}/`,
    {
      method: 'DELETE',
    },
    true,
  );
}

export async function createPayment(data: CreatePaymentData): Promise<Payment> {
  const payload = (await request(
    `${API_URL}/payments/`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    true,
  )) as BackendPayment;

  return {
    id: payload.id,
    order: normalizeOrder(payload.order),
    amount: Number(payload.amount),
    method: payload.method,
    is_successful: payload.is_successful,
    created_at: payload.created_at,
  };
}

export async function predictDemand(hallId: number, date: string): Promise<DemandPrediction> {
  const payload = (await request(
    `${API_URL}/ai/predict/`,
    {
      method: 'POST',
      body: JSON.stringify({ date }),
    },
    true,
  )) as { predicted_orders: number; explanation: string };

  return {
    hall_id: hallId,
    date,
    prediction: payload.predicted_orders >= 8 ? 'HIGH' : 'LOW',
    predicted_orders: payload.predicted_orders,
    confidence: 0.8,
    explanation: payload.explanation,
  };
}

export async function getAnalytics(): Promise<Analytics> {
  const payload = (await request(`${API_URL}/analytics/summary/`, {}, true)) as BackendAnalytics;

  return {
    total_users: payload.total_users ?? 0,
    total_halls: payload.total_halls ?? 0,
    total_bookings: payload.total_bookings ?? payload.total_orders ?? 0,
    total_revenue: Number(payload.total_revenue),
  };
}

export async function getActionLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const payload = (await request(
    buildUrl('/audit/logs/', {
      search: filters.search,
      action: filters.action,
      date_from: filters.date_from,
      date_to: filters.date_to,
    }),
    {},
    true,
  )) as BackendAuditLog[] | PaginatedResponse<BackendAuditLog>;

  return unwrapList(payload).map((log) => ({
    id: log.id,
    user: log.user,
    username: log.username,
    user_email: log.user_email,
    action: log.action,
    details: log.details,
    timestamp: log.timestamp,
  }));
}

export async function getPromoCodes(filters: { search?: string; is_active?: boolean } = {}): Promise<PromoCode[]> {
  const payload = (await request(
    buildUrl('/promos/promocodes/', {
      search: filters.search,
      is_active: typeof filters.is_active === 'boolean' ? String(filters.is_active) : undefined,
    }),
    {},
    true,
  )) as BackendPromoCode[] | PaginatedResponse<BackendPromoCode>;

  return unwrapList(payload).map(normalizePromoCode);
}

export async function createPromoCode(data: CreatePromoCodeData): Promise<PromoCode> {
  const payload = (await request(
    `${API_URL}/promos/promocodes/`,
    {
      method: 'POST',
      body: JSON.stringify({
        code: data.code,
        description: data.description,
        discount_percent: data.discount_percent,
        valid_from: data.valid_from,
        valid_to: data.valid_to,
      }),
    },
    true,
  )) as BackendPromoCode;

  return normalizePromoCode(payload);
}

export async function deactivatePromoCode(id: number): Promise<PromoCode> {
  const payload = (await request(
    `${API_URL}/promos/promocodes/${id}/deactivate/`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    },
    true,
  )) as BackendPromoCode;

  return normalizePromoCode(payload);
}

function normalizeTimeSlot(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function normalizeAvailability(payload: BackendAvailabilityPayload): AvailabilitySlot[] {
  if (Array.isArray(payload)) {
    return payload.map((slot, index) => ({
      start: slot.start || `${String(index + 9).padStart(2, '0')}:00:00`,
      end: slot.end || `${String(index + 10).padStart(2, '0')}:00:00`,
      available: slot.available ?? true,
    }));
  }

  if (payload.slots?.length) {
    return payload.slots.map((slot, index) => ({
      start: slot.start || `${String(index + 9).padStart(2, '0')}:00:00`,
      end: slot.end || `${String(index + 10).padStart(2, '0')}:00:00`,
      available: slot.available ?? true,
    }));
  }

  const blockedEntries = [...(payload.busy_slots ?? []), ...(payload.occupied_slots ?? [])].map((slot) => {
    if (typeof slot === 'string') {
      return {
        start: normalizeTimeSlot(slot),
        end: normalizeTimeSlot(slot),
      };
    }

    return {
      start: normalizeTimeSlot(slot.start || ''),
      end: normalizeTimeSlot(slot.end || slot.start || ''),
    };
  });

  return Array.from({ length: 12 }, (_, index) => {
    const startHour = String(index + 9).padStart(2, '0');
    const endHour = String(index + 10).padStart(2, '0');
    const start = `${startHour}:00:00`;
    const end = `${endHour}:00:00`;
    const available = !blockedEntries.some((blocked) => blocked.start === start || blocked.start.startsWith(`${startHour}:`));

    return {
      start,
      end,
      available,
    };
  });
}

export async function getHallAvailability(hallId: number, date: string): Promise<AvailabilitySlot[]> {
  const payload = (await request(buildUrl(`/halls/${hallId}/availability/`, { date }), {}, true)) as BackendAvailabilityPayload;
  return normalizeAvailability(payload);
}
