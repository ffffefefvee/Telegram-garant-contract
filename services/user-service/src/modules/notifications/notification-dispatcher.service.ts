import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { OutboxEvent } from '../ops/entities/outbox-event.entity';
import { NotificationPreferenceService } from './notification-preference.service';
import {
  NotificationTemplateRegistry,
  registerBuiltinTemplates,
  type DeeplinkBuilder,
  type Lang,
} from './notification-template.registry';

export interface DispatchResult {
  delivered: number;
  skipped: number;
  deferredMs: number | null;
  /** True if dispatcher decided this event has no template — safe to mark delivered. */
  unhandled: boolean;
}

/**
 * Consumes one outbox row at a time:
 *   1. Looks up the template for `event.eventType`.
 *   2. Extracts recipient user-ids from the payload.
 *   3. For each recipient: respects notification preferences, renders the
 *      message, sends via TelegramBotService.
 *
 * Returns a DispatchResult instead of throwing on per-recipient failure —
 * throwing would fail the whole outbox row and re-queue the same event
 * indefinitely (e.g. if one of N recipients has a stale telegramId).
 * Transport-level failures (network down) DO throw so the worker retries.
 */
@Injectable()
export class NotificationDispatcher implements OnModuleInit {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private deeplink: DeeplinkBuilder = { build: () => null };

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly registry: NotificationTemplateRegistry,
    private readonly preferences: NotificationPreferenceService,
    private readonly bot: TelegramBotService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    registerBuiltinTemplates(this.registry);
    this.deeplink = buildDeeplinkBuilder(this.config);
    this.logger.log(
      `Notification dispatcher ready. Event types: ${this.registry.listRegisteredEventTypes().join(', ') || '(none)'}`,
    );
  }

  /** Test seam — call from spec to skip onModuleInit's config dependency. */
  initForTest(): void {
    registerBuiltinTemplates(this.registry);
  }

  async dispatch(event: OutboxEvent): Promise<DispatchResult> {
    const template = this.registry.get(event.eventType);
    if (!template) {
      return { delivered: 0, skipped: 0, deferredMs: null, unhandled: true };
    }

    const recipientIds = template.recipients(event.payload);
    if (recipientIds.length === 0) {
      return { delivered: 0, skipped: 0, deferredMs: null, unhandled: false };
    }

    // Resolve each recipient (user row + preferences). We do this in a
    // pre-pass so we can decide whether to defer the WHOLE row before
    // sending anything — if we sent to half the recipients and then
    // deferred for the other half, the early ones would receive
    // duplicates on the next tick.
    type Resolved = {
      userId: string;
      user: User;
      pref: Awaited<ReturnType<NotificationPreferenceService['getOrDefault']>>;
      muted: boolean;
      delayMs: number;
    };
    const resolved: Resolved[] = [];
    for (const userId of recipientIds) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user || !user.telegramId) {
        this.logger.warn(
          `Skip ${event.eventType}/${userId}: user missing or no telegramId`,
        );
        continue;
      }
      const pref = await this.preferences.getOrDefault(userId);
      const muted = this.preferences.isMuted(pref, event.eventType);
      const delayMs = template.critical
        ? 0
        : this.preferences.quietHoursDelayMs(pref);
      resolved.push({ userId, user, pref, muted, delayMs });
    }

    // No reachable recipients at all (everyone missing telegramId): treat
    // as a non-deferrable miss so the worker can mark delivered and stop
    // re-firing.
    if (resolved.length === 0) {
      return {
        delivered: 0,
        skipped: recipientIds.length,
        deferredMs: null,
        unhandled: false,
      };
    }

    // If ANY non-muted recipient is currently inside their quiet-hours
    // window, defer the whole row to the latest end-of-window across
    // recipients. Muted recipients don't extend the defer because they
    // would never be delivered anyway.
    const deferCandidates = resolved.filter((r) => !r.muted && r.delayMs > 0);
    if (deferCandidates.length > 0) {
      const maxDelay = deferCandidates.reduce(
        (acc, r) => Math.max(acc, r.delayMs),
        0,
      );
      return {
        delivered: 0,
        // Skipped here means "not delivered now"; the worker will re-pick
        // the row after the defer window. We still report skipped so logs
        // make it obvious the tick wasn't a no-op.
        skipped: resolved.length,
        deferredMs: maxDelay,
        unhandled: false,
      };
    }

    let delivered = 0;
    let skipped = recipientIds.length - resolved.length;

    for (const r of resolved) {
      if (r.muted) {
        skipped += 1;
        continue;
      }

      const lang = normalizeLang(r.user.telegramLanguageCode);
      const rendered = template.render({
        recipientUserId: r.userId,
        lang,
        payload: event.payload,
        deeplink: this.deeplink,
      });

      try {
        await this.bot.sendMessage(r.user.telegramId!, rendered.text, {
          parseMode: 'HTML',
          replyMarkup: rendered.keyboard,
        });
        delivered += 1;
      } catch (err) {
        // Transport-level failure — propagate so outbox retries.
        throw err;
      }
    }

    return {
      delivered,
      skipped,
      deferredMs: null,
      unhandled: false,
    };
  }
}

function normalizeLang(code: string | null | undefined): Lang {
  if (code === 'en' || code === 'es') return code;
  return 'ru';
}

/**
 * Builds Telegram MiniApp deeplinks of the form
 * `https://t.me/<bot_username>/<miniapp_slug>?startapp=<path>__<id>`.
 *
 * Telegram's `startapp` parameter is alphanumeric + `_` + `-` only and
 * <= 64 chars. We encode the route path by replacing `/` with `__` and
 * append the id with `___`. The mini-app's bootstrap reads `startapp`
 * from `WebApp.initDataUnsafe.start_param` and routes accordingly.
 *
 * Returns `null` if either env var is missing (CI/dev) — templates fall
 * back to text-only messages.
 */
export function buildDeeplinkBuilder(config: ConfigService): DeeplinkBuilder {
  const botUsername = config.get<string>('TELEGRAM_BOT_USERNAME');
  const miniappSlug = config.get<string>('TELEGRAM_MINIAPP_SLUG');
  if (!botUsername || !miniappSlug) {
    return { build: () => null };
  }
  const cleanBot = botUsername.replace(/^@/, '');
  return {
    build: (path: string, id?: string) => {
      const slug = `${path}${id ? `___${id}` : ''}`.replace(/\//g, '__');
      // Telegram limits start_param to alphanumerics, underscores, dashes.
      const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
      const truncated = safeSlug.slice(0, 64);
      return `https://t.me/${cleanBot}/${miniappSlug}?startapp=${truncated}`;
    },
  };
}
