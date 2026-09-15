import type { OfficeProfile } from '../types.js';
import type { HandoffDecision, HoursStatus } from './decision.js';
import type { ExtractedFields } from '../types.js';

const TONE_GREETING: Record<string, string> = {
  professional: 'שלום, תודה שפנית אלינו.',
  warm: 'היי, איזה כיף שפנית אלינו! 🙂',
  businesslike: 'התקבלה פנייתך.',
  formal: 'שלום רב, פנייתך התקבלה.',
};

const TONE_HANDOFF: Record<string, string> = {
  professional: 'אנחנו מעבירים את הפנייה לטיפול אישי של הצוות, ונחזור אליך בהקדם.',
  warm: 'אנחנו כבר מעבירים את זה לאחד מאיתנו, נשוב אליך ממש בקרוב 💬',
  businesslike: 'הפנייה הועברה לטיפול הצוות.',
  formal: 'פנייתך הועברה לטיפול נציג/ת המשרד, ותקבל/י מענה בהקדם האפשרי.',
};

export interface AutoReplyContext {
  isFirstMessage: boolean;
  hoursStatus: HoursStatus;
  handoff: HandoffDecision;
  extracted: ExtractedFields;
}

/**
 * Builds the automatic reply text for an incoming message, using the office's
 * disclosure/representative/style/after-hours settings. This is a template
 * engine, not an AI — it composes fixed building blocks from office settings
 * rather than generating free text, which keeps behavior predictable and
 * fully covered by tests.
 */
export function buildAutoReply(profile: OfficeProfile, ctx: AutoReplyContext): string {
  const tone = profile.style?.tone ?? 'professional';
  const parts: string[] = [];

  if (ctx.isFirstMessage) {
    if (profile.disclosure?.enabled && profile.disclosure.messageText) {
      parts.push(profile.disclosure.messageText);
    }
    const rep = profile.representative;
    if (rep) {
      parts.push(`מדבר/ת ${rep.name}, ${roleLabel(rep.role)} ${profile.office.name}.`);
    }
  }

  if (ctx.handoff.handoff) {
    parts.push(TONE_HANDOFF[tone] ?? TONE_HANDOFF.professional);
    return parts.join(' ');
  }

  if (ctx.hoursStatus !== 'open' && profile.afterHoursPolicy?.outOfHoursMessage) {
    parts.push(profile.afterHoursPolicy.outOfHoursMessage);
    return parts.join(' ');
  }

  parts.push(TONE_GREETING[tone] ?? TONE_GREETING.professional);
  if (ctx.extracted.practiceArea) {
    parts.push(`נרשם שמדובר בתחום ${ctx.extracted.practiceArea}, ונחזור אליך עם פרטים נוספים.`);
  }

  return parts.join(' ');
}

function roleLabel(role: string): string {
  switch (role) {
    case 'secretary':
      return 'מזכירת';
    case 'representative':
      return 'נציגת';
    case 'digital_assistant':
      return 'העוזרת הדיגיטלית של';
    default:
      return 'נציגת';
  }
}
