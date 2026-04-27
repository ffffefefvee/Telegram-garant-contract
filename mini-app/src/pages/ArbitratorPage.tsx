import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { arbitrationApi } from '../api';
import { useAppStore } from '../store/appStore';
import {
  ArbitratorStatus,
  DisputeStatus,
  type ArbitratorProfile,
  type ArbitratorStatistics,
  type Dispute,
} from '../types';
import './ArbitratorPage.css';

const STATUS_LABEL: Record<DisputeStatus, string> = {
  opened: 'Открыт',
  waiting_seller_response: 'Ждём продавца',
  waiting_buyer_evidence: 'Ждём покупателя',
  waiting_seller_evidence: 'Ждём продавца',
  pending_arbitrator: 'Ждёт арбитра',
  under_review: 'На рассмотрении',
  decision_made: 'Решение принято',
  appeal_period: 'Апелляция',
  appealed: 'Апелляция',
  enforced: 'Исполнено',
  closed: 'Закрыт',
};

const ACTIVE_STATUSES: DisputeStatus[] = [
  DisputeStatus.PENDING_ARBITRATOR,
  DisputeStatus.UNDER_REVIEW,
  DisputeStatus.APPEAL_PERIOD,
  DisputeStatus.APPEALED,
];
const COMPLETED_STATUSES: DisputeStatus[] = [
  DisputeStatus.DECISION_MADE,
  DisputeStatus.ENFORCED,
  DisputeStatus.CLOSED,
];

type Tab = 'active' | 'completed';

export const ArbitratorPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('active');
  const [profile, setProfile] = useState<ArbitratorProfile | null>(null);
  const [stats, setStats] = useState<ArbitratorStatistics | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, statsRes, disputesRes] = await Promise.allSettled([
          arbitrationApi.getMyArbitratorProfile(),
          arbitrationApi.getMyStatistics(),
          arbitrationApi.getMyDisputes(),
        ]);
        if (cancelled) return;
        if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (disputesRes.status === 'fulfilled') setDisputes(disputesRes.value);
        const firstErr = [profileRes, statsRes, disputesRes].find(
          (r) => r.status === 'rejected',
        );
        if (firstErr && firstErr.status === 'rejected') {
          setError(
            firstErr.reason instanceof Error
              ? firstErr.reason.message
              : 'Не удалось загрузить данные',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myDisputes = useMemo(
    () => disputes.filter((d) => d.arbitratorId === user?.id),
    [disputes, user?.id],
  );

  const filtered = useMemo(() => {
    const statuses = tab === 'active' ? ACTIVE_STATUSES : COMPLETED_STATUSES;
    return myDisputes.filter((d) => statuses.includes(d.status));
  }, [myDisputes, tab]);

  const statusBadge = (status?: ArbitratorStatus) => {
    if (!status) return null;
    const label =
      status === 'active' ? 'Активен' :
      status === 'pending' ? 'На рассмотрении' :
      status === 'suspended' ? 'Приостановлен' :
      'Отклонён';
    return <span className={`arb-status-badge arb-status-${status}`}>{label}</span>;
  };

  return (
    <div className="arbitrator-page">
      <div className="arbitrator-header">
        <div className="arbitrator-title-row">
          <h1>Кабинет арбитра</h1>
          {statusBadge(profile?.status)}
        </div>
        {profile && (
          <p className="arbitrator-subtitle">
            {profile.user?.telegramFirstName || profile.user?.telegramUsername || 'Арбитр'}
          </p>
        )}
      </div>

      {stats && (
        <div className="arbitrator-kpi">
          <div className="kpi-card">
            <span className="kpi-value">{stats.totalCases}</span>
            <span className="kpi-label">Всего дел</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{stats.successRate.toFixed(0)}%</span>
            <span className="kpi-label">Success rate</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{stats.averageRating.toFixed(1)}</span>
            <span className="kpi-label">Рейтинг</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-value">{stats.totalEarned.toFixed(2)}</span>
            <span className="kpi-label">Заработано</span>
          </div>
        </div>
      )}

      <div className="arbitrator-tabs">
        <button
          className={`tab-button ${tab === 'active' ? 'active' : ''}`}
          onClick={() => setTab('active')}
        >
          Активные
        </button>
        <button
          className={`tab-button ${tab === 'completed' ? 'active' : ''}`}
          onClick={() => setTab('completed')}
        >
          Завершённые
        </button>
      </div>

      {loading ? (
        <div className="arbitrator-placeholder">
          <p>Загрузка...</p>
        </div>
      ) : error ? (
        <div className="arbitrator-placeholder">
          <p className="arb-error">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="arbitrator-placeholder">
          <p>
            {tab === 'active'
              ? 'Нет активных споров.'
              : 'Нет завершённых споров.'}
          </p>
        </div>
      ) : (
        <div className="arb-dispute-list">
          {filtered.map((d) => (
            <button
              key={d.id}
              className="arb-dispute-card"
              onClick={() => navigate(`/arbitrator/disputes/${d.id}`)}
            >
              <div className="arb-dispute-row">
                <span className="arb-dispute-id">#{d.id.slice(0, 8)}</span>
                <span className={`arb-dispute-status arb-status-${d.status}`}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
              <div className="arb-dispute-reason">{d.reason}</div>
              {d.deal && (
                <div className="arb-dispute-meta">
                  {d.deal.title ?? `Сделка ${d.dealId.slice(0, 8)}`} ·{' '}
                  {d.deal.amount} {d.deal.currency ?? 'USDT'}
                </div>
              )}
              {d.decisionDueAt && (
                <div className="arb-dispute-deadline">
                  Дедлайн: {new Date(d.decisionDueAt).toLocaleString('ru-RU')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
