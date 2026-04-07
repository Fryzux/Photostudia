# Подключение к бэкенду

Это фронтенд приложение для фотостудии "Экспозиция". В данный момент оно работает с моковыми данными для демонстрации функционала.

## Как подключить реальный бэкенд

### 1. Настройка API URL

Откройте файл `/src/app/services/api.ts` и измените константу `BASE_URL` на адрес вашего бэкенда:

```typescript
const BASE_URL = 'http://your-backend-url.com'; // Замените на ваш URL
```

### 2. Активация реальных API запросов

В файле `/src/app/services/api.ts` для каждой функции API:

1. **Раскомментируйте** код с реальными fetch-запросами
2. **Удалите** или **закомментируйте** моковые данные

Пример для функции `login`:

**Было (мок):**
```typescript
export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  // Мок
  await new Promise(resolve => setTimeout(resolve, 500));
  const tokens = { access: 'mock_access_token', refresh: 'mock_refresh_token' };
  tokenStorage.setTokens(tokens);
  return tokens;
}
```

**Станет (реальный API):**
```typescript
export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const response = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) throw new Error('Неверный логин или пароль');
  const tokens = await response.json();
  tokenStorage.setTokens(tokens);
  return tokens;
}
```

### 3. CORS настройки

Убедитесь, что ваш бэкенд настроен для работы с CORS и разрешает запросы с вашего фронтенд домена.

В Django добавьте в `settings.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",
    # Добавьте ваш продакшн домен
]

CORS_ALLOW_CREDENTIALS = True
```

### 4. Структура API эндпоинтов

Приложение ожидает следующие эндпоинты:

#### Авторизация
- `POST /api/auth/register/` - регистрация
- `POST /api/auth/login/` - вход
- `POST /api/auth/refresh/` - обновление токена
- `GET /api/auth/profile/` - профиль пользователя

#### Залы
- `GET /api/studio/halls/` - список залов
- `GET /api/studio/halls/{id}/` - детали зала
- `POST /api/studio/halls/` - создание зала (админ)
- `PUT /api/studio/halls/{id}/` - обновление зала (админ)
- `DELETE /api/studio/halls/{id}/` - удаление зала (админ)

#### Бронирования
- `GET /api/studio/bookings/` - список бронирований
- `POST /api/studio/bookings/` - создание бронирования
- `DELETE /api/studio/bookings/{id}/` - отмена бронирования

#### Оплата
- `POST /api/studio/payments/create_payment/` - оплата заказа

#### Аналитика (Админ)
- `GET /api/studio/analytics/summary/` - общая аналитика
- `GET /api/ai/predict_demand/` - прогноз спроса (ИИ)

### 5. Демо-доступ

Для быстрого тестирования в приложении предусмотрен демо-доступ:

- **Пользователь**: любой логин/пароль (в режиме мока)
- **Админ**: логин `admin`, любой пароль (в режиме мока)

После подключения реального бэкенда эти учётные данные нужно будет создать в базе данных.

## Особенности реализации

- JWT токены хранятся в `localStorage`
- Автоматическое обновление токена при истечении
- Защищённые маршруты (требуют авторизации)
- Проверка роли администратора для доступа к админ-панели

## Запуск приложения

```bash
npm install
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`
