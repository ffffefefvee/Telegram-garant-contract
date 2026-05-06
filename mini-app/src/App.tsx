import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTelegramWebApp } from './hooks/useTelegramWebApp';
import { DealsPage } from './pages/DealsPage';
import { DealChatPage } from './pages/DealChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ArbitratorPage } from './pages/ArbitratorPage';
import { AdminPage } from './pages/AdminPage';
import { BottomNav } from './components/BottomNav';
import { AuthGate } from './components/AuthGate';
import { RoleGuard } from './components/RoleGuard';
import { UserRole } from './types';
import './styles/global.css';

const App: React.FC = () => {
  const { themeParams } = useTelegramWebApp();

  useEffect(() => {
    if (themeParams) {
      document.documentElement.style.setProperty(
        '--tg-theme-bg-color',
        themeParams.bg_color || '#ffffff',
      );
      document.documentElement.style.setProperty(
        '--tg-theme-text-color',
        themeParams.text_color || '#000000',
      );
      document.documentElement.style.setProperty(
        '--tg-theme-hint-color',
        themeParams.hint_color || '#999999',
      );
      document.documentElement.style.setProperty(
        '--tg-theme-link-color',
        themeParams.link_color || '#2481cc',
      );
      document.documentElement.style.setProperty(
        '--tg-theme-button-color',
        themeParams.button_color || '#2481cc',
      );
      document.documentElement.style.setProperty(
        '--tg-theme-button-text-color',
        themeParams.button_text_color || '#ffffff',
      );
      document.documentElement.style.setProperty(
        '--tg-theme-secondary-bg-color',
        themeParams.secondary_bg_color || '#f4f4f5',
      );
    }
  }, [themeParams]);

  return (
    <BrowserRouter>
      <AuthGate>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Navigate to="/deals" replace />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealChatPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/arbitrator/*"
              element={
                <RoleGuard role={UserRole.ARBITRATOR}>
                  <ArbitratorPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/*"
              element={
                <RoleGuard role={UserRole.ADMIN}>
                  <AdminPage />
                </RoleGuard>
              }
            />
          </Routes>
          <BottomNav />
        </div>
      </AuthGate>
    </BrowserRouter>
  );
};

export default App;
