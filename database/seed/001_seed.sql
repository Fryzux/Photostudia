BEGIN;

-- 5 локаций (можешь переименовать под свои залы)
INSERT INTO location (name) VALUES
  ('Зал 1'),
  ('Зал 2'),
  ('Зал 3'),
  ('Зал 4'),
  ('Зал 5')
ON CONFLICT (name) DO NOTHING;

-- Доп.услуги
INSERT INTO extra_service (name) VALUES
  ('Световое оборудование'),
  ('Фоны'),
  ('Зеркала'),
  ('Реквизит')
ON CONFLICT (name) DO NOTHING;
-- Конструкция INSERT ... ON CONFLICT DO NOTHING позволяет не падать,
-- если запись с таким уникальным значением уже есть. [web:98][web:104]

COMMIT;
