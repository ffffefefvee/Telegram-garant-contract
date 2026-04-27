import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { arbitrationApi } from '../api';
import { useAppStore } from '../store/appStore';
import {
  ArbitrationDecisionType,
  DisputeStatus,
  type ArbitrationChatMessage,
  type Dispute,
  type Evidence,
  type MakeDecisionInput,
} from '../types';
import './ArbitratorDisputePage.css';

type Tab = 'evidence' | 'chat' | 'decision';

interface Preset {
  key: string;
  label: string;
  /** Buyer share / seller share in percentage. Drives which decisionType to send. */
  buyerPct: number;
  decisionType: ArbitrationDecisionType;
  defaultReasoning: string;
}

const PRESETS: Preset[] = [
  {
    key: 'buyer-100',
    label: '100 / 0',
    buyerPct: 100,
    decisionType: ArbitrationDecisionType.FULL_REFUND_TO_BUYER,
    defaultReasoning: 'Полный возврат покупателю.',
  },
  {
    key: 'buyer-70',
    label: '70 / 30',
    buyerPct: 70,
    decisionType: ArbitrationDecisionType.PARTIAL_REFUND_TO_BUYER,
    defaultReasoning: 'Частичный возврат покупателю (70/30).',
  },
  {
    key: 'split-50',
    label: '50 / 50',
    buyerPct: 50,
    decisionType: ArbitrationDecisionType.SPLIT_FUNDS,
    defaultReasoning: 'Раздел средств 50/50.',
  },
  {
    key: 'seller-70',
    label: '30 / 70',
    buyerPct: 30,
    decisionType: ArbitrationDecisionType.PARTIAL_PAYMENT_TO_SELLER,
    defaultReasoning: 'Частичная оплата продавцу (30/70).',
  },
  {
    key: 'seller-100',
    label: '0 / 100',
    buyerPct: 0,
    decisionType: ArbitrationDecisionType.FULL_PAYMENT_TO_SELLER,
    defaultReasoning: 'Полная оплата продавцу.',
  },
];

export const ArbitratorDisputePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const [tab, setTab] = useState<Tab>('evidence');
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [chat, setChat] = useState<ArbitrationChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [preset, setPreset] = useState<Preset | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, ev, c] = await Promise.all([
          arbitrationApi.getDispute(id),
          arbitrationApi.getEvidence(id),
          arbitrationApi.getChat(id, 100),
        ]);
        if (cancelled) return;
        setDispute(d);
        setEvidence(ev);
        setChat(c);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить спор');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (tab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab, chat.length]);

  const isMyCase = dispute && user && dispute.arbitratorId === user.id;
  const canDecide =
    isMyCase && dispute && dispute.status === DisputeStatus.UNDER_REVIEW;

  const handleSendChat = async () => {
    if (!id || !chatInput.trim() || chatSending) return;
    setChatSending(true);
    try {
      const msg = await arbitrationApi.sendChatMessage(id, chatInput.trim());
      setChat((prev) => [...prev, msg]);
      setChatInput('');
    } catch (err) {
      const m =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? (err instanceof Error ? err.message : 'Не удалось отправить');
      setError(m);
    } finally {
      setChatSending(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!id || !preset) return;
    if (!reasoning.trim()) {
      setSubmitError('Обоснование обязательно');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: MakeDecisionInput = {
        decisionType: preset.decisionType,
        reasoning: reasoning.trim(),
        isAppealable: true,
      };
      await arbitrationApi.makeDecision(id, payload);
      // refetch dispute so status updates immediately
      const refreshed = await arbitrationApi.getDispute(id);
      setDispute(refreshed);
      setPreset(null);
      setReasoning('');
    } catch (err) {
      const m =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? (err instanceof Error ? err.message : 'Не удалось отправить решение');
      setSubmitError(m);
    } finally {
      setSubmitting(false);
    }
  };

  const dealAmount = useMemo(() => {
    if (!dispute?.deal) return null;
    return `${dispute.deal.amount} ${dispute.deal.currency ?? 'USDT'}`;
  }, [dispute]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="loading-screen">
        <h2>Ошибка</h2>
        <p className="auth-error-message">{error ?? 'Спор не найден'}</p>
        <button className="primary-button" onClick={() => navigate('/arbitrator')}>
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="arb-dispute-page">
      <div className="arb-dispute-header">
        <button
          className="back-link"
          onClick={() => navigate('/arbitrator')}
          aria-label="Назад к списку"
        >
          ← Назад
        </button>
        <h1>Спор #{dispute.id.slice(0, 8)}</h1>
        <div className="arb-dispute-summary">
          <div>
            <span className="summary-label">Тип</span>
            <span className="summary-value">{dispute.type}</span>
          </div>
          <div>
            <span className="summary-label">Открыл</span>
            <span className="summary-value">
              {dispute.openedBy === 'buyer' ? 'Покупатель' : 'Продавец'}
            </span>
          </div>
          {dealAmount && (
            <div>
              <span className="summary-label">Сумма</span>
              <span className="summary-value">{dealAmount}</span>
            </div>
          )}
        </div>
        <p className="arb-dispute-reason">{dispute.reason}</p>
        {dispute.description && (
          <p className="arb-dispute-description">{dispute.description}</p>
        )}
      </div>

      <div className="arb-tabs">
        <button
          className={`tab-button ${tab === 'evidence' ? 'active' : ''}`}
          onClick={() => setTab('evidence')}
        >
          Доказательства ({evidence.length})
        </button>
        <button
          className={`tab-button ${tab === 'chat' ? 'active' : ''}`}
          onClick={() => setTab('chat')}
        >
          Чат ({chat.length})
        </button>
        <button
          className={`tab-button ${tab === 'decision' ? 'active' : ''}`}
          onClick={() => setTab('decision')}
          disabled={!canDecide}
        >
          Решение
        </button>
      </div>

      {tab === 'evidence' && (
        <div className="tab-panel">
          {evidence.length === 0 ? (
            <p className="empty-hint">Доказательств пока нет.</p>
          ) : (
            evidence.map((e) => (
              <div key={e.id} className="evidence-card">
                <div className="evidence-row">
                  <span className="evidence-type">{e.type}</span>
                  <span className="evidence-date">
                    {new Date(e.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                <p className="evidence-description">{e.description}</p>
                {e.content && <p className="evidence-content">{e.content}</p>}
                {e.fileName && (
                  <p className="evidence-file">📎 {e.fileName}</p>
                )}
                {e.submitter && (
                  <p className="evidence-submitter">
                    От: {e.submitter.telegramFirstName || e.submitter.telegramUsername}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div className="tab-panel chat-panel">
          <div className="chat-messages">
            {chat.length === 0 ? (
              <p className="empty-hint">Сообщений нет.</p>
            ) : (
              chat.map((m) => (
                <div
                  key={m.id}
                  className={`chat-message ${
                    m.senderId === user?.id ? 'mine' : 'theirs'
                  }`}
                >
                  <div className="chat-sender">
                    {m.sender?.telegramFirstName ||
                      m.sender?.telegramUsername ||
                      'Участник'}
                  </div>
                  <div className="chat-content">{m.content}</div>
                  <div className="chat-date">
                    {new Date(m.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              type="text"
              placeholder="Написать сообщение..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChat();
              }}
              disabled={chatSending}
            />
            <button
              className="primary-button"
              onClick={handleSendChat}
              disabled={chatSending || !chatInput.trim()}
            >
              Отправить
            </button>
          </div>
        </div>
      )}

      {tab === 'decision' && (
        <div className="tab-panel">
          {!canDecide ? (
            <p className="empty-hint">
              Решение можно вынести только если спор в статусе «На рассмотрении».
            </p>
          ) : (
            <>
              <p className="decision-hint">
                Выберите split (покупатель / продавец) и напишите обоснование.
              </p>
              <div className="preset-grid">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={`preset-button ${preset?.key === p.key ? 'active' : ''}`}
                    onClick={() => {
                      setPreset(p);
                      setReasoning((r) => (r.trim() ? r : p.defaultReasoning));
                    }}
                  >
                    <span className="preset-label">{p.label}</span>
                    <span className="preset-sub">
                      {p.buyerPct}% / {100 - p.buyerPct}%
                    </span>
                  </button>
                ))}
              </div>

              <label className="decision-label">
                Обоснование
                <textarea
                  className="decision-reasoning"
                  rows={5}
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Опишите мотивы решения. Видно обеим сторонам."
                />
              </label>

              {submitError && <p className="wallet-error">{submitError}</p>}

              <button
                className="primary-button decision-submit"
                onClick={handleSubmitDecision}
                disabled={submitting || !preset || !reasoning.trim()}
              >
                {submitting ? 'Отправляем…' : 'Вынести решение'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
