import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import axios from 'axios';
import Database from 'better-sqlite3';
import { validate } from '@telegram-apps/init-data-node';
import dbManager from './db.js';
import { authMiddleware } from './middleware/authMiddleware.js';

// Инициализация сервисов
let xuiService = null;

// Функция для динамического импорта и инициализации XUI сервиса
async function initializeXuiService() {
  try {
    const { default: XuiServiceClass } = await import('./services/xuiService.js');
    return new XuiServiceClass();
  } catch (error) {
    console.warn('XUI сервис недоступен:', error.message);
    return null;
  }
}

// Инициализация Express приложения
const app = express();
const port = process.env.PORT || 3000;

// Инициализация базы данных
const db = new Database('database.db');
db.pragma('journal_mode = WAL');

// Настройка безопасности
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Конфигурация CORS для Telegram Mini Apps
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://web.telegram.org',
      'https://telegram.org',
      'https://t.me',
      'https://*.t.me',
      'https://miniapp.telegram.org',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern.startsWith('https://*.')) {
        const domain = pattern.substring(9);
        return origin.endsWith('.' + domain) || origin === 'https://' + domain;
      } else {
        return origin === pattern || (pattern.includes('*') && new RegExp(`^${pattern.replace(/\*/g, '.*')}$`).test(origin));
      }
    });
    
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
    'Authorization', 'X-Total-Count', 'X-Api-Key', 'X-Telegram-InitData'
  ]
}));

// Инициализация Telegram бота
const botToken = process.env.BOT_TOKEN;
let bot = null;

if (!botToken) {
  console.warn('BOT_TOKEN не установлен в .env файле. Функционал бота отключен.');
} else {
  bot = new Telegraf(botToken);

  // Команды бота
  bot.command('start', (ctx) => {
    ctx.reply('Добро пожаловать в VPN Subscription Service! Используйте /help для просмотра команд.');
  });

  bot.command('help', (ctx) => {
    ctx.reply('Доступные команды:\n/start - Запустить бота\n/help - Показать это сообщение\n/status - Проверить статус подписки\n/health - Проверить работоспособность сервера');
  });

  bot.command('status', (ctx) => {
    ctx.reply('Проверка вашей подписки...');
    // Здесь будет логика проверки через базу данных
    ctx.reply('Ваша VPN подписка активна!');
  });

  bot.command('health', (ctx) => {
    ctx.reply('Сервер работает в штатном режиме (ESM Mode).');
  });

  // Webhook callback для обновлений бота
  app.post(`/bot${botToken}`, (req, res) => {
    bot.handleUpdate(req.body, res);
  });
}

/**
 * Валидация данных инициализации Telegram
 * @param {string} initData - Строка данных инициализации
 */
function validateTelegramInitData(initData) {
  if (!botToken) return false;
  try {
    validate(initData, botToken);
    return true;
  } catch (e) {
    console.error('Ошибка валидации initData:', e.message);
    return false;
  }
}

// API Роуты
app.post('/api/subscribe', async (req, res) => {
  try {
    const { user_id, username } = req.body;
    
    const initData = req.headers['x-telegram-initdata'];
    if (initData) {
      const isValid = validateTelegramInitData(decodeURIComponent(initData));
      if (!isValid) {
        return res.status(400).json({
          message: 'Неверные данные инициализации Telegram'
        });
      }
    }
    
    // Эмуляция подписки
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.status(200).json({
      message: `Пользователь ${username || user_id} успешно подписан на VPN сервис!`,
      user_id,
      subscription_status: 'active',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ошибка подписки:', error);
    res.status(500).json({
      message: 'Внутренняя ошибка сервера при оформлении подписки'
    });
  }
});

// Эндпоинт проверки здоровья
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', mode: 'ESM', timestamp: new Date().toISOString() });
});

// Эндпоинт статуса бота
app.get('/bot-status', (req, res) => {
  if (botToken) {
    res.status(200).json({
      status: 'ACTIVE',
      message: 'Бот сконфигурирован и запущен',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(200).json({
      status: 'WARNING',
      message: 'Токен бота не настроен',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/user/me — возвращает данные профиля и статус подписки
app.get('/api/user/me', authMiddleware, (req, res) => {
  try {
    // Получаем данные пользователя из базы данных
    const user = dbManager.getUserById(req.user.tg_id);
    
    if (!user) {
      return res.status(404).json({
        message: 'Пользователь не найден'
      });
    }

    // Получаем информацию о подписке
    const subscription = dbManager.getUserSubscription(user.tg_id);

    // Возвращаем данные пользователя с информацией о подписке
    res.status(200).json({
      user: {
        id: user.tg_id,
        username: user.username,
        first_name: user.first_name,
        balance: user.balance,
        created_at: user.created_at
      },
      subscription: subscription || {
        status: 'expired',
        expires_at: null,
        vpn_config_url: null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ошибка получения данных пользователя:', error);
    res.status(500).json({
      message: 'Внутренняя ошибка сервера при получении данных пользователя'
    });
  }
});

// POST /api/subscription/activate — логика покупки: проверка баланса -> запрос к 3X-UI -> сохранение ключа в БД -> возврат конфига
app.post('/api/subscription/activate', authMiddleware, async (req, res) => {
  try {
    const { price = 100 } = req.body; // по умолчанию цена 100 единиц
    
    // Получаем данные пользователя из базы данных
    const user = dbManager.getUserById(req.user.tg_id);
    
    if (!user) {
      return res.status(404).json({
        message: 'Пользователь не найден'
      });
    }

    // Проверяем баланс пользователя
    if (user.balance < price) {
      return res.status(400).json({
        message: 'Недостаточно средств для активации подписки',
        current_balance: user.balance,
        required_amount: price
      });
    }

    // Обновляем баланс пользователя (списание средств)
    const updateUserStmt = dbManager.db.prepare(
      'UPDATE users SET balance = balance - ? WHERE tg_id = ?'
    );
    updateUserStmt.run(price, user.tg_id);

    // Обновляем данные пользователя
    const updatedUser = dbManager.getUserById(user.tg_id);

    try {
      // Асинхронно инициализируем XUI сервис, если он еще не инициализирован
      if (!xuiService) {
        xuiService = await initializeXuiService();
      }

      // Проверяем, доступен ли XUI сервис
      if (!xuiService) {
        // Если XUI сервис недоступен, создаем только запись в базе данных с mock данными
        const uuid = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
        
        // Сохраняем информацию о подписке в базе данных
        const insertSubscriptionStmt = dbManager.db.prepare(`
          INSERT INTO subscriptions (user_id, status, expires_at, vpn_key_id, vpn_config_url)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Пример: 30 дней
        insertSubscriptionStmt.run(
          user.tg_id,
          'active',
          expiresAt,
          uuid, // сохраняем UUID как vpn_key_id
          null // нет конфигурации без XUI сервиса
        );

        // Возвращаем успешный ответ с информацией о подписке
        res.status(200).json({
          message: 'Подписка успешно активирована',
          user: {
            id: updatedUser.tg_id,
            username: updatedUser.username,
            first_name: updatedUser.first_name,
            balance: updatedUser.balance
          },
          subscription: {
            status: 'active',
            expires_at: expiresAt,
            vpn_key_id: uuid,
            vpn_config_url: null
          },
          timestamp: new Date().toISOString(),
          warning: 'XUI сервис недоступен - подписка создана в локальной базе, но не в VPN провайдере'
        });
        return;
      }

      // Создаем уникальный email для клиента в формате: tg_username_timestamp
      const clientEmail = `${user.username || 'user'}_${Date.now()}@vpn.example`;
      
      // Генерируем UUID для клиента
      const uuid = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
      
      // Подготавливаем данные для создания клиента в 3X-UI
      // Используем произвольный inbound ID для демонстрации (в реальной системе нужно использовать реальный inbound ID)
      const inboundId = process.env.XUI_INBOUND_ID || 1; // по умолчанию используем первый inbound
      
      const clientData = {
        email: clientEmail,
        uuid: uuid,
        flow: '', // можно задать определенный flow если требуется
        upload: 0,
        download: 0,
        total: 0, // можно задать лимит трафика если требуется
        expiryTime: 0 // можно задать дату истечения подписки в миллисекундах
      };

      // Создаем клиента в 3X-UI
      const createdClient = await xuiService.createClient(clientData, parseInt(inboundId));

      // Получаем конфигурацию для клиента
      const configs = await xuiService.getClientConfigs();
      const userConfig = configs.find(config => config.includes(clientEmail));
      
      // Сохраняем информацию о подписке в базе данных
      const insertSubscriptionStmt = dbManager.db.prepare(`
        INSERT INTO subscriptions (user_id, status, expires_at, vpn_key_id, vpn_config_url)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Пример: 30 дней
      insertSubscriptionStmt.run(
        user.tg_id,
        'active',
        expiresAt,
        uuid, // сохраняем UUID как vpn_key_id
        userConfig || null // сохраняем конфигурацию если удалось получить
      );

      // Возвращаем успешный ответ с конфигурацией и информацией о подписке
      res.status(200).json({
        message: 'Подписка успешно активирована',
        user: {
          id: updatedUser.tg_id,
          username: updatedUser.username,
          first_name: updatedUser.first_name,
          balance: updatedUser.balance
        },
        subscription: {
          status: 'active',
          expires_at: expiresAt,
          vpn_key_id: uuid,
          vpn_config_url: userConfig
        },
        timestamp: new Date().toISOString()
      });
    } catch (xuiError) {
      console.error('Ошибка при работе с 3X-UI:', xuiError);
      
      // В случае ошибки при работе с 3X-UI, возвращаем средства пользователю
      const refundStmt = dbManager.db.prepare(
        'UPDATE users SET balance = balance + ? WHERE tg_id = ?'
      );
      refundStmt.run(price, user.tg_id);
      
      return res.status(500).json({
        message: 'Ошибка при активации подписки в VPN сервисе',
        error: xuiError.message
      });
    }
  } catch (error) {
    console.error('Ошибка активации подписки:', error);
    res.status(500).json({
      message: 'Внутренняя ошибка сервера при активации подписки'
    });
  }
});

/**
 * Вспомогательная функция для генерации UUID если не доступна crypto.randomUUID
 * @returns {string} Сгенерированный UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Запуск сервера
app.listen(port, () => {
  console.log(`VPN Subscription API сервер запущен на порту ${port} (ESM Mode)`);
  
  if (bot && botToken) {
    bot.launch()
      .then(() => {
        console.log('Telegram бот успешно запущен');
      })
      .catch((error) => {
        console.error('Ошибка запуска бота:', error.message);
      });
  } else {
    console.log('Telegram бот не сконфигурирован (отсутствует BOT_TOKEN)');
  }
});

// Корректное завершение работы
process.once('SIGINT', () => {
  if (bot) bot.stop('SIGINT');
  db.close();
  console.log('Получен SIGINT, бот остановлен, сервер закрыт.');
  process.exit(0);
});

process.once('SIGTERM', () => {
  if (bot) bot.stop('SIGTERM');
  db.close();
  console.log('Получен SIGTERM, бот остановлен, сервер закрыт.');
  process.exit(0);
});
