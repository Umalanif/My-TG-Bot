import React, { useState, useEffect, useMemo } from 'react';
import { miniApp, viewport, openLink, retrieveLaunchParams, hapticFeedback } from '@telegram-apps/sdk';
import './App.css';

const API_BASE_URL = '/api';

const LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.v2raytun.android', 
  ios: 'https://apps.apple.com/us/app/v2box-v2ray-client/id6446814690', 
  
  windows: 'https://github.com/2dust/v2rayN/releases/latest/download/v2rayN-windows-64-desktop.zip',
  macos: 'https://github.com/2dust/v2rayN/releases/latest/download/v2rayN-macos-64.zip',
  linux: 'https://github.com/2dust/v2rayN/releases/latest/download/v2rayN-linux-64.zip',
  
  support: 'https://t.me/nexus_vpn_support',
  api_url: `${API_BASE_URL}/vpn/key`
};

const Icons = {
  VpnLock: () => <span className="material-icons-round earth-blink">vpn_lock</span>,
  Laptop: () => <span className="material-icons-round">laptop_mac</span>,
  ChevronRight: () => <span className="material-icons-round">chevron_right</span>,
  
  Rocket: () => <img src="./v2ray.png" alt="v2ray" style={{width: '28px', height: '28px', objectFit: 'contain'}} />,
  
  Copy: () => <span className="material-icons-round">content_copy</span>,
  Apple: () => <span className="material-icons-round">apple</span>,
  Android: () => <span className="material-icons-round">android</span>,
  Windows: () => <span className="material-icons-round">desktop_windows</span>,
  Download: () => <span className="material-icons-round">download</span>,
};

function getLaunchData() {
  const raw = window.Telegram?.WebApp?.initData || "";
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user || { first_name: "Пользователь" };

  if (!raw) {
    try {
      const lp = retrieveLaunchParams();
      return { user: lp.initData?.user || user, initDataRaw: lp.initDataRaw || "" };
    } catch (e) { return { user, initDataRaw: "" }; }
  }
  return { user, initDataRaw: raw };
}

function App() {
  const [isMounted, setIsMounted] = useState(false);
  const [modal, setModal] = useState({ active: false, type: null, step: 1 });
  const [vpnData, setVpnData] = useState({ status: 'loading', configUrl: null, expiryDate: null });
  const [toast, setToast] = useState('');

  const launchData = useMemo(() => getLaunchData(), []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor('#050b14');
      webApp.setBackgroundColor('#050b14');
    }

    const init = async () => {
      try {
        if (miniApp.mount.isAvailable()) await miniApp.mount();
        if (viewport.mount.isAvailable()) await viewport.mount();
      } catch (e) { console.warn(e); }
      setIsMounted(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (isMounted && launchData.initDataRaw) fetchVpnKey();
  }, [isMounted, launchData.initDataRaw]);

  const fetchVpnKey = async () => {
    try {
      const response = await fetch(LINKS.api_url, {
        method: 'GET',
        headers: { 'X-Telegram-InitData': launchData.initDataRaw }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      if (data.vpn_client) {
        setVpnData({
          status: 'active',
          configUrl: data.vpn_client.config_url,
          expiryDate: data.vpn_client.expiry_time
        });
      } else {
        setVpnData({ status: 'no_sub', configUrl: null, expiryDate: null });
      }
    } catch (error) {
      setVpnData({ status: 'error', configUrl: null, expiryDate: null });
    }
  };

  const handleAction = (type, payload = null) => {
    if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred('light');
    
    if (type === 'smartphone' || type === 'desktop') { 
      setModal({ active: true, type, step: 1 }); 
      return; 
    }

    if (type === 'copy_key' && vpnData.configUrl) {
      navigator.clipboard.writeText(vpnData.configUrl);
      if (hapticFeedback.notificationOccurred.isAvailable()) hapticFeedback.notificationOccurred('success');
      showToast('✅ Скопировано в буфер обмена!');
      return;
    }

    if (type === 'deep_connect') {
      const platform = window.Telegram?.WebApp?.platform || 'unknown';
      
      // Принудительно копируем ключ в буфер перед попыткой открыть приложение
      try {
        navigator.clipboard.writeText(vpnData.configUrl);
      } catch (e) {}
      
      if (platform === 'android') {
        showToast('✅ Скопировано! Открываем V2rayTun...');
        openLink(`v2raytun://install-sub?url=${encodeURIComponent(vpnData.configUrl)}&name=NexusVPN`);
      } else if (platform === 'ios') {
        showToast('✅ Скопировано! Открываем V2Box...');
        openLink(`v2box://install-sub?url=${encodeURIComponent(vpnData.configUrl)}&name=NexusVPN`);
      } else {
        showToast('🔗 Скопировано! Откройте клиент и нажмите Ctrl+V');
      }
      return;
    }

    openLink(payload || LINKS[type]);
  };

  if (!isMounted) return <div className="app-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'white'}}>
    <div className="loader"></div>
  </div>;

  return (
    <div className="app-container">
      <style>{`
        @keyframes earthBlink {
          0% { opacity: 1; filter: drop-shadow(0 0 5px #38bdf8); }
          50% { opacity: 0.7; filter: drop-shadow(0 0 15px #38bdf8); transform: scale(1.05); color: #38bdf8; }
          100% { opacity: 1; filter: drop-shadow(0 0 5px #38bdf8); }
        }
        .earth-blink {
          animation: earthBlink 2.5s infinite ease-in-out;
          color: #0ea5e9;
        }
        
        /* Стили для всплывающего уведомления (Тоста) */
        .toast-message {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
          padding: 12px 24px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          z-index: 9999;
          white-space: nowrap;
          border: 1px solid rgba(255,255,255,0.1);
          animation: fadeInOut 2.5s forwards;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; bottom: 10px; }
          15% { opacity: 1; bottom: 30px; }
          85% { opacity: 1; bottom: 30px; }
          100% { opacity: 0; bottom: 40px; }
        }
      `}</style>

      <div className="scanlines"></div>

      {/* Отрисовка тоста */}
      {toast && <div className="toast-message">{toast}</div>}

      <main className="main-content">
        <header className="header">
          <div className="logo-container">
            <Icons.VpnLock />
            <h1 className="logo-text font-orbitron">NEXUS<span className="text-primary">-VPN</span></h1>
          </div>
        </header>

        <section className="glass-panel">
          <div className="status-bar">
            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
              <span className={`material-icons-round ${vpnData.status === 'active' ? 'text-primary' : 'text-danger'}`} style={{fontSize: '32px'}}>
                {vpnData.status === 'active' ? 'check_circle' : 'hourglass_empty'}
              </span>
              <div>
                <p className="uppercase bold" style={{fontSize:'10px', color: 'var(--text-gray)'}}>Статус подписки</p>
                <p className={`font-orbitron bold ${vpnData.status === 'active' ? 'text-primary' : 'text-danger'}`} style={{fontSize:'18px'}}>
                  {vpnData.status === 'active' ? 'АКТИВЕН' : vpnData.status === 'loading' ? 'ЗАГРУЗКА...' : vpnData.status === 'no_sub' ? 'НЕТ ПОДПИСКИ' : 'ОШИБКА'}
                </p>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <p style={{fontSize:'10px', color: 'var(--text-gray)'}}>Активно до</p>
              <p style={{fontFamily:'monospace', fontSize:'14px', color: '#d1d5db'}}>
                {vpnData.expiryDate ? new Date(vpnData.expiryDate).toLocaleDateString() : '--.--.----'}
              </p>
            </div>
          </div>
        </section>

        <section style={{marginBottom: '24px'}}>
            <h3 className="section-title">Быстрое подключение</h3>
            <div className="hiddify-btn-wrapper">
              <div className="hiddify-inner">
                  <button
                      disabled={!vpnData.configUrl}
                      onClick={() => handleAction('deep_connect')} 
                      className="btn-main-action"
                  >
                      <div className="hiddify-icon">
                        <Icons.Rocket /> 
                      </div>
                      <div>
                        <div className="bold" style={{fontSize: '16px', lineHeight: '1.2'}}>Подключить</div>
                        <div style={{fontSize: '11px', color: '#64748b'}}>
                          {window.Telegram?.WebApp?.platform === 'android' ? 'V2rayTun (Android)' : 
                           window.Telegram?.WebApp?.platform === 'ios' ? 'V2Box (iOS)' : 'ПК (Копировать)'}
                        </div>
                      </div>
                  </button>
                  <div className="divider-vertical"></div>
                  <button
                    disabled={!vpnData.configUrl}
                    onClick={(e) => { e.stopPropagation(); handleAction('copy_key'); }}
                    className="btn-copy-sm"
                  >
                     <Icons.Copy />
                  </button>
              </div>
            </div>
        </section>

        <section>
          <h3 className="section-title">Инструкции по настройке</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <button onClick={() => handleAction('smartphone')} className="btn-glass">
              <div className="btn-content">
                <div className="icon-box"><span className="material-icons-round">phone_android</span></div>
                <div>
                  <span style={{display: 'block', fontWeight: '600', fontSize: '17px'}}>Смартфон</span>
                  <span style={{fontSize: '11px', color: '#94a3b8'}}>Android & iOS</span>
                </div>
              </div>
              <Icons.ChevronRight />
            </button>
            <button onClick={() => handleAction('desktop')} className="btn-glass">
              <div className="btn-content">
                <div className="icon-box"><Icons.Laptop /></div>
                <div>
                  <span style={{display: 'block', fontWeight: '600', fontSize: '17px'}}>Компьютер</span>
                  <span style={{fontSize: '11px', color: '#94a3b8'}}>Windows / MacOS / Linux</span>
                </div>
              </div>
              <Icons.ChevronRight />
            </button>
          </div>
        </section>
      </main>

      {modal.active && (
        <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) setModal({...modal, active: false}); }}>
          <div className="modal-content">
            <div className="drag-handle"></div>
            <div style={{textAlign: 'center', marginBottom: '20px'}}>
              <h3 className="font-orbitron bold" style={{fontSize: '18px'}}>
                {modal.type === 'smartphone' ? 'Настройка Mobile' : 'Настройка Desktop'}
              </h3>
              <p className="section-title" style={{textAlign: 'center', padding: 0, marginTop: '6px', fontSize: '12px'}}>
                Шаг {modal.step}: {modal.step === 1 ? 'Загрузка клиента' : 'Активация'}
              </p>
            </div>

            {modal.step === 1 && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {modal.type === 'smartphone' ? (
                  <>
                    <button onClick={() => handleAction('android', LINKS.android)} className="btn-glass">
                      <div className="btn-content">
                        <Icons.Android /> 
                        <div>
                          <div className="bold">Google Play</div>
                          <div style={{fontSize: '10px', color: '#888'}}>Скачать V2rayTun</div>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => handleAction('ios', LINKS.ios)} className="btn-glass">
                      <div className="btn-content">
                        <Icons.Apple /> 
                        <div>
                          <div className="bold">App Store</div>
                          <div style={{fontSize: '10px', color: '#888'}}>Скачать V2Box</div>
                        </div>
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleAction('windows', LINKS.windows)} className="btn-glass"><div className="btn-content"><Icons.Windows /> <div><div className="bold">Windows</div></div></div></button>
                    <button onClick={() => handleAction('macos', LINKS.macos)} className="btn-glass"><div className="btn-content"><Icons.Laptop /> <div><div className="bold">macOS</div></div></div></button>
                    <button onClick={() => handleAction('linux', LINKS.linux)} className="btn-glass"><div className="btn-content"><span className="material-icons-round">terminal</span> <div><div className="bold">Linux</div></div></div></button>
                  </>
                )}
                <button onClick={() => setModal({...modal, step: 2})} className="btn-primary" style={{marginTop:'10px'}}>Установил, далее</button>
              </div>
            )}

            {modal.step === 2 && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                 <button
                  disabled={!vpnData.configUrl}
                  onClick={() => handleAction('deep_connect')}
                  className="btn-glass highlight"
                 >
                    <div className="btn-content">
                      <Icons.Rocket />
                      <div>
                        <div className="bold">Добавить подписку</div>
                        <div style={{fontSize:'10px', color:'#94a3b8'}}>Нажми для настройки в 1 клик</div>
                      </div>
                    </div>
                 </button>
                 <button onClick={() => handleAction('copy_key')} className="btn-glass">
                    <div className="btn-content">
                      <Icons.Copy />
                      <div>
                        <div className="bold">Копировать ключ</div>
                        <div style={{fontSize:'10px', color:'#94a3b8'}}>Для ручного добавления</div>
                      </div>
                    </div>
                 </button>
                 
                 <div style={{background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', fontSize: '12px', marginTop: '5px'}}>
                    <span style={{color: '#fbbf24'}}>⚠️ Важно:</span> После добавления, если список пуст — нажмите <span className="bold">"Обновить подписку"</span>.
                 </div>

                 <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                   <button onClick={() => setModal({...modal, step: 1})} className="btn-outline">Назад</button>
                   <button onClick={() => setModal({...modal, active: false})} className="btn-primary" style={{flex: 1}}>Готово</button>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
