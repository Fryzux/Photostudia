# Frontend Architecture

## Product idea

Frontend строится не как абстрактный шаблон фотосайта, а как интерфейс бронирования студии "Экспозиция":

- визуально: холодный свет, чистые бело-синие поверхности, ощущение выставленной экспозиции;
- функционально: каталог залов, бронирование, checkout, личный кабинет и admin flow;
- интеграционно: весь data-flow идёт через готовый Django REST API и JWT auth.

## Stack

- React 18 + Vite
- TypeScript
- Tailwind CSS v4
- shadcn/ui style primitives
- React Router
- Fetch API + собственный слой `api.ts`

## Main layers

- `src/app/pages`
  Route-level страницы: landing, halls, hall detail, checkout, profile, admin.
- `src/app/components`
  Повторно используемые визуальные блоки и app shell.
- `src/app/components/auth`
  Изолированный JWT auth UI: вход, регистрация, клиентская валидация.
- `src/app/services`
  Работа с backend: login, refresh, logout, profile, halls, bookings, payments, analytics.
- `src/app/context`
  Сессионное состояние пользователя и role-based flags.
- `src/app/types`
  DTO и frontend-доменные сущности.
- `src/app/data`
  Только презентационный контент бренда "Экспозиция".
- `src/styles`
  Дизайн-система: токены, фоновые паттерны, типографика, utility-эффекты.

## Routing

- `/`
  Лендинг с hero, преимуществами, популярными залами, workflow и контактным блоком.
- `/login`
  JWT auth entry: login/register через backend.
- `/halls`
  Каталог залов с фильтрами и дальнейшей интеграцией в API.
- `/halls/:id`
  Страница зала с availability и booking flow.
- `/checkout`
  Оплата pending order через `/api/payments/`.
- `/profile`
  Данные пользователя, история, статусы заказов.
- `/my-bookings`
  Отдельная рабочая зона по бронированиям.
- `/admin-panel`
  Управление залами и AI-аналитика.
- `/admin/audit`
  Журнал действий администратора.

## Auth flow

1. Пользователь отправляет форму на `/api/auth/login/` или `/api/auth/register/`.
2. `api.ts` сохраняет `access` и `refresh` в localStorage.
3. `AuthContext` восстанавливает профиль через `/api/auth/profile/` с fallback на `/api/auth/user/`.
4. Все защищённые запросы получают `Authorization: Bearer <access>`.
5. При `401` клиент автоматически делает refresh через `/api/auth/refresh/` и повторяет запрос.
6. При выходе frontend вызывает `/api/auth/logout/` и очищает локальные токены.

## Page composition

### Landing

- hero с сильным брендингом студии;
- блок "Почему мы" с объяснением backend-driven возможностей;
- слайдер популярных залов;
- этапы бронирования;
- контакты и CTA.

### Auth

- отдельный компонент `AuthPanel`;
- вкладки входа и регистрации;
- клиентская валидация до запроса;
- toast-ошибки сервера;
- переход пользователя в целевой сценарий после успешной авторизации.

## UX principles

- минимум декоративного шума, максимум читаемого пространства;
- мобильная-first вёрстка без перегруженных hero-паттернов;
- каждый интерактивный экран должен иметь loading/error/empty states;
- фирменный стиль опирается на тему света, глубины и кадра, чтобы название "Экспозиция" чувствовалось не только в тексте, но и в визуальном ритме.
