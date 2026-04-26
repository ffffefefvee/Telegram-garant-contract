import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dealsApi, paymentsApi } from '../api';
import { useAppStore } from '../store/appStore';
import { ChatWindow } from '../components/ChatWindow';
import { Deal } from '../types';
import './DealChatPage.css';

export const DealChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadDeal();
  }, [id]);

  const loadDeal = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await dealsApi.getById(id);
      setDeal(data);
    } catch (error) {
      console.error('Failed to load deal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    if (!deal) return;
    try {
      const result = await paymentsApi.create({
        dealId: deal.id,
        amount: deal.amount,
        currency: deal.currency,
        description: `Оплата сделки #${deal.dealNumber}`,
      });
      setPaymentUrl(result.paymentUrl);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Payment error:', error);
    }
  };

  const handleConfirm = async () => {
    if (!deal) return;
    try {
      await dealsApi.confirm(deal.id);
      await loadDeal();
    } catch (error) {
      console.error('Confirm error:', error);
    }
  };

  const getOtherUser = () => {
    if (!deal || !user) return { id: '', name: 'Неизвестно' };
    const other = deal.buyer.id === user.id ? deal.seller : deal.buyer;
    return {
      id: other?.id || '',
      name: other?.telegramFirstName || other?.telegramUsername || 'Неизвестно',
      avatar: undefined,
    };
  };

  const statusActions: Record<string, { label: string; action: () => void; style: string } | null> = {
    pending_payment: { label: 'Оплатить', action: handlePay, style: 'primary' },
    pending_confirmation: { label: 'Подтвердить получение', action: handleConfirm, style: 'success' },
  };

  if (isLoading) {
    return <div className="deal-chat-page loading">Загрузка...</div>;
  }

  if (!deal) {
    return <div className="deal-chat-page error">Сделка не найдена</div>;
  }

  const otherUser = getOtherUser();
  const action = statusActions[deal.status];

  return (
    <div className="deal-chat-page">
      <div className="deal-chat-header">
        <button className="back-btn" onClick={() => navigate('/deals')}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              fill="currentColor"
              d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            />
          </svg>
        </button>
        <div className="deal-info-summary">
          <span className="deal-number">#{deal.dealNumber}</span>
          <span className="deal-amount">
            {deal.amount.toLocaleString()} {deal.currency}
          </span>
        </div>
      </div>

      <div className="deal-status-bar">
        <span className={`status-badge status-${deal.status}`}>
          {deal.status.replace('_', ' ')}
        </span>
        {action && (
          <button
            className={`btn-action btn-${action.style}`}
            onClick={action.action}
          >
            {action.label}
          </button>
        )}
      </div>

      <div className="deal-content">
        <ChatWindow dealId={deal.id} otherUser={otherUser} />
      </div>

      {showPaymentModal && paymentUrl && (
        <div className="payment-modal">
          <div className="payment-modal-content">
            <h3>Оплата сделки</h3>
            <p>Перейдите по ссылке для оплаты:</p>
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
              Открыть ссылку на оплату
            </a>
            <button onClick={() => setShowPaymentModal(false)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};