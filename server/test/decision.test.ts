import { describe, it, expect } from 'vitest';
import { resolveBusinessHoursStatus, shouldHandoffToHuman } from '../src/engine/decision.js';
import type { OfficeProfile } from '../src/types.js';

function baseProfile(overrides: Partial<OfficeProfile> = {}): OfficeProfile {
  return {
    office: { id: 'o1', name: 'Test', logoUrl: null, address: null, createdAt: '', updatedAt: '' },
    whatsapp: null,
    representative: null,
    disclosure: null,
    style: null,
    practiceAreas: [],
    serviceRegionsConfig: null,
    serviceRegions: [],
    businessHours: [],
    holidays: [],
    afterHoursPolicy: null,
    staff: [],
    handoffRules: [],
    ...overrides,
  };
}

describe('resolveBusinessHoursStatus', () => {
  it('reports open within configured hours', () => {
    // 2026-09-14 is a Monday -> dayOfWeek 1
    const profile = baseProfile({
      businessHours: [{ id: 'h1', officeId: 'o1', dayOfWeek: 1, isClosed: false, openTime: '09:00', closeTime: '17:00' }],
    });
    const monday10am = new Date(2026, 8, 14, 10, 0); // month is 0-indexed: Sep=8
    expect(monday10am.getDay()).toBe(1);
    expect(resolveBusinessHoursStatus(profile, monday10am)).toBe('open');
  });

  it('reports closed outside configured hours', () => {
    const profile = baseProfile({
      businessHours: [{ id: 'h1', officeId: 'o1', dayOfWeek: 1, isClosed: false, openTime: '09:00', closeTime: '17:00' }],
    });
    const monday8pm = new Date(2026, 8, 14, 20, 0);
    expect(resolveBusinessHoursStatus(profile, monday8pm)).toBe('closed');
  });

  it('reports closed for a day with no configured hours', () => {
    const profile = baseProfile({ businessHours: [] });
    const someDay = new Date(2026, 8, 14, 10, 0);
    expect(resolveBusinessHoursStatus(profile, someDay)).toBe('closed');
  });

  it('reports holiday even during otherwise-open hours', () => {
    const profile = baseProfile({
      businessHours: [{ id: 'h1', officeId: 'o1', dayOfWeek: 1, isClosed: false, openTime: '09:00', closeTime: '17:00' }],
      holidays: [{ id: 'hol1', officeId: 'o1', date: '2026-09-14', name: 'חג לדוגמה', isRecurringAnnual: false }],
    });
    const monday10am = new Date(2026, 8, 14, 10, 0);
    expect(resolveBusinessHoursStatus(profile, monday10am)).toBe('holiday');
  });

  it('matches recurring annual holidays by month-day regardless of year', () => {
    const profile = baseProfile({
      businessHours: [{ id: 'h1', officeId: 'o1', dayOfWeek: 1, isClosed: false, openTime: '09:00', closeTime: '17:00' }],
      holidays: [{ id: 'hol1', officeId: 'o1', date: '2020-09-14', name: 'חג שנתי', isRecurringAnnual: true }],
    });
    const monday10am = new Date(2026, 8, 14, 10, 0);
    expect(resolveBusinessHoursStatus(profile, monday10am)).toBe('holiday');
  });
});

describe('shouldHandoffToHuman', () => {
  it('hands off on explicit human request', () => {
    const profile = baseProfile({
      handoffRules: [{ id: 'r1', officeId: 'o1', ruleType: 'explicit_request', value: 'true', action: 'transfer_to_human', preserveContext: true, isActive: true }],
    });
    const decision = shouldHandoffToHuman(profile, { text: 'אני רוצה לדבר עם בן אדם', explicitHumanRequest: true });
    expect(decision.handoff).toBe(true);
    expect(decision.reason).toBe('explicit_request');
    expect(decision.preserveContext).toBe(true);
  });

  it('hands off on a matching keyword', () => {
    const profile = baseProfile({
      handoffRules: [{ id: 'r1', officeId: 'o1', ruleType: 'keyword', value: 'דחוף', action: 'transfer_to_human', preserveContext: true, isActive: true }],
    });
    const decision = shouldHandoffToHuman(profile, { text: 'זה מקרה דחוף' });
    expect(decision.handoff).toBe(true);
    expect(decision.reason).toBe('keyword:דחוף');
  });

  it('hands off when urgency meets or exceeds the configured threshold', () => {
    const profile = baseProfile({
      handoffRules: [{ id: 'r1', officeId: 'o1', ruleType: 'urgency', value: 'high', action: 'transfer_to_human', preserveContext: false, isActive: true }],
    });
    expect(shouldHandoffToHuman(profile, { text: '', urgency: 'urgent' }).handoff).toBe(true);
    expect(shouldHandoffToHuman(profile, { text: '', urgency: 'high' }).handoff).toBe(true);
    expect(shouldHandoffToHuman(profile, { text: '', urgency: 'normal' }).handoff).toBe(false);
  });

  it('hands off when the message practice area matches a configured area rule', () => {
    const profile = baseProfile({
      handoffRules: [{ id: 'r1', officeId: 'o1', ruleType: 'area', value: 'פלילי', action: 'transfer_to_human', preserveContext: true, isActive: true }],
    });
    expect(shouldHandoffToHuman(profile, { text: '', practiceArea: 'פלילי' }).handoff).toBe(true);
    expect(shouldHandoffToHuman(profile, { text: '', practiceArea: 'אזרחי' }).handoff).toBe(false);
  });

  it('ignores inactive rules', () => {
    const profile = baseProfile({
      handoffRules: [{ id: 'r1', officeId: 'o1', ruleType: 'keyword', value: 'דחוף', action: 'transfer_to_human', preserveContext: true, isActive: false }],
    });
    expect(shouldHandoffToHuman(profile, { text: 'מקרה דחוף' }).handoff).toBe(false);
  });

  it('does not hand off when no rule matches', () => {
    const profile = baseProfile({ handoffRules: [] });
    const decision = shouldHandoffToHuman(profile, { text: 'שאלה כללית' });
    expect(decision.handoff).toBe(false);
    expect(decision.preserveContext).toBe(true);
  });
});
