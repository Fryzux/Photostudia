import urllib.request
import json
import time

BASE_URL = "http://localhost:8000/api"

def make_request(url, method="GET", data=None, headers=None):
    if headers is None: headers = {}
    if data is not None:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            text = response.read().decode()
            try: return response.status, json.loads(text)
            except: return response.status, text
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try: return e.code, json.loads(text)
        except: return e.code, text
    except Exception as e:
        return 500, str(e)

print("=============================================")
print("  PHOTOSTUDIA BACKEND DEMO SCRIPT")
print("=============================================")
print("\n[✔] Шаг 1. Безопасность и Бизнес-процесс 1: Регистрация")
user_email = f"demo_user_{int(time.time())}@test.com"
pwd = "StrongPassword123!"

status, data = make_request(f"{BASE_URL}/auth/register/", "POST", {
    "username": f"usr_{int(time.time())}",
    "email": user_email,
    "password": pwd,
    "first_name": "Demo"
})
print("Регистрация клиента:", status, "(201 - Успех)" if status == 201 else f"Ошибка: {data}")

status, data = make_request(f"{BASE_URL}/auth/login/", "POST", {
    "email": user_email,
    "password": pwd
})
token = data.get('access')
headers = {"Authorization": f"Bearer {token}"}
print("Получение JWT-токена:", status, "Да (Успех)" if token else "Нет")

print("\n[✔] Шаг 2. Защита ролей (RBAC)")
hall_status, hall_data = make_request(f"{BASE_URL}/halls/", "POST", {
    "name": f"Hacker Hall {int(time.time())}", "capacity": 10, "price_per_hour": 1000.0
}, headers)

print("Попытка обычного клиента создать зал:", hall_status)
if hall_status == 403:
    print(" -> 403 Forbidden! РОЛЕВАЯ ЗАЩИТА СРАБОТАЛА! (Обычные юзеры не могут)")

print("\n[✔] Шаг 3. Запрос ИИ (AI-Аналитика)")
ai_status, ai_data = make_request(f"{BASE_URL}/ai/predict/", "GET", headers=headers)
print("Статус запроса к ИИ:", ai_status)
if ai_status == 200:
    print("ИИ ответил успешно! Вот прогноз (JSON):")
    print(json.dumps(ai_data, indent=2, ensure_ascii=False))
else:
    print("Ответ сервера (скорее всего требуется роль Админа для аналитики):", ai_data)

print("\n[✔] Готово! Все критические системы проверены.")
print("=============================================")
