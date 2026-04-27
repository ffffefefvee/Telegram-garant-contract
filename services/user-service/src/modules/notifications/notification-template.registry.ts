import { Injectable } from '@nestjs/common';

/**
 * Maps an outbox `eventType` to:
 *   - a list of recipient user-ids (extracted from the payload), and
 *   - a rendered message body (HTML, Telegram-parse-mode='HTML' safe).
 *
 * Keeping this as a registry (not inline in the dispatcher) makes it
 * trivial to add new notification types in later PRs — just register a
 * new builder and the worker picks it up.
 */
export type Lang = 'ru' | 'en' | 'es';

export interface RenderedNotification {
  text: string;
  keyboard?: {
    inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  };
}

export interface RenderInput {
  recipientUserId: string;
  lang: Lang;
  payload: Record<string, unknown>;
}

export type Renderer = (input: RenderInput) => RenderedNotification;

export interface NotificationTemplate {
  /** Outbox eventType this template matches. */
  eventType: string;
  /** Pulls recipient user-ids from the payload. */
  recipients: (payload: Record<string, unknown>) => string[];
  /** Renders the message body per recipient + language. */
  render: Renderer;
}

@Injectable()
export class NotificationTemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  register(template: NotificationTemplate): void {
    this.templates.set(template.eventType, template);
  }

  get(eventType: string): NotificationTemplate | undefined {
    return this.templates.get(eventType);
  }

  listRegisteredEventTypes(): string[] {
    return [...this.templates.keys()];
  }
}

// ─── Built-in templates for H2S1 PR 1/3 ──────────────────────

export function registerBuiltinTemplates(
  registry: NotificationTemplateRegistry,
): void {
  registry.register({
    eventType: 'dispute.opened',
    recipients: (p) => {
      const out: string[] = [];
      const opponentId = p.opponentUserId;
      if (typeof opponentId === 'string') out.push(opponentId);
      return out;
    },
    render: ({ lang, payload }) => ({
      text: pickLang(
        {
          ru: `⚖️ <b>Против вас открыт спор</b>\nСделка: ${safe(payload.dealTitle)}\nПричина: ${safe(payload.reason)}\n\nОткройте приложение, чтобы ответить.`,
          en: `⚖️ <b>A dispute has been opened against you</b>\nDeal: ${safe(payload.dealTitle)}\nReason: ${safe(payload.reason)}\n\nOpen the app to respond.`,
          es: `⚖️ <b>Se ha abierto una disputa contra usted</b>\nTrato: ${safe(payload.dealTitle)}\nMotivo: ${safe(payload.reason)}\n\nAbra la aplicación para responder.`,
        },
        lang,
      ),
    }),
  });

  registry.register({
    eventType: 'dispute.arbitrator_assigned',
    recipients: (p) => (typeof p.arbitratorUserId === 'string' ? [p.arbitratorUserId] : []),
    render: ({ lang, payload }) => ({
      text: pickLang(
        {
          ru: `🧑‍⚖️ <b>Вам назначен спор</b>\nСделка: ${safe(payload.dealTitle)}\nСумма: ${safe(payload.dealAmount)} USDT\nДедлайн: ${safe(payload.decisionDueAt)}`,
          en: `🧑‍⚖️ <b>A dispute has been assigned to you</b>\nDeal: ${safe(payload.dealTitle)}\nAmount: ${safe(payload.dealAmount)} USDT\nDeadline: ${safe(payload.decisionDueAt)}`,
          es: `🧑‍⚖️ <b>Se le ha asignado una disputa</b>\nTrato: ${safe(payload.dealTitle)}\nCantidad: ${safe(payload.dealAmount)} USDT\nFecha límite: ${safe(payload.decisionDueAt)}`,
        },
        lang,
      ),
    }),
  });

  registry.register({
    eventType: 'dispute.decision_made',
    recipients: (p) => {
      const ids: string[] = [];
      if (typeof p.buyerUserId === 'string') ids.push(p.buyerUserId);
      if (typeof p.sellerUserId === 'string') ids.push(p.sellerUserId);
      return ids;
    },
    render: ({ lang, payload, recipientUserId }) => {
      const isBuyer = payload.buyerUserId === recipientUserId;
      const share = isBuyer ? payload.buyerShare : payload.sellerShare;
      return {
        text: pickLang(
          {
            ru: `📣 <b>Арбитр принял решение по спору</b>\nСделка: ${safe(payload.dealTitle)}\nВаша доля: ${safe(share)} USDT\n\nОткройте приложение, чтобы увидеть обоснование.`,
            en: `📣 <b>Arbitrator has made a decision</b>\nDeal: ${safe(payload.dealTitle)}\nYour share: ${safe(share)} USDT\n\nOpen the app to see the reasoning.`,
            es: `📣 <b>El árbitro ha tomado una decisión</b>\nTrato: ${safe(payload.dealTitle)}\nSu parte: ${safe(share)} USDT\n\nAbra la aplicación para ver el razonamiento.`,
          },
          lang,
        ),
      };
    },
  });
}

function pickLang(d: Record<Lang, string>, lang: Lang): string {
  return d[lang] ?? d.ru;
}

function safe(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = String(v);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
