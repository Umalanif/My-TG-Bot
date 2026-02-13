import axios from 'axios';

/**
 * Сервис для интеграции с 3X-UI панелью
 */
class XuiService {
  constructor() {
    this.baseUrl = process.env.XUI_BASE_URL; // https://jsstudy.xyz:1337
    this.basePath = process.env.XUI_BASE_PATH || '/'; // /GfWRVC18J5m2Y3U317/
    this.username = process.env.XUI_USERNAME;
    this.password = process.env.XUI_PASSWORD;
    
    if (!this.baseUrl || !this.username || !this.password) {
      throw new Error('Отсутствуют обязательные переменные окружения для подключения к 3X-UI');
    }

    // Правильно склеиваем URL с учетом секретного пути и убираем лишние слеши
    const cleanBasePath = this.basePath.startsWith('/') ? this.basePath : `/${this.basePath}`;
    const fullUrl = `${this.baseUrl}${cleanBasePath}`.replace(/\/+$/, '');

    this.apiClient = axios.create({
      baseURL: fullUrl,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    
    this.authenticatedClient = null;
    this.sessionCookie = null;
  }

  /**
   * Метод аутентификации
   */
  async authenticate() {
    try {
      // Запрос пойдет на BASE_URL + BASE_PATH + /login
      const response = await this.apiClient.post('/login', {
        username: this.username,
        password: this.password
      });

      if (response.data.success) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          // Ищем именно куку сессии
          this.sessionCookie = cookies.find(c => c.includes('3x-ui'));
        }
        
        this.authenticatedClient = axios.create({
          baseURL: this.apiClient.defaults.baseURL,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': this.sessionCookie || '',
          },
        });

        console.log('✅ [XUI] Успешная аутентификация');
        return true;
      } else {
        throw new Error(response.data.msg || 'Ошибка аутентификации');
      }
    } catch (error) {
      console.error('❌ [XUI] Ошибка логина:', error.message);
      return false;
    }
  }

  /**
   * Проверка и обновление сессии
   */
  async _ensureAuthenticated() {
    if (!this.authenticatedClient) {
      const success = await this.authenticate();
      if (!success) throw new Error('Не удалось авторизоваться в 3X-UI');
    }
  }

  /**
   * Создает нового клиента (VLESS/VMess/etc)
   */
  async createClient(clientData, inboundId) {
    try {
      await this._ensureAuthenticated();

      // В 3X-UI API добавление клиента идет через этот эндпоинт
      // settings должен быть JSON-строкой внутри объекта
      const response = await this.authenticatedClient.post('/panel/api/inbounds/addClient', {
        id: inboundId,
        settings: JSON.stringify({
          clients: [{
            id: clientData.uuid,
            email: clientData.email,
            enable: true,
            expiryTime: 0,
            totalGB: 0,
            alterId: 0 // для VMess
          }]
        })
      });

      if (response.data.success) {
        return response.data.obj;
      } else {
        throw new Error(response.data.msg || 'Панель отклонила запрос');
      }
    } catch (error) {
      console.error('❌ [XUI] Ошибка создания клиента:', error.message);
      throw error;
    }
  }

  /**
   * Получение списка инбаундов (нужно для отладки)
   */
  async getInbounds() {
    await this._ensureAuthenticated();
    const response = await this.authenticatedClient.get('/panel/api/inbounds/list');
    return response.data.obj;
  }
}

const xuiService = new XuiService();
export default xuiService;