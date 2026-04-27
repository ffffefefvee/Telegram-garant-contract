import React from 'react';
import { useAppStore } from '../store/appStore';
import { WalletCard } from '../components/WalletCard';
import { UserRole } from '../types';
import './ProfilePage.css';

const ROLE_LABELS: Record<UserRole, string> = {
  buyer: 'Покупатель',
  seller: 'Продавец',
  arbitrator: 'Арбитр',
  admin: 'Администратор',
};

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAppStore();

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-empty">
          <p>Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {user.telegramFirstName?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="profile-info">
          <h1>{user.telegramFirstName || user.telegramUsername || 'Пользователь'}</h1>
          {user.telegramUsername && (
            <span className="profile-username">@{user.telegramUsername}</span>
          )}
          <div className="profile-roles">
            {user.roles.map((role) => (
              <span key={role} className={`role-chip role-${role}`}>
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <span className="stat-value">{user.balance?.toLocaleString() || 0}</span>
          <span className="stat-label">Баланс</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{user.reputationScore || 0}</span>
          <span className="stat-label">Репутация</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{user.completedDeals || 0}</span>
          <span className="stat-label">Сделок</span>
        </div>
      </div>

      <WalletCard />

      <div className="profile-deals-summary">
        <div className="deals-row">
          <span>Завершено</span>
          <span className="deals-value success">{user.completedDeals || 0}</span>
        </div>
        <div className="deals-row">
          <span>Отменено</span>
          <span className="deals-value danger">{user.cancelledDeals || 0}</span>
        </div>
        <div className="deals-row">
          <span>Со спорами</span>
          <span className="deals-value warning">{user.disputedDeals || 0}</span>
        </div>
      </div>

      <div className="profile-menu">
        <button className="menu-item">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          Настройки
        </button>

        <button className="menu-item">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M12 22c1.1 0 1.99-.89 1.99-1.99h-3.98c0 1.1.9 1.99 1.99 1.99zm7.74-1.8c.61-1.24.99-2.58.99-4.2 0-4.41-3.59-8-8-8s-8 3.59-8 8c0 1.62.38 2.96.99 4.2l-.71 4.91v2.89h15v-2.89l-.72-4.91z"/>
          </svg>
          Помощь
        </button>

        <button className="menu-item logout" onClick={logout}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          Выйти
        </button>
      </div>
    </div>
  );
};
