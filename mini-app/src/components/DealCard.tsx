import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import './DealCard.css';

export interface Deal {
  id: string;
  dealNumber: string;
  type: 'physical' | 'digital' | 'service' | 'rent';
  status: string;
  amount: number;
  currency: string;
  description: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  buyer: {
    id: string;
    telegramFirstName?: string;
    telegramUsername?: string;
  };
  seller?: {
    id: string;
    telegramFirstName?: string;
    telegramUsername?: string;
  };
}

interface DealCardProps {
  deal: Deal;
  currentUserId: string;
  onClick?: () => void;
}

const typeLabels: Record<string, string> = {
  physical: 'Физический товар',
  digital: 'Цифровой товар',
  service: 'Услуга',
  rent: 'Аренда',
};

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  pending_acceptance: 'Ожидает принятия',
  pending_payment: 'Ожидает оплаты',
  in_progress: 'В процессе',
  pending_confirmation: 'Ожидает подтверждения',
  completed: 'Завершена',
  disputed: 'Спор',
  cancelled: 'Отменена',
  refunded: 'Возврат',
};

const statusColors: Record<string, string> = {
  draft: '#8e8e93',
  pending_acceptance: '#ff9500',
  pending_payment: '#ff9500',
  in_progress: '#007aff',
  pending_confirmation: '#007aff',
  completed: '#34c759',
  disputed: '#ff3b30',
  cancelled: '#8e8e93',
  refunded: '#ff9500',
};

export const DealCard: React.FC<DealCardProps> = ({ deal, currentUserId, onClick }) => {
  const otherParty = deal.buyer.id === currentUserId ? deal.seller : deal.buyer;
  const isBuyer = deal.buyer.id === currentUserId;

  return (
    <div className="deal-card" onClick={onClick}>
      <div className="deal-card-header">
        <div className="deal-card-number">#{deal.dealNumber}</div>
        <div
          className="deal-card-status"
          style={{ background: statusColors[deal.status] }}
        >
          {statusLabels[deal.status] || deal.status}
        </div>
      </div>

      <div className="deal-card-title">
        {deal.title || deal.description.slice(0, 60) + (deal.description.length > 60 ? '...' : '')}
      </div>

      <div className="deal-card-info">
        <span className="deal-card-type">{typeLabels[deal.type]}</span>
        <span className="deal-card-amount">
          {deal.amount.toLocaleString()} {deal.currency}
        </span>
      </div>

      <div className="deal-card-footer">
        <div className="deal-card-party">
          <span className="deal-card-role">{isBuyer ? 'Продавец' : 'Покупатель'}</span>
          <span className="deal-card-name">
            {otherParty?.telegramFirstName || otherParty?.telegramUsername || 'Неизвестно'}
          </span>
        </div>
        <div className="deal-card-time">
          {formatDistanceToNow(new Date(deal.updatedAt), { addSuffix: true, locale: ru })}
        </div>
      </div>
    </div>
  );
};