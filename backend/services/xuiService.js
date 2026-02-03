import axios from 'axios';

/**
 * Сервис для интеграции с 3X-UI панелью
 * Предоставляет методы для аутентификации, создания клиентов и получения конфигураций
 */
class XuiService {
  constructor() {
    // Получаем параметры из переменных окружения
    this.baseUrl = process.env.XUI_BASE_URL;
    this.username = process.env.XUI_USERNAME;
    this.password = process.env.XUI_PASSWORD;
    
    // Проверяем наличие обязательных переменных окружения
    if (!this.baseUrl || !this.username || !this.password) {
      throw new Error('Отсутствуют обязательные переменные окружения для подключения к 3X-UI: XUI_BASE_URL, XUI_USERNAME, XUI_PASSWORD');
    }
    
    // Инициализируем axios клиент без авторизации
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.authenticatedClient = null;
    this.csrfToken = null;
    this.sessionCookie = null;
  }

  /**
   * Метод аутентификации в 3X-UI панели
   * @returns {Promise<boolean>} Успешность аутентификации
   */
  async authenticate() {
    try {
      const response = await this.apiClient.post('/login', {
        username: this.username,
        password: this.password
      });

      if (response.data.success) {
        // Сохраняем токен CSRF и cookie сессии
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          this.sessionCookie = cookies.find(cookie => 
            cookie.startsWith('3x-ui=') || cookie.includes('connect.sid')
          );
        }
        
        // Находим CSRF токен из заголовков или ответа
        this.csrfToken = response.headers['x-csrf-token'] || response.data.csrfToken;
        
        // Создаем клиент с авторизацией
        this.authenticatedClient = axios.create({
          baseURL: this.baseUrl,
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': this.sessionCookie || '',
            'X-Requested-With': 'XMLHttpRequest',
            ...(this.csrfToken && {'X-CSRF-Token': this.csrfToken})
          },
        });

        console.log('Успешная аутентификация в 3X-UI');
        return true;
      } else {
        throw new Error(`Ошибка аутентификации: ${response.data.msg || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при аутентификации в 3X-UI:', error.message);
      throw error;
    }
  }

  /**
   * Проверяет, есть ли активная сессия
   * @returns {boolean} Активна ли сессия
   */
  isAuthenticated() {
    return this.authenticatedClient !== null && this.sessionCookie !== null;
  }

  /**
   * Внутренний метод для проверки сессии и повторной аутентификации при необходимости
   * @returns {Promise<void>}
   */
  async _ensureAuthenticated() {
    if (!this.isAuthenticated()) {
      await this.authenticate();
    }
  }

  /**
   * Создает нового клиента в 3X-UI панели
   * @param {Object} clientData Данные клиента для создания
   * @param {string} clientData.email Email клиента
   * @param {string} clientData.uuid UUID клиента
   * @param {string} [clientData.flow] Flow для клиента (необязательно)
   * @param {number} [clientData.upload=0] Загрузка (в байтах)
   * @param {number} [clientData.download=0] Скачивание (в байтах)
   * @param {number} [clientData.total=0] Общий лимит (в байтах)
   * @param {number} [clientData.expiryTime=0] Время истечения (в мс с 1970-01-01 UTC)
   * @param {boolean} [clientData.enable=true] Включен ли клиент
   * @param {string} [clientData.remarks=''] Комментарии
   * @param {number} inboundId ID inbound соединения
   * @returns {Promise<Object>} Данные созданного клиента
   */
  async createClient(clientData, inboundId) {
    try {
      await this._ensureAuthenticated();

      // Подготовка данных по умолчанию
      const defaultClientData = {
        email: '',
        uuid: '',
        flow: '',
        upload: 0,
        download: 0,
        total: 0,
        expiryTime: 0,
        enable: true,
        remarks: '',
        ...clientData
      };

      // Отправляем запрос на создание клиента
      const response = await this.authenticatedClient.post(`/panel/inbound/addClient/${inboundId}`, defaultClientData);

      if (response.data.success) {
        console.log(`Клиент ${defaultClientData.email} успешно создан`);
        return response.data.obj;
      } else {
        throw new Error(`Ошибка создания клиента: ${response.data.msg || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при создании клиента в 3X-UI:', error.message);
      throw error;
    }
  }

  /**
   * Удаляет клиента из 3X-UI панели
   * @param {string} clientId ID клиента для удаления
   * @param {number} inboundId ID inbound соединения
   * @returns {Promise<boolean>} Успешность удаления
   */
  async deleteClient(clientId, inboundId) {
    try {
      await this._ensureAuthenticated();

      const response = await this.authenticatedClient.post(`/panel/inbound/delClient/${inboundId}`, {
        id: clientId
      });

      if (response.data.success) {
        console.log(`Клиент ${clientId} успешно удален`);
        return true;
      } else {
        throw new Error(`Ошибка удаления клиента: ${response.data.msg || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при удалении клиента в 3X-UI:', error.message);
      throw error;
    }
  }

  /**
   * Получает конфигурацию для клиента
   * @param {string} [protocol] Протокол для фильтрации (например, 'vless', 'vmess')
   * @returns {Promise<Array>} Массив конфигураций
   */
  async getClientConfigs(protocol = null) {
    try {
      await this._ensureAuthenticated();

      // Получаем все inbound соединения
      const response = await this.authenticatedClient.get('/panel/inbound/list');

      if (response.data.success) {
        let configs = [];
        
        // Фильтруем inbound'ы по протоколу если указан
        const inbounds = protocol ? 
          response.data.obj.filter(inbound => inbound.protocol === protocol) : 
          response.data.obj;

        for (const inbound of inbounds) {
          // Генерация конфигураций для каждого клиента в inbound'е
          if (inbound.settings && inbound.settings.clients) {
            for (const client of inbound.settings.clients) {
              // Форматирование конфигурации в зависимости от протокола
              const config = this.generateConfig(inbound, client);
              if (config) {
                configs.push(config);
              }
            }
          }
        }

        console.log(`Получено ${configs.length} конфигураций`);
        return configs;
      } else {
        throw new Error(`Ошибка получения конфигураций: ${response.data.msg || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при получении конфигураций из 3X-UI:', error.message);
      throw error;
    }
  }

  /**
   * Генерирует URL конфигурацию для клиента в зависимости от протокола
   * @param {Object} inbound inbound соединение
   * @param {Object} client данные клиента
   * @returns {string|null} Строка конфигурации или null
   */
  generateConfig(inbound, client) {
    const settings = inbound.settings ? JSON.parse(inbound.settings) : {};
    const streamSettings = inbound.streamSettings ? JSON.parse(inbound.streamSettings) : {};
    
    try {
      switch (inbound.protocol) {
        case 'vless':
          // Для VLESS формат URL
          const net = streamSettings.network || 'tcp';
          let configUrl = `vless://${client.id}@${inbound.listen}:${inbound.port}`;
          
          let params = [];
          params.push(`type=${net}`);
          
          if (streamSettings.security === 'tls') {
            params.push('security=tls');
            if (streamSettings.tlsSettings?.sni) {
              params.push(`sni=${encodeURIComponent(streamSettings.tlsSettings.sni)}`);
            }
          }
          
          if (settings.flow && settings.flow !== '') {
            params.push(`flow=${encodeURIComponent(settings.flow)}`);
          }
          
          configUrl += `?${params.join('&')}#${encodeURIComponent(client.email || 'VPN')}`;
          return configUrl;
          
        case 'vmess':
          // Для VMess формат JSON
          const vmessConfig = {
            v: '2',
            ps: client.email || 'VPN',
            add: inbound.listen,
            port: String(inbound.port),
            id: client.id,
            aid: '0',
            net: streamSettings.network || 'tcp',
            type: 'none',
            host: '',
            path: '',
            tls: streamSettings.security === 'tls' ? 'tls' : ''
          };
          
          if (streamSettings.tcpSettings?.header?.request?.headers?.Host?.[0]) {
            vmessConfig.host = streamSettings.tcpSettings.header.request.headers.Host[0];
          }
          
          if (streamSettings.httpSettings?.path) {
            vmessConfig.path = streamSettings.httpSettings.path;
          }
          
          return `vmess://${Buffer.from(JSON.stringify(vmessConfig)).toString('base64')}`;
          
        case 'trojan':
          // Для Trojan формат URL
          let trojanUrl = `trojan://${client.password}@${inbound.listen}:${inbound.port}`;
          
          let trojanParams = [];
          if (streamSettings.security === 'tls') {
            trojanParams.push('security=tls');
          }
          
          if (streamSettings.tlsSettings?.sni) {
            trojanParams.push(`sni=${encodeURIComponent(streamSettings.tlsSettings.sni)}`);
          }
          
          trojanUrl += `?${trojanParams.join('&')}#${encodeURIComponent(client.email || 'VPN')}`;
          return trojanUrl;
          
        default:
          console.warn(`Протокол ${inbound.protocol} не поддерживается для генерации конфига`);
          return null;
      }
    } catch (error) {
      console.error('Ошибка при генерации конфигурации:', error.message);
      return null;
    }
  }

  /**
   * Получает список всех inbound соединений
   * @returns {Promise<Array>} Массив inbound соединений
   */
  async getInbounds() {
    try {
      await this._ensureAuthenticated();

      const response = await this.authenticatedClient.get('/panel/inbound/list');

      if (response.data.success) {
        console.log(`Получено ${response.data.obj.length} inbound соединений`);
        return response.data.obj;
      } else {
        throw new Error(`Ошибка получения inbound соединений: ${response.data.msg || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при получении inbound соединений из 3X-UI:', error.message);
      throw error;
    }
  }

  /**
   * Получает статистику трафика для клиентов
   * @returns {Promise<Object>} Объект с информацией о трафике
   */
  async getTrafficStats() {
    try {
      await this._ensureAuthenticated();

      const response = await this.authenticatedClient.get('/panel/inbound/traffic');

      if (response.data.success) {
        console.log('Статистика трафика получена');
        return response.data.obj;
      } else {
        throw new Error(`Ошибка получения статистики трафика: ${response.data.msg || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при получении статистики трафика из 3X-UI:', error.message);
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса
const xuiService = new XuiService();
export default xuiService;