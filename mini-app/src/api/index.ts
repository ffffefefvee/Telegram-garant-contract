import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.reload();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const api = new ApiClient();

export const dealsApi = {
  getAll: (params?: { status?: string[]; limit?: number; offset?: number }) =>
    api.get<{ deals: any[]; total: number }>('/deals', params),

  getById: (id: string) => api.get<any>(`/deals/${id}`),

  create: (data: {
    type: string;
    amount: number;
    description: string;
    title?: string;
    terms?: string;
  }) => api.post<any>('/deals', data),

  cancel: (id: string, reason?: string) =>
    api.post<any>(`/deals/${id}/cancel`, { reason }),

  accept: (id: string) => api.post<any>(`/deals/${id}/accept`),

  confirm: (id: string) => api.post<any>(`/deals/${id}/confirm`),

  getMessages: (id: string, limit?: number, offset?: number) =>
    api.get<any[]>(`/deals/${id}/messages`, { limit, offset }),

  sendMessage: (id: string, content: string) =>
    api.post<any>(`/deals/${id}/messages`, { content }),

  getEvents: (id: string, limit?: number) =>
    api.get<any[]>(`/deals/${id}/events`, { limit }),
};

export const paymentsApi = {
  create: (data: {
    dealId: string;
    amount: number;
    currency?: string;
    description?: string;
  }) => api.post<any>('/payments', data),

  getAll: (limit?: number, offset?: number) =>
    api.get<any>('/payments', { limit, offset }),

  getById: (id: string) => api.get<any>(`/payments/${id}`),

  checkStatus: (id: string) => api.post<any>(`/payments/${id}/check`),

  getForDeal: (dealId: string) => api.get<any>(`/payments/deal/${dealId}`),
};

export const usersApi = {
  getMe: () => api.get<any>('/users/me'),

  getStats: () => api.get<any>('/users/me/stats'),

  setLanguage: (languageCode: string) =>
    api.post<any>('/users/me/language', { languageCode }),

  updateProfile: (data: any) => api.put<any>('/users/me', data),
};