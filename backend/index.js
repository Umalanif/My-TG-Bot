require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS configuration for Telegram Mini Apps
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Curl, Postman)
    if (!origin) return callback(null, true);
    
    // Telegram Mini Apps origins
    const allowedOrigins = [
      'https://web.telegram.org',
      'https://telegram.org',
      'https://t.me',
      'https://*.t.me',
      'https://miniapp.telegram.org',
      // Local development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    // Check if the origin is in the allowed list
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern.startsWith('https://*.')) {
        const domain = pattern.substring(9); // Remove 'https://*.' prefix
        return origin.endsWith('.' + domain) || origin === 'https://' + domain;
      } else {
        return origin === pattern || pattern.includes('*') && new RegExp(`^${pattern.replace(/\*/g, '.*')}$`).test(origin);
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

// Initialize Telegraf bot only if BOT_TOKEN is present
const botToken = process.env.BOT_TOKEN;
let bot = null;

if (!botToken) {
  console.warn('BOT_TOKEN is not set in .env file. Bot functionality will be disabled.');
} else {
  bot = new Telegraf(botToken);

  // Telegram bot commands
  bot.command('start', (ctx) => {
    ctx.reply('Welcome to VPN Subscription Service! Use /help to see available commands.');
  });

  bot.command('help', (ctx) => {
    ctx.reply('Available commands:\n/start - Start the bot\n/help - Show this help message\n/status - Check your subscription status');
  });

  bot.command('status', (ctx) => {
    ctx.reply('Checking your subscription status...');
    // Here you would typically check the user's subscription status in your database
    ctx.reply('Your VPN subscription is active!');
  });

  // Webhook callback for bot updates
  app.post(`/bot${botToken}`, (req, res) => {
    bot.handleUpdate(req.body, res);
  });
}

// Middleware to validate Telegram WebApp initData
function validateTelegramInitData(initData) {
  // In a real application, you'd implement the actual validation logic here
  // This involves checking the hash against the secret key
  // For now, we'll just check if initData exists
  return !!initData;
}

// API routes
app.post('/api/subscribe', async (req, res) => {
  try {
    // Extract user data from request
    const { user_id, username } = req.body;
    
    // Validate Telegram init data if available
    const initData = req.headers['x-telegram-initdata'];
    if (initData) {
      const isValid = validateTelegramInitData(decodeURIComponent(initData));
      if (!isValid) {
        return res.status(400).json({
          message: 'Invalid Telegram init data'
        });
      }
    }
    
    // In a real application, you would store subscription info in the database
    // For this example, we'll simulate the subscription process
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return success response
    res.status(200).json({
      message: `Successfully subscribed user ${username || user_id} to VPN service!`,
      user_id,
      subscription_status: 'active',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      message: 'Internal server error during subscription process'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Bot status endpoint to indicate if bot is configured
app.get('/bot-status', (req, res) => {
  if (botToken) {
    res.status(200).json({
      status: 'ACTIVE',
      message: 'Bot is configured and should be running',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(200).json({
      status: 'WARNING',
      message: 'Bot token not configured',
      timestamp: new Date().toISOString()
    });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`VPN Subscription API server running on port ${port}`);
  
  // Try to launch the bot if it's configured
  if (bot && botToken) {
    bot.launch()
      .then(() => {
        console.log('Telegram bot launched successfully');
      })
      .catch((error) => {
        console.error('Failed to launch Telegram bot:', error.message);
      });
  } else {
    console.log('Telegram bot is not configured (missing BOT_TOKEN)');
  }
});

// Graceful shutdown
process.once('SIGINT', () => {
  if (bot) {
    bot.stop();
  }
  console.log('Received SIGINT, stopping bot and closing server...');
  process.exit(0);
});

process.once('SIGTERM', () => {
  if (bot) {
    bot.stop();
  }
  console.log('Received SIGTERM, stopping bot and closing server...');
  process.exit(0);
});