import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { validate } from '@telegram-apps/init-data-node';
import { v4 as uuidv4 } from 'uuid';

// ИМПОРТИРУЕМ ТОЛЬКО НОВЫЙ МОДУЛЬ БД
import database from './database.js';
import { authMiddleware } from './middleware/authMiddleware.js';

// Инициализация сервисов
let xuiService = null;

async function initializeXuiService() {
  try {
    const { default: XuiServiceClass } = await import('./services/xuiService.js');
    return new XuiServiceClass();
  } catch (error) {
    console.warn('XUI сервис недоступен:', error.message);
    return null;
  }
}

const app = express();
const port = process.env.PORT || 3000;

// Настройка безопасности
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Конфигурация CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'https://web.telegram.org', 'https://telegram.org', 'https://t.me',
      'https://*.t.me', 'https://miniapp.telegram.org',
      'http://localhost:3000', 'http://127.0.0.1:3000'
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
  credentials: true
}));

// Инициализация Telegram бота
const botToken = process.env.BOT_TOKEN;
let bot = null;

if (botToken) {
  bot = new Telegraf(botToken);
  bot.command('start', (ctx) => ctx.reply('Добро пожаловать в VPN Service!'));
  
  app.post(`/bot${botToken}`, (req, res) => {
    bot.handleUpdate(req.body, res);
  });
}

// === API Routes ===

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', mode: 'ESM', timestamp: new Date().toISOString() });
});

// GET /api/user/me
app.get('/api/user/me', authMiddleware, (req, res) => {
  try {
    // Используем правильный метод из database.js
    const user = database.getUserByTgId(req.user.tg_id);
    
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const subscription = database.getUserSubscription(user.tg_id);

    res.status(200).json({
      user: {
        id: user.tg_id,
        username: user.username,
        first_name: user.first_name,
        balance: user.balance,
        created_at: user.created_at
      },
      subscription: subscription || { status: 'expired', expires_at: null, vpn_config_url: null }
    });
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// GET /api/vpn/key (ГЛАВНЫЙ ЭНДПОИНТ)
app.get('/api/vpn/key', authMiddleware, async (req, res) => {
  try {
    const { tg_id } = req.user;
    if (!tg_id) return res.status(400).json({ message: 'No TG ID' });

    // 1. Получаем или создаем юзера
    let user = database.getUserByTgId(tg_id);
    if (!user) {
      user = database.upsertUser({
        tg_id,
        username: req.user.username || '',
        first_name: req.user.first_name || ''
      });
    }

    // 2. Проверяем, есть ли уже ключ
    const activeClient = database.getActiveVpnClientByUserId(user.id);
    if (activeClient) {
      return res.status(200).json({
        message: 'VPN ключ уже существует',
        status: 'existing',
        vpn_client: activeClient
      });
    }

    // 3. Если ключа нет — пытаемся создать через XUI
    if (!xuiService) xuiService = await initializeXuiService();

    // Генерируем UUID
    const clientUuid = uuidv4();
    const clientEmail = `tg_${user.tg_id}_${Date.now()}@vpn.service`;
    
    // Формируем ссылку подписки
    // ВАЖНО: Берем настройки из ENV, которые мы добавляли ранее
    const subDomain = process.env.SUB_DOMAIN || 'jsstudy.xyz';
    const subPort = process.env.SUB_PORT || '2096';
    const subPath = process.env.SUB_PATH || '/sub/';
    const subProtocol = process.env.SUB_PROTOCOL || 'https';
    
    // Итоговая ссылка: https://jsstudy.xyz:2096/sub/UUID
    const finalConfigUrl = `${subProtocol}://${subDomain}:${subPort}${subPath}${clientUuid}`;

    if (xuiService) {
      try {
        const inboundId = process.env.XUI_INBOUND_ID || 1;
        await xuiService.createClient({
          email: clientEmail,
          uuid: clientUuid,
          enable: true
        }, parseInt(inboundId));
        
        console.log(`✅ Клиент создан в панели: ${clientUuid}`);
      } catch (e) {
        console.error('⚠️ Ошибка XUI, создаем локально:', e.message);
      }
    }

    // 4. Сохраняем в базу
    const vpnClient = database.createVpnClient({
      user_id: user.id,
      uuid: clientUuid,
      email: clientEmail,
      status: 'active',
      config_url: finalConfigUrl // Сохраняем правильную HTTPS ссылку
    });

    return res.status(200).json({
      message: 'VPN ключ успешно создан',
      status: 'created',
      vpn_client: vpnClient,
      config_url: finalConfigUrl
    });

  } catch (error) {
    console.error('Ошибка /api/vpn/key:', error);
    res.status(500).json({ message: 'Internal Error', error: error.message });
  }
});

// Запуск
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  if (bot && botToken) bot.launch();
});

// Graceful stop
process.once('SIGINT', () => { if (bot) bot.stop('SIGINT'); database.close(); process.exit(0); });
process.once('SIGTERM', () => { if (bot) bot.stop('SIGTERM'); database.close(); process.exit(0); });
