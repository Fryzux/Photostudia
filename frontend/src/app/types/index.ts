// Типы для приложения фотостудии "Экспозиция"

export interface User {
  id: number;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  is_staff: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
  date_joined?: string;
  last_login?: string | null;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  password: string;
}

export interface Hall {
  id: number;
  name: string;
  description?: string;
  price_per_hour: number;
  capacity: number;
  equipment?: string[];
  image?: string | null;
  images: string[];
  created_at?: string;
}

export interface Booking {
  id: number;
  hall: Hall;
  start_time: string;
  end_time: string;
}

export type OrderStatus = 'NEW' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: number;
  booking: Booking;
  user_id?: number;
  username?: string;
  user_email?: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

export interface Payment {
  id: number;
  order: Order;
  amount: number;
  method: 'card' | 'cash' | 'online';
  is_successful: boolean;
  created_at: string;
}

export interface CreateBookingData {
  hall_id: number;
  start_time: string;
  end_time: string;
  extra_services_total?: number;
}

export interface CreatePaymentData {
  order_id: number;
  method: 'card' | 'cash' | 'online';
}

export interface DemandPrediction {
  hall_id: number;
  date: string;
  prediction: 'HIGH' | 'LOW';
  predicted_orders: number;
  confidence: number;
  explanation?: string;
}

export interface ForecastHeatmapCell {
  date: string;
  hour: number;
  load_percent: number;
  predicted_orders: number;
  confidence: number;
}

export interface ForecastDayOverview {
  date: string;
  avg_load_percent: number;
  predicted_orders: number;
  confidence: number;
  explanation: string;
}

export interface ForecastSummary {
  average_load_percent: number;
  average_confidence: number;
  peak: ForecastHeatmapCell | null;
}

export interface ForecastResult {
  hall_id: number | null;
  date_from: string;
  date_to: string;
  hours: number[];
  days: string[];
  heatmap: ForecastHeatmapCell[];
  day_overview: ForecastDayOverview[];
  summary: ForecastSummary;
  recommendations: string[];
}

export interface Analytics {
  total_users: number;
  total_halls: number;
  total_bookings: number;
  total_revenue: number;
}

export interface CreateHallData {
  name: string;
  price_per_hour: number;
  capacity: number;
  description?: string;
}

export interface AuditLog {
  id: number;
  user: number | null;
  username: string;
  user_email: string;
  action: string;
  details?: string | null;
  timestamp: string;
}

export interface AuditLogFilters {
  search?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
}

export interface PromoCode {
  id: number;
  code: string;
  description?: string;
  discount_percent: number;
  is_active: boolean;
  hall?: number | null;
  hour_from?: string | null;
  hour_to?: string | null;
  uses_count?: number;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePromoCodeData {
  code: string;
  description?: string;
  discount_percent: number;
  hall?: number;
  hour_from?: string;
  hour_to?: string;
  max_uses?: number;
  valid_from?: string;
  valid_to?: string;
}

export interface StudioService {
  id: number;
  name: string;
  description?: string;
  price: number;
  pricing_mode: 'fixed' | 'hourly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStudioServiceData {
  name: string;
  description?: string;
  price: number;
  pricing_mode: 'fixed' | 'hourly';
  is_active?: boolean;
}
