export const UserRole = {
  BUYER: 'buyer',
  SELLER: 'seller',
  ARBITRATOR: 'arbitrator',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: string;
  telegramId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  telegramLanguageCode?: string;
  email?: string;
  status: 'active' | 'inactive' | 'banned' | 'pending_verification';
  roles: UserRole[];
  balance: number;
  reputationScore: number;
  completedDeals: number;
  cancelledDeals: number;
  disputedDeals: number;
  walletAddress?: string | null;
  walletAttachedAt?: string | null;
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

export const DisputeStatus = {
  OPENED: 'opened',
  WAITING_SELLER_RESPONSE: 'waiting_seller_response',
  WAITING_BUYER_EVIDENCE: 'waiting_buyer_evidence',
  WAITING_SELLER_EVIDENCE: 'waiting_seller_evidence',
  PENDING_ARBITRATOR: 'pending_arbitrator',
  UNDER_REVIEW: 'under_review',
  DECISION_MADE: 'decision_made',
  APPEAL_PERIOD: 'appeal_period',
  APPEALED: 'appealed',
  ENFORCED: 'enforced',
  CLOSED: 'closed',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const ArbitrationDecisionType = {
  FULL_REFUND_TO_BUYER: 'full_refund_to_buyer',
  PARTIAL_REFUND_TO_BUYER: 'partial_refund_to_buyer',
  FULL_PAYMENT_TO_SELLER: 'full_payment_to_seller',
  PARTIAL_PAYMENT_TO_SELLER: 'partial_payment_to_seller',
  SPLIT_FUNDS: 'split_funds',
  REFUND_NO_PENALTY: 'refund_no_penalty',
} as const;
export type ArbitrationDecisionType =
  (typeof ArbitrationDecisionType)[keyof typeof ArbitrationDecisionType];

export const ArbitratorStatus = {
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
} as const;
export type ArbitratorStatus = (typeof ArbitratorStatus)[keyof typeof ArbitratorStatus];

export interface Dispute {
  id: string;
  dealId: string;
  deal?: Deal;
  status: DisputeStatus;
  type: string;
  openedBy: 'buyer' | 'seller';
  openerId: string;
  opener?: User;
  arbitratorId?: string | null;
  arbitrator?: User | null;
  arbitratorAssignedAt?: string | null;
  reason: string;
  description?: string;
  claimedAmount?: number;
  penaltyPercent?: number;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  decisionDueAt?: string | null;
}

export interface Evidence {
  id: string;
  disputeId: string;
  submitterId: string;
  submitter?: User;
  type: string;
  description: string;
  content?: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  verified?: boolean;
  createdAt: string;
}

export interface ArbitrationChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender?: User;
  content: string;
  attachments?: string[];
  createdAt: string;
}

export interface ArbitratorProfile {
  id: string;
  userId: string;
  user?: User;
  status: ArbitratorStatus;
  rating: number;
  totalCases: number;
  completedCases: number;
  appealedCases: number;
  overturnedCases: number;
  totalEarned: number;
  specialization?: string;
  languages?: string;
  bio?: string;
  lastActiveAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArbitratorStatistics {
  totalCases: number;
  completedCases: number;
  appealedCases: number;
  overturnedCases: number;
  successRate: number;
  overturnRate: number;
  averageRating: number;
  totalEarned: number;
}

export interface MakeDecisionInput {
  decisionType: ArbitrationDecisionType;
  reasoning: string;
  comments?: string;
  isAppealable?: boolean;
  appealPeriodHours?: number;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    telegramId: number;
    telegramUsername: string | null;
  };
}

/**
 * Minimal Telegram WebApp surface we rely on. The real SDK exposes far more —
 * we only type what is actually consumed.
 */
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    auth_date?: number;
    hash?: string;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  colorScheme?: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  onEvent: (eventType: string, handler: () => void) => void;
  offEvent: (eventType: string, handler: () => void) => void;
  HapticFeedback?: {
    impactOccurred?: (style: string) => void;
    notificationOccurred?: (type: string) => void;
  };
  MainButton?: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setText: (text: string) => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}
