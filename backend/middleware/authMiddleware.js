import { validate } from '@telegram-apps/init-data-node';
import dbManager from '../db.js';

/**
 * Middleware для проверки аутентификации пользователя Telegram
 * Извлекает initData из заголовка x-telegram-initdata, валидирует её
 * и прикрепляет данные пользователя к req.user
 * @param {Object} req - Объект запроса
 * @param {Object} res - Объект ответа
 * @param {Function} next - Функция перехода к следующему middleware
 * @returns {void}
 */
export const authMiddleware = (req, res, next) => {
  try {
    // Извлекаем initData из заголовка x-telegram-initdata
    const initData = req.headers['x-telegram-initdata'];
    
    // Если заголовок отсутствует, возвращаем ошибку 401
    if (!initData) {
      return res.status(401).json({
        error: 'Unauthorized: Missing init data header'
      });
    }

    // Валидируем initData с использованием BOT_TOKEN из переменных окружения
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('BOT_TOKEN is not defined in environment variables');
    }

    // Проверяем подлинность initData
    const isValid = validate(initData, botToken, { expiresIn: 3600 }); // Действителен в течение 1 часа
    
    if (!isValid) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid init data'
      });
    }

    // Парсим initData, чтобы получить данные пользователя
    // Извлекаем параметры из строки инициализации
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    
    if (!userParam) {
      return res.status(401).json({
        error: 'Unauthorized: User data not found in init data'
      });
    }

    // Декодируем JSON с данными пользователя
    const userData = JSON.parse(decodeURIComponent(userParam));
    const tgId = parseInt(userData.id);

    // Получаем данные пользователя из базы данных
    const user = dbManager.getUserById(tgId);
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: User not found in database'
      });
    }

    // Прикрепляем данные пользователя к объекту запроса
    req.user = user;

    // Переходим к следующему middleware
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({
      error: 'Unauthorized: Authentication failed',
      details: error.message
    });
  }
};