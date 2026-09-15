import type { OfficeProfile, UrgencyLevel } from '../types.js';

export type HoursStatus = 'open' | 'closed' | 'holiday';

/**
 * Resolves whether `at` falls within the office's configured business hours,
 * accounting for weekly schedule and one-off / recurring holidays.
 */
export function resolveBusinessHoursStatus(profile: OfficeProfile, at: Date): HoursStatus {
  const isoDate = at.toISOString().slice(0, 10); // YYYY-MM-DD
  const monthDay = isoDate.slice(5); // MM-DD

  const onHoliday = profile.holidays.some((h) =>
    h.isRecurringAnnual ? h.date.slice(5) === monthDay : h.date === isoDate
  );
  if (onHoliday) return 'holiday';

  const dayOfWeek = at.getDay(); // 0=Sunday
  const today = profile.businessHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!today || today.isClosed || !today.openTime || !today.closeTime) return 'closed';

  const minutes = at.getHours() * 60 + at.getMinutes();
  const [openH, openM] = today.openTime.split(':').map(Number);
  const [closeH, closeM] = today.closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return minutes >= openMinutes && minutes < closeMinutes ? 'open' : 'closed';
}

export interface IncomingMessage {
  text: string;
  explicitHumanRequest?: boolean;
  urgency?: UrgencyLevel;
  practiceArea?: string;
}

export interface HandoffDecision {
  handoff: boolean;
  reason?: string;
  matchedRuleId?: string;
  preserveContext: boolean;
}

const URGENCY_ORDER: Record<UrgencyLevel, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

/**
 * Evaluates the office's handoff rules against an incoming message and decides
 * whether the conversation should be handed off to a human. Any transfer is
 * planned to preserve the conversation thread and previously collected data —
 * the caller is expected to keep the same conversation/session id across the
 * handoff rather than starting a new one.
 */
export function shouldHandoffToHuman(profile: OfficeProfile, message: IncomingMessage): HandoffDecision {
  const activeRules = profile.handoffRules.filter((r) => r.isActive);

  for (const rule of activeRules) {
    switch (rule.ruleType) {
      case 'explicit_request':
        if (message.explicitHumanRequest) {
          return { handoff: true, reason: 'explicit_request', matchedRuleId: rule.id, preserveContext: rule.preserveContext };
        }
        break;
      case 'keyword': {
        const keyword = rule.value.trim();
        if (keyword && message.text.includes(keyword)) {
          return { handoff: true, reason: `keyword:${keyword}`, matchedRuleId: rule.id, preserveContext: rule.preserveContext };
        }
        break;
      }
      case 'urgency': {
        const threshold = rule.value as UrgencyLevel;
        if (message.urgency && URGENCY_ORDER[message.urgency] >= URGENCY_ORDER[threshold]) {
          return { handoff: true, reason: `urgency:${message.urgency}`, matchedRuleId: rule.id, preserveContext: rule.preserveContext };
        }
        break;
      }
      case 'area':
        if (message.practiceArea && message.practiceArea === rule.value) {
          return { handoff: true, reason: `area:${rule.value}`, matchedRuleId: rule.id, preserveContext: rule.preserveContext };
        }
        break;
    }
  }

  return { handoff: false, preserveContext: true };
}
