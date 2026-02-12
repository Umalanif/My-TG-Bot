import { validate } from '@telegram-apps/init-data-node';
import database from '../database.js';

/**
 * Middleware для проверки аутентификации пользователя Telegram
 */
export const authMiddleware = (req, res, next) => {
  try {
    // Извлекаем initData из заголовка
    const initData = req.headers['x-telegram-initdata'];

    // Если заголовок отсутствует, возвращаем ошибку 401
    if (!initData) {
      return res.status(401).json({
        error: 'Unauthorized: Missing init data header'
      });
    }

    // Получаем токен
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      console.error('BOT_TOKEN is missing in env');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Проверяем подлинность initData
    // ВАЖНО: validate выбрасывает ошибку, если данные неверны, поэтому оборачиваем в try/catch или проверяем результат
    try {
        validate(initData, botToken, { expiresIn: 3600 });
    } catch (e) {
        return res.status(401).json({ error: 'Unauthorized: Invalid init data signature' });
    }

    // Парсим данные пользователя вручную из строки
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');

    if (!userParam) {
      return res.status(401).json({
        error: 'Unauthorized: User data not found in init data'
      });
    }

    const userData = JSON.parse(decodeURIComponent(userParam));
    const tgId = userData.id;

    // 1. Пытаемся найти пользователя в нашей БД
    // Используем правильный метод из нового database.js
    const dbUser = database.getUserByTgId(tgId);

    if (dbUser) {
      // Если пользователь есть в базе — прикрепляем его полные данные
      req.user = dbUser;
    } else {
      // 2. Если пользователя НЕТ в базе (он новый)
      // Мы НЕ должны блокировать его ошибкой 401.
      // Мы передаем данные из Telegram, чтобы контроллер (index.js) мог его создать.
      req.user = {
        tg_id: tgId,
        username: userData.username,
        first_name: userData.first_name,
        is_new: true // Флаг, что это новичок
      };
    }

    // Переходим к следующему обработчику
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Unauthorized: Authentication failed',
      details: error.message
    });
  }
};
