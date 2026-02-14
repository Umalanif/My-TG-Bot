import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

class XuiService {
  constructor() {
    this.baseUrl = process.env.XUI_BASE_URL;
    // Возвращаем поддержку BASE_PATH (если у тебя панель не в корне)
    this.basePath = process.env.XUI_BASE_PATH || '/'; 
    this.username = process.env.XUI_USERNAME;
    this.password = process.env.XUI_PASSWORD;

    // Жестко прописываем домен для подписки (как договаривались)
    this.publicDomain = 'https://jsstudy.xyz:2096'; 

    if (!this.baseUrl || !this.username || !this.password) {
      console.error('❌ [XUI ERROR] ПЕРЕМЕННЫЕ НЕ НАЙДЕНЫ В .ENV!');
    }

    // Правильная сборка URL (как было у тебя раньше)
    const cleanPath = this.basePath.startsWith('/') ? this.basePath : `/${this.basePath}`;
    // Убираем двойные слэши, но оставляем http://
    const fullUrl = `${this.baseUrl}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1");

    console.log(`[XUI DEBUG] Бот будет стучаться сюда: ${fullUrl}`); // <-- СМОТРИ В ЛОГИ СЮДА

    this.apiClient = axios.create({
      baseURL: fullUrl,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.authenticatedClient = null;
  }

  // Генерация случайного subId (16 символов)
  generateSubId() {
    return crypto.randomBytes(8).toString('hex');
  }

  async authenticate() {
    try {
      // Пытаемся залогиниться
      console.log(`[XUI DEBUG] Пробую логин по адресу: ${this.apiClient.defaults.baseURL}login`);
      
      const response = await this.apiClient.post('/login', {
        username: this.username,
        password: this.password
      });

      if (response.data.success) {
        const cookies = response.headers['set-cookie'];
        let sessionCookie = cookies?.find(c => c.includes('3x-ui') || c.includes('session'));
        
        if (!sessionCookie && cookies && cookies.length > 0) {
            sessionCookie = cookies[0];
        }

        this.authenticatedClient = axios.create({
          baseURL: this.apiClient.defaults.baseURL,
          headers: { 
            'Content-Type': 'application/json', 
            'Cookie': sessionCookie || '' 
          },
        });
        console.log('✅ [XUI] Авторизация успешна');
        return true;
      }
      return false;
    } catch (e) {
      console.error(`❌ [XUI] Ошибка логина: ${e.message}`);
      // Если 404 - значит адрес неверный
      if (e.response && e.response.status === 404) {
          console.error('⚠️ ПРОВЕРЬ .ENV: Бот стучится не туда. Проверь XUI_BASE_URL и XUI_BASE_PATH');
      }
      return false;
    }
  }

  async createClient(tgId) {
    if (!this.authenticatedClient) {
        const success = await this.authenticate();
        if (!success) throw new Error('Не удалось авторизоваться в панели');
    }

    // 1. Генерируем данные
    const uuid = crypto.randomUUID();
    const subId = this.generateSubId(); // Короткий ID
    const email = `user_${tgId}_${Date.now()}`;

    // Высчитываем 72 часа от текущего времени в миллисекундах
    const expiryTimeMs = Date.now() + (72 * 60 * 60 * 1000);

    // 2. Данные для панели
    const clientPayload = {
      id: uuid,
      email: email,
      limitIp: 2,
      totalGB: 0,
      expiryTime: expiryTimeMs,
      enable: true,
      tgId: tgId.toString(),
      subId: subId, // Передаем subId в панель
      flow: "",
    };

    try {
      // 3. Отправляем в панель (ID подключения = 1, проверь в панели!)
      const inboundId = 2; 

      await this.authenticatedClient.post('/panel/api/inbounds/addClient', {
        id: inboundId,
        settings: JSON.stringify({
          clients: [clientPayload]
        })
      });

      // 4. Формируем красивую ссылку
      const publicUrl = `${this.publicDomain}/sub/${subId}`;

      console.log(`✅ Клиент создан: ${email}, Ссылка: ${publicUrl}`);

      return {
        configUrl: publicUrl,
        uuid: uuid,
        email: email,
        subId: subId,
        expiryTime: expiryTimeMs
      };

    } catch (error) {
      console.error('❌ Ошибка при добавлении клиента:', error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('🔄 Пробуем перелогиниться...');
          this.authenticatedClient = null;
          return this.createClient(tgId);
      }
      throw error;
    }
  }
}

export default new XuiService();
