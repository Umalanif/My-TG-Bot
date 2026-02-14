import { validate } from '@telegram-apps/init-data-node';
import database from '../database.js';

export const authMiddleware = (req, res, next) => {
  try {
    // Проверяем оба варианта заголовков
    const initData = req.headers['x-telegram-initdata'] || req.headers['authorization']?.replace('tma ', '');

    // DEBUG: Выведет в pm2 logs все заголовки, чтобы мы поняли, что доходит
    console.log('--- DEBUG HEADERS ---');
    console.log('X-Telegram-InitData:', req.headers['x-telegram-initdata']);
    console.log('Authorization:', req.headers['authorization']);

    if (!initData) {
      return res.status(401).json({ error: 'Unauthorized: Missing init data header' });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Server configuration error: BOT_TOKEN missing' });
    }

    try {
      validate(initData, botToken, { expiresIn: 3600 });
    } catch (e) {
      console.error('❌ Ошибка валидации:', e.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
    }

    const params = new URLSearchParams(initData);
    const userData = JSON.parse(decodeURIComponent(params.get('user')));
    
    // Прикрепляем пользователя к запросу
    req.user = database.getUserByTgId(userData.id) || {
      tg_id: userData.id,
      username: userData.username,
      first_name: userData.first_name,
      is_new: true
    };

    next();
  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(401).json({ error: 'Auth failed' });
  }
};
