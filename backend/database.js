import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER UNIQUE NOT NULL,
    uuid TEXT UNIQUE,
    username TEXT,
    first_name TEXT,
    balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vpn_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    uuid TEXT NOT NULL UNIQUE,
    email TEXT,
    xui_client_id TEXT,
    inbound_id INTEGER, -- Вот это поле нам нужно заполнить
    status TEXT DEFAULT 'active',
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
`);

const database = {
  getOrCreateUser: ({ tg_id, username, first_name }) => {
    let user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id);
    if (!user) {
      const stmt = db.prepare('INSERT INTO users (tg_id, username, first_name) VALUES (?, ?, ?)');
      stmt.run(tg_id, username || '', first_name || '');
      user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id);
    } else {
      const stmt = db.prepare('UPDATE users SET username = ?, first_name = ?, updated_at = CURRENT_TIMESTAMP WHERE tg_id = ?');
      stmt.run(username || '', first_name || '', tg_id);
    }
    return user;
  },

  getUserByTgId: (tg_id) => db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id),

  getActiveVpnClientByUserId: (user_id) => {
    return db.prepare("SELECT * FROM vpn_clients WHERE user_id = ? AND status = 'active'").get(user_id);
  },

  // ИСПРАВИЛИ ЭТОТ МЕТОД: теперь он принимает inbound_id
  createVpnClient: ({ user_id, uuid, email, status, config_url, inbound_id }) => {
    const stmt = db.prepare(`
      INSERT INTO vpn_clients (user_id, uuid, email, status, config_url, inbound_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    // Передаем inbound_id в запрос
    const info = stmt.run(user_id, uuid, email, status || 'active', config_url, inbound_id || 0);
    
    return db.prepare('SELECT * FROM vpn_clients WHERE id = ?').get(info.lastInsertRowid);
  },

  getUserSubscription: (tg_id) => {
    const user = db.prepare('SELECT id FROM users WHERE tg_id = ?').get(tg_id);
    if (!user) return null;
    return db.prepare('SELECT * FROM vpn_clients WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(user.id);
  },
  
  close: () => db.close()
};

export default database;
