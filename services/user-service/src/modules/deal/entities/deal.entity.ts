import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { DealType, DealStatus, DealSide, Currency } from '../enums/deal.enum';
import { DealMessage } from './deal-message.entity';
import { DealAttachment } from './deal-attachment.entity';
import { DealInvite } from './deal-invite.entity';
import { DealEvent } from './deal-event.entity';

@Entity('deals')
@Index(['buyerId'])
@Index(['sellerId'])
@Index(['type'])
@Index(['createdAt'])
export class Deal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  dealNumber: string;

  @Column({
    type: 'enum',
    enum: DealType,
  })
  type: DealType;

  @Column({
    type: 'enum',
    enum: DealStatus,
    default: DealStatus.DRAFT,
  })
  @Index()
  status: DealStatus;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ type: 'uuid', name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'seller_id' })
  seller: User | null;

  @Column({ type: 'uuid', name: 'seller_id', nullable: true })
  sellerId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.RUB,
  })
  currency: Currency;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  commissionAmount: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  terms: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  publicSlug: string | null;

  @OneToMany(() => DealMessage, (message) => message.deal, { cascade: true })
  messages: DealMessage[];

  @OneToMany(() => DealAttachment, (attachment) => attachment.deal, { cascade: true })
  attachments: DealAttachment[];

  @OneToMany(() => DealInvite, (invite) => invite.deal, { cascade: true })
  invites: DealInvite[];

  @OneToMany(() => DealEvent, (event) => event.deal, { cascade: true })
  events: DealEvent[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disputedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  arbitratorId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancelReason: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refundReason: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'escrow_address' })
  escrowAddress: string | null;

  // Геттеры для вычисляемых полей
  get totalAmount(): number {
    return this.amount + this.commissionAmount;
  }

  get sellerReceives(): number {
    return this.amount;
  }

  get buyerPays(): number {
    return this.amount + this.commissionAmount;
  }

  get isExpired(): boolean {
    if (!this.deadline) return false;
    return new Date() > this.deadline && this.status !== DealStatus.COMPLETED;
  }

  get canBeCancelled(): boolean {
    return [
      DealStatus.DRAFT,
      DealStatus.PENDING_ACCEPTANCE,
      DealStatus.PENDING_PAYMENT,
    ].includes(this.status);
  }

  get canBeConfirmed(): boolean {
    return this.status === DealStatus.PENDING_CONFIRMATION;
  }

  get canBeDisputed(): boolean {
    return [
      DealStatus.IN_PROGRESS,
      DealStatus.PENDING_CONFIRMATION,
    ].includes(this.status);
  }

  get activeSide(): DealSide | null {
    switch (this.status) {
      case DealStatus.PENDING_PAYMENT:
        return DealSide.BUYER;
      case DealStatus.IN_PROGRESS:
        return DealSide.SELLER;
      case DealStatus.PENDING_CONFIRMATION:
        return DealSide.BUYER;
      default:
        return null;
    }
  }

  // Методы для изменения статуса
  canTransitionTo(newStatus: DealStatus): boolean {
    const transitions: Record<DealStatus, DealStatus[]> = {
      [DealStatus.DRAFT]: [DealStatus.PENDING_ACCEPTANCE, DealStatus.CANCELLED],
      [DealStatus.PENDING_ACCEPTANCE]: [
        DealStatus.IN_PROGRESS,
        DealStatus.PENDING_PAYMENT,
        DealStatus.CANCELLED,
      ],
      [DealStatus.PENDING_PAYMENT]: [
        DealStatus.IN_PROGRESS,
        DealStatus.CANCELLED,
        DealStatus.REFUNDED,
      ],
      [DealStatus.IN_PROGRESS]: [
        DealStatus.PENDING_CONFIRMATION,
        DealStatus.DISPUTED,
        DealStatus.FROZEN,
      ],
      [DealStatus.PENDING_CONFIRMATION]: [
        DealStatus.COMPLETED,
        DealStatus.DISPUTED,
        DealStatus.REFUNDED,
      ],
      [DealStatus.COMPLETED]: [],
      [DealStatus.CANCELLED]: [],
      [DealStatus.REFUNDED]: [],
      [DealStatus.DISPUTED]: [DealStatus.DISPUTE_RESOLVED, DealStatus.FROZEN],
      [DealStatus.DISPUTE_RESOLVED]: [DealStatus.COMPLETED, DealStatus.REFUNDED],
      [DealStatus.FROZEN]: [DealStatus.IN_PROGRESS, DealStatus.REFUNDED],
    };

    return transitions[this.status]?.includes(newStatus) || false;
  }

  getStatusProgress(): number {
    const statusOrder = [
      DealStatus.DRAFT,
      DealStatus.PENDING_ACCEPTANCE,
      DealStatus.PENDING_PAYMENT,
      DealStatus.IN_PROGRESS,
      DealStatus.PENDING_CONFIRMATION,
      DealStatus.COMPLETED,
    ];

    const index = statusOrder.indexOf(this.status);
    if (index === -1) return 0;

    return Math.round((index / (statusOrder.length - 1)) * 100);
  }
}
