import React, { useState, useEffect, useMemo } from 'react';
import { miniApp, viewport, openLink, retrieveLaunchParams, hapticFeedback } from '@telegram-apps/sdk';
import './App.css';

// --- КОНФИГУРАЦИЯ ССЫЛОК ---
const LINKS = {
  android: 'https://play.google.com/store/apps/details?id=app.hiddify.com',
  ios: 'https://apps.apple.com/us/app/hiddify-proxy-vpn/id6596777532?platform=iphone',
  windows: 'https://github.com/hiddify/hiddify-app/releases/latest/download/Hiddify-Windows-Setup-x64.Msix',
  macos: 'https://github.com/hiddify/hiddify-app/releases/latest/download/Hiddify-MacOS.dmg',
  linux: 'https://github.com/hiddify/hiddify-app/releases/latest/download/Hiddify-Linux-x64.AppImage',
  support: 'https://t.me/nexus_vpn_support',
  deep_config: 'hiddify://install-config?url=',
  // Путь через Nginx мостик
  api_url: 'https://jsstudy.xyz/api/vpn/key'
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
};

function getLaunchData() {
  try {
    const lp = retrieveLaunchParams();
    if (lp?.initData?.user) return { user: lp.initData.user };
  } catch (e) {}
  return { user: { first_name: "User" } };
}

function App() {
  const [isMounted, setIsMounted] = useState(false);
  const [modal, setModal] = useState({ active: false, type: null, step: 1 });
  
  const [vpnData, setVpnData] = useState({
    status: 'loading',
    configUrl: null,
    expiryDate: null
  });

  const launchData = useMemo(() => getLaunchData(), []);

  useEffect(() => {
    const init = async () => {
      if (miniApp.mount.isAvailable()) await miniApp.mount();
      if (viewport.mount.isAvailable()) await viewport.mount();
      if (miniApp.setHeaderColor.isAvailable()) {
        miniApp.setHeaderColor('#050b14');
        miniApp.setBackgroundColor('#050b14');
      }
      setIsMounted(true);

      // Запрос ключа у бэкенда
      try {
        const initDataRaw = window.Telegram.WebApp.initData;
        const response = await fetch(LINKS.api_url, {
          method: 'GET',
          headers: {
            'X-Telegram-InitData': initDataRaw 
          }
        });
        
        const data = await response.json();

        if (data.vpn_client) {
          setVpnData({
            status: data.vpn_client.status === 'active' ? 'active' : 'expired',
            configUrl: data.vpn_client.config_url,
            expiryDate: data.vpn_client.created_at
          });
        } else {
          setVpnData({ status: 'expired', configUrl: null, expiryDate: null });
        }
      } catch (error) {
        console.error('API Error:', error);
        setVpnData({ status: 'error', configUrl: null, expiryDate: null });
      }
    };
    init();
  }, []);

  const handleAction = (type, payload = null) => {
    if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred('light');

    if (type === 'smartphone' || type === 'desktop') {
      setModal({ active: true, type: type, step: 1 });
      return;
    }

    if (type === 'copy_key') {
      if (!vpnData.configUrl) return;
      navigator.clipboard.writeText(vpnData.configUrl);
      if (hapticFeedback.notificationOccurred.isAvailable()) hapticFeedback.notificationOccurred('success');
      return;
    }

    if (type === 'deep') {
       if (!payload) return;
       openLink(payload);
    } else if (payload) {
       openLink(payload);
    } else if (LINKS[type]) {
       openLink(LINKS[type]);
    }
  };

  if (!isMounted) return <div className="app-container" style={{color:'white'}}>Инициализация...</div>;

  return (
    <div className="app-container">
      <div className="scanlines"></div>
      <main className="main-content">

        <div className="header">
          <div className="logo-container">
            <span className="material-icons-round text-primary" style={{fontSize: '28px', animation: 'pulse 2s infinite'}}>vpn_lock</span>
            <h1 className="logo-text font-orbitron">
              NEXUS<span className="text-primary">-VPN</span>
            </h1>
          </div>
        </div>

        <div className="glass-panel">
          <div className="glow-corner"></div>
          <div className="panel-header">
            <h2 className="font-orbitron bold" style={{fontSize: '20px'}}>ИНФО-ПАНЕЛЬ</h2>
          </div>

          <div className="status-bar">
            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
              <span className={`material-icons-round ${vpnData.status === 'active' ? 'text-primary' : 'text-danger'}`} style={{fontSize: '32px'}}>
                {vpnData.status === 'active' ? 'check_circle' : 'error_outline'}
              </span>
              <div>
                <p className="uppercase bold" style={{fontSize:'10px', color: 'var(--text-gray)'}}>Статус</p>
                <p className={`font-orbitron bold ${vpnData.status === 'active' ? 'text-primary' : 'text-danger'}`} style={{fontSize:'18px'}}>
                  {vpnData.status === 'active' ? 'АКТИВНА' : vpnData.status === 'loading' ? 'ЗАГРУЗКА...' : 'ИСТЕКЛА'}
                </p>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <p style={{fontSize:'10px', color: 'var(--text-gray)'}}>Создана</p>
              <p style={{fontFamily:'monospace', fontSize:'14px', color: '#d1d5db'}}>
                {vpnData.expiryDate ? new Date(vpnData.expiryDate).toLocaleDateString() : '--.--.----'}
              </p>
            </div>
          </div>
        </div>

        <div style={{marginBottom: '24px'}}>
            <h3 className="section-title">Основное действие</h3>
            <div className="hiddify-btn-wrapper">
              <div className="hiddify-inner">
                  <button
                     disabled={!vpnData.configUrl}
                     onClick={() => handleAction('deep', LINKS.deep_config + encodeURIComponent(vpnData.configUrl))}
                     className="btn-main-action"
                     style={{ opacity: vpnData.configUrl ? 1 : 0.6 }}
                  >
                     <div className="hiddify-icon">
                        <svg viewBox="0 0 1000 1000" style={{width:'28px', height:'28px', fill:'black'}}>
                            {/* ПОЛНЫЙ LOGO HIDDIFY */}
                            <path d="M1.000001,589.468628 C2.771058,587.061707 4.274509,584.750183 6.362225,583.253601 C13.241864,578.322021 20.152021,573.388489 27.374897,568.988220 C55.219608,552.024841 83.171227,535.236572 111.119110,518.443176 C141.035187,500.467041 170.606247,481.863831 201.104828,464.933899 C214.929230,457.259918 234.865494,466.541107 234.924423,485.493042 C235.122406,549.156616 235.144989,612.821838 234.886475,676.484924 C234.829788,690.440002 245.391037,701.913086 260.223206,701.984985 C274.388977,702.053711 288.556580,702.115295 302.721161,701.968506 C317.918945,701.810974 328.015381,690.981079 328.011902,676.448914 C327.988892,580.452637 328.029297,484.456360 327.955780,388.460144 C327.948242,378.619659 332.308350,371.746094 340.550629,366.799286 C370.069794,349.082611 399.520233,331.251404 429.032501,313.523163 C453.091003,299.071075 477.205719,284.712616 501.284760,270.294739 C508.841125,265.770172 516.504211,261.403870 523.870178,256.585632 C538.573120,246.968094 557.312561,253.509216 561.498779,270.044769 C561.896606,271.616272 561.980408,273.301849 561.980591,274.934448 C562.001221,464.260437 562.001404,653.586426 561.997070,842.912415 C561.996765,855.779602 551.851807,865.993103 539.054138,865.995056 C476.389893,866.004883 413.725555,865.932617 351.061554,866.058777 C339.268738,866.082520 327.471558,854.817749 327.812958,842.959106 C328.460114,820.478577 327.720093,797.961487 328.100830,775.468811 C328.344574,761.069580 317.821533,748.448608 301.746094,748.917236 C288.091553,749.315308 274.414001,749.153076 260.750641,748.958679 C245.373535,748.739868 234.604294,759.816284 234.886185,774.567322 C235.319138,797.224792 234.917374,819.897156 235.031677,842.562317 C235.097214,855.560181 224.483521,866.035339 211.702454,866.024109 C149.538239,865.969727 87.373932,865.967468 25.209743,866.032288 C15.220128,866.042725 8.019124,861.657166 3.011859,853.226990 C2.723829,852.742065 2.163637,852.418884 1.365048,852.010254 C1.000000,764.645752 1.000000,677.291565 1.000001,589.468628 z"></path>
                            <path d="M889,851.5 L888.7,853.7 C881.7,861.4 875,866 865.6,866 C803.3,865.9 741,865.8 678.6,866 C666.9,866.1 654.9,856 654.9,842.4 C655,686.8 655,531.1 654.8,375.5 C654.8,362.5 665.3,350.8 679.7,350.9 C731.5,351.1 783.4,351 835.2,351 C844.4,351 853.5,351.1 862.7,350.9 C873.3,350.7 881.5,354.5 886.9,363.8 C887.3,364.5 888,365 888.7,365.3 C889,527 889,689 889,851.5 z"></path>
                            <path d="M656.1,196.9 C655.4,187.5 662.4,183 668.8,179.1 C710.3,153.9 752,129 793.6,104 C813.4,92.1 833.2,80.1 853.1,68.4 C864.7,61.6 878.1,65 885.1,75.5 C886.1,76.9 887.4,78.3 888.7,79.3 C889,149.3 889,219.7 889,290.5 C888.1,291.7 887,292.2 886.4,293.1 C881.5,300.4 875.4,305 866.2,305 C803.7,304.9 741.2,304.9 678.7,305 C669.4,305 658.2,298.8 656.2,287.2 C657,284.9 657.9,283.2 657.9,281.5 C658,255.1 658,228.7 657.9,202.3 C657.9,200.5 656.7,198.7 656.1,196.9 z"></path>
                        </svg>
                     </div>
                     <div>
                        <div className="bold" style={{fontSize: '18px', lineHeight: '1.2'}}>Hiddify</div>
                        <div style={{fontSize: '12px', color: '#94a3b8'}}>Нажми для импорта</div>
                     </div>
                  </button>

                  <div className="divider-vertical"></div>

                  <button
                     disabled={!vpnData.configUrl}
                     onClick={(e) => { e.stopPropagation(); handleAction('copy_key'); }}
                     className="btn-copy-sm"
                     style={{ opacity: vpnData.configUrl ? 1 : 0.6 }}
                  >
                     <Icons.Copy />
                     <span style={{fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b'}}>Copy</span>
                  </button>
              </div>
            </div>
        </div>

        <div>
          <h3 className="section-title">Инструкции</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <button onClick={() => handleAction('smartphone')} className="btn-glass">
              <div className="btn-content">
                <div className="icon-box"><span className="material-icons-round">phone_android</span></div>
                <div>
                  <span style={{display: 'block', fontWeight: '600', fontSize: '18px'}}>Смартфон</span>
                  <span style={{fontSize: '12px', color: '#94a3b8'}}>iOS & Android</span>
                </div>
              </div>
              <Icons.ChevronRight />
            </button>
            <button onClick={() => handleAction('desktop')} className="btn-glass">
              <div className="btn-content">
                <div className="icon-box"><Icons.Laptop /></div>
                <div>
                  <span style={{display: 'block', fontWeight: '600', fontSize: '18px'}}>ПК / Ноутбук</span>
                  <span style={{fontSize: '12px', color: '#94a3b8'}}>Windows & macOS</span>
                </div>
              </div>
              <Icons.ChevronRight />
            </button>
          </div>
        </div>

        <div style={{marginTop: '32px', textAlign: 'center'}}>
          <a href={LINKS.support} onClick={(e) => { e.preventDefault(); handleAction('support'); }} className="support-link">
            @nexus_vpn_support
          </a>
        </div>
      </main>

      {modal.active && (
        <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) setModal({...modal, active: false}); }}>
          <div className="modal-content">
            <div className="drag-handle"></div>
            <div style={{textAlign: 'center', marginBottom: '24px'}}>
              <h3 className="font-orbitron bold" style={{fontSize: '20px'}}>
                {modal.type === 'smartphone' ? 'Настройка Mobile' : 'Настройка PC'}
              </h3>
              <p className="section-title" style={{textAlign: 'center', padding: 0}}>
                Этап {modal.step}: {modal.step === 1 ? 'Установка софта' : 'Импорт ключа'}
              </p>
            </div>

            {modal.step === 1 && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {modal.type === 'smartphone' ? (
                  <>
                    <button onClick={() => handleAction('ios', LINKS.ios)} className="btn-glass">
                      <div className="btn-content"><Icons.Apple /> <div><div className="bold">App Store</div><div style={{fontSize:'12px', color:'#94a3b8'}}>Скачать Hiddify</div></div></div>
                    </button>
                    <button onClick={() => handleAction('android', LINKS.android)} className="btn-glass">
                      <div className="btn-content"><Icons.Android /> <div><div className="bold">Google Play</div><div style={{fontSize:'12px', color:'#94a3b8'}}>Скачать Hiddify</div></div></div>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleAction('windows', LINKS.windows)} className="btn-glass">
                      <div className="btn-content"><Icons.Windows /> <div><div className="bold">Windows</div><div style={{fontSize:'12px', color:'#94a3b8'}}>.Msix</div></div></div>
                    </button>
                    <button onClick={() => handleAction('macos', LINKS.macos)} className="btn-glass">
                      <div className="btn-content"><Icons.Laptop /> <div><div className="bold">macOS</div><div style={{fontSize:'12px', color:'#94a3b8'}}>.dmg</div></div></div>
                    </button>
                  </>
                )}
                <button onClick={() => setModal({...modal, step: 2})} className="btn-primary">Вперед</button>
              </div>
            )}

            {modal.step === 2 && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                 <div className="selection-badge">
                    <p style={{fontSize: '10px', color: '#94a3b8', margin: 0}}>Твое приложение:</p>
                    <p className="bold text-primary" style={{margin: 0}}>Hiddify Next</p>
                 </div>
                 <button
                    disabled={!vpnData.configUrl}
                    onClick={() => handleAction('deep', LINKS.deep_config + encodeURIComponent(vpnData.configUrl))}
                    className="btn-glass highlight"
                 >
                    <div className="btn-content">
                      <span className="text-primary"><Icons.Rocket /></span>
                      <div>
                        <div className="bold">Автоматически</div>
                        <div style={{fontSize: '10px', color: '#94a3b8'}}>Импортировать подписку</div>
                      </div>
                    </div>
                 </button>
                 <button onClick={() => handleAction('copy_key')} className="btn-glass">
                    <div className="btn-content">
                      <Icons.Copy />
                      <div>
                        <div className="bold">Копировать</div>
                        <div style={{fontSize: '10px', color: '#94a3b8'}}>Для вставки вручную</div>
                      </div>
                    </div>
                 </button>
                 <div style={{display: 'flex', gap: '12px', marginTop: '12px'}}>
                   <button onClick={() => setModal({...modal, step: 1})} className="btn-outline">Назад</button>
                   <button onClick={() => setModal({...modal, active: false})} className="btn-primary" style={{marginTop: 0, flex: 1}}>Завершить</button>
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
