import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущему файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Класс для работы с базой данных SQLite
 */
class DatabaseManager {
  /**
   * Конструктор класса DatabaseManager
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
    // Создаем таблицу пользователей
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        tg_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        balance REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем таблицу подписок
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'expired' CHECK(status IN ('active', 'expired')),
        expires_at TEXT,
        vpn_key_id TEXT,
        vpn_config_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создаем индекс для улучшения производительности поиска пользователей
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id)
    `);

    // Создаем индекс для улучшения производительности поиска подписок по user_id
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)
    `);
  }

  /**
   * Метод для регистрации или обновления информации о пользователе
   * @param {Object} userData - Данные пользователя
   * @param {number} userData.tg_id - Telegram ID пользователя
   * @param {string} userData.username - Имя пользователя в Telegram
   * @param {string} userData.first_name - Имя пользователя
   * @returns {Object} Объект с информацией о пользователе
   */
  upsertUser({ tg_id, username, first_name }) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO users (tg_id, username, first_name, balance, created_at)
      VALUES (?, ?, ?, COALESCE((SELECT balance FROM users WHERE tg_id = ?), 0), 
             COALESCE((SELECT created_at FROM users WHERE tg_id = ?), CURRENT_TIMESTAMP))
    `);

    stmt.run(tg_id, username, first_name, tg_id, tg_id);

    // Возвращаем обновленную информацию о пользователе
    return this.getUserById(tg_id);
  }

  /**
   * Получить пользователя по его Telegram ID
   * @param {number} tgId - Telegram ID пользователя
   * @returns {Object|null} Объект пользователя или null если не найден
   */
  getUserById(tgId) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE tg_id = ?');
    return stmt.get(tgId) || null;
  }

  /**
   * Получить подписку пользователя по его Telegram ID
   * @param {number} userId - ID пользователя
   * @returns {Object|null} Объект подписки или null если не найдена
   */
  getUserSubscription(userId) {
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1');
    return stmt.get(userId) || null;
  }

  /**
   * Закрыть соединение с базой данных
   */
  close() {
    this.db.close();
  }
}

// Экспортируем экземпляр класса
export default new DatabaseManager();