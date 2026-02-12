import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Получаем путь к текущему файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Модуль для управления базой данных пользователей и клиентов VPN
 */
class DatabaseModule {
  /**
   * Конструктор класса DatabaseModule
   * @param {string} dbPath - Путь к файлу базы данных
   */
  constructor(dbPath = path.join(__dirname, 'database.sqlite')) {
    // Создаем соединение с базой данных
    this.db = new Database(dbPath);
    
    // Включаем WAL режим для лучшей конкурентности
    this.db.pragma('journal_mode = WAL');
    
    // Создаем таблицы при инициализации
    this.initTables();
  }
  
  /**
   * Инициализация таблиц в базе данных
   */
  initTables() {
    // Создаем таблицу пользователей (расширенная версия)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_id INTEGER UNIQUE NOT NULL,
        uuid TEXT UNIQUE,
        username TEXT,
        first_name TEXT,
        balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создаем таблицу клиентов VPN
    this.db.exec(`
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
      )
    `);
    
    // Создаем таблицу подписок (для обратной совместимости)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'expired' CHECK(status IN ('active', 'expired')),
        expires_at TEXT,
        vpn_key_id TEXT,
        vpn_config_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    
    // Создаем индексы для улучшения производительности
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_vpn_clients_user_id ON vpn_clients(user_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_vpn_clients_uuid ON vpn_clients(uuid)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
  }
  
  /**
   * Получить пользователя по Telegram ID
   * @param {number} tgId - Telegram ID пользователя
   * @returns {Object|null} Объект пользователя или null если не найден
   */
  getUserByTgId(tgId) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE tg_id = ?');
    return stmt.get(tgId) || null;
  }
  
  /**
   * Получить пользователя по UUID
   * @param {string} uuid - UUID пользователя
   * @returns {Object|null} Объект пользователя или null если не найден
   */
  getUserByUuid(uuid) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE uuid = ?');
    return stmt.get(uuid) || null;
  }
  
  /**
   * Создать или обновить пользователя
   * @param {Object} userData - Данные пользователя
   * @param {number} userData.tg_id - Telegram ID пользователя
   * @param {string} userData.username - Имя пользователя в Telegram
   * @param {string} userData.first_name - Имя пользователя
   * @returns {Object} Объект созданного/обновленного пользователя
   */
  upsertUser({ tg_id, username, first_name }) {
    // Проверяем, существует ли пользователь
    const existingUser = this.getUserByTgId(tg_id);
    
    if (existingUser) {
      // Обновляем существующего пользователя
      const stmt = this.db.prepare(`
        UPDATE users 
        SET username = ?, first_name = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE tg_id = ?
      `);
      stmt.run(username, first_name, tg_id);
      return this.getUserByTgId(tg_id);
    } else {
      // Создаем нового пользователя с UUID
      const uuid = uuidv4();
      const stmt = this.db.prepare(`
        INSERT INTO users (tg_id, uuid, username, first_name, balance, created_at)
        VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `);
      stmt.run(tg_id, uuid, username, first_name);
      return this.getUserByTgId(tg_id);
    }
  }
  
  /**
   * Получить клиент VPN по UUID
   * @param {string} uuid - UUID клиента
   * @returns {Object|null} Объект клиента или null если не найден
   */
  getVpnClientByUuid(uuid) {
    const stmt = this.db.prepare('SELECT * FROM vpn_clients WHERE uuid = ?');
    return stmt.get(uuid) || null;
  }
  
  /**
   * Получить клиентов VPN по user_id
   * @param {number} userId - ID пользователя
   * @returns {Array} Массив клиентов VPN
   */
  getVpnClientsByUserId(userId) {
    const stmt = this.db.prepare('SELECT * FROM vpn_clients WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  }
  
  /**
   * Получить активный клиент VPN по user_id
   * @param {number} userId - ID пользователя
   * @returns {Object|null} Активный клиент VPN или null
   */
  getActiveVpnClientByUserId(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM vpn_clients 
      WHERE user_id = ? AND status = 'active' 
      ORDER BY created_at DESC LIMIT 1
    `);
    return stmt.get(userId) || null;
  }
  
  /**
   * Создать клиент VPN
   * @param {Object} clientData - Данные клиента
   * @param {number} clientData.user_id - ID пользователя
   * @param {string} clientData.uuid - UUID клиента
   * @param {string} [clientData.email] - Email клиента
   * @param {string} [clientData.xui_client_id] - ID клиента в 3X-UI
   * @param {number} [clientData.inbound_id] - ID inbound соединения
   * @param {string} [clientData.status] - Статус клиента
   * @param {number} [clientData.total_traffic] - Общий трафик
   * @param {string} [clientData.config_url] - URL конфигурации
   * @returns {Object} Объект созданного клиента
   */
  createVpnClient(clientData) {
    const {
      user_id,
      uuid,
      email = '',
      xui_client_id = '',
      inbound_id = 1,
      status = 'active',
      total_traffic = 0,
      config_url = ''
    } = clientData;
    
    const stmt = this.db.prepare(`
      INSERT INTO vpn_clients (
        user_id, uuid, email, xui_client_id, inbound_id, 
        status, total_traffic, config_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      user_id, uuid, email, xui_client_id, inbound_id,
      status, total_traffic, config_url
    );
    
    return this.getVpnClientByUuid(uuid);
  }
  
  /**
   * Обновить конфигурацию клиента VPN
   * @param {string} uuid - UUID клиента
   * @param {string} configUrl - URL конфигурации
   * @returns {boolean} Успешность операции
   */
  updateVpnClientConfig(uuid, configUrl) {
    try {
      const stmt = this.db.prepare(`
        UPDATE vpn_clients 
        SET config_url = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE uuid = ?
      `);
      stmt.run(configUrl, uuid);
      return true;
    } catch (error) {
      console.error('Ошибка обновления конфигурации клиента:', error);
      return false;
    }
  }
  
  /**
   * Обновить статус клиента VPN
   * @param {string} uuid - UUID клиента
   * @param {string} status - Новый статус
   * @returns {boolean} Успешность операции
   */
  updateVpnClientStatus(uuid, status) {
    try {
      const stmt = this.db.prepare(`
        UPDATE vpn_clients 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE uuid = ?
      `);
      stmt.run(status, uuid);
      return true;
    } catch (error) {
      console.error('Ошибка обновления статуса клиента:', error);
      return false;
    }
  }
  
  /**
   * Удалить клиента VPN
   * @param {string} uuid - UUID клиента
   * @returns {boolean} Успешность операции
   */
  deleteVpnClient(uuid) {
    try {
      const stmt = this.db.prepare('DELETE FROM vpn_clients WHERE uuid = ?');
      stmt.run(uuid);
      return true;
    } catch (error) {
      console.error('Ошибка удаления клиента:', error);
      return false;
    }
  }
  
  /**
   * Получить подписку пользователя (для обратной совместимости)
   * @param {number} userId - ID пользователя
   * @returns {Object|null} Объект подписки или null
   */
  getUserSubscription(userId) {
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1');
    return stmt.get(userId) || null;
  }
  
  /**
   * Создать подписку (для обратной совместимости)
   * @param {Object} subscriptionData - Данные подписки
   * @returns {Object} Объект созданной подписки
   */
  createSubscription(subscriptionData) {
    const { user_id, status = 'active', expires_at, vpn_key_id, vpn_config_url } = subscriptionData;
    
    const stmt = this.db.prepare(`
      INSERT INTO subscriptions (user_id, status, expires_at, vpn_key_id, vpn_config_url, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(user_id, status, expires_at, vpn_key_id, vpn_config_url);
    
    const idStmt = this.db.prepare('SELECT last_insert_rowid() as id');
    const { id } = idStmt.get();
    
    return this.db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
  }
  
  /**
   * Закрыть соединение с базой данных
   */
  close() {
    this.db.close();
  }
}

// Экспортируем экземпляр класса
export default new DatabaseModule();