import { getTodayIsoDate } from '../../../shared/licenseRules.js';
import type { AppDatabase } from '../db/database.js';
import type { EvaluationService } from './evaluation.js';
import { NotificationService } from './notifications.js';
import type { SettingsService } from './settings.js';

const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;

export function startScheduler(deps: {
  db: AppDatabase;
  settings: SettingsService;
  evaluation: EvaluationService;
}): () => void {
  const notifications = new NotificationService(deps);
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const pub = deps.settings.getPublicSettings();
      if (pub.mail_provider === 'none') return;

      const now = new Date();
      const today = getTodayIsoDate(now);
      let shouldSendDigest = false;

      if (pub.notify_digest_enabled) {
        const lastSent = deps.settings.getSettingRaw<string>('last_digest_sent_at', '');
        const hourMatch = now.getHours() >= pub.notify_digest_hour;
        const dayMatch =
          pub.notify_digest_frequency === 'daily' ||
          now.getDay() === pub.notify_digest_weekday;

        if (lastSent !== today && hourMatch && dayMatch) {
          shouldSendDigest = true;
        }
      }

      const shouldSendMembers = Boolean(pub.notify_members_enabled);

      if (!shouldSendDigest && !shouldSendMembers) {
        return;
      }

      const res = await notifications.runNotifications({
        sendDigest: shouldSendDigest,
        sendMembers: shouldSendMembers,
      });

      if (shouldSendDigest && res.errors.length === 0) {
        deps.settings.setSettingRaw('last_digest_sent_at', today);
      }
    } catch (err) {
      console.error('[scheduler] Fehler beim Benachrichtigungs-Lauf:', err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, SCHEDULER_INTERVAL_MS);

  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
