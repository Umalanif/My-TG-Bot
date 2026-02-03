import React, { useState, useEffect } from 'react';
import { useLaunchParams, useThemeParams, useViewport, useInitData, isTMA, initDataRaw, openLink } from '@telegram-apps/sdk-react';

function App() {
  const [isMounted, setIsMounted] = useState(false);
  const launchParams = useLaunchParams();
  const themeParams = useThemeParams();
  const viewport = useViewport();
  const initData = useInitData();

  const [theme, setTheme] = useState('light');
  const [userData, setUserData] = useState(null);
  
  useEffect(() => {
    // Set theme based on Telegram's theme parameters
    if (themeParams.bg_color && themeParams.bg_color.startsWith('#')) {
      setTheme('dark');
      document.body.style.backgroundColor = themeParams.bg_color;
    } else {
      setTheme('light');
      document.body.style.backgroundColor = themeParams.bg_color || '#ffffff';
    }
    
    // Apply theme to document element for CSS variables
    Object.entries(themeParams).forEach(([key, value]) => {
      if (value) {
        document.documentElement.style.setProperty(`--tg-theme-${key}`, value);
      }
    });

    // Extract user data
    if (initData?.user) {
      setUserData(initData.user);
    }
    
    setIsMounted(true);
  }, [themeParams, initData]);

  // Handle back button functionality
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.BackButton?.show();
      window.Telegram.WebApp.onEvent('back_button_pressed', () => {
        window.Telegram.WebApp.close();
      });
    }

    // Clean up event listeners
    return () => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.offEvent('back_button_pressed');
      }
    };
  }, []);

  const handleConnectWallet = async () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback?.impactOccurred('light');
      window.Telegram.WebApp.showAlert('VPN subscription service connected!');
    }
  };

  const handleSubscribe = async () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback?.impactOccurred('light');
      // Show loading indicator
      window.Telegram.WebApp.showPreloader();
      try {
        // Get init data to send with the request for authentication
        const initData = window.Telegram.WebApp.initData || '';
        
        // Call the backend API to subscribe to VPN service
        const response = await fetch('http://localhost:3001/api/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-InitData': encodeURIComponent(initData),
          },
          body: JSON.stringify({
            user_id: userData?.id,
            username: userData?.username,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          window.Telegram.WebApp.showAlert(result.message || 'Successfully subscribed to VPN service!');
        } else {
          const error = await response.json();
          window.Telegram.WebApp.showAlert(error.message || 'Failed to subscribe. Please try again.');
        }
      } catch (error) {
        window.Telegram.WebApp.showAlert('Failed to subscribe. Network error occurred.');
        console.error('Subscription error:', error);
      } finally {
        window.Telegram.WebApp.hidePreloader();
      }
    }
  };

  // Function to share the app with friends
  const handleShare = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback?.impactOccurred('light');
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=Check out this VPN subscription service!`;
      openLink(shareUrl);
    }
  };

  // Function to check if user is premium
  const isPremium = userData?.is_premium;

  return (
    <div style={{
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
      color: themeParams.text_color || (theme === 'dark' ? '#ffffff' : '#000000'),
      minHeight: '100vh',
      backgroundColor: themeParams.bg_color || '#ffffff',
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      <header style={{
        textAlign: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: `1px solid ${themeParams.secondary_bg_color || '#e0e0e0'}`
      }}>
        <h1 style={{
          color: themeParams.hint_color || (theme === 'dark' ? '#cccccc' : '#666666'),
          margin: 0,
          fontSize: '1.8rem'
        }}>
          🛡️ VPN Subscription Service
        </h1>
        {isPremium && (
          <span style={{
            display: 'inline-block',
            marginTop: '8px',
            padding: '4px 10px',
            backgroundColor: themeParams.accent_text_color || '#3390ec',
            color: themeParams.button_text_color || '#ffffff',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 'bold'
          }}>
            Premium User
          </span>
        )}
      </header>
      
      {/* User Profile Section */}
      <section style={{
        backgroundColor: themeParams.section_bg_color || themeParams.bg_color || '#f0f0f0',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h2 style={{
          color: themeParams.header_text_color || (theme === 'dark' ? '#ffffff' : '#333333'),
          margin: '0 0 15px 0',
          fontSize: '1.3rem'
        }}>Your Profile</h2>
        
        {userData ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: themeParams.button_color || '#3390ec',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: themeParams.button_text_color || '#ffffff',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {userData.first_name?.charAt(0) || '?'}
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '1.2rem' }}>
                {userData.first_name} {userData.last_name || ''}
              </p>
              {userData.username && (
                <p style={{ margin: 0, color: themeParams.hint_color || '#666666', fontSize: '0.9rem' }}>
                  @{userData.username}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p style={{ color: themeParams.hint_color || '#666666', fontStyle: 'italic' }}>Loading user data...</p>
        )}
        
        {userData && (
          <div style={{ fontSize: '0.9rem' }}>
            <p><strong>ID:</strong> {userData.id.toString()}</p>
            <p><strong>Premium:</strong> {userData.is_premium ? 'Yes' : 'No'}</p>
            <p><strong>Language:</strong> {userData.language_code || 'Not set'}</p>
          </div>
        )}
      </section>

      {/* Action Buttons */}
      <section style={{ marginBottom: '25px' }}>
        <h2 style={{
          color: themeParams.header_text_color || (theme === 'dark' ? '#ffffff' : '#333333'),
          margin: '0 0 15px 0',
          fontSize: '1.3rem'
        }}>Actions</h2>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <button
            onClick={handleSubscribe}
            style={{
              padding: '15px',
              backgroundColor: (isPremium ? themeParams.accent_text_color : themeParams.button_color) || '#3390ec',
              color: themeParams.button_text_color || '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isPremium ? 'Manage Subscription' : 'Subscribe to VPN'} 🔒
          </button>
          
          <button
            onClick={handleConnectWallet}
            style={{
              padding: '15px',
              backgroundColor: themeParams.secondary_bg_color || '#f0f0f0',
              color: themeParams.text_color || '#000000',
              border: `1px solid ${themeParams.hint_color || '#cccccc'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            Connect Wallet 💰
          </button>
          
          <button
            onClick={handleShare}
            style={{
              padding: '15px',
              backgroundColor: themeParams.button_color || '#3390ec',
              color: themeParams.button_text_color || '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            Share with Friends 🚀
          </button>
        </div>
      </section>

      {/* Telegram WebApp Info */}
      <footer style={{
        paddingTop: '20px',
        borderTop: `1px solid ${themeParams.secondary_bg_color || '#e0e0e0'}`,
        color: themeParams.hint_color || '#666666',
        fontSize: '0.8rem'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: themeParams.text_color || '#333333' }}>App Info</h3>
        <p><strong>Platform:</strong> {launchParams.platform || 'Unknown'}</p>
        <p><strong>Version:</strong> {launchParams.version || 'Unknown'}</p>
        <p><strong>Is TMA:</strong> {isTMA() ? 'Yes' : 'No'}</p>
        {viewport && (
          <div>
            <p><strong>Viewport Height:</strong> {viewport.height}px</p>
            <p><strong>Stable Height:</strong> {viewport.stable_height}px</p>
          </div>
        )}
        {!initData && (
          <p style={{ color: '#ff4d4d', marginTop: '10px' }}>
            Warning: Telegram Init Data not available. Please run this app in Telegram.
          </p>
        )}
      </footer>
    </div>
  );
}

export default App;