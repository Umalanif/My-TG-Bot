# API эндпоинт для получения VPN ключа

## Описание

Эндпоинт `GET /api/vpn/key` предназначен для получения или создания VPN ключа для пользователя. Он принимает Telegram ID пользователя, проверяет наличие ключа в локальной базе данных (SQLite) и, если ключа нет, создает нового клиента в панели 3X-UI через API. На выходе отдается HTTPS-ссылка на подписку.

## Требования

- Node.js v20+
- Express.js
- База данных SQLite3
- Библиотека `axios` для запросов к 3X-UI
- Библиотека `uuid` для генерации UUID v4

## Настройка окружения

Перед использованием необходимо настроить следующие переменные окружения в файле `.env`:

```env
# Конфигурация 3X-UI панели
XUI_BASE_URL=https://ваша-панель-3x-ui.com
XUI_USERNAME=ваш_логин
XUI_PASSWORD=ваш_пароль
XUI_INBOUND_ID=1  # ID inbound соединения в 3X-UI панели
```

Если переменные 3X-UI не настроены, эндпоинт будет работать в "локальном режиме", создавая клиентов только в локальной базе данных без интеграции с 3X-UI.

## Аутентификация

Эндпоинт использует middleware аутентификации, который проверяет валидность `initData` от Telegram. Для успешного запроса необходимо передать заголовок:

```
X-Telegram-InitData: <telegram_init_data>
```

## Структура базы данных

### Таблица `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id INTEGER UNIQUE NOT NULL,
  uuid TEXT UNIQUE,
  username TEXT,
  first_name TEXT,
  balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица `vpn_clients`
```sql
CREATE TABLE IF NOT EXISTS vpn_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  uuid TEXT NOT NULL UNIQUE,
  email TEXT,
  xui_client_id TEXT,
  inbound_id INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'expired')),
  total_traffic INTEGER DEFAULT 0,
  upload INTEGER DEFAULT 0,
  download INTEGER DEFAULT 0,
  total_limit INTEGER DEFAULT 0,
  expiry_time INTEGER DEFAULT 0,
  config_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## Работа эндпоинта

### Алгоритм работы

1. **Валидация пользователя**: Извлекает Telegram ID пользователя из аутентифицированного запроса
2. **Проверка существования пользователя**: Ищет пользователя в базе данных по `tg_id`
3. **Создание пользователя (при необходимости)**: Если пользователь не найден, создает новую запись с автоматически сгенерированным UUID
4. **Проверка существующего VPN клиента**: Ищет активного VPN клиента для пользователя
5. **Обработка результатов**:
   - **Если клиент существует**: Возвращает информацию о существующем клиенте
   - **Если клиент не существует**: Создает нового клиента

### Создание нового клиента

При создании нового клиента возможны три сценария:

1. **Интеграция с 3X-UI (режим по умолчанию)**:
   - Аутентификация в панели 3X-UI
   - Создание клиента с уникальным UUID
   - Получение конфигурации (HTTPS-ссылка на подписку)
   - Сохранение данных клиента в локальной БД

2. **Локальный режим (3X-UI недоступен)**:
   - Создание клиента только в локальной БД
   - Генерация UUID
   - Сохранение без конфигурации 3X-UI

3. **Режим fallback (ошибка 3X-UI)**:
   - Попытка создания в 3X-UI завершается ошибкой
   - Создание клиента в локальной БД
   - Возврат информации с предупреждением об ошибке

## Ответы API

### Успешные ответы

#### 1. Ключ уже существует (статус: `existing`)
```json
{
  "message": "VPN ключ уже существует",
  "status": "existing",
  "user": {
    "tg_id": 123456789,
    "username": "test_user",
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
  },
  "vpn_client": {
    "uuid": "550e8400-e29b-41d4-a716-446655440001",
    "status": "active",
    "config_url": "https://example.com/config/vless.txt",
    "created_at": "2026-02-12T05:30:00.000Z"
  },
  "timestamp": "2026-02-12T06:00:00.000Z"
}
```

#### 2. Ключ создан в 3X-UI (статус: `created`)
```json
{
  "message": "VPN ключ успешно создан",
  "status": "created",
  "user": {
    "tg_id": 123456789,
    "username": "test_user",
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
  },
  "vpn_client": {
    "uuid": "550e8400-e29b-41d4-a716-446655440001",
    "status": "active",
    "config_url": "https://example.com/config/vless.txt",
    "created_at": "2026-02-12T06:00:00.000Z"
  },
  "config_url": "https://example.com/config/vless.txt",
  "timestamp": "2026-02-12T06:00:00.000Z"
}
```

#### 3. Ключ создан только в локальной БД (статус: `created_local`)
```json
{
  "message": "VPN ключ создан в локальной базе (3X-UI сервис недоступен)",
  "status": "created_local",
  "user": {
    "tg_id": 123456789,
    "username": "test_user",
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
  },
  "vpn_client": {
    "uuid": "550e8400-e29b-41d4-a716-446655440001",
    "status": "active",
    "config_url": null,
    "created_at": "2026-02-12T06:00:00.000Z"
  },
  "warning": "3X-UI сервис недоступен - клиент создан только в локальной базе",
  "timestamp": "2026-02-12T06:00:00.000Z"
}
```

#### 4. Ключ создан в fallback режиме (статус: `created_fallback`)
```json
{
  "message": "VPN ключ создан в локальной базе (ошибка 3X-UI)",
  "status": "created_fallback",
  "user": {
    "tg_id": 123456789,
    "username": "test_user",
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
  },
  "vpn_client": {
    "uuid": "550e8400-e29b-41d4-a716-446655440001",
    "status": "active",
    "config_url": null,
    "created_at": "2026-02-12T06:00:00.000Z"
  },
  "warning": "3X-UI сервис вернул ошибку: Authentication failed",
  "timestamp": "2026-02-12T06:00:00.000Z"
}
```

### Ошибки

#### Ошибка аутентификации (401)
```json
{
  "message": "Неавторизованный доступ"
}
```

#### Ошибка сервера (500)
```json
{
  "message": "Внутренняя ошибка сервера при получении VPN ключа",
  "error": "Описание ошибки",
  "timestamp": "2026-02-12T06:00:00.000Z"
}
```

## Примеры использования

### Пример запроса (cURL)

```bash
curl -X GET "http://localhost:3000/api/vpn/key" \
  -H "X-Telegram-InitData: <your_telegram_init_data>"
```

### Пример запроса (JavaScript)

```javascript
const response = await fetch('http://localhost:3000/api/vpn/key', {
  method: 'GET',
  headers: {
    'X-Telegram-InitData': '<your_telegram_init_data>'
  }
});

const data = await response.json();
console.log(data);
```

### Пример использования в Telegram Mini App

```javascript
// Внутри Telegram Mini App
const initData = window.Telegram.WebApp.initData;

fetch('/api/vpn/key', {
  method: 'GET',
  headers: {
    'X-Telegram-InitData': initData
  }
})
.then(response => response.json())
.then(data => {
  if (data.config_url) {
    // Показать пользователю ссылку на конфигурацию
    window.location.href = data.config_url;
  }
});
```

## Тестирование

### Тестовые скрипты

1. **Тест модуля базы данных**:
   ```bash
   cd backend
   node test_vpn_key.js
   ```

2. **Тест эндпоинтов API**:
   ```bash
   cd backend
   node test_endpoints.js
   ```

### Запуск тестового сервера

```bash
cd backend
npm install  # Установить зависимости (включая uuid)
npm start    # Запустить сервер
```

## Логирование

Эндпоинт логирует следующие события:
- Создание нового пользователя
- Поиск существующего VPN клиента
- Успешное создание клиента в 3X-UI
- Ошибки при работе с 3X-UI
- Создание клиента в локальном режиме

## Обработка ошибок

Эндпоинт реализует следующие стратегии обработки ошибок:

1. **Ошибки аутентификации**: Возвращает 401 статус
2. **Ошибки базы данных**: Возвращает 500 статус с описанием ошибки
3. **Ошибки 3X-UI**: Переходит в fallback режим, создавая клиента только в локальной БД
4. **Отсутствие конфигурации 3X-UI**: Возвращает клиента без `config_url`

## Безопасность

1. **Валидация входных данных**: Все данные проверяются через middleware аутентификации
2. **Защита от SQL-инъекций**: Используется параметризованные запросы через `better-sqlite3`
3. **Безопасное хранение UUID**: UUID генерируются с помощью криптографически безопасного генератора
4. **Лимиты запросов**: Рекомендуется использовать rate-limiting middleware

## Совместимость

Эндпоинт совместим с:
- Telegram Mini Apps
- Телеграм ботами через WebApp интерфейс
- Любыми клиентами, поддерживающими передачу `X-Telegram-InitData`

## Следующие шаги

Рекомендуемые улучшения:
1. Добавить rate limiting для предотвращения злоупотреблений
2. Реализовать кэширование результатов запросов
3. Добавить поддержку нескольких протоколов (VLESS, VMess, Trojan)
4. Реализовать автоматическое обновление конфигураций
5. Добавить веб-интерфейс для управления клиентами