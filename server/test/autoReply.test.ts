import { describe, it, expect } from 'vitest';
import { buildAutoReply } from '../src/engine/autoReply.js';
import type { OfficeProfile } from '../src/types.js';

function baseProfile(overrides: Partial<OfficeProfile> = {}): OfficeProfile {
  return {
    office: { id: 'o1', name: 'משרד לדוגמה', logoUrl: null, address: null, createdAt: '', updatedAt: '' },
    whatsapp: null,
    representative: { officeId: 'o1', name: 'נועה', role: 'digital_assistant', updatedAt: '' },
    disclosure: { officeId: 'o1', enabled: true, messageText: 'שיחה זו מנוהלת אוטומטית.', updatedAt: '' },
    style: { officeId: 'o1', tone: 'professional', customNotes: null, updatedAt: '' },
    practiceAreas: [],
    serviceRegionsConfig: null,
    serviceRegions: [],
    businessHours: [],
    holidays: [],
    afterHoursPolicy: { officeId: 'o1', inHoursBehavior: 'auto_reply_full', outOfHoursBehavior: 'collect_message_only', outOfHoursMessage: 'המשרד סגור כעת.', updatedAt: '' },
    staff: [],
    handoffRules: [],
    ...overrides,
  };
}

describe('buildAutoReply', () => {
  it('includes the disclosure and representative intro on the first message', () => {
    const profile = baseProfile();
    const reply = buildAutoReply(profile, {
      isFirstMessage: true,
      hoursStatus: 'open',
      handoff: { handoff: false, preserveContext: true },
      extracted: { practiceArea: null, urgency: null, phoneNumbers: [] },
    });
    expect(reply).toContain('שיחה זו מנוהלת אוטומטית.');
    expect(reply).toContain('נועה');
  });

  it('omits the disclosure/intro on later messages', () => {
    const profile = baseProfile();
    const reply = buildAutoReply(profile, {
      isFirstMessage: false,
      hoursStatus: 'open',
      handoff: { handoff: false, preserveContext: true },
      extracted: { practiceArea: null, urgency: null, phoneNumbers: [] },
    });
    expect(reply).not.toContain('שיחה זו מנוהלת אוטומטית.');
  });

  it('prefers the handoff message when a handoff is triggered', () => {
    const profile = baseProfile();
    const reply = buildAutoReply(profile, {
      isFirstMessage: false,
      hoursStatus: 'open',
      handoff: { handoff: true, reason: 'keyword:דחוף', preserveContext: true },
      extracted: { practiceArea: null, urgency: null, phoneNumbers: [] },
    });
    expect(reply).toContain('מעבירים');
  });

  it('uses the out-of-hours message when closed and no handoff is needed', () => {
    const profile = baseProfile();
    const reply = buildAutoReply(profile, {
      isFirstMessage: false,
      hoursStatus: 'closed',
      handoff: { handoff: false, preserveContext: true },
      extracted: { practiceArea: null, urgency: null, phoneNumbers: [] },
    });
    expect(reply).toBe('המשרד סגור כעת.');
  });

  it('mentions the detected practice area during open hours', () => {
    const profile = baseProfile();
    const reply = buildAutoReply(profile, {
      isFirstMessage: false,
      hoursStatus: 'open',
      handoff: { handoff: false, preserveContext: true },
      extracted: { practiceArea: 'דיני משפחה', urgency: null, phoneNumbers: [] },
    });
    expect(reply).toContain('דיני משפחה');
  });
});
