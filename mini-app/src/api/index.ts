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
