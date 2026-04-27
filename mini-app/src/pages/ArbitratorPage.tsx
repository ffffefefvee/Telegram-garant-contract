import React from 'react';
import './ArbitratorPage.css';

export const ArbitratorPage: React.FC = () => {
  return (
    <div className="arbitrator-page">
      <div className="arbitrator-header">
        <h1>Кабинет арбитра</h1>
        <p className="arbitrator-subtitle">
          Управление спорами, статус работы, выплаты
        </p>
      </div>

      <div className="arbitrator-placeholder">
        <p>Полный интерфейс арбитра появится в следующем релизе.</p>
        <p>Пока доступен только доступ к разделу.</p>
      </div>
    </div>
  );
};
