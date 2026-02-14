import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
// uuid больше не нужен здесь, его генерирует сервис
import database from './database.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import xuiService from './services/xuiService.js'; // Убедись, что путь правильный!

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', xui_configured: !!process.env.XUI_BASE_URL });
});

app.get('/vpn/key', authMiddleware, async (req, res) => {
  try {
    const { tg_id, username, first_name } = req.user;
    console.log(`📡 [PROD] Запрос ключа для: ${tg_id}`);

    // 1. Получаем или создаем пользователя в БД
    let user = database.getOrCreateUser({
      tg_id: tg_id,
      username: username || '',
      first_name: first_name || ''
    });

    // 2. Если у пользователя уже есть активный ключ - отдаем его
    const activeClient = database.getActiveVpnClientByUserId(user.id);
    if (activeClient) {
        return res.status(200).json({ vpn_client: activeClient });
    }

    // 3. ЕСЛИ КЛЮЧА НЕТ - СОЗДАЕМ ЧЕРЕЗ СЕРВИС
    try {
      // ВАЖНО: Передаем только tg_id. Сервис сам сгенерирует UUID, subId и правильную ссылку.
      const xuiResult = await xuiService.createClient(tg_id);
      
      console.log(`✅ [XUI] Клиент создан: ${xuiResult.email}`);
      console.log(`🔗 Ссылка от сервиса: ${xuiResult.configUrl}`);

      // 4. Сохраняем в базу то, что вернул сервис
      const vpnClient = database.createVpnClient({
        user_id: user.id,
        uuid: xuiResult.uuid,       // Длинный UUID для API панели
        email: xuiResult.email,     // Почта
        status: 'active',
        
        // САМОЕ ГЛАВНОЕ: Берем готовую ссылку из сервиса!
        // Она будет вида: https://jsstudy.xyz:2096/sub/shortId
        config_url: xuiResult.configUrl, 
        
        // Если база поддерживает subId - сохраняем. Если нет - не страшно, он зашит в config_url
        sub_id: xuiResult.subId,    
        
        inbound_id: 1 // ID подключения (мы его зашили в сервисе, но для базы укажем 1)
      });

      res.json({ vpn_client: vpnClient });

    } catch (e) {
      console.error('❌ [XUI] Ошибка создания:', e.message);
      return res.status(503).json({ error: 'VPN Panel Error' });
    }

  } catch (error) {
    console.error('🔥 [API ERROR]:', error);
    res.status(500).json({ error: 'Internal Error' });
  }
});

app.listen(port, () => console.log(`🚀 Сервер запущен в боевом режиме`));
