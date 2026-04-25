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
  CreateStudioServiceData,
  DailyForecast,
  DemandPrediction,
  ForecastResult,
  Hall,
  LoginCredentials,
  Order,
  Payment,
  PromoCode,
  PromoValidationResult,
  RegisterData,
  StudioService,
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
  description?: string | null;
  is_active?: boolean;
  capacity: number;
  price_per_hour: number | string;
  image?: string | null;
  images?: Array<{ id: number; image?: string | null; created_at?: string }>;
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
  discount_amount?: number | string;
  final_amount?: number | string | null;
  promo_code?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
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
      booked_slots?: Array<{ start_time?: string; end_time?: string }>;
      busy_slots?: Array<{ start?: string; end?: string } | string>;
      occupied_slots?: Array<{ start?: string; end?: string } | string>;
    }
  | Array<{ start?: string; end?: string; available?: boolean }>;

type BackendPromoCode = {
  id: number;
  code: string;
  description?: string | null;
  discount_percent: number | string;
  promo_type?: 'PERCENT' | 'FIXED';
  value?: number | string;
  expiry?: string | null;
  usage_limit?: number | string | null;
  usage_count?: number | string | null;
  is_active: boolean;
  hall?: number | null;
  hour_from?: string | null;
  hour_to?: string | null;
  uses_count?: number | string | null;
  max_uses?: number | string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
};

// Access token хранится только в памяти (не персистируется — XSS не получит его из storage).
// Refresh token — в sessionStorage (очищается при закрытии вкладки/браузера).
let _accessToken: string | null = null;
const REFRESH_KEY = 'rt';

export const tokenStorage = {
  getAccessToken: () => _accessToken,
  getRefreshToken: () => (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REFRESH_KEY) : null),
  setTokens: (tokens: AuthTokens) => {
    _accessToken = tokens.access;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(REFRESH_KEY, tokens.refresh);
    }
    // Очищаем старые localStorage-токены если остались
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    window.dispatchEvent(new Event(AUTH_STATE_EVENT));
  },
  clearTokens: () => {
    _accessToken = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(REFRESH_KEY);
    }
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

async function fetchAllPaginated<T>(url: string, withAuth = false): Promise<T[]> {
  const collected: T[] = [];
  const visited = new Set<string>();
  let nextUrl: string | null = url;
  let pageCount = 0;

  while (nextUrl) {
    if (visited.has(nextUrl)) break;
    if (pageCount > 100) {
      throw new Error('Слишком много страниц в ответе API.');
    }

    visited.add(nextUrl);

    const payload = (await request(nextUrl, {}, withAuth)) as T[] | PaginatedResponse<T>;
    if (Array.isArray(payload)) {
      collected.push(...payload);
      break;
    }

    if (!Array.isArray(payload.results)) {
      throw new Error('Некорректный формат пагинированного списка.');
    }

    collected.push(...payload.results);
    nextUrl = typeof payload.next === 'string' && payload.next ? new URL(payload.next, nextUrl).toString() : null;
    pageCount += 1;
  }

  return collected;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseNumber(value: unknown, fieldName: string) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    throw new Error(`Некорректное поле ${fieldName} в ответе сервера.`);
  }
  return nextValue;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return undefined;
  return nextValue;
}

function normalizeUser(raw: unknown): User {
  if (!isObject(raw)) {
    throw new Error('Некорректный формат пользователя в ответе сервера.');
  }

  return {
    id: parseNumber(raw.id, 'id'),
    email: typeof raw.email === 'string' ? raw.email : '',
    username: typeof raw.username === 'string' ? raw.username : '',
    first_name: typeof raw.first_name === 'string' ? raw.first_name : '',
    last_name: typeof raw.last_name === 'string' ? raw.last_name : '',
    phone: typeof raw.phone === 'string' ? raw.phone : null,
    is_staff: Boolean(raw.is_staff),
    is_superuser: Boolean(raw.is_superuser),
    is_manager: Boolean(raw.is_manager),
    is_active: Boolean(raw.is_active),
    date_joined: typeof raw.date_joined === 'string' ? raw.date_joined : undefined,
    last_login: typeof raw.last_login === 'string' ? raw.last_login : null,
  };
}

function assertAuthTokens(payload: unknown, fallbackRefresh?: string): AuthTokens {
  if (!isObject(payload) || typeof payload.access !== 'string') {
    throw new Error('Некорректный ответ авторизации от сервера.');
  }

  const refreshToken = typeof payload.refresh === 'string' ? payload.refresh : fallbackRefresh;
  if (!refreshToken) {
    throw new Error('В ответе авторизации отсутствует refresh token.');
  }

  return {
    access: payload.access,
    refresh: refreshToken,
  };
}

function normalizeMediaUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return `${BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function normalizeHall(raw: BackendHall): Hall {
  const hallId = parseNumber(raw.id, 'hall.id');
  const presentation = getHallPresentation(raw.name, raw.id);
  const coverImage = normalizeMediaUrl(raw.image);
  const galleryImages = Array.isArray(raw.images)
    ? raw.images
        .map((entry) => normalizeMediaUrl(entry?.image || null))
        .filter((value): value is string => Boolean(value))
    : [];

  const fallbackImage = presentation.image;
  const baseImage = coverImage || galleryImages[0] || fallbackImage;
  const images = galleryImages.length ? galleryImages : baseImage ? [baseImage] : [];

  return {
    id: hallId,
    name: presentation.title,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    capacity: parseNumber(raw.capacity, 'hall.capacity'),
    price_per_hour: parseNumber(raw.price_per_hour, 'hall.price_per_hour'),
    equipment: presentation.equipment,
    image: baseImage || null,
    images,
    description: (raw.description || presentation.description || '').trim(),
  };
}

function normalizeBooking(raw: BackendBooking): Booking {
  if (!isObject(raw.hall)) {
    throw new Error('Некорректный формат бронирования: не найден hall.');
  }

  return {
    id: parseNumber(raw.id, 'booking.id'),
    hall: normalizeHall(raw.hall),
    start_time: typeof raw.start_time === 'string' ? raw.start_time : '',
    end_time: typeof raw.end_time === 'string' ? raw.end_time : '',
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
  if (!raw.booking) {
    throw new Error('Некорректный формат заказа: отсутствует booking.');
  }

  return {
    id: parseNumber(raw.id, 'order.id'),
    booking: normalizeBooking(raw.booking),
    user_id: raw.user_id ? parseNumber(raw.user_id, 'order.user_id') : undefined,
    username: typeof raw.username === 'string' ? raw.username : undefined,
    user_email: typeof raw.user_email === 'string' ? raw.user_email : undefined,
    total_amount: parseNumber(raw.total_amount, 'order.total_amount'),
    discount_amount: parseOptionalNumber(raw.discount_amount) ?? 0,
    final_amount: parseOptionalNumber(raw.final_amount) ?? null,
    promo_code: typeof raw.promo_code === 'string' ? raw.promo_code : null,
    status: raw.status,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
  };
}

function normalizePromoCode(raw: BackendPromoCode): PromoCode {
  const usesCount = parseOptionalNumber(raw.uses_count);
  const maxUses = parseOptionalNumber(raw.max_uses);
  const usageCount = parseOptionalNumber(raw.usage_count);
  const usageLimit = parseOptionalNumber(raw.usage_limit);
  const promoValue = parseOptionalNumber(raw.value);

  return {
    id: parseNumber(raw.id, 'promo.id'),
    code: typeof raw.code === 'string' ? raw.code : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    discount_percent: parseNumber(raw.discount_percent, 'promo.discount_percent'),
    promo_type: raw.promo_type || 'PERCENT',
    value: promoValue ?? parseNumber(raw.discount_percent, 'promo.discount_percent'),
    expiry: raw.expiry || raw.valid_to || null,
    usage_limit: usageLimit ?? maxUses ?? null,
    usage_count: usageCount ?? usesCount ?? 0,
    is_active: raw.is_active,
    hall: parseOptionalNumber(raw.hall) ?? null,
    hour_from: typeof raw.hour_from === 'string' ? raw.hour_from : null,
    hour_to: typeof raw.hour_to === 'string' ? raw.hour_to : null,
    uses_count: usesCount ?? usageCount ?? 0,
    max_uses: maxUses ?? null,
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
    } catch (refreshError) {
      tokenStorage.clearTokens();
      const reason = refreshError instanceof Error ? refreshError.message : 'refresh token invalid';
      throw new Error(`Сессия истекла (${reason}). Войдите снова.`);
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
  const payload = await request(
    `${API_URL}/auth/login/`,
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    },
    false,
  );

  const tokens = assertAuthTokens(payload);

  tokenStorage.setTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const payload = await request(
    `${API_URL}/auth/refresh/`,
    {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    },
    false,
  );
  return assertAuthTokens(payload, refreshToken);
}

/** Обновляет access token используя refresh token из хранилища. */
export async function refreshToken(): Promise<void> {
  const rt = tokenStorage.getRefreshToken();
  if (!rt) throw new Error('No refresh token');
  const tokens = await refreshAccessToken(rt);
  tokenStorage.setTokens(tokens);
}

export async function getProfile(): Promise<User> {
  const payload = await request(`${API_URL}/auth/profile/`, {}, true);
  return normalizeUser(payload);
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

  return unwrapList(payload).map(normalizeUser);
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
        description: data.description || '',
        is_active: data.is_active ?? true,
        capacity: data.capacity,
        price_per_hour: data.price_per_hour,
      }),
    },
    true,
  )) as BackendHall;

  return normalizeHall(payload);
}

export async function updateHall(id: number, data: Partial<CreateHallData>): Promise<Hall> {
  const body: Record<string, unknown> = {};
  if (typeof data.name === 'string') body.name = data.name;
  if (typeof data.description === 'string') body.description = data.description;
  if (typeof data.is_active === 'boolean') body.is_active = data.is_active;
  if (typeof data.capacity === 'number') body.capacity = data.capacity;
  if (typeof data.price_per_hour === 'number') body.price_per_hour = data.price_per_hour;

  const payload = (await request(
    `${API_URL}/halls/${id}/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    true,
  )) as BackendHall;

  return normalizeHall(payload);
}

export async function uploadHallImages(
  hallId: number,
  files: File[],
  onProgress?: (filename: string, progress: number) => void,
): Promise<Hall> {
  if (!files.length) {
    return getHall(hallId);
  }

  const token = tokenStorage.getAccessToken();

  const uploadWithXhr = (
    url: string,
    method: 'POST' | 'PATCH',
    formDataFactory: () => FormData,
    fileName: string,
  ) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Accept', 'application/json');

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) return;
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(fileName, percent);
      };

      xhr.onerror = () => reject(new Error('Ошибка сети при загрузке изображения.'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(fileName, 100);
          resolve();
          return;
        }

        try {
          const payload = JSON.parse(xhr.responseText) as { details?: string; error?: string };
          const message = payload.details || payload.error || `Upload failed (${xhr.status})`;
          reject(new Error(`${message} [status:${xhr.status}]`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status}) [status:${xhr.status}]`));
        }
      };

      xhr.send(formDataFactory());
    });

  for (const file of files) {
    try {
      await uploadWithXhr(
        `${API_URL}/halls/${hallId}/images/`,
        'POST',
        () => {
          const formData = new FormData();
          // Main backend contract (upload action): request.FILES.getlist('images')
          formData.append('images', file);
          // Compatibility with older handlers that read single `image`.
          formData.append('image', file);
          return formData;
        },
        file.name,
      );
    } catch (error: any) {
      const message = String(error?.message || '');
      const statusMatch = message.match(/\[status:(\d+)\]$/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : NaN;
      const isActionUnavailable = statusCode === 404 || statusCode === 405 || statusCode === 501;

      if (!isActionUnavailable) {
        throw new Error(message.replace(/\s*\[status:\d+\]$/, '') || 'Не удалось загрузить изображение.');
      }

      // Fallback for deployments without /halls/:id/images/ action:
      // upload image directly into Hall.image via PATCH.
      await uploadWithXhr(
        `${API_URL}/halls/${hallId}/`,
        'PATCH',
        () => {
          const formData = new FormData();
          formData.append('image', file);
          return formData;
        },
        file.name,
      );
    }
  }

  return getHall(hallId);
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
  const payload = await fetchAllPaginated<BackendOrder>(`${API_URL}/orders/`, true);
  return payload.map(normalizeOrder);
}

export async function updateOrderStatus(orderId: number, statusValue: Order['status']): Promise<Order> {
  const payload = (await request(
    `${API_URL}/orders/${orderId}/status/`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: statusValue }),
    },
    true,
  )) as BackendOrder | { status?: Order['status'] };

  if (isObject(payload) && isObject((payload as BackendOrder).booking)) {
    return normalizeOrder(payload as BackendOrder);
  }

  // Fallback for old backend responses that return only {"status": "..."}
  const orders = await getOrders();
  const existingOrder = orders.find((order) => order.id === orderId);
  if (!existingOrder) {
    throw new Error('Не удалось получить обновлённый заказ после смены статуса.');
  }

  const fallbackStatus =
    isObject(payload) && typeof payload.status === 'string' ? (payload.status as Order['status']) : statusValue;

  return {
    ...existingOrder,
    status: fallbackStatus,
  };
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
      body: JSON.stringify({
        order_id: data.order_id,
        method: data.method,
        promo_code: data.promo_code,
      }),
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
  )) as { predicted_orders: number; confidence?: number; explanation: string };

  const predictedOrders = Number(payload.predicted_orders);
  const fallbackConfidence = Math.min(0.93, 0.58 + Math.max(0, predictedOrders) * 0.03);
  const confidenceValue = Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : fallbackConfidence;

  return {
    hall_id: hallId,
    date,
    prediction: predictedOrders >= 8 ? 'HIGH' : 'LOW',
    predicted_orders: predictedOrders,
    confidence: Math.max(0.5, Math.min(0.96, confidenceValue)),
    explanation: payload.explanation,
  };
}

export async function getForecast(params: {
  hall_id?: number;
  date_from: string;
  date_to: string;
}): Promise<ForecastResult> {
  const payload = (await request(
    `${API_URL}/ai/forecast/`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    true,
  )) as ForecastResult;

  return payload;
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
    buildUrl('/audit/', {
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

export async function getActionLogsPage(
  filters: AuditLogFilters & { page?: number } = {},
): Promise<{ count: number; next: string | null; previous: string | null; results: AuditLog[] }> {
  const payload = (await request(
    buildUrl('/audit/', {
      search: filters.search,
      action: filters.action,
      date_from: filters.date_from,
      date_to: filters.date_to,
      page: filters.page,
    }),
    {},
    true,
  )) as BackendAuditLog[] | PaginatedResponse<BackendAuditLog>;

  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      results: payload.map((log) => ({
        id: log.id,
        user: log.user,
        username: log.username,
        user_email: log.user_email,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp,
      })),
    };
  }

  return {
    count: payload.count,
    next: payload.next,
    previous: payload.previous,
    results: payload.results.map((log) => ({
      id: log.id,
      user: log.user,
      username: log.username,
      user_email: log.user_email,
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
    })),
  };
}

export async function getPromoCodes(filters: { search?: string; is_active?: boolean } = {}): Promise<PromoCode[]> {
  const payload = (await request(
    buildUrl('/promo/', {
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
    `${API_URL}/promo/`,
    {
      method: 'POST',
      body: JSON.stringify({
        code: data.code,
        description: data.description,
        discount_percent: data.discount_percent,
        promo_type: data.promo_type || 'PERCENT',
        value: data.value ?? data.discount_percent,
        usage_limit: data.usage_limit,
        expiry: data.expiry || data.valid_to,
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
    `${API_URL}/promo/${id}/deactivate/`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    },
    true,
  )) as BackendPromoCode;

  return normalizePromoCode(payload);
}

export async function activatePromoCode(id: number): Promise<PromoCode> {
  const payload = (await request(
    `${API_URL}/promo/${id}/activate/`,
    {
      method: 'PATCH',
      body: JSON.stringify({}),
    },
    true,
  )) as BackendPromoCode;

  return normalizePromoCode(payload);
}

export async function validatePromoCode(code: string, orderId: number): Promise<PromoValidationResult> {
  const payload = (await request(
    `${API_URL}/promo/validate/`,
    {
      method: 'POST',
      body: JSON.stringify({ code, order_id: orderId }),
    },
    true,
  )) as {
    promo: BackendPromoCode;
    order_id: number;
    base_total: number | string;
    discount_amount: number | string;
    final_total: number | string;
  };

  return {
    promo: normalizePromoCode(payload.promo),
    order_id: payload.order_id,
    base_total: parseNumber(payload.base_total, 'promo.base_total'),
    discount_amount: parseNumber(payload.discount_amount, 'promo.discount_amount'),
    final_total: parseNumber(payload.final_total, 'promo.final_total'),
  };
}

function normalizeTimeSlot(value: string) {
  if (value.length === 5) return `${value}:00`;
  return value;
}

function isTimeValue(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function toSlot(start: string, end: string, available: boolean): AvailabilitySlot | null {
  const normalizedStart = normalizeTimeSlot(start);
  const normalizedEnd = normalizeTimeSlot(end);
  if (!isTimeValue(normalizedStart) || !isTimeValue(normalizedEnd)) return null;
  if (normalizedStart >= normalizedEnd) return null;

  return {
    start: normalizedStart,
    end: normalizedEnd,
    available,
  };
}

function normalizeAvailability(payload: BackendAvailabilityPayload): AvailabilitySlot[] {
  if (Array.isArray(payload)) {
    const normalized = payload
      .map((slot) => {
        if (!slot.start || !slot.end) return null;
        return toSlot(slot.start, slot.end, slot.available ?? true);
      })
      .filter((slot): slot is AvailabilitySlot => slot !== null);

    if (normalized.length) return normalized;
    throw new Error('Не удалось распознать формат availability-слотов.');
  }

  if (payload.slots?.length) {
    const normalized = payload.slots
      .map((slot) => {
        if (!slot.start || !slot.end) return null;
        return toSlot(slot.start, slot.end, slot.available ?? true);
      })
      .filter((slot): slot is AvailabilitySlot => slot !== null);

    if (normalized.length) return normalized;
    throw new Error('Пустые или некорректные слоты availability.');
  }

  if (payload.booked_slots?.length) {
    const normalized = payload.booked_slots
      .map((slot) => {
        const startTime = typeof slot.start_time === 'string' ? slot.start_time : '';
        const endTime = typeof slot.end_time === 'string' ? slot.end_time : '';
        const start = startTime.split('T')[1]?.slice(0, 8) || '';
        const end = endTime.split('T')[1]?.slice(0, 8) || '';
        return toSlot(start, end, false);
      })
      .filter((slot): slot is AvailabilitySlot => slot !== null);

    if (normalized.length) return normalized;
  }

  const busyEntries = [...(payload.busy_slots ?? []), ...(payload.occupied_slots ?? [])];
  if (busyEntries.length) {
    const normalized = busyEntries
      .map((slot) => {
        if (typeof slot === 'string') return null;
        if (typeof slot.start !== 'string' || typeof slot.end !== 'string') return null;
        return toSlot(slot.start, slot.end, false);
      })
      .filter((slot): slot is AvailabilitySlot => slot !== null);

    if (normalized.length) return normalized;
  }

  throw new Error('Сервер вернул неизвестный формат availability.');
}

export async function getHallAvailability(hallId: number, date: string): Promise<AvailabilitySlot[]> {
  const payload = (await request(buildUrl(`/halls/${hallId}/availability/`, { date }), {}, true)) as BackendAvailabilityPayload;
  return normalizeAvailability(payload);
}

// ── Studio Services ──────────────────────────────────────────────────────────

export async function getStudioServices(): Promise<StudioService[]> {
  const payload = (await request(buildUrl('/services/'), {}, false)) as StudioService[] | PaginatedResponse<StudioService>;
  return unwrapList(payload) as StudioService[];
}

export async function createStudioService(data: CreateStudioServiceData): Promise<StudioService> {
  return request(buildUrl('/services/'), { method: 'POST', body: JSON.stringify(data) }, true) as Promise<StudioService>;
}

export async function updateStudioService(id: number, data: Partial<CreateStudioServiceData>): Promise<StudioService> {
  return request(buildUrl(`/services/${id}/`), { method: 'PATCH', body: JSON.stringify(data) }, true) as Promise<StudioService>;
}

export async function deleteStudioService(id: number): Promise<void> {
  await request(buildUrl(`/services/${id}/`), { method: 'DELETE' }, true);
}

export async function getWeeklyForecast(hallId: number): Promise<DailyForecast[]> {
  const url = `${API_URL}/ai/weekly/?hall_id=${hallId}`;
  return request(url, {}, true) as Promise<DailyForecast[]>;
}
