# Отчет по архитектуре серверной части проекта "Photostudia"

## 1. Общая архитектура

Сервер реализован на **Django + Django REST Framework (DRF)**. База данных: **PostgreSQL**. Интеллектуальный модуль реализован на базе **scikit-learn** (RandomForestRegressor). Приложение обернуто в **Docker** (используется docker-compose с двумя контейнерами: `db` и `backend`).

## 2. Архитектурные слои и паттерны (MVC + Repository + Service)

Приложение спроектировано в виде строгой концепции MVC (MVT в терминологии Django):
- **Model** – ORM-модели (напр. `User`, `Hall`, `Booking`, `ActionLog`).
- **View / Controller** – `ViewSet` и `APIView` (напр. `BookingViewSet`), которые обрабатывают HTTP(S) запросы и занимаются маршрутизацией через сериализаторы, делегируя при этом бизнес-логику на уровень Service.
- **Serializer** – классы для валидации и трансформации входного/выходного JSON.

Для разгрузки `views.py` и повторного использования кода внедрены паттерны:
- **Repository Pattern**: Созданы классы (`BookingRepository`, `HallRepository`) в слое `repositories.py`. Они отвечают за инкапсуляцию сложных запросов к БД с использованием `Q()` выражений (например, поиск пересекающихся по времени броней `get_overlapping_bookings`).
- **Service Layer Pattern**: Созданы сервисы (`BookingService`, `PaymentService`, `AIService`) в слое `services.py`. Они управляют транзакциями (`@transaction.atomic`) и проверяют бизнес-правила (создание `Booking` с одновременным созданием `Order`).

## 3. Цепочка обработки запроса при бронировании

Вот пошаговый процесс (согласно требованиям), который происходит, когда клиент пытается забронировать зал:

```text
Ввод данных в UI (React) -> Формируется JSON payload
        ↓
POST /api/bookings/ с JWT-токеном (Bearer) в заголовке
        ↓
DRF View (BookingViewSet.create): Проверяет токен (IsAuthenticated)
        ↓
Serializer (BookingSerializer): Валидирует JSON (проверка типов, обязательность полей id зала, даты)
        ↓
Service Layer (BookingService.create_booking): 
    1. Открывается транзакция (@transaction.atomic)
    2. Проверяется базовое правило: start < end.
    3. Вызывается Repository (BookingRepository.get_overlapping_bookings), чтобы убедиться, что зал "свободен".
    4. Если занято -> Выбрасывается кастомная ошибка, транзакция откатывается.
    5. Если свободно -> Создается `Booking`
    6. Создается привязанный `Order` со статусом PENDING на основе цены за час.
    7. Коммит транзакции.
        ↓
Repository (Django ORM): Выполняет INSERT в PostgreSQL (при этом работают CheckConstraints).
        ↓
Signals (audit/signals.py): Асинхронно или в том же потоке срабатывает post_save сигнал и фиксирует запись о "Booking Created" в `ActionLog`.
        ↓
JSON-ответ клиенту (201 Created с данными брони)
```

## 4. Резервное копирование

Бэкапы БД интегрированы в контейнер. Для этого:
- Используется утилита **pg_dump**. Команда выглядит так:
  `pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -F c > /backups/db_backup_$(date +%Y%m%d).dump`
- Этот процесс обернут в bash-скрипт `scripts/backup.sh`.
- Чтобы автоматизировать процесс, скрипт настраивается на выполнение через **cron** внутри контейнера, или с хост-системы.
- Копии хранятся в постоянном volume: `/backups` (описан в `docker-compose.yml`), что гарантирует доступность файлов `.dump` даже в случае удаления контейнера PostgreSQL.
- Для восстановления (RESTORE) из копии используется команда:
  `pg_restore -U $POSTGRES_USER -d $POSTGRES_DB -1 /backups/db_backup_XXXXXXXX.dump`

## 5. Итог

Проект удовлетворяет всем выдвинутым требованиям и стандартам. Реализована обработка ошибок (`core/exceptions.py`), логирование (`audit.models.ActionLog` через Signals), строгая изоляция структуры сервисов (API, Service, Repository, Database), а также покрыто 10-ю интеграционными тестами (`core.tests.PhotostudiaTests`).
