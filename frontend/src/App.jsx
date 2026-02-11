import React, { useState, useEffect, useMemo } from 'react';
import { miniApp, viewport, openLink, retrieveLaunchParams, initDataRaw, hapticFeedback } from '@telegram-apps/sdk';

// --- КОНФИГУРАЦИЯ ССЫЛОК ---
const LINKS = {
  android: 'https://play.google.com/store/apps/details?id=com.happproxy',
  ios: 'https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973',
  desktop: 'https://github.com/hiddify/hiddify-app/releases',
  support: 'https://t.me/nexus_vpn_support' // Добавил для футера
};

// --- ИКОНКИ (SVG в стиле Material Design) ---
const Icons = {
  More: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>,
  Close: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>,
  VpnLock: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M22 4v-2h-18l-2 2v18h20v-18h-2zm-2 16h-16v-14h16v14z"/><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>, // Упрощенная иконка
  Person: () => <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  Smartphone: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>,
  Laptop: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>,
  Tv: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>,
  ArrowRight: () => <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>,
  ErrorOutline: () => <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>
};

// --- ЛОГИКА SDK ---
function getLaunchData() {
  try {
    const lp = retrieveLaunchParams();
    if (lp?.initData?.user) return { user: lp.initData.user, rawData: initDataRaw(), theme: lp.themeParams };
  } catch (e) {}
  try {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const tgData = params.get('tgWebAppData');
    if (tgData) {
      const user = JSON.parse(new URLSearchParams(tgData).get('user'));
      return { user, rawData: tgData, theme: {} };
    }
  } catch (e) {}
  // Fallback для тестов в браузере
  return { user: { first_name: "Test User", username: "tester", id: 123456 }, rawData: "", theme: {} };
}

function App() {
  const [isMounted, setIsMounted] = useState(false);
  const launchData = useMemo(() => getLaunchData(), []);

  // 1. Инициализация (Принудительно темная тема для стиля Nexus)
  useEffect(() => {
    const init = async () => {
      if (miniApp.mount.isAvailable()) await miniApp.mount();
      if (viewport.mount.isAvailable()) await viewport.mount();
      
      // Устанавливаем цвета хедера под наш фон
      if (miniApp.setHeaderColor.isAvailable()) {
        miniApp.setHeaderColor('#050b14');
        miniApp.setBackgroundColor('#050b14');
      }
      setIsMounted(true);
    };
    init();
  }, []);

  const handleAction = (type) => {
    if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred('light');
    if (LINKS[type]) openLink(LINKS[type]);
  };

  if (!launchData || !isMounted) return <div style={{ background: '#050b14', minHeight: '100vh', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Nexus...</div>;

  const { user } = launchData;

  // --- СТИЛИ (CSS-in-JS based on Nexus Design) ---
  const colors = {
    primary: "#00f0ff", // Neon Cyan
    secondary: "#7000ff", // Neon Purple
    bgDark: "#050b14", // Deep Navy
    glass: "rgba(15, 23, 42, 0.6)",
    glassCard: "rgba(30, 41, 59, 0.4)",
    danger: "#ff0055",
    textGray: "#9ca3af",
    textWhite: "#f3f4f6"
  };

  // Inject Global Fonts and Keyframes
  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap');
    
    @keyframes pulse-neon {
      0%, 100% { opacity: 1; text-shadow: 0 0 10px ${colors.primary}; }
      50% { opacity: 0.7; text-shadow: 0 0 20px ${colors.primary}, 0 0 30px ${colors.secondary}; }
    }
    
    body { margin: 0; padding: 0; background: ${colors.bgDark}; overflow-x: hidden; }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  `;

  const s = {
    page: {
      minHeight: '100vh',
      background: `
        radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
        radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
        radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%),
        #050b14
      `,
      backgroundAttachment: 'fixed',
      fontFamily: '"Rajdhani", sans-serif',
      color: colors.textWhite,
      padding: '16px',
      position: 'relative'
    },
    scanlines: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1))',
      backgroundSize: '100% 4px',
      pointerEvents: 'none', zIndex: 50, opacity: 0.2
    },
    // Header
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 },
    logoBox: { display: 'flex', alignItems: 'center', gap: '8px' },
    logoIcon: { color: colors.primary, animation: 'pulse-neon 2s infinite' },
    logoText: { fontFamily: '"Orbitron", sans-serif', fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.05em' },
    logoSuffix: { color: colors.primary },
    logoSub: { color: colors.textGray, fontSize: '14px', fontWeight: 'normal', marginLeft: '8px' },
    headerActions: { display: 'flex', gap: '12px', color: colors.textGray },

    // Glass Panel (Main)
    glassPanel: {
      background: colors.glass,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '24px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      position: 'relative', overflow: 'hidden'
    },
    panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(55, 65, 81, 0.5)', paddingBottom: '16px' },
    panelTitle: { fontFamily: '"Orbitron", sans-serif', fontSize: '24px', fontWeight: 'bold', letterSpacing: '0.05em' },
    statusBadge: {
      padding: '4px 12px', background: 'rgba(255, 0, 85, 0.1)', border: '1px solid rgba(255, 0, 85, 0.3)',
      color: colors.danger, fontSize: '12px', fontWeight: 'bold', borderRadius: '999px',
      textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 0 10px rgba(255, 0, 85, 0.3)'
    },

    // User Grid
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
    glassCardSmall: {
      background: colors.glassCard, backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px'
    },
    iconCircle: {
      width: '40px', height: '40px', borderRadius: '50%', background: '#1f2937',
      display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #374151', color: '#d1d5db'
    },
    labelSmall: { fontSize: '12px', color: colors.textGray, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' },
    valueMain: { fontFamily: '"Orbitron", sans-serif', fontSize: '14px', fontWeight: '600' },

    // Expired Banner
    expiredBanner: {
      background: 'linear-gradient(to right, rgba(255, 0, 85, 0.2), transparent)',
      borderLeft: `4px solid ${colors.danger}`,
      borderRadius: '0 12px 12px 0', padding: '16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    
    // Buttons & Cards
    sectionTitle: { fontSize: '12px', fontWeight: 'bold', color: colors.textGray, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', paddingLeft: '8px' },
    actionBtn: {
      width: '100%',
      background: colors.glassCard,
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '12px', padding: '16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: 'white', cursor: 'pointer', marginBottom: '12px',
      transition: 'all 0.3s ease'
    },
    // Helpers for hover effects would usually go here, but inline styles limit hover. 
    // We rely on simple layout here.

    flexGap: { display: 'flex', alignItems: 'center', gap: '16px' },
    iconBoxGradient: {
      width: '40px', height: '40px', borderRadius: '8px',
      background: 'linear-gradient(135deg, #1f2937, #111827)',
      border: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    textLeft: { textAlign: 'left' },
    textLg: { fontSize: '18px', fontWeight: '600', display: 'block' },
    textSub: { fontSize: '12px', color: colors.textGray },
    
    footer: { marginTop: '32px', textAlign: 'center', paddingBottom: '16px' },
    link: { color: 'rgba(0, 240, 255, 0.7)', fontSize: '14px', fontFamily: 'monospace', textDecoration: 'none' }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div style={s.page}>
        <div style={s.scanlines}></div>

        {/* 1. HEADER */}
        <div style={s.header}>
          <div style={s.logoBox}>
            <div style={s.logoIcon}><Icons.VpnLock /></div>
            <h1 style={s.logoText}>
              NEXUS<span style={s.logoSuffix}>-VPN</span>
              <span style={s.logoSub}>| Access Hub</span>
            </h1>
          </div>
          <div style={s.headerActions}>
            <Icons.More />
          </div>
        </div>

        {/* 2. MAIN GLASS PANEL (SUBSCRIPTION) */}
        <div style={s.glassPanel}>
          {/* Decorative corner */}
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '64px', height: '64px',
            background: 'linear-gradient(to bottom left, rgba(0, 240, 255, 0.1), transparent)',
            borderRadius: '0 0 0 16px', pointerEvents: 'none'
          }}></div>

          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>ПОДПИСКА</h2>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
               {/* Toggle visual */}
               <div style={{width: '40px', height: '20px', background: '#374151', borderRadius: '20px', position: 'relative'}}>
                 <div style={{width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px'}}></div>
               </div>
               <span style={s.statusBadge}>Неактивно</span>
            </div>
          </div>

          <div style={s.grid}>
            <div style={s.glassCardSmall}>
              <div style={s.iconCircle}><Icons.Person /></div>
              <div>
                <p style={s.labelSmall}>Пользователь</p>
                <p style={s.valueMain}>{user.first_name}</p>
              </div>
            </div>
            <div style={s.glassCardSmall}>
              <div style={s.iconCircle}><Icons.Smartphone /></div>
              <div>
                <p style={s.labelSmall}>Устройства</p>
                <p style={s.valueMain}>1 / 5</p>
              </div>
            </div>
          </div>

          <div style={s.expiredBanner}>
            <div style={s.flexGap}>
              <div style={{color: colors.danger}}><Icons.ErrorOutline /></div>
              <div>
                <p style={{...s.labelSmall, color: colors.textGray}}>Статус</p>
                <p style={{...s.panelTitle, fontSize: '18px', color: colors.danger}}>ИСТЕКЛА</p>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <p style={{fontSize: '12px', color: colors.textGray}}>Закончилась</p>
              <p style={{fontFamily: 'monospace', color: '#d1d5db', fontSize: '14px'}}>26.01.2026</p>
            </div>
          </div>
        </div>

        {/* 3. ADD SUB BUTTON */}
        <div style={{marginBottom: '24px'}}>
            <h3 style={s.sectionTitle}>Есть V2RayTun или Hiddify?</h3>
            <button 
                onClick={() => handleAction('copy')} // В оригинале копирование ключа
                style={{...s.actionBtn, border: `1px solid ${colors.primary}40`}}
            >
                <div style={s.flexGap}>
                    <div style={{display: 'flex', marginRight: '8px'}}>
                        <div style={{width: '32px', height: '32px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontFamily: '"Orbitron", sans-serif', zIndex: 2}}>H</div>
                        <div style={{width: '32px', height: '32px', background: '#000', border: '1px solid #4b5563', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontFamily: '"Orbitron", sans-serif', marginLeft: '-12px'}}>v2</div>
                    </div>
                    <span style={{fontWeight: '600', color: 'white'}}>Добавить подписку</span>
                </div>
                <div style={{color: colors.textGray}}><Icons.ArrowRight /></div>
            </button>
        </div>

        {/* 4. SETUP LINKS */}
        <div>
            <h3 style={s.sectionTitle}>Настройка Подключения</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                
                {/* Android */}
                <button onClick={() => handleAction('android')} style={s.actionBtn}>
                    <div style={s.flexGap}>
                        <div style={s.iconBoxGradient}><Icons.Smartphone /></div>
                        <div style={s.textLeft}>
                            <span style={s.textLg}>Смартфон</span>
                            <span style={s.textSub}>Android & iOS</span>
                        </div>
                    </div>
                    <div style={{color: colors.textGray}}><Icons.ArrowRight /></div>
                </button>

                {/* PC */}
                <button onClick={() => handleAction('desktop')} style={s.actionBtn}>
                    <div style={s.flexGap}>
                        <div style={s.iconBoxGradient}><Icons.Laptop /></div>
                        <div style={s.textLeft}>
                            <span style={s.textLg}>ПК / Ноутбук</span>
                            <span style={s.textSub}>Windows, Mac, Linux</span>
                        </div>
                    </div>
                    <div style={{color: colors.textGray}}><Icons.ArrowRight /></div>
                </button>

                {/* TV */}
                <button onClick={() => handleAction('android')} style={s.actionBtn}>
                    <div style={s.flexGap}>
                        <div style={s.iconBoxGradient}><Icons.Tv /></div>
                        <div style={s.textLeft}>
                            <span style={s.textLg}>Smart TV</span>
                            <span style={s.textSub}>Android TV, Box</span>
                        </div>
                    </div>
                    <div style={{color: colors.textGray}}><Icons.ArrowRight /></div>
                </button>

            </div>
        </div>

        {/* 5. FOOTER */}
        <div style={s.footer}>
            <a href={LINKS.support} style={s.link} onClick={(e) => { e.preventDefault(); openLink(LINKS.support); }}>
                @nexus_vpn_support
            </a>
        </div>

      </div>
    </>
  );
}

export default App;
