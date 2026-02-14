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

// Вспомогательная функция для отрисовки главного меню
async function sendOrEditMainMenu(ctx, isEdit = false) {
  const tg_id = ctx.from.id;
  const first_name = ctx.from.first_name || 'друг';

  const subscription = database.getUserSubscription(tg_id);
  let subStatus = "ОТСУТСТВУЕТ";
  let expiryDate = "--.--.----";
  let hasActiveSub = false;

  if (subscription) {
    // Проверяем, не истекло ли время подписки
    hasActiveSub = subscription.expiry_time > Date.now() && subscription.status === 'active';
    subStatus = hasActiveSub ? 'АКТИВНА ✅' : 'ИСТЕКЛА ❌';
    expiryDate = subscription.expiry_time
      ? new Date(subscription.expiry_time).toLocaleDateString()
      : new Date(subscription.created_at).toLocaleDateString();
  }

  const welcomeMessage = `
👋 <b>Привет, ${first_name}!</b>

<b>Nexus-VPN — Твой личный доступ в Интернет.</b>
Доступные сервера: 🇷🇺 🇺🇸 🇨🇦 🇩🇪 🇫🇮

⌛️ <b>Ваша подписка:</b> <code>${subStatus}</code> ${hasActiveSub ? `(до ${expiryDate})` : ''}

${!subscription ? '🎁 <i>У вас есть доступ к бесплатной пробной подписке на 72 часа! Нажмите кнопку ниже для активации.</i>' : ''}
  `;

  const keyboard = [];

  // Показываем кнопку "Подключиться", только если есть активная подписка
  if (hasActiveSub) {
    keyboard.push([Markup.button.webApp('🔌 Подключиться', MINI_APP_URL)]);
  }

  // Если подписки вообще нет - даем кнопку активации триала
  if (!subscription) {
    keyboard.push([Markup.button.callback('🎁 Активировать 72 часа бесплатно', 'activate_trial')]);
  } else {
    // Если есть (активная или истекшая) - показываем кнопку продления
    keyboard.push([Markup.button.callback('💳 Продлить', 'renew_sub')]);
  }

  keyboard.push([
    Markup.button.callback('🎁 Бонусы', 'bonuses'),
    Markup.button.url('💬 Поддержка', 'https://t.me/nexus_vpn_support')
  ]);
  keyboard.push([Markup.button.callback('ℹ️ О нас', 'about')]);
  keyboard.push([Markup.button.url('📢 Наш канал', 'https://t.me/your_channel_link')]);

  if (isEdit) {
    await ctx.editMessageText(welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
  } else {
    await ctx.replyWithHTML(welcomeMessage, Markup.inlineKeyboard(keyboard));
  }
}

// --- ЛОГИКА ТЕЛЕГРАМ-БОТА ---

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

    await sendOrEditMainMenu(ctx, false);
  } catch (err) {
    console.error('Bot Start Error:', err);
  }
});

// Активация пробного периода
bot.action('activate_trial', async (ctx) => {
  try {
    const tg_id = ctx.from.id;
    const user = database.getUserByTgId(tg_id);
    const existingSub = database.getUserSubscription(tg_id);

    if (existingSub) {
      return ctx.answerCbQuery('У вас уже была подписка!', { show_alert: true });
    }

    await ctx.answerCbQuery('Создаем подписку... ⏳');

    const xuiResult = await xuiService.createClient(tg_id);
    database.createVpnClient({
      user_id: user.id,
      uuid: xuiResult.uuid,
      email: xuiResult.email,
      status: 'active',
      config_url: xuiResult.configUrl,
      sub_id: xuiResult.subId,
      inbound_id: 2,
      expiry_time: xuiResult.expiryTime
    });

    // Обновляем меню (появится кнопка Подключиться)
    await sendOrEditMainMenu(ctx, true);
  } catch (err) {
    console.error('Activate Trial Error:', err);
    ctx.answerCbQuery('Ошибка при создании ключа', { show_alert: true });
  }
});

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

bot.action('pay_crypto_sbp', async (ctx) => {
  await ctx.answerCbQuery('Переход к оплате... 🛠');
});

bot.action('back_to_main', async (ctx) => {
  try {
    await sendOrEditMainMenu(ctx, true);
  } catch (err) {
    console.error('Back action error:', err);
  }
});

// Обновленная логика бонусов
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

<i>Отправьте эту ссылку другу. Вы получите 20% от его первой покупки и 10% от последующих покупок!</i>
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Вернуться в главное меню', 'back_to_main')]
    ]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard.reply_markup
    });
  } catch (err) {
    console.error('Bonuses action error:', err);
  }
});

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

    // Пытаемся найти клиента
    const subscription = database.getUserSubscription(tg_id);

    // Если клиент есть и его подписка активна (время не вышло) - отдаем. Иначе null.
    if (subscription && subscription.expiry_time > Date.now()) {
        return res.status(200).json({ vpn_client: subscription });
    } else {
        return res.status(200).json({ vpn_client: null });
    }
  } catch (error) {
    console.error('🔥 [API ERROR]:', error);
    res.status(500).json({ error: 'Internal Error' });
  }
});

// --- АВТОРАССЫЛКА (УВЕДОМЛЕНИЯ ОБ ОКОНЧАНИИ) ---
async function checkSubscriptionsAndNotify() {
  try {
    const users = database.getAllUsers();
    const now = Date.now();
    
    // Временные интервалы (в миллисекундах)
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000; // 2 дня + 3 дня = 5 дней

    for (const user of users) {
      const sub = database.getUserSubscription(user.tg_id);
      
      // Игнорируем если: нет подписки / вечная подписка / подписка еще активна
      if (!sub || sub.expiry_time === 0 || sub.expiry_time > now) {
        continue; 
      }

      const timePassed = now - sub.expiry_time;
      let currentStep = sub.notification_step || 0;
      let messageToSend = null;

      // Логика шагов (отправляем 1 раз на каждый этап)
      if (currentStep === 0) {
        messageToSend = 1;
        currentStep = 1;
      } else if (currentStep === 1 && timePassed >= TWO_DAYS) {
        messageToSend = 2;
        currentStep = 2;
      } else if (currentStep === 2 && timePassed >= FIVE_DAYS) {
        messageToSend = 3;
        currentStep = 3;
      }

      if (messageToSend) {
        try {
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('💳 Продлить', 'renew_sub')]
          ]);

          let text = '';
          if (messageToSend === 1) {
            text = `<b>Доступ к глобальной сети ограничен 🛡</b>\n\nСрок вашей подписки истек. Это значит, что YouTube, Instagram и другие важные сервисы снова стали недоступны.\n\nМы ценим ваш комфорт и не хотим, чтобы блокировки мешали вашим планам. Ваш ключ всё ещё сохранен в системе — просто активируйте его, чтобы вернуть интернет в привычное состояние.\n\n👇 Восстановить доступ:`;
          } else if (messageToSend === 2) {
            text = `<b>Скучали по интернету без границ? ✨</b>\n\nПрошло два дня с тех пор, как ваш доступ в Nexus был приостановлен. Скорее всего, вы уже заметили, как неудобно пользоваться заблокированными сервисами через медленные бесплатные решения.\n\nВ Nexus всё работает иначе: честная скорость, никаких лимитов и полная доступность YouTube в 4K. Вернитесь к качеству, которого вы достойны.\n\n👇 Вернуть всё как было:`;
          } else if (messageToSend === 3) {
            text = `<b>Ваш ключ Nexus ждет активации 🔑</b>\n\nМы в последний раз напоминаем, что ваш личный канал связи сейчас неактивен. Пока подписка не продлена, доступ к заблокированным ресурсам остается закрытым.\n\nНастройка занимает всего 30 секунд. Нажмите кнопку ниже, чтобы снова пользоваться интернетом без цензуры и тормозов.\n\n👇 Подключиться:`;
          }

          // Отправляем сообщение юзеру
          await bot.telegram.sendMessage(user.tg_id, text, { parse_mode: 'HTML', reply_markup: keyboard.reply_markup });
          
          // Сохраняем шаг в базу данных
          database.updateNotificationStep(sub.id, currentStep);
        } catch (err) {
          // Игнорируем ошибку (например, если пользователь заблокировал бота)
          console.error(`Failed to send auto-mailing to ${user.tg_id}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Auto-mailing error:', err);
  }
}

// Запускаем проверку подписок каждый час
setInterval(checkSubscriptionsAndNotify, 60 * 60 * 1000);
// Делаем самую первую проверку через 10 секунд после старта сервера
setTimeout(checkSubscriptionsAndNotify, 10000);

app.listen(port, () => {
  console.log(`🚀 API сервер на порту ${port}`);
  bot.launch().then(() => console.log('🤖 Бот запущен корректно'));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
