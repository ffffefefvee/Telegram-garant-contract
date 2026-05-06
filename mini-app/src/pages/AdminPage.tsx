import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  AuditLogEntry,
  AuditLogQuery,
  TreasurySummary,
} from '../api';
import './AdminPage.css';

type Tab = 'treasury' | 'audit';

const formatToken = (raw: string, decimals: number): string => {
  // raw is a decimal string of base units (e.g. "12345600" with decimals=6 → "12.3456").
  if (!raw || raw === '0') return '0';
  const negative = raw.startsWith('-');
  const abs = negative ? raw.slice(1) : raw;
  const padded = abs.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
  const result = fracPart ? `${intPart}.${fracPart}` : intPart;
  return negative ? `-${result}` : result;
};

const shortAddr = (addr: string): string =>
  addr && addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

export const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('treasury');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Админ-панель</h1>
        <p className="admin-subtitle">Казна и журнал аудита</p>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'treasury' ? 'active' : ''}`}
          onClick={() => setTab('treasury')}
        >
          Казна
        </button>
        <button
          className={`admin-tab ${tab === 'audit' ? 'active' : ''}`}
          onClick={() => setTab('audit')}
        >
          Журнал
        </button>
      </div>

      {tab === 'treasury' ? <TreasurySection /> : <AuditSection />}
    </div>
  );
};

const TreasurySection: React.FC = () => {
  const [data, setData] = useState<TreasurySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await adminApi.getTreasurySummary();
      setData(summary);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Не удалось загрузить казну';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <div className="admin-placeholder"><p>Загрузка…</p></div>;
  }
  if (error) {
    return (
      <div className="admin-placeholder">
        <p className="admin-error">{error}</p>
        <button className="admin-link-button" onClick={load}>
          Повторить
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="admin-treasury">
      {!data.ready && (
        <div className="admin-banner">
          On-chain layer is not configured (stub mode). Все балансы показаны как 0.
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-row">
          <span className="admin-card-label">Основной баланс</span>
          <span className="admin-card-value">
            {formatToken(data.main, data.decimals)}
          </span>
        </div>
        <div className="admin-card-row">
          <span className="admin-card-label">Резерв</span>
          <span className="admin-card-value">
            {formatToken(data.reserve, data.decimals)}
          </span>
        </div>
        <div className="admin-card-row">
          <span className="admin-card-label">Сырой баланс контракта</span>
          <span className="admin-card-value">
            {formatToken(data.rawTokenBalance, data.decimals)}
          </span>
        </div>
        <div className="admin-card-row">
          <span className="admin-card-label">Не разнесено (нужен reconcile)</span>
          <span className={`admin-card-value ${data.untracked !== '0' ? 'admin-warn' : ''}`}>
            {formatToken(data.untracked, data.decimals)}
          </span>
        </div>
        <div className="admin-card-row">
          <span className="admin-card-label">Доля резерва</span>
          <span className="admin-card-value">{(data.reserveBps / 100).toFixed(2)}%</span>
        </div>
      </div>

      <div className="admin-card admin-card-meta">
        <div className="admin-card-row">
          <span className="admin-card-label">Treasury</span>
          <span className="admin-card-mono" title={data.treasuryAddress}>
            {shortAddr(data.treasuryAddress)}
          </span>
        </div>
        <div className="admin-card-row">
          <span className="admin-card-label">Token</span>
          <span className="admin-card-mono" title={data.tokenAddress}>
            {shortAddr(data.tokenAddress)}
          </span>
        </div>
      </div>

      <button className="admin-link-button" onClick={load}>
        Обновить
      </button>
    </div>
  );
};

const PAGE_SIZE = 25;

const AuditSection: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{ action: string; aggregateType: string }>({
    action: '',
    aggregateType: '',
  });
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: AuditLogQuery = { page, limit: PAGE_SIZE };
      if (filters.action.trim()) query.action = filters.action.trim();
      if (filters.aggregateType.trim()) query.aggregateType = filters.aggregateType.trim();
      const result = await adminApi.getAuditLog(query);
      setData(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Не удалось загрузить журнал';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total],
  );

  return (
    <div className="admin-audit">
      <div className="admin-filters">
        <input
          className="admin-filter-input"
          placeholder="action (e.g. arbitrator.approved)"
          value={filters.action}
          onChange={(e) => {
            setFilters((f) => ({ ...f, action: e.target.value }));
            setPage(1);
          }}
        />
        <input
          className="admin-filter-input"
          placeholder="aggregateType (e.g. arbitrator)"
          value={filters.aggregateType}
          onChange={(e) => {
            setFilters((f) => ({ ...f, aggregateType: e.target.value }));
            setPage(1);
          }}
        />
      </div>

      {error && (
        <div className="admin-placeholder">
          <p className="admin-error">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="admin-placeholder"><p>Загрузка…</p></div>
      ) : data.length === 0 ? (
        <div className="admin-placeholder"><p>Записей пока нет.</p></div>
      ) : (
        <ul className="admin-audit-list">
          {data.map((entry) => (
            <li key={entry.id} className="admin-audit-item">
              <div className="admin-audit-row">
                <span className="admin-audit-action">{entry.action}</span>
                <span className="admin-audit-time">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="admin-audit-meta">
                <span>
                  {entry.aggregateType}/{entry.aggregateId.slice(0, 8)}…
                </span>
                {entry.actorRole && <span>actor: {entry.actorRole}</span>}
              </div>
              {entry.details && Object.keys(entry.details).length > 0 && (
                <pre className="admin-audit-details">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="admin-pager">
        <button
          className="admin-link-button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ←
        </button>
        <span className="admin-pager-info">
          {page} / {totalPages} · всего {total}
        </span>
        <button
          className="admin-link-button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
};
