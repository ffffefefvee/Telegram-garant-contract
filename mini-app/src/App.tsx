import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import { useTelegramWebApp } from './hooks/useTelegramWebApp';
import { DealsPage } from './pages/DealsPage';
import { DealChatPage } from './pages/DealChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { BottomNav } from './components/BottomNav';
import './styles/global.css';

const App: React.FC = () => {
  const { user, setUser, setLoading, isLoading } = useAppStore();
  const { isDarkMode, themeParams } = useTelegramWebApp();

  useEffect(() => {
    if (themeParams) {
      document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color || '#ffffff');
      document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color || '#000000');
      document.documentElement.style.setProperty('--tg-theme-hint-color', themeParams.hint_color || '#999999');
      document.documentElement.style.setProperty('--tg-theme-link-color', themeParams.link_color || '#2481cc');
      document.documentElement.style.setProperty('--tg-theme-button-color', themeParams.button_color || '#2481cc');
      document.documentElement.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color || '#ffffff');
      document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color || '#f4f4f5');
    }
  }, [themeParams]);

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Navigate to="/deals" replace />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:id" element={<DealChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
};

export default App;