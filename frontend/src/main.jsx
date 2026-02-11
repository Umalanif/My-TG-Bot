import React from 'react';
import ReactDOM from 'react-dom/client';
import { init } from '@telegram-apps/sdk';
import App from './App.jsx';

// БЕЗОПАСНАЯ ИНИЦИАЛИЗАЦИЯ
// Если мы не в Telegram, init() может выдать ошибку. Мы её ловим.
try {
  init();
} catch (e) {
  console.log("SDK Init skipped (Running in Browser Mode)");
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
