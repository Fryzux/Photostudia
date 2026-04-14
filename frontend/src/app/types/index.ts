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
  description: string;
  price_per_hour: number;
  capacity: number;
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

export interface Order {
  id: number;
  booking: Booking;
  user_id?: number;
  username?: string;
  user_email?: string;
  total_amount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
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
  valid_from?: string | null;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePromoCodeData {
  code: string;
  description?: string;
  discount_percent: number;
  valid_from?: string;
  valid_to?: string;
}
