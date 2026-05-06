import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NOTIFICATION_EVENT_TYPES,
  NotificationPreferences,
  notificationsApi,
} from '../api';
import './SettingsPage.css';

const EVENT_LABELS: Record<string, string> = {
  'deal.created': 'Новая сделка (для продавца)',
  'deal.payment_received': 'Оплата получена в эскроу',
  'deal.completed': 'Сделка завершена',
  'deal.cancelled': 'Сделка отменена',
  'invite.accepted': 'Контрагент принял приглашение',
  'dispute.opened': 'По вашей сделке открыт спор',
  'dispute.arbitrator_assigned': 'Арбитр назначен на ваш спор',
  'dispute.decision_made': 'Принято решение по спору',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function isQuietWindowDirty(prev: NotificationPreferences | null, next: {
  start: string | null;
  end: string | null;
}): boolean {
  return (prev?.quietHoursStart ?? null) !== next.start ||
    (prev?.quietHoursEnd ?? null) !== next.end;
}

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Local form state — kept separate from `prefs` so the user can edit
  // freely (and we can validate) without thrashing the server.
  const [mutedAll, setMutedAll] = useState(false);
  const [mutedEventTypes, setMutedEventTypes] = useState<Set<string>>(new Set());
  const [quietHoursOn, setQuietHoursOn] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await notificationsApi.getPreferences();
        if (cancelled) return;
        setPrefs(fresh);
        setMutedAll(fresh.mutedAll);
        setMutedEventTypes(new Set(fresh.mutedEventTypes ?? []));
        if (fresh.quietHoursStart && fresh.quietHoursEnd) {
          setQuietHoursOn(true);
          setQuietStart(fresh.quietHoursStart);
          setQuietEnd(fresh.quietHoursEnd);
        } else {
          setQuietHoursOn(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(extractErrorMessage(err) ?? 'Не удалось загрузить настройки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleEvent = (eventType: string) => {
    setMutedEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  };

  const onSave = async () => {
    setError(null);

    if (quietHoursOn) {
      if (!isValidTime(quietStart) || !isValidTime(quietEnd)) {
        setError('Время должно быть в формате HH:MM (00:00–23:59)');
        return;
      }
      if (quietStart === quietEnd) {
        setError('Начало и конец «тихих часов» не могут совпадать');
        return;
      }
    }

    const nextStart = quietHoursOn ? quietStart : null;
    const nextEnd = quietHoursOn ? quietEnd : null;

    setSaving(true);
    try {
      const updated = await notificationsApi.updatePreferences({
        mutedAll,
        mutedEventTypes: Array.from(mutedEventTypes),
        quietHoursStart: nextStart,
        quietHoursEnd: nextEnd,
      });
      setPrefs(updated);
      setMutedAll(updated.mutedAll);
      setMutedEventTypes(new Set(updated.mutedEventTypes ?? []));
      if (updated.quietHoursStart && updated.quietHoursEnd) {
        setQuietHoursOn(true);
        setQuietStart(updated.quietHoursStart);
        setQuietEnd(updated.quietHoursEnd);
      } else {
        setQuietHoursOn(false);
      }
    } catch (err) {
      setError(extractErrorMessage(err) ?? 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!prefs &&
    (prefs.mutedAll !== mutedAll ||
      !setsEqual(new Set(prefs.mutedEventTypes ?? []), mutedEventTypes) ||
      isQuietWindowDirty(prefs, {
        start: quietHoursOn ? quietStart : null,
        end: quietHoursOn ? quietEnd : null,
      }));

  if (loading) {
    return (
      <div className="settings-page">
        <button className="settings-back" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <div className="settings-empty">Загрузка настроек…</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <button className="settings-back" onClick={() => navigate(-1)}>
        ← Назад
      </button>

      <h1 className="settings-title">Уведомления</h1>
      <p className="settings-subtitle">
        Управляйте Telegram-уведомлениями от платформы. Настройки применяются
        мгновенно после сохранения.
      </p>

      <section className="settings-section">
        <label className="settings-row settings-row--toggle">
          <div>
            <div className="settings-row__title">Полный «не беспокоить»</div>
            <div className="settings-row__hint">
              Отключает все уведомления, включая срочные про споры.
            </div>
          </div>
          <input
            type="checkbox"
            checked={mutedAll}
            onChange={(e) => setMutedAll(e.target.checked)}
            aria-label="Полный режим не беспокоить"
          />
        </label>
      </section>

      <section
        className={`settings-section ${mutedAll ? 'settings-section--disabled' : ''}`}
      >
        <h2 className="settings-section__title">Типы событий</h2>
        <p className="settings-section__hint">
          Снимите флажок, чтобы заглушить отдельный тип уведомлений.
        </p>
        {NOTIFICATION_EVENT_TYPES.map((eventType) => {
          const active = !mutedEventTypes.has(eventType);
          return (
            <label key={eventType} className="settings-row settings-row--toggle">
              <div>
                <div className="settings-row__title">
                  {EVENT_LABELS[eventType] ?? eventType}
                </div>
                <div className="settings-row__hint settings-row__code">
                  {eventType}
                </div>
              </div>
              <input
                type="checkbox"
                checked={active}
                disabled={mutedAll}
                onChange={() => toggleEvent(eventType)}
                aria-label={`Уведомления типа ${eventType}`}
              />
            </label>
          );
        })}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Тихие часы</h2>
        <p className="settings-section__hint">
          В этом окне (по UTC) уведомления будут отложены до его окончания.
          Срочные dispute-уведомления могут прийти раньше.
        </p>
        <label className="settings-row settings-row--toggle">
          <div>
            <div className="settings-row__title">Включить тихие часы</div>
          </div>
          <input
            type="checkbox"
            checked={quietHoursOn}
            onChange={(e) => setQuietHoursOn(e.target.checked)}
            aria-label="Включить тихие часы"
          />
        </label>
        {quietHoursOn && (
          <div className="settings-quiet">
            <label className="settings-quiet__field">
              <span>С (UTC)</span>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
              />
            </label>
            <label className="settings-quiet__field">
              <span>До (UTC)</span>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      {error && <div className="settings-error">{error}</div>}

      <div className="settings-actions">
        <button
          className="settings-save"
          disabled={!dirty || saving}
          onClick={onSave}
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
};

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function extractErrorMessage(err: unknown): string | null {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object'
  ) {
    const data = (err as { response: { data?: unknown } }).response.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
        return msg.join(', ');
      }
    }
  }
  if (err instanceof Error) return err.message;
  return null;
}
