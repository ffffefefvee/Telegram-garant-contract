export interface User {
  id: string;
  telegramId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  telegramLanguageCode?: string;
  email?: string;
  status: 'active' | 'inactive' | 'banned';
  roles: string[];
  balance: number;
  reputationScore: number;
  completedDeals: number;
  cancelledDeals: number;
  disputedDeals: number;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  dealNumber: string;
  type: 'physical' | 'digital' | 'service' | 'rent';
  status: string;
  amount: number;
  currency: string;
  description: string;
  title?: string;
  terms?: string;
  buyer: User;
  seller?: User;
  buyerId: string;
  sellerId?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  paidAt?: string;
  completedAt?: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  type: 'text' | 'system';
  createdAt: string;
}

export interface Payment {
  id: string;
  dealId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
}