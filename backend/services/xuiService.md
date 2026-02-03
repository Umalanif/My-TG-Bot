# Сервис интеграции с 3X-UI

Этот сервис предоставляет средства для интеграции с панелью управления 3X-UI, включая аутентификацию, создание клиентов и управление конфигурациями.

## Установка

Сервис уже включен в проект и использует следующие зависимости:

- `axios` - для HTTP-запросов к API 3X-UI

## Конфигурация

Для работы сервиса необходимо настроить переменные окружения в файле `.env`:

```env
XUI_BASE_URL=https://your-xui-panel-domain.com
XUI_USERNAME=your_username
XUI_PASSWORD=your_password
```

## Использование

### Импорт сервиса

```javascript
import xuiService from './services/xuiService.js';
```

### Аутентификация

Перед использованием других методов необходимо выполнить аутентификацию:

```javascript
try {
  await xuiService.authenticate();
  console.log('Аутентификация прошла успешно');
} catch (error) {
  console.error('Ошибка аутентификации:', error.message);
}
```

### Создание клиента

Для создания нового клиента используется метод `createClient()`:

```javascript
const clientData = {
  email: 'user@example.com',
  uuid: 'uuid-v4-string', // Сгенерированный UUID
  flow: 'xtls-rprx-vision', // Необязательно, зависит от настроек сервера
  total: 10737418240, // 10GB в байтах
  expiryTime: Date.now() + (30 * 24 * 60 * 60 * 1000) // Через 30 дней
};

try {
  const result = await xuiService.createClient(clientData, inboundId);
  console.log('Клиент создан:', result);
} catch (error) {
  console.error('Ошибка при создании клиента:', error.message);
}
```

### Получение конфигураций

Для получения всех конфигураций клиентов:

```javascript
try {
  const configs = await xuiService.getClientConfigs();
  console.log('Конфигурации получены:', configs);
  
  // Можно фильтровать по протоколу
  const vlessConfigs = await xuiService.getClientConfigs('vless');
} catch (error) {
  console.error('Ошибка при получении конфигураций:', error.message);
}
```

### Удаление клиента

Для удаления клиента:

```javascript
try {
  const success = await xuiService.deleteClient(clientId, inboundId);
  if (success) {
    console.log('Клиент успешно удален');
  }
} catch (error) {
  console.error('Ошибка при удалении клиента:', error.message);
}
```

### Получение списка inbound соединений

```javascript
try {
  const inbounds = await xuiService.getInbounds();
  console.log('Inbound соединения:', inbounds);
} catch (error) {
  console.error('Ошибка при получении inbound соединений:', error.message);
}
```

### Получение статистики трафика

```javascript
try {
  const trafficStats = await xuiService.getTrafficStats();
  console.log('Статистика трафика:', trafficStats);
} catch (error) {
  console.error('Ошибка при получении статистики трафика:', error.message);
}
```

## Безопасность

- Все учетные данные хранятся в переменных окружения и не должны быть жестко закодированы
- Сервис автоматически управляет сессиями и CSRF-токенами
- Все методы имеют обработку ошибок
- При каждом вызове метода проверяется состояние аутентификации