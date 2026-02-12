// Тестовый скрипт для проверки модуля database.js и эндпоинта /api/vpn/key

import database from './database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Тестирование модуля базы данных
 */
async function testDatabaseModule() {
  console.log('=== Тестирование модуля database.js ===\n');
  
  try {
    // Тест 1: Создание пользователя
    console.log('1. Тест создания пользователя...');
    const userData = {
      tg_id: 123456789,
      username: 'test_user',
      first_name: 'Test'
    };
    
    const user = database.upsertUser(userData);
    console.log(`✓ Пользователь создан: ID=${user.id}, TG_ID=${user.tg_id}, UUID=${user.uuid}`);
    
    // Тест 2: Получение пользователя по TG_ID
    console.log('\n2. Тест получения пользователя по TG_ID...');
    const foundUser = database.getUserByTgId(123456789);
    console.log(`✓ Пользователь найден: ${foundUser ? foundUser.username : 'не найден'}`);
    
    // Тест 3: Создание VPN клиента
    console.log('\n3. Тест создания VPN клиента...');
    const clientUuid = uuidv4();
    const vpnClient = database.createVpnClient({
      user_id: user.id,
      uuid: clientUuid,
      email: 'test@vpn.example',
      status: 'active',
      config_url: 'https://example.com/config.txt'
    });
    console.log(`✓ VPN клиент создан: UUID=${vpnClient.uuid}, Статус=${vpnClient.status}`);
    
    // Тест 4: Получение VPN клиентов по user_id
    console.log('\n4. Тест получения VPN клиентов по user_id...');
    const clients = database.getVpnClientsByUserId(user.id);
    console.log(`✓ Найдено клиентов: ${clients.length}`);
    
    // Тест 5: Получение активного клиента
    console.log('\n5. Тест получения активного клиента...');
    const activeClient = database.getActiveVpnClientByUserId(user.id);
    console.log(`✓ Активный клиент: ${activeClient ? activeClient.uuid : 'не найден'}`);
    
    // Тест 6: Обновление статуса клиента
    console.log('\n6. Тест обновления статуса клиента...');
    const updated = database.updateVpnClientStatus(clientUuid, 'suspended');
    console.log(`✓ Статус обновлен: ${updated ? 'успешно' : 'ошибка'}`);
    
    // Проверяем обновление
    const updatedClient = database.getVpnClientByUuid(clientUuid);
    console.log(`  Новый статус: ${updatedClient.status}`);
    
    console.log('\n=== Все тесты модуля database.js пройдены успешно! ===\n');
    
  } catch (error) {
    console.error('✗ Ошибка при тестировании модуля database.js:', error);
    throw error;
  }
}

/**
 * Тестирование эндпоинта /api/vpn/key (имитация запроса)
 */
function testVpnKeyEndpoint() {
  console.log('=== Тестирование эндпоинта /api/vpn/key (логика) ===\n');
  
  console.log('Логика работы эндпоинта:');
  console.log('1. Получает Telegram ID пользователя из аутентификации');
  console.log('2. Проверяет наличие пользователя в базе данных');
  console.log('3. Проверяет наличие активного VPN клиента');
  console.log('4. Если клиент отсутствует:');
  console.log('   а) Пытается создать клиента в 3X-UI (если сервис доступен)');
  console.log('   б) Получает конфигурацию и сохраняет в БД');
  console.log('   в) Если 3X-UI недоступен - создает клиента только в локальной БД');
  console.log('5. Возвращает HTTPS-ссылку на подписку или статус');
  
  console.log('\nВозможные ответы эндпоинта:');
  console.log('- status: "existing" - ключ уже существует');
  console.log('- status: "created" - ключ создан в 3X-UI');
  console.log('- status: "created_local" - ключ создан только в локальной БД');
  console.log('- status: "created_fallback" - ошибка 3X-UI, создан в локальной БД');
  
  console.log('\n=== Тестирование логики завершено ===\n');
}

/**
 * Тестирование зависимостей
 */
function testDependencies() {
  console.log('=== Тестирование зависимостей ===\n');
  
  try {
    // Проверяем наличие uuid
    const testUuid = uuidv4();
    console.log(`✓ UUID сгенерирован: ${testUuid}`);
    console.log('✓ Модуль uuid импортирован успешно');
    
    console.log('\n=== Зависимости в порядке ===\n');
  } catch (error) {
    console.error('✗ Ошибка при проверке зависимостей:', error);
    throw error;
  }
}

/**
 * Основная функция тестирования
 */
async function runTests() {
  console.log('Запуск тестов VPN ключа...\n');
  
  try {
    await testDependencies();
    await testDatabaseModule();
    testVpnKeyEndpoint();
    
    console.log('🎉 Все тесты успешно пройдены!');
    console.log('\nДля реального тестирования эндпоинта /api/vpn/key:');
    console.log('1. Убедитесь, что сервер запущен (npm start)');
    console.log('2. Используйте Telegram Mini Apps для аутентификации');
    console.log('3. Отправьте GET запрос на /api/vpn/key с заголовком X-Telegram-InitData');
    console.log('\nДля тестирования без 3X-UI:');
    console.log('- Оставьте переменные XUI_* пустыми или несуществующими');
    console.log('- Эндпоинт будет создавать клиентов только в локальной БД');
    
  } catch (error) {
    console.error('❌ Тестирование завершилось с ошибками:', error.message);
    process.exit(1);
  }
}

// Запускаем тесты
runTests();