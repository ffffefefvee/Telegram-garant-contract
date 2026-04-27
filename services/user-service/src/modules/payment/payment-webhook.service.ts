import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Payment } from './entities/payment.entity';
import { CryptomusWebhookPayload } from './cryptomus.service';
import { Deal } from '../deal/entities/deal.entity';
import { DealStatus } from '../deal/enums/deal.enum';
import { EscrowService } from '../escrow/escrow.service';

export enum WebhookStatus {
  PAID = 'paid',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PROCESSING = 'processing',
}

/**
 * Result of a webhook processing pass. Lets the caller (and tests) inspect
 * what side-effects fired.
 */
export interface WebhookProcessingResult {
  paymentStatus: string;
  dealId: string | null;
  escrowAddress: string | null;
  forwarded: boolean;
  /** Hash of the USDT transfer + notifyFunded if we forwarded. */
  txHashes: { transfer?: string; notify?: string };
  /** Human-readable message for non-fatal skips. */
  notes: string[];
}

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Deal)
    private readonly dealRepository: Repository<Deal>,
    @Inject(forwardRef(() => EscrowService))
    private readonly escrow: EscrowService,
  ) {}

  /**
   * Entry point invoked by `CryptomusWebhookController` after HMAC has been
   * verified. Routes by `status`. Idempotent — a re-delivered PAID webhook
   * for a deal whose escrow is already FUNDED will skip forwarding and
   * just record the duplicate hit.
   */
  async handlePaymentWebhook(
    payload: CryptomusWebhookPayload,
  ): Promise<WebhookProcessingResult> {
    const { order_id, status, txid, currency_amount } = payload;
    this.logger.log(
      `Processing webhook order=${order_id} status=${status} txid=${txid}`,
    );

    const payment = await this.paymentRepository.findOne({
      where: { transactionId: order_id },
      relations: ['deal'],
    });
    if (!payment) {
      this.logger.error(`Payment not found: ${order_id}`);
      throw new NotFoundException(`Payment not found: ${order_id}`);
    }

    switch (status) {
      case WebhookStatus.PAID:
        return this.handlePaymentCompleted(payment, txid, currency_amount);
      case WebhookStatus.PROCESSING:
        return this.handlePaymentProcessing(payment);
      case WebhookStatus.REFUNDED:
        return this.handlePaymentRefunded(payment);
      case WebhookStatus.CANCELLED:
      case WebhookStatus.EXPIRED:
        return this.handlePaymentFailed(payment, status);
      default:
        this.logger.warn(`Unknown webhook status: ${status}`);
        return this.emptyResult(payment, [`unknown status: ${status}`]);
    }
  }

  /**
   * Successful Cryptomus payment. We:
   *   1. Mark the Payment row paid (idempotent).
   *   2. Look up the Deal (if any).
   *   3. If the Deal has both wallets attached and no escrow deployed yet,
   *      deploy the clone now.
   *   4. Forward USDT from the relay hot-wallet to the clone and call
   *      notifyFunded() on the clone.
   *   5. Transition the Deal to IN_PROGRESS.
   *
   * Any of (3)-(5) may legitimately skip with a recorded note (see returned
   * `notes`). The caller must NOT 5xx on these — Cryptomus would retry
   * forever. Reconciliation (PR 6/6) sweeps up partials later.
   */
  private async handlePaymentCompleted(
    payment: Payment,
    txid: string,
    cryptoAmount: string,
  ): Promise<WebhookProcessingResult> {
    const notes: string[] = [];

    payment.status = 'completed' as Payment['status'];
    payment.paidAt = payment.paidAt ?? new Date();
    payment.txId = txid;
    payment.cryptoAmount = parseFloat(cryptoAmount);
    payment.cryptomusData = {
      ...payment.cryptomusData,
      paidAt: new Date().toISOString(),
      txid,
    };
    await this.paymentRepository.save(payment);

    const deal = payment.deal ?? (
      payment.dealId
        ? await this.dealRepository.findOne({ where: { id: payment.dealId } })
        : null
    );
    if (!deal) {
      notes.push('payment has no associated deal — recorded paid only');
      return {
        paymentStatus: 'completed',
        dealId: null,
        escrowAddress: null,
        forwarded: false,
        txHashes: {},
        notes,
      };
    }

    const buyerWallet = deal.buyer?.walletAddress ?? null;
    const sellerWallet = deal.seller?.walletAddress ?? null;
    if (!buyerWallet || !sellerWallet) {
      notes.push(
        `wallets missing (buyer=${!!buyerWallet} seller=${!!sellerWallet}); reconciliation will retry`,
      );
      return {
        paymentStatus: 'completed',
        dealId: deal.id,
        escrowAddress: deal.escrowAddress,
        forwarded: false,
        txHashes: {},
        notes,
      };
    }

    let escrowAddress = deal.escrowAddress;
    if (!escrowAddress) {
      try {
        const result = await this.escrow.createEscrow(
          deal.id,
          buyerWallet,
          sellerWallet,
          Number(deal.amount),
        );
        escrowAddress = result.escrowAddress;
        deal.escrowAddress = escrowAddress;
        await this.dealRepository.save(deal);
        this.logger.log(`Escrow deployed JIT for deal ${deal.id} @ ${escrowAddress}`);
      } catch (err) {
        notes.push(
          `JIT escrow deploy failed: ${(err as Error).message}; reconciliation will retry`,
        );
        return {
          paymentStatus: 'completed',
          dealId: deal.id,
          escrowAddress: null,
          forwarded: false,
          txHashes: {},
          notes,
        };
      }
    }

    if (escrowAddress === ethers.ZeroAddress) {
      notes.push('escrow address is zero — cannot forward');
      return {
        paymentStatus: 'completed',
        dealId: deal.id,
        escrowAddress,
        forwarded: false,
        txHashes: {},
        notes,
      };
    }

    if (!this.escrow.isEnabled()) {
      notes.push('blockchain disabled (stub mode) — skipping forward+notify');
      await this.transitionDealToInProgress(deal);
      return {
        paymentStatus: 'completed',
        dealId: deal.id,
        escrowAddress,
        forwarded: false,
        txHashes: {},
        notes,
      };
    }

    try {
      const forwardResult = await this.escrow.forwardAndFund(
        deal.id,
        Number(deal.amount),
      );
      this.logger.log(
        `Escrow funded for deal ${deal.id}: transfer=${forwardResult.transferTxHash} notify=${forwardResult.notifyTxHash}`,
      );
      await this.transitionDealToInProgress(deal);
      return {
        paymentStatus: 'completed',
        dealId: deal.id,
        escrowAddress,
        forwarded: true,
        txHashes: {
          transfer: forwardResult.transferTxHash,
          notify: forwardResult.notifyTxHash,
        },
        notes,
      };
    } catch (err) {
      this.logger.error(
        `Escrow forward+notify failed for deal ${deal.id}: ${(err as Error).message}`,
      );
      notes.push(`forward+notify failed: ${(err as Error).message}; reconciliation will retry`);
      return {
        paymentStatus: 'completed',
        dealId: deal.id,
        escrowAddress,
        forwarded: false,
        txHashes: {},
        notes,
      };
    }
  }

  private async transitionDealToInProgress(deal: Deal): Promise<void> {
    if (deal.status === DealStatus.IN_PROGRESS || deal.status === DealStatus.COMPLETED) {
      return;
    }
    deal.status = DealStatus.IN_PROGRESS;
    deal.paidAt = deal.paidAt ?? new Date();
    await this.dealRepository.save(deal);
  }

  private async handlePaymentProcessing(payment: Payment): Promise<WebhookProcessingResult> {
    payment.status = 'processing' as Payment['status'];
    await this.paymentRepository.save(payment);
    return this.emptyResult(payment, ['payment processing']);
  }

  private async handlePaymentRefunded(payment: Payment): Promise<WebhookProcessingResult> {
    payment.status = 'refunded' as Payment['status'];
    payment.refundedAt = new Date();
    await this.paymentRepository.save(payment);
    return this.emptyResult(payment, ['payment refunded']);
  }

  private async handlePaymentFailed(
    payment: Payment,
    status: string,
  ): Promise<WebhookProcessingResult> {
    payment.status = 'failed' as Payment['status'];
    payment.failureReason = `Payment ${status}`;
    await this.paymentRepository.save(payment);
    return this.emptyResult(payment, [`payment ${status}`]);
  }

  private emptyResult(payment: Payment, notes: string[]): WebhookProcessingResult {
    return {
      paymentStatus: payment.status,
      dealId: payment.dealId,
      escrowAddress: null,
      forwarded: false,
      txHashes: {},
      notes,
    };
  }
}
