import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { dealsApi } from '../api';
import { DealCard, Deal } from '../components/DealCard';
import './DealsPage.css';

type Filter = 'all' | 'active' | 'completed';

export const DealsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, [filter]);

  const loadDeals = async () => {
    try {
      setIsLoading(true);
      const statusFilter =
        filter === 'all'
          ? []
          : filter === 'active'
          ? ['pending_acceptance', 'pending_payment', 'in_progress', 'pending_confirmation']
          : ['completed'];
      const data = await dealsApi.getAll({ status: statusFilter, limit: 50 });
      setDeals(data.deals || []);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDealClick = (deal: Deal) => {
    navigate(`/deals/${deal.id}`);
  };

  if (isLoading) {
    return (
      <div className="deals-page">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="deals-page">
      <div className="deals-page-header">
        <h1>Мои сделки</h1>
        <button className="btn-new-deal" onClick={() => navigate('/deals/new')}>
          + Новая сделка
        </button>
      </div>

      <div className="deals-filters">
        <button
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Активные
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Завершённые
        </button>
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
      </div>

      <div className="deals-list">
        {deals.length === 0 ? (
          <div className="deals-empty">
            <p>Сделок пока нет</p>
            <button onClick={() => navigate('/deals/new')}>
              Создать первую сделку
            </button>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              currentUserId={user?.id || ''}
              onClick={() => handleDealClick(deal)}
            />
          ))
        )}
      </div>
    </div>
  );
};