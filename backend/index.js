import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { Telegraf, Markup } from 'telegraf';
import database from './database.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import xuiService from './services/xuiService.js';

const app = express();
const port = process.env.PORT || 3000;
const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL;

// Вспомогательная функция для отрисовки главного меню (чтобы работала кнопка "Назад")
async function sendOrEditMainMenu(ctx, isEdit = false) {
  const tg_id = ctx.from.id;
  const first_name = ctx.from.first_name || 'друг';

  const subscription = database.getUserSubscription(tg_id);
  let subStatus = "ОТСУТСТВУЕТ";
  let expiryDate = "--.--.----";

  if (subscription) {
    subStatus = subscription.status === 'active' ? 'АКТИВНА ✅' : 'ИСТЕКЛА ❌';
    expiryDate = subscription.expiry_time
      ? new Date(subscription.expiry_time).toLocaleDateString()
      : new Date(subscription.created_at).toLocaleDateString();
  }

  const welcomeMessage = `
👋 <b>Привет, ${first_name}!</b>

<b>Nexus-VPN — Твой личный доступ в Интернет.</b>
Доступные сервера: 🇷🇺 🇺🇸 🇨🇦 🇩🇪 🇫🇮

⌛️ <b>Ваша подписка:</b> <code>${subStatus}</code> (до ${expiryDate})

<i>Используйте кнопки ниже 👇</i>
  `;

  // 1. Убрали кнопку "Сбросить трафик"
  // 2. Изменили кнопку "Продлить" на callback
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.webApp('🔌 Подключиться', MINI_APP_URL)],
    [Markup.button.callback('💳 Продлить', 'renew_sub')], 
    [
      Markup.button.callback('🎁 Бонусы', 'bonuses'),
      Markup.button.url('💬 Поддержка', 'https://t.me/nexus_vpn_support')
    ],
    [Markup.button.callback('ℹ️ О нас', 'about')],
    [Markup.button.url('📢 Наш канал', 'https://t.me/your_channel_link')]
  ]);

  if (isEdit) {
    await ctx.editMessageText(welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    });
  } else {
    await ctx.replyWithHTML(welcomeMessage, keyboard);
  }
}

// --- ЛОГИКА ТЕЛЕГРАМ-БОТА ---

// 1. Команда /start
bot.start(async (ctx) => {
  try {
    const { id: tg_id, username, first_name } = ctx.from;
    const startPayload = ctx.startPayload;

    const existingUser = database.getUserByTgId(tg_id);
    const isNewUser = !existingUser;

    database.getOrCreateUser({
      tg_id,
      username: username || '',
      first_name: first_name || ''
    });

    // Реферальная привязка
    if (isNewUser && startPayload) {
      const referrerId = parseInt(startPayload);
      if (referrerId !== tg_id) {
        const referrer = database.getUserByTgId(referrerId);
        if (referrer) {
          database.setReferrer(tg_id, referrerId);
          try {
            await bot.telegram.sendMessage(referrerId, `🎁 По вашей ссылке присоединился <b>${first_name}</b>!`, { parse_mode: 'HTML' });
          } catch (e) { console.error('Ошибка уведомления реферера'); }
        }
      }
    }

    // Вызываем отрисовку главного меню (новое сообщение)
    await sendOrEditMainMenu(ctx, false);
  } catch (err) {
    console.error('Bot Start Error:', err);
  }
});

// 2. Обработка кнопки "💳 Продлить" (Открываем подменю оплаты)
bot.action('renew_sub', async (ctx) => {
  try {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('QR СБП / Crypto', 'pay_crypto_sbp')],
      [Markup.button.callback('🔙 Назад', 'back_to_main')]
    ]);

    await ctx.editMessageText('💳 <b>Выберите способ оплаты:</b>', {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    });
  } catch (err) {
    console.error('Renew action error:', err);
  }
});

// Кнопка оплаты (пока просто заглушка)
bot.action('pay_crypto_sbp', async (ctx) => {
  await ctx.answerCbQuery('Переход к оплате... 🛠');
  // Тут можно добавить логику выдачи реквизитов или ссылки на оплату
});

// Кнопка Назад из меню оплаты и "О нас"
bot.action('back_to_main', async (ctx) => {
  try {
    await sendOrEditMainMenu(ctx, true); // true = редактируем текущее сообщение
  } catch (err) {
    console.error('Back action error:', err);
  }
});

// 3. Обработка кнопки "🎁 Бонусы"
bot.action('bonuses', async (ctx) => {
  try {
    const tg_id = ctx.from.id;
    const stats = database.getReferralStats(tg_id);
    const user = database.getUserByTgId(tg_id);

    const refLink = `https://t.me/${ctx.botInfo.username}?start=${tg_id}`;

    const message = `
🎁 <b>Ваша партнерская программа</b>

👤 Вы пригласили: <b>${stats.count}</b> чел.
💰 Баланс бонусов: <b>${user.balance || 0}</b> ₽

🔗 <b>Ваша реферальная ссылка:</b>
<code>${refLink}</code>

<i>Отправьте эту ссылку другу. Вы получите 20% от его первой покупки!</i>
    `;

    await ctx.answerCbQuery();
    await ctx.replyWithHTML(message);
  } catch (err) {
    console.error('Bonuses action error:', err);
  }
});

// Обработка кнопки "ℹ️ О нас"
bot.action('about', async (ctx) => {
  try {
    const aboutMessage = `
<blockquote><b>👥 Кто мы:</b>
• Команда системных администраторов и инженеров
• Создали Nexus-VPN для надежного доступа в сеть
• Делаем сервис «как для себя» — без логов и ограничений</blockquote>

<blockquote><b>🚀 Что мы используем:</b>
• Xray + VLESS — передовой протокол, который невозможно отследить
• 100% маскировка под обычный веб-трафик (HTTPS)
• Мощные сервера, обеспечивающие быструю загрузку и низкий пинг</blockquote>

<blockquote><b>🔥 Почему Nexus-VPN лучше:</b>
• Полное отсутствие логов и сбора личных данных
• Стабильная работа серверов с аптаймом 99.9%
• Высокая скорость без урезания канала
• Мгновенный доступ к привычным сервисам без блокировок</blockquote>
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('📄 Пользовательское соглашение', 'https://telegra.ph/Polzovatelskoe-soglashenie-08-15-10')],
      [Markup.button.url('🔒 Политика конфиденциальности', 'https://telegra.ph/Politika-konfidencialnosti-08-15-17')],
      [Markup.button.callback('⬅️ Вернуться в главное меню', 'back_to_main')]
    ]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(aboutMessage, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    });
  } catch (err) {
    console.error('About action error:', err);
  }
});

// Кнопка меню
bot.telegram.setChatMenuButton({
  menuButton: {
    type: 'web_app',
    text: 'Моя подписка',
    web_app: { url: MINI_APP_URL }
  }
});

// --- API НАСТРОЙКИ ---
app.use(helmet());
app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));

app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.get('/vpn/key', authMiddleware, async (req, res) => {
  try {
    const { tg_id, username, first_name } = req.user;
    let user = database.getOrCreateUser({ tg_id, username: username || '', first_name: first_name || '' });
    const activeClient = database.getActiveVpnClientByUserId(user.id);
    if (activeClient) return res.status(200).json({ vpn_client: activeClient });

    try {
      const xuiResult = await xuiService.createClient(tg_id);
      const vpnClient = database.createVpnClient({
        user_id: user.id,
        uuid: xuiResult.uuid,
        email: xuiResult.email,
        status: 'active',
        config_url: xuiResult.configUrl,
        sub_id: xuiResult.subId,
        inbound_id: 1
      });
      res.json({ vpn_client: vpnClient });
    } catch (e) {
      console.error('❌ [XUI] Error:', e.message);
      return res.status(503).json({ error: 'VPN Panel Error' });
    }
  } catch (error) {
    console.error('🔥 [API ERROR]:', error);
    res.status(500).json({ error: 'Internal Error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 API сервер на порту ${port}`);
  bot.launch().then(() => console.log('🤖 Бот запущен корректно'));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
