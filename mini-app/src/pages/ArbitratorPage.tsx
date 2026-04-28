import React, { useEffect, useState } from 'react';
import {
  arbitrationApi,
  type ArbitratorAvailability,
  type ArbitratorProfileSummary,
} from '../api';
import './ArbitratorPage.css';

const STATUS_LABEL: Record<ArbitratorProfileSummary['status'], string> = {
  active: 'Активен',
  pending: 'Ожидает одобрения',
  suspended: 'Приостановлен',
  rejected: 'Отклонён',
};

export const ArbitratorPage: React.FC = () => {
  const [profile, setProfile] = useState<ArbitratorProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    arbitrationApi
      .getMyProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { message?: string } } }).response?.data
            ?.message ?? 'Не удалось загрузить профиль';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleAvailability = async (next: ArbitratorAvailability) => {
    if (!profile || profile.availability === next || toggling) return;
    setToggling(true);
    setError(null);
    // Optimistic update — revert if the call fails.
    const previous = profile.availability;
    setProfile({ ...profile, availability: next });
    try {
      const updated = await arbitrationApi.setMyAvailability(next);
      setProfile(updated);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? 'Не удалось изменить статус';
      setError(msg);
      setProfile({ ...profile, availability: previous });
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="arbitrator-page">
      <div className="arbitrator-header">
        <h1>Кабинет арбитра</h1>
        <p className="arbitrator-subtitle">
          Управление спорами, статус работы, выплаты
        </p>
      </div>

      {loading && (
        <div className="arbitrator-placeholder">
          <p>Загрузка профиля…</p>
        </div>
      )}

      {!loading && error && !profile && (
        <div className="arbitrator-placeholder">
          <p>{error}</p>
        </div>
      )}

      {profile && (
        <section className="arbitrator-availability-card">
          <div className="arbitrator-availability-header">
            <span className="arbitrator-availability-label">
              Статус профиля
            </span>
            <span
              className={`arbitrator-availability-status arbitrator-availability-status--${profile.status}`}
            >
              {STATUS_LABEL[profile.status]}
            </span>
          </div>

          <div className="arbitrator-availability-toggle">
            <span className="arbitrator-availability-label">Доступность</span>
            <div
              className="arbitrator-availability-buttons"
              role="group"
              aria-label="Доступность арбитра"
            >
              <button
                type="button"
                className={`arbitrator-availability-btn ${profile.availability === 'available' ? 'is-active' : ''}`}
                disabled={
                  toggling ||
                  profile.status !== 'active' ||
                  profile.availability === 'available'
                }
                onClick={() => handleToggleAvailability('available')}
              >
                Принимаю дела
              </button>
              <button
                type="button"
                className={`arbitrator-availability-btn ${profile.availability === 'away' ? 'is-active' : ''}`}
                disabled={
                  toggling ||
                  profile.status !== 'active' ||
                  profile.availability === 'away'
                }
                onClick={() => handleToggleAvailability('away')}
              >
                В отъезде
              </button>
            </div>
            {profile.status !== 'active' && (
              <p className="arbitrator-availability-hint">
                Управление доступностью включится, когда профиль будет одобрен
                админом.
              </p>
            )}
            {error && profile && (
              <p className="arbitrator-availability-error">{error}</p>
            )}
          </div>
        </section>
      )}

      <div className="arbitrator-placeholder">
        <p>Полный интерфейс арбитра появится в следующем релизе.</p>
        <p>Пока доступен только доступ к разделу.</p>
      </div>
    </div>
  );
};
