# Photostudia database (PostgreSQL)

## Что внутри!
- `migrations/001_init.sql` — создание таблиц и связей.
- `seed/001_seed.sql` — заполнение справочников (5 локаций и доп.услуги).

## Как развернуть?
1) Создать базу данных:
```sql
CREATE DATABASE photostudia;
