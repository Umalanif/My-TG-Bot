import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';

import database from './database.js';
import { authMiddleware } from './middleware/authMiddleware.js';

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

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
  origin: true,
  credentials: true
}));

// === API РОУТЫ С ПРЕФИКСОМ /api ДЛЯ NGINX ===

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/user/me', authMiddleware, (req, res) => {
  try {
    const user = database.getUserByTgId(req.user.tg_id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const subscription = database.getUserSubscription(user.tg_id);
    res.status(200).json({ user, subscription });
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
});

app.get('/api/vpn/key', authMiddleware, async (req, res) => {
  try {
    const { tg_id } = req.user;
    console.log(`📡 [DEBUG] Запрос ключа для TG: ${tg_id}`);
    
    let user = database.getUserByTgId(tg_id) || database.upsertUser({
      tg_id,
      username: req.user.username || '',
      first_name: req.user.first_name || ''
    });

    const activeClient = database.getActiveVpnClientByUserId(user.id);
    if (activeClient) {
      return res.status(200).json({ status: 'existing', vpn_client: activeClient });
    }

    if (!xuiService) xuiService = await initializeXuiService();

    const clientUuid = uuidv4();
    const clientEmail = `tg_${tg_id}_${Date.now()}@vpn.service`;
    const subDomain = process.env.SUB_DOMAIN || 'jsstudy.xyz';
    const subPort = process.env.SUB_PORT || '2096';
    const finalConfigUrl = `https://${subDomain}:${subPort}/sub/${clientUuid}`;

    if (xuiService) {
      try {
        const inboundId = process.env.XUI_INBOUND_ID || 1;
        await xuiService.createClient({ email: clientEmail, uuid: clientUuid, enable: true }, parseInt(inboundId));
        console.log(`✅ [DEBUG] Клиент создан в панели: ${clientUuid}`);
      } catch (e) {
        console.error('❌ [DEBUG] Ошибка XUI Panel:', e.message);
      }
    }

    const vpnClient = database.createVpnClient({
      user_id: user.id,
      uuid: clientUuid,
      email: clientEmail,
      status: 'active',
      config_url: finalConfigUrl
    });

    res.status(200).json({ vpn_client: vpnClient });
  } catch (error) {
    console.error('🔥 [DEBUG] Ошибка API:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.listen(port, () => console.log(`🚀 Бот слушает порт ${port}`));
