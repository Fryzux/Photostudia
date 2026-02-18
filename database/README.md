# База данных Photostudia (PostgreSQL)

Эта папка содержит SQL-скрипты для создания структуры базы данных фотостудии и заполнения справочников.  
Ветка репозитория: `PhotoStudio-BD`.

## Структура папки
- `migrations/001_init.sql` — создание таблиц, типов, связей и индексов.
- `seed/001_seed.sql` — заполнение справочников (5 локаций + доп.услуги).

## Что реализовано по ТЗ
- **Клиент**: `client (client_id, full_name, phone, email)`.
- **Бронь/заявка**: `booking (...)` включает `client_id`, `location_id`, `price`, `photographer_id` (опционально), `start_at`, `end_at`, `people_count`, `comment`, `status`.
- **Доп.услуги**: справочник `extra_service` + связь `booking_extra_service` (много услуг на одну бронь).
- Главное правило: **1 бронь = 1 локация (зал)**. Это обеспечено тем, что в `booking` есть ровно одно поле `location_id` (NOT NULL) и нет отдельной таблицы для нескольких залов на одну бронь.

## Как развернуть базу (через SQL Shell / psql)
### 1) Создать базу данных (один раз)
Открой `SQL Shell (psql)` и выполни:
```sql
CREATE DATABASE photostudia;
