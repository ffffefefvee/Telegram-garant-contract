import axios, { AxiosInstance } from 'axios';
import type { AuthSession, Deal, Message, Payment, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          // Trigger a reload so AuthGate re-runs the Telegram handshake
          // and puts the user back into an authenticated state.
          window.location.reload();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const api = new ApiClient();

export const authApi = {
  /**
   * Exchange Telegram `initData` for a backend-issued JWT + user payload.
   * Stores the token in localStorage on success so all subsequent requests
   * are authenticated via the Axios interceptor above.
   */
  loginWithTelegram: async (initData: string): Promise<AuthSession> => {
    const session = await api.post<AuthSession>('/auth/telegram', { initData });
    if (session.accessToken) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.accessToken);
    }
    return session;
  },

  logout: () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  },
};

export const dealsApi = {
  getAll: (params?: { status?: string[]; limit?: number; offset?: number }) =>
    api.get<{ deals: Deal[]; total: number }>('/deals', params as Record<string, unknown>),

  getById: (id: string) => api.get<Deal>(`/deals/${id}`),

  create: (data: {
    type: string;
    amount: number;
    description: string;
    title?: string;
    terms?: string;
  }) => api.post<Deal>('/deals', data),

  cancel: (id: string, reason?: string) =>
    api.post<Deal>(`/deals/${id}/cancel`, { reason }),

  accept: (id: string) => api.post<Deal>(`/deals/${id}/accept`),

  confirm: (id: string) => api.post<Deal>(`/deals/${id}/confirm`),

  getMessages: (id: string, limit?: number, offset?: number) =>
    api.get<Message[]>(`/deals/${id}/messages`, { limit, offset }),

  sendMessage: (id: string, content: string) =>
    api.post<Message>(`/deals/${id}/messages`, { content }),

  getEvents: (id: string, limit?: number) =>
    api.get<unknown[]>(`/deals/${id}/events`, { limit }),
};

export const paymentsApi = {
  create: (data: {
    dealId: string;
    amount: number;
    currency?: string;
    description?: string;
  }) => api.post<Payment>('/payments', data),

  getAll: (limit?: number, offset?: number) =>
    api.get<Payment[]>('/payments', { limit, offset }),

  getById: (id: string) => api.get<Payment>(`/payments/${id}`),

  checkStatus: (id: string) => api.post<Payment>(`/payments/${id}/check`),

  getForDeal: (dealId: string) => api.get<Payment>(`/payments/deal/${dealId}`),
};

export const usersApi = {
  getMe: () => api.get<User>('/users/me'),

  getStats: () => api.get<unknown>('/users/me/stats'),

  setLanguage: (languageCode: string) =>
    api.post<User>('/users/me/language', { languageCode }),

  updateProfile: (data: Partial<User>) => api.put<User>('/users/me', data),

  /**
   * Attach an EVM wallet so the user can act as seller or arbitrator in
   * on-chain settled deals. The backend enforces EIP-55 checksum and
   * uniqueness. Returns the updated User row.
   */
  attachWallet: (walletAddress: string) =>
    api.post<User>('/users/me/wallet', { walletAddress }),

  detachWallet: () => api.delete<User>('/users/me/wallet'),
};

export type ArbitratorAvailability = 'available' | 'away';

export interface ArbitratorProfileSummary {
  id: string;
  userId: string;
  status: 'active' | 'pending' | 'suspended' | 'rejected';
  availability: ArbitratorAvailability;
  rating: number;
  totalCases: number;
  completedCases: number;
}

export const arbitrationApi = {
  /** Self-service profile fetch (404 if user is not an arbitrator). */
  getMyProfile: () =>
    api.get<ArbitratorProfileSummary>('/arbitration/arbitrators/me'),

  /** Flip work-state. Backend enforces status === ACTIVE. */
  setMyAvailability: (availability: ArbitratorAvailability) =>
    api.patch<ArbitratorProfileSummary>(
      '/arbitration/arbitrators/me/availability',
      { availability },
    ),
};

export interface TreasurySummary {
  ready: boolean;
  treasuryAddress: string;
  tokenAddress: string;
  decimals: number;
  /** Decimal string of token base units. */
  main: string;
  reserve: string;
  rawTokenBalance: string;
  untracked: string;
  reserveBps: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  aggregateType: string;
  aggregateId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  action?: string;
  aggregateType?: string;
  aggregateId?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

/**
 * Backend-known notification event types. Keep in sync with
 * `notification-template.registry.ts` on the user-service. Mini-app
 * only needs this list for the per-event mute UI; unknown values are
 * tolerated (server is the source of truth).
 */
export const NOTIFICATION_EVENT_TYPES = [
  'deal.created',
  'deal.payment_received',
  'deal.completed',
  'deal.cancelled',
  'invite.accepted',
  'dispute.opened',
  'dispute.arbitrator_assigned',
  'dispute.decision_made',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export interface NotificationPreferences {
  id?: string;
  userId: string;
  mutedAll: boolean;
  mutedEventTypes: string[];
  /** "HH:MM" UTC, or null when disabled. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateNotificationPreferencesInput {
  mutedAll?: boolean;
  mutedEventTypes?: string[];
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export const notificationsApi = {
  getPreferences: () =>
    api.get<NotificationPreferences>('/notifications/preferences'),

  updatePreferences: (input: UpdateNotificationPreferencesInput) =>
    api.patch<NotificationPreferences>('/notifications/preferences', input),
};

export const adminApi = {
  /** On-chain treasury balances + token info. Read-only. */
  getTreasurySummary: () => api.get<TreasurySummary>('/admin/treasury/summary'),

  /** Paginated audit log; combine filters with AND. */
  getAuditLog: (query: AuditLogQuery = {}) =>
    api.get<AuditLogPage>('/admin/audit-log', query as Record<string, unknown>),
};
