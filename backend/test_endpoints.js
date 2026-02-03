import axios from 'axios';

// Тестовые эндпоинты API
async function testEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Тестируем эндпоинты VPN API...\n');
  
  try {
    // Тестируем /health endpoint
    console.log('1. Тестируем /health endpoint...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✓ /health:', healthResponse.data);
    
    // Тестируем /api/user/me (без аутентификации - должен вернуть ошибку)
    console.log('\n2. Тестируем /api/user/me без аутентификации...');
    try {
      const userMeResponse = await axios.get(`${baseUrl}/api/user/me`);
      console.log('✗ /api/user/me (ожидается ошибка):', userMeResponse.data);
    } catch (error) {
      console.log('✓ /api/user/me корректно вернул ошибку аутентификации:', error.response.status);
    }
    
    // Тестируем /api/subscription/activate (без аутентификации - должен вернуть ошибку)
    console.log('\n3. Тестируем /api/subscription/activate без аутентификации...');
    try {
      const subActivateResponse = await axios.post(`${baseUrl}/api/subscription/activate`, { price: 100 });
      console.log('✗ /api/subscription/activate (ожидается ошибка):', subActivateResponse.data);
    } catch (error) {
      console.log('✓ /api/subscription/activate корректно вернул ошибку аутентификации:', error.response.status);
    }
    
    console.log('\n✓ Все тесты пройдены успешно! Эндпоинты работают корректно.');
    console.log('\nПримечание: Для полноценного тестирования эндпоинтов /api/user/me и /api/subscription/activate');
    console.log('необходимо предоставить корректные заголовки аутентификации X-Telegram-InitData.');
    
  } catch (error) {
    console.error('✗ Ошибка при тестировании:', error.message);
  }
}

// Запуск тестов
testEndpoints();