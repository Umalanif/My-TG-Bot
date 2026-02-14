import React, { useState, useEffect, useMemo } from 'react';
import { miniApp, viewport, openLink, retrieveLaunchParams, hapticFeedback } from '@telegram-apps/sdk';
import './App.css';

const API_BASE_URL = '/api';

const LINKS = {
  // Новые ссылки на клиенты
  android: 'https://play.google.com/store/apps/details?id=com.v2ray.ang', // v2rayNG
  ios: 'https://apps.apple.com/us/app/streisand/id6450534064', // Streisand (лучший аналог для iOS)
  
  // Десктоп оставим как есть или можно заменить на Nekoray, но пока пусть будет Hiddify для ПК (он там неплох)
  windows: 'https://github.com/hiddify/hiddify-app/releases/latest/download/Hiddify-Windows-Setup-x64.Msix',
  macos: 'https://github.com/hiddify/hiddify-app/releases/latest/download/Hiddify-MacOS.dmg',
  linux: 'https://github.com/hiddify/hiddify-app/releases/latest/download/Hiddify-Linux-x64.AppImage',
  
  support: 'https://t.me/nexus_vpn_support',
  api_url: `${API_BASE_URL}/vpn/key`
};

const Icons = {
  VpnLock: () => <span className="material-icons-round">vpn_lock</span>,
  Laptop: () => <span className="material-icons-round">laptop_mac</span>,
  ChevronRight: () => <span className="material-icons-round">chevron_right</span>,
  Rocket: () => <span className="material-icons-round">rocket_launch</span>,
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

  const launchData = useMemo(() => getLaunchData(), []);

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
      return;
    }

    // ЛОГИКА DEEP LINK ДЛЯ V2RAYNG
    if (type === 'deep_connect') {
      // Формируем ссылку именно для v2rayNG
      // sub - это подписка. v2rayng://install-sub?url=...&name=...
      const deepLink = `v2rayng://install-sub?url=${encodeURIComponent(vpnData.configUrl)}&name=NexusVPN`;
      openLink(deepLink);
      return;
    }

    openLink(payload || LINKS[type]);
  };

  if (!isMounted) return <div className="app-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'white'}}>
    <div className="loader"></div>
  </div>;

  return (
    <div className="app-container">
      <div className="scanlines"></div>

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
                  {vpnData.status === 'active' ? 'АКТИВЕН' : vpnData.status === 'loading' ? 'ЗАГРУЗКА...' : 'ОШИБКА'}
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
                  {/* КНОПКА ПОДКЛЮЧЕНИЯ (V2RAYNG) */}
                  <button
                      disabled={!vpnData.configUrl}
                      onClick={() => handleAction('deep_connect')} 
                      className="btn-main-action"
                  >
                      <div className="hiddify-icon">
                        {/* Иконка ракеты вместо SVG Hiddify */}
                        <Icons.Rocket /> 
                      </div>
                      <div>
                        <div className="bold" style={{fontSize: '16px', lineHeight: '1.2'}}>Подключить</div>
                        <div style={{fontSize: '11px', color: '#64748b'}}>v2rayNG (Android)</div>
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
                          <div style={{fontSize: '10px', color: '#888'}}>Скачать v2rayNG</div>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => handleAction('ios', LINKS.ios)} className="btn-glass">
                      <div className="btn-content">
                        <Icons.Apple /> 
                        <div>
                          <div className="bold">App Store</div>
                          <div style={{fontSize: '10px', color: '#888'}}>Скачать Streisand</div>
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
                 
                 {/* Краткая инструкция, чтобы не тупили */}
                 <div style={{background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', fontSize: '12px', marginTop: '5px'}}>
                    <span style={{color: '#fbbf24'}}>⚠️ Важно:</span> После добавления, если список пуст — нажмите <span className="bold">"Обновить подписку"</span> (три точки сверху).
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
