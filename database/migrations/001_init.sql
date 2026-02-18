-- PostgreSQL

BEGIN;

-- 1) Клиенты
CREATE TABLE IF NOT EXISTS client (
  client_id     BIGSERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  CONSTRAINT uq_client_email UNIQUE (email)
);

-- 2) Фотографы (опционально, но логично для photographer_id)
CREATE TABLE IF NOT EXISTS photographer (
  photographer_id BIGSERIAL PRIMARY KEY,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT
);

-- 3) Локации (залы)
CREATE TABLE IF NOT EXISTS location (
  location_id BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE
);

-- 4) Статусы брони (ENUM)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('new', 'confirmed', 'paid', 'canceled', 'completed');
  END IF;
END$$;
-- В PostgreSQL enum‑тип объявляется через CREATE TYPE ... AS ENUM(...). [web:93][web:99]

-- 5) Бронь/заявка
CREATE TABLE IF NOT EXISTS booking (
  booking_id        BIGSERIAL PRIMARY KEY,

  client_id         BIGINT NOT NULL
                   REFERENCES client(client_id) ON DELETE RESTRICT,

  -- ВАЖНО: одна бронь = одна локация
  location_id       BIGINT NOT NULL
                   REFERENCES location(location_id) ON DELETE RESTRICT,

  price             NUMERIC(12,2) NOT NULL DEFAULT 0,

  photographer_id   BIGINT NULL
                   REFERENCES photographer(photographer_id) ON DELETE SET NULL,

  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  people_count      INT NOT NULL CHECK (people_count > 0),

  comment           TEXT,
  status            booking_status NOT NULL DEFAULT 'new',

  CONSTRAINT chk_booking_time CHECK (end_at > start_at)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_booking_client_id   ON booking(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_location_id ON booking(location_id);
CREATE INDEX IF NOT EXISTS idx_booking_start_at    ON booking(start_at);

-- 6) Доп.услуги (справочник)
CREATE TABLE IF NOT EXISTS extra_service (
  extra_service_id BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE
);

-- 7) Связь бронь ↔ доп.услуги (много услуг для одной брони)
CREATE TABLE IF NOT EXISTS booking_extra_service (
  booking_id        BIGINT NOT NULL
                   REFERENCES booking(booking_id) ON DELETE CASCADE,
  extra_service_id  BIGINT NOT NULL
                   REFERENCES extra_service(extra_service_id) ON DELETE RESTRICT,
  PRIMARY KEY (booking_id, extra_service_id)
);

COMMIT;
