import React, { useState } from 'react';
import { usersApi } from '../api';
import { useAppStore } from '../store/appStore';
import type { User } from '../types';
import './WalletCard.css';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const WalletCard: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    setError(null);
    const trimmed = input.trim();
    if (!EVM_ADDRESS_RE.test(trimmed)) {
      setError('Введите валидный EVM-адрес (0x + 40 символов)');
      return;
    }
    setSubmitting(true);
    try {
      const updated: User = await usersApi.attachWallet(trimmed);
      setUser(updated);
      setInput('');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? (err instanceof Error ? err.message : 'Не удалось привязать');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetach = async () => {
    if (!window.confirm('Отвязать кошелёк? На текущие сделки это не повлияет.')) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated: User = await usersApi.detachWallet();
      setUser(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось отвязать';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="wallet-card">
      <div className="wallet-card-header">
        <h3>Кошелёк для выплат</h3>
        <span className={`wallet-badge ${user.walletAddress ? 'attached' : 'missing'}`}>
          {user.walletAddress ? 'привязан' : 'не привязан'}
        </span>
      </div>

      {user.walletAddress ? (
        <>
          <div className="wallet-address" title={user.walletAddress}>
            <code>{formatAddress(user.walletAddress)}</code>
          </div>
          <p className="wallet-hint">
            На этот адрес придут USDT при завершении сделок.
          </p>
          <button
            className="secondary-button"
            onClick={handleDetach}
            disabled={submitting}
          >
            {submitting ? 'Отвязываем…' : 'Отвязать'}
          </button>
        </>
      ) : (
        <>
          <p className="wallet-hint">
            Требуется для продавца и арбитра — на этот адрес будут приходить
            USDT-выплаты.
          </p>
          <input
            className="wallet-input"
            type="text"
            placeholder="0x..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="primary-button"
            onClick={handleAttach}
            disabled={submitting || !input.trim()}
          >
            {submitting ? 'Привязываем…' : 'Привязать'}
          </button>
        </>
      )}

      {error && <p className="wallet-error">{error}</p>}
    </div>
  );
};
