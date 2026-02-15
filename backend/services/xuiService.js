import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

class XuiService {
  constructor() {
    this.baseUrl = process.env.XUI_BASE_URL;
    this.basePath = process.env.XUI_BASE_PATH || '/'; 
    this.username = process.env.XUI_USERNAME;
    this.password = process.env.XUI_PASSWORD;
    this.publicDomain = 'https://jsstudy.xyz:2096'; 

    if (!this.baseUrl || !this.username || !this.password) {
      console.error('❌ [XUI ERROR] ПЕРЕМЕННЫЕ НЕ НАЙДЕНЫ В .ENV!');
    }

    const cleanPath = this.basePath.startsWith('/') ? this.basePath : `/${this.basePath}`;
    const fullUrl = `${this.baseUrl}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1");

    console.log(`[XUI DEBUG] Базовый URL: ${fullUrl}`);

    this.apiClient = axios.create({
      baseURL: fullUrl,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.authenticatedClient = null;
  }

  generateSubId() {
    return crypto.randomBytes(8).toString('hex');
  }

  async authenticate() {
    try {
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
      return false;
    }
  }

  // --- НОВАЯ ФУНКЦИЯ: Проверка наличия клиента ---
  async checkClientExists(email) {
    if (!this.authenticatedClient) {
      const success = await this.authenticate();
      if (!success) return true; // Если не можем войти, возвращаем true, чтобы случайно не удалить
    }

    try {
      const response = await this.authenticatedClient.get(`/panel/api/inbounds/getClientTraffics/${email}`);
      // Если клиент есть, панель вернет { success: true, obj: {...} }. Если нет obj, значит удален.
      if (response.data && response.data.success && response.data.obj) {
        return true;
      }
      return false;
    } catch (error) {
      console.error(`⚠️ [XUI] Ошибка проверки существования клиента ${email}:`, error.message);
      return true; // При сетевой ошибке лучше перестраховаться
    }
  }

  // --- НОВАЯ ФУНКЦИЯ: Удаление клиента ---
  async deleteClient(inboundId, clientUuid) {
    if (!this.authenticatedClient) {
      const success = await this.authenticate();
      if (!success) throw new Error('Не удалось авторизоваться в панели');
    }

    try {
      const response = await this.authenticatedClient.post(`/panel/api/inbounds/${inboundId}/delClient/${clientUuid}`);
      return response.data.success;
    } catch (error) {
      console.error(`❌ [XUI] Ошибка удаления клиента ${clientUuid}:`, error.message);
      return false;
    }
  }

  async createClient(tgId) {
    if (!this.authenticatedClient) {
        const success = await this.authenticate();
        if (!success) throw new Error('Не удалось авторизоваться в панели');
    }

    const cleanTgId = (typeof tgId === 'object' && tgId !== null) 
        ? (tgId.tg_id || tgId.id || tgId.toString()) 
        : tgId;

    const uuid = crypto.randomUUID();
    const subId = this.generateSubId(); 
    const email = `user_${cleanTgId}_${Date.now()}`;
    const expiryTimeMs = Date.now() + (72 * 60 * 60 * 1000);

    const clientPayload = {
      id: uuid,
      email: email,
      limitIp: 2,
      totalGB: 0,
      expiryTime: expiryTimeMs,
      enable: true,
      tgId: cleanTgId.toString(),
      subId: subId,
      flow: "",
    };

    try {
      const inboundId = 2; 

      await this.authenticatedClient.post('/panel/api/inbounds/addClient', {
        id: inboundId,
        settings: JSON.stringify({
          clients: [clientPayload]
        })
      });

      const publicUrl = `${this.publicDomain}/sub/${subId}`;
      console.log(`✅ Клиент создан: ${email}`);

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
          this.authenticatedClient = null;
          return this.createClient(tgId);
      }
      throw error;
    }
  }
}

export default new XuiService();
