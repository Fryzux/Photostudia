import type { CreateBookingData, CreateHallData, RegisterData } from '../types';

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(data: { username: string; password: string }) {
  const errors: FieldErrors<'username' | 'password'> = {};

  if (!data.username.trim()) {
    errors.username = 'Укажите логин.';
  } else if (data.username.trim().length < 3) {
    errors.username = 'Логин должен содержать минимум 3 символа.';
  }

  if (!data.password) {
    errors.password = 'Укажите пароль.';
  } else if (data.password.length < 8) {
    errors.password = 'Пароль должен содержать минимум 8 символов.';
  }

  return errors;
}

export function validateRegisterForm(data: RegisterData) {
  const errors: FieldErrors<'first_name' | 'email' | 'username' | 'password' | 'phone'> = {};

  if (!data.first_name.trim()) {
    errors.first_name = 'Укажите имя.';
  }

  if (!data.email.trim()) {
    errors.email = 'Укажите email.';
  } else if (!emailPattern.test(data.email.trim())) {
    errors.email = 'Введите корректный email.';
  }

  if (!data.username.trim()) {
    errors.username = 'Укажите логин.';
  } else if (data.username.trim().length < 3) {
    errors.username = 'Логин должен содержать минимум 3 символа.';
  }

  if (!data.password) {
    errors.password = 'Укажите пароль.';
  } else if (data.password.length < 8) {
    errors.password = 'Пароль должен содержать минимум 8 символов.';
  } else if (!/[A-Za-zА-Яа-я]/.test(data.password) || !/\d/.test(data.password)) {
    errors.password = 'Пароль должен содержать буквы и цифры.';
  }

  if (data.phone && !/^[+\d()\s-]{10,20}$/.test(data.phone.trim())) {
    errors.phone = 'Введите телефон в международном или локальном формате.';
  }

  return errors;
}

export function validateBookingForm(data: CreateBookingData) {
  const errors: FieldErrors<'start_time' | 'end_time'> = {};

  if (!data.start_time) {
    errors.start_time = 'Выберите дату и время начала.';
  }

  if (!data.end_time) {
    errors.end_time = 'Выберите дату и время окончания.';
  }

  if (data.start_time && data.end_time) {
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);
    const now = new Date();

    if (Number.isNaN(start.getTime())) {
      errors.start_time = 'Некорректная дата начала.';
    }

    if (Number.isNaN(end.getTime())) {
      errors.end_time = 'Некорректная дата окончания.';
    }

    if (!errors.start_time && start < now) {
      errors.start_time = 'Нельзя бронировать слот в прошлом.';
    }

    if (!errors.start_time && !errors.end_time && start >= end) {
      errors.end_time = 'Время окончания должно быть позже времени начала.';
    }
  }

  return errors;
}

export function validateHallForm(data: CreateHallData) {
  const errors: FieldErrors<'name' | 'price_per_hour' | 'capacity'> = {};

  if (!data.name.trim()) {
    errors.name = 'Укажите название зала.';
  } else if (data.name.trim().length < 3) {
    errors.name = 'Название должно содержать минимум 3 символа.';
  }

  if (!Number.isFinite(data.price_per_hour) || data.price_per_hour <= 0) {
    errors.price_per_hour = 'Цена должна быть больше 0.';
  }

  if (!Number.isFinite(data.capacity) || data.capacity < 1) {
    errors.capacity = 'Вместимость должна быть не меньше 1.';
  }

  return errors;
}

export function hasValidationErrors<T extends string>(errors: FieldErrors<T>) {
  return Object.values(errors).some(Boolean);
}
