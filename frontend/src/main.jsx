import React from 'react';
import ReactDOM from 'react-dom/client';
import { initTelegramWebApp, TelegramProvider } from '@telegram-apps/sdk-react';
import App from './App.jsx';

// Initialize Telegram WebApp safely
try {
  initTelegramWebApp();
} catch (error) {
  console.warn('Failed to initialize Telegram WebApp:', error);
}

// Apply theme styles immediately
const updateTheme = () => {
  // Check if we're in a Telegram environment
  const tgWebApp = window.Telegram?.WebApp;
  if (tgWebApp && tgWebApp.themeParams) {
    const themeParams = tgWebApp.themeParams;
    Object.entries(themeParams).forEach(([key, value]) => {
      if (value) {
        document.documentElement.style.setProperty(`--tg-theme-${key}`, value);
      }
    });

    // Also update body background
    if (themeParams.bg_color) {
      document.body.style.backgroundColor = themeParams.bg_color;
    }
  }
};

// Run once on load
updateTheme();

// Re-update theme when it changes
const tgWebApp = window.Telegram?.WebApp;
if (tgWebApp) {
  tgWebApp.onEvent('theme_changed', updateTheme);
}

// Create root and render
let root;
try {
  root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <TelegramProvider value={window.Telegram?.WebApp}>
        <App />
      </TelegramProvider>
    </React.StrictMode>,
  );
} catch (error) {
  console.error('Failed to render app:', error);
}