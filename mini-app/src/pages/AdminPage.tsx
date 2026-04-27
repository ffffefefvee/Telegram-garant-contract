import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api';
import {
  ArbitratorStatus,
  DisputeStatus,
  type AdminDashboardStats,
  type AdminDisputeStats,
  type ArbitratorProfile,
  type Dispute,
} from '../types';
import './AdminPage.css';

type Tab = 'dashboard' | 'arbitrators' | 'disputes' | 'treasury' | 'audit';

const STATUS_LABEL_DISPUTE: Record<DisputeStatus, string> = {
  opened: 'Открыт',
  waiting_seller_response: 'Ждём продавца',
  waiting_buyer_evidence: 'Ждём покупателя',
  waiting_seller_evidence: 'Ждём продавца',
  pending_arbitrator: 'Ждёт арбитра',
  under_review: 'На рассмотрении',
  decision_made: 'Решение',
  appeal_period: 'Апелляция',
  appealed: 'Апелляция',
  enforced: 'Исполнено',
  closed: 'Закрыт',
};

const STATUS_LABEL_ARB: Record<ArbitratorStatus, string> = {
  active: 'Активен',
  pending: 'Ожидает',
  suspended: 'Приостановлен',
  rejected: 'Отклонён',
};

export const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Админ-панель</h1>
      </div>

      <div className="admin-tabs" role="tablist">
        <button
          className={`tab-button ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          Обзор
        </button>
        <button
          className={`tab-button ${tab === 'arbitrators' ? 'active' : ''}`}
          onClick={() => setTab('arbitrators')}
        >
          Арбитры
        </button>
        <button
          className={`tab-button ${tab === 'disputes' ? 'active' : ''}`}
          onClick={() => setTab('disputes')}
        >
          Споры
        </button>
        <button
          className={`tab-button ${tab === 'treasury' ? 'active' : ''}`}
          onClick={() => setTab('treasury')}
        >
          Казна
        </button>
        <button
          className={`tab-button ${tab === 'audit' ? 'active' : ''}`}
          onClick={() => setTab('audit')}
        >
          Audit
        </button>
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'arbitrators' && <ArbitratorsTab />}
      {tab === 'disputes' && <DisputesTab />}
      {tab === 'treasury' && <TreasuryPlaceholder />}
      {tab === 'audit' && <AuditPlaceholder />}
    </div>
  );
};

// ─── Dashboard ─────────────────────────────────────────────

const DashboardTab: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [disputeStats, setDisputeStats] = useState<AdminDisputeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [d, ds] = await Promise.all([
          adminApi.getDashboard(),
          adminApi.getDisputeStats(),
        ]);
        if (cancelled) return;
        setStats(d);
        setDisputeStats(ds);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить статистику');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="empty-hint">Загрузка...</p>;
  if (error) return <p className="wallet-error">{error}</p>;

  return (
    <div className="admin-panel">
      <div className="admin-kpi">
        <div className="kpi-card">
          <span className="kpi-value">{stats?.users.total ?? 0}</span>
          <span className="kpi-label">Пользователей</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{stats?.deals.total ?? 0}</span>
          <span className="kpi-label">Сделок</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{stats?.finance.volume.toFixed?.(2) ?? 0}</span>
          <span className="kpi-label">Объём</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{disputeStats?.total ?? 0}</span>
          <span className="kpi-label">Споров</span>
        </div>
      </div>

      {disputeStats?.byStatus && (
        <div className="admin-breakdown">
          <h3>Споры по статусам</h3>
          {Object.entries(disputeStats.byStatus).map(([k, v]) => (
            <div key={k} className="breakdown-row">
              <span>{STATUS_LABEL_DISPUTE[k as DisputeStatus] ?? k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Arbitrators ───────────────────────────────────────────

const ArbitratorsTab: React.FC = () => {
  const [filter, setFilter] = useState<ArbitratorStatus | 'all'>('all');
  const [list, setList] = useState<ArbitratorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getArbitrators(
        filter === 'all' ? undefined : filter,
      );
      setList(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const act = async (
    userId: string,
    action: 'approve' | 'reject' | 'suspend' | 'reactivate',
  ) => {
    setActingOn(userId);
    try {
      if (action === 'approve') await adminApi.approveArbitrator(userId);
      if (action === 'reject') await adminApi.rejectArbitrator(userId);
      if (action === 'suspend') {
        const reason = window.prompt('Причина приостановки?');
        if (!reason) return;
        await adminApi.suspendArbitrator(userId, reason);
      }
      if (action === 'reactivate') await adminApi.reactivateArbitrator(userId);
      await load();
    } catch (err) {
      const m =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? (err instanceof Error ? err.message : 'Действие не удалось');
      window.alert(m);
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-filter-row">
        <label>
          Статус:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ArbitratorStatus | 'all')}
          >
            <option value="all">Все</option>
            <option value="pending">Ожидают</option>
            <option value="active">Активные</option>
            <option value="suspended">Приостановлены</option>
            <option value="rejected">Отклонённые</option>
          </select>
        </label>
      </div>

      {loading && <p className="empty-hint">Загрузка...</p>}
      {error && <p className="wallet-error">{error}</p>}
      {!loading && list.length === 0 && (
        <p className="empty-hint">Нет арбитров в этой категории.</p>
      )}

      <div className="admin-row-list">
        {list.map((a) => (
          <div key={a.id} className="admin-row">
            <div className="admin-row-main">
              <div className="admin-row-title">
                {a.user?.telegramFirstName || a.user?.telegramUsername || 'Арбитр'}
              </div>
              <div className="admin-row-meta">
                {STATUS_LABEL_ARB[a.status]} · Дел: {a.totalCases} · Рейтинг: {a.rating.toFixed(1)}
              </div>
            </div>
            <div className="admin-row-actions">
              {a.status === ArbitratorStatus.PENDING && (
                <>
                  <button
                    className="primary-button tiny"
                    disabled={actingOn === a.userId}
                    onClick={() => act(a.userId, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button tiny"
                    disabled={actingOn === a.userId}
                    onClick={() => act(a.userId, 'reject')}
                  >
                    Reject
                  </button>
                </>
              )}
              {a.status === ArbitratorStatus.ACTIVE && (
                <button
                  className="secondary-button tiny"
                  disabled={actingOn === a.userId}
                  onClick={() => act(a.userId, 'suspend')}
                >
                  Suspend
                </button>
              )}
              {a.status === ArbitratorStatus.SUSPENDED && (
                <button
                  className="primary-button tiny"
                  disabled={actingOn === a.userId}
                  onClick={() => act(a.userId, 'reactivate')}
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Disputes ──────────────────────────────────────────────

const DisputesTab: React.FC = () => {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDisputes({ page: 1, limit: 50 });
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить споры');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = useMemo(
    () =>
      items.filter(
        (d) =>
          d.status !== DisputeStatus.ENFORCED && d.status !== DisputeStatus.CLOSED,
      ),
    [items],
  );

  const handleReassign = async (id: string) => {
    const arbitratorId = window.prompt('ID нового арбитра (user-uuid)?');
    if (!arbitratorId) return;
    try {
      await adminApi.reassignArbitrator(id, arbitratorId);
      await load();
    } catch (err) {
      const m =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? (err instanceof Error ? err.message : 'Не удалось переназначить');
      window.alert(m);
    }
  };

  const handleClose = async (id: string) => {
    const reason = window.prompt('Причина закрытия?');
    if (!reason) return;
    try {
      await adminApi.closeDispute(id, reason);
      await load();
    } catch (err) {
      const m =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? (err instanceof Error ? err.message : 'Не удалось закрыть');
      window.alert(m);
    }
  };

  return (
    <div className="admin-panel">
      {loading && <p className="empty-hint">Загрузка...</p>}
      {error && <p className="wallet-error">{error}</p>}
      {!loading && active.length === 0 && (
        <p className="empty-hint">Активных споров нет.</p>
      )}

      <div className="admin-row-list">
        {active.map((d) => (
          <div key={d.id} className="admin-row">
            <div className="admin-row-main">
              <div className="admin-row-title">Спор #{d.id.slice(0, 8)}</div>
              <div className="admin-row-meta">
                {STATUS_LABEL_DISPUTE[d.status]} · {d.reason}
              </div>
              {d.arbitratorId && (
                <div className="admin-row-sub">
                  Арбитр: {d.arbitrator?.telegramUsername || d.arbitratorId.slice(0, 8)}
                </div>
              )}
            </div>
            <div className="admin-row-actions">
              <button className="secondary-button tiny" onClick={() => handleReassign(d.id)}>
                Reassign
              </button>
              <button className="secondary-button tiny" onClick={() => handleClose(d.id)}>
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Placeholders ──────────────────────────────────────────

const TreasuryPlaceholder: React.FC = () => (
  <div className="admin-panel">
    <div className="admin-placeholder">
      <h3>Казна</h3>
      <p>
        Ончейн-баланс Treasury Operational / Reserve / Insurance виден прямо в контракте
        <code>PlatformTreasury.sol</code>. Отдельный endpoint для чтения через backend
        будет добавлен в следующем релизе.
      </p>
    </div>
  </div>
);

const AuditPlaceholder: React.FC = () => (
  <div className="admin-panel">
    <div className="admin-placeholder">
      <h3>Audit Log</h3>
      <p>
        Записи уже идут в таблицу <code>audit_log</code> (PR #14).
        Admin-эндпоинт для чтения + фильтрации появится в отдельном PR.
      </p>
    </div>
  </div>
);
