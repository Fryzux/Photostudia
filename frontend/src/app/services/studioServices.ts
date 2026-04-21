import type { CreateStudioServiceData, StudioService } from '../types';

const STORAGE_KEY = 'photostudia-studio-services-v1';

const defaultServices: StudioService[] = [
  {
    id: 1,
    name: 'Визажист',
    description: 'Базовый макияж и подготовка к съёмке.',
    price: 2500,
    pricing_mode: 'fixed',
    is_active: true,
    created_at: new Date('2026-01-01T09:00:00+03:00').toISOString(),
    updated_at: new Date('2026-01-01T09:00:00+03:00').toISOString(),
  },
  {
    id: 2,
    name: 'Ассистент на площадке',
    description: 'Помощь со светом и реквизитом в течение съёмки.',
    price: 800,
    pricing_mode: 'hourly',
    is_active: true,
    created_at: new Date('2026-01-01T09:00:00+03:00').toISOString(),
    updated_at: new Date('2026-01-01T09:00:00+03:00').toISOString(),
  },
  {
    id: 3,
    name: 'Аренда фона',
    description: 'Выбор бумажного фона из каталога студии.',
    price: 1200,
    pricing_mode: 'fixed',
    is_active: true,
    created_at: new Date('2026-01-01T09:00:00+03:00').toISOString(),
    updated_at: new Date('2026-01-01T09:00:00+03:00').toISOString(),
  },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toService(value: unknown): StudioService | null {
  if (!isObject(value)) return null;

  const id = Number(value.id);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const price = Number(value.price);
  const pricing_mode = value.pricing_mode === 'hourly' ? 'hourly' : 'fixed';
  const is_active = Boolean(value.is_active);
  const created_at = typeof value.created_at === 'string' ? value.created_at : new Date().toISOString();
  const updated_at = typeof value.updated_at === 'string' ? value.updated_at : created_at;

  if (!Number.isFinite(id) || id < 1) return null;
  if (!name || !Number.isFinite(price) || price < 0) return null;

  return {
    id,
    name,
    description,
    price,
    pricing_mode,
    is_active,
    created_at,
    updated_at,
  };
}

function hasWindow() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function writeServices(next: StudioService[]) {
  if (!hasWindow()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function readServices() {
  if (!hasWindow()) return defaultServices;

  const payload = localStorage.getItem(STORAGE_KEY);
  if (!payload) {
    writeServices(defaultServices);
    return defaultServices;
  }

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) throw new Error('invalid services payload');

    const normalized = parsed.map(toService).filter((item): item is StudioService => item !== null);
    if (!normalized.length) {
      writeServices(defaultServices);
      return defaultServices;
    }
    return normalized.sort((left, right) => left.id - right.id);
  } catch {
    writeServices(defaultServices);
    return defaultServices;
  }
}

export function getStudioServices() {
  return readServices();
}

export function createStudioService(data: CreateStudioServiceData) {
  const current = readServices();
  const now = new Date().toISOString();
  const nextId = current.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;

  const nextService: StudioService = {
    id: nextId,
    name: data.name.trim(),
    description: data.description?.trim() || '',
    price: Number(data.price),
    pricing_mode: data.pricing_mode,
    is_active: data.is_active ?? true,
    created_at: now,
    updated_at: now,
  };

  const next = [...current, nextService];
  writeServices(next);
  return nextService;
}

export function updateStudioService(id: number, data: Partial<CreateStudioServiceData>) {
  const current = readServices();
  let updatedService: StudioService | null = null;

  const next = current.map((item) => {
    if (item.id !== id) return item;

    updatedService = {
      ...item,
      name: typeof data.name === 'string' ? data.name.trim() : item.name,
      description: typeof data.description === 'string' ? data.description.trim() : item.description,
      price: typeof data.price === 'number' ? data.price : item.price,
      pricing_mode: data.pricing_mode || item.pricing_mode,
      is_active: typeof data.is_active === 'boolean' ? data.is_active : item.is_active,
      updated_at: new Date().toISOString(),
    };

    return updatedService;
  });

  writeServices(next);
  return updatedService;
}

export function deleteStudioService(id: number) {
  const current = readServices();
  const next = current.filter((item) => item.id !== id);
  writeServices(next);
}
