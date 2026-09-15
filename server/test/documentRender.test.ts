import { describe, it, expect } from 'vitest';
import { renderTemplate, buildDocumentContext } from '../src/engine/documentRender.js';
import type { CaseRecord, Conversation, OfficeProfile } from '../src/types.js';

function baseProfile(overrides: Partial<OfficeProfile> = {}): OfficeProfile {
  return {
    office: { id: 'o1', name: 'משרד לדוגמה', logoUrl: null, address: 'רוטשילד 1', createdAt: '', updatedAt: '' },
    whatsapp: null,
    representative: { officeId: 'o1', name: 'נועה', role: 'digital_assistant', updatedAt: '' },
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

describe('renderTemplate', () => {
  it('substitutes known placeholders', () => {
    const result = renderTemplate('שלום {{clientName}}, בעניין {{practiceArea}}.', {
      clientName: 'דנה כהן',
      practiceArea: 'דיני משפחה',
    });
    expect(result.content).toBe('שלום דנה כהן, בעניין דיני משפחה.');
    expect(result.missingFields).toEqual([]);
  });

  it('leaves unresolved placeholders in place and reports them as missing', () => {
    const result = renderTemplate('שלום {{clientName}}, מספר תיק {{caseNumber}}.', { clientName: 'דנה' });
    expect(result.content).toBe('שלום דנה, מספר תיק {{caseNumber}}.');
    expect(result.missingFields).toEqual(['caseNumber']);
  });

  it('deduplicates a placeholder that appears more than once', () => {
    const result = renderTemplate('{{clientName}} ... {{clientName}} שוב', {});
    expect(result.missingFields).toEqual(['clientName']);
  });
});

describe('buildDocumentContext', () => {
  it('pulls client fields from the linked conversation and case', () => {
    const profile = baseProfile();
    const caseRecord: CaseRecord = {
      id: 'c1',
      officeId: 'o1',
      conversationId: 'conv1',
      title: 'תיק גירושין',
      practiceArea: 'דיני משפחה',
      status: 'new',
      assignedStaffId: null,
      score: null,
      createdAt: '',
      updatedAt: '',
    };
    const conversation: Conversation = {
      id: 'conv1',
      officeId: 'o1',
      contactPhone: '+972501234567',
      contactName: 'דנה כהן',
      status: 'auto',
      practiceArea: 'דיני משפחה',
      assignedStaffId: null,
      everHandoff: false,
      createdAt: '',
      updatedAt: '',
      lastMessageAt: '',
    };

    const context = buildDocumentContext(profile, caseRecord, conversation);
    expect(context.officeName).toBe('משרד לדוגמה');
    expect(context.clientName).toBe('דנה כהן');
    expect(context.clientPhone).toBe('+972501234567');
    expect(context.caseTitle).toBe('תיק גירושין');
    expect(context.practiceArea).toBe('דיני משפחה');
    expect(context.representativeName).toBe('נועה');
  });

  it('falls back gracefully with no case or conversation', () => {
    const profile = baseProfile();
    const context = buildDocumentContext(profile, null, null);
    expect(context.officeName).toBe('משרד לדוגמה');
    expect(context.clientName).toBeNull();
    expect(context.caseTitle).toBeNull();
  });
});
