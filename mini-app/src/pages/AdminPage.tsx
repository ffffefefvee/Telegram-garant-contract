import React from 'react';
import './AdminPage.css';

export const AdminPage: React.FC = () => {
  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Админ-панель</h1>
        <p className="admin-subtitle">
          Реестр арбитров, очередь споров, казначейство
        </p>
      </div>

      <div className="admin-placeholder">
        <p>Полная админ-панель появится в следующем релизе.</p>
        <p>Пока доступен только доступ к разделу.</p>
      </div>
    </div>
  );
};
