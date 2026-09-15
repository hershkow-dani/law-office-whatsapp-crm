import { describe, it, expect } from 'vitest';
import { extractFields } from '../src/engine/extraction.js';
import type { PracticeArea } from '../src/types.js';

const areas: PracticeArea[] = [
  { id: 'a1', officeId: 'o1', name: 'דיני משפחה', parentId: null },
  { id: 'a2', officeId: 'o1', name: 'פלילי', parentId: null },
];

describe('extractFields', () => {
  it('matches a configured practice area mentioned in the text', () => {
    const result = extractFields('אני צריך עזרה בתיק דיני משפחה בבקשה', areas);
    expect(result.practiceArea).toBe('דיני משפחה');
  });

  it('returns null practice area when nothing matches', () => {
    const result = extractFields('שאלה כללית על שכר טרחה', areas);
    expect(result.practiceArea).toBeNull();
  });

  it('detects urgent-level keywords', () => {
    expect(extractFields('זה מצב חירום ממש', areas).urgency).toBe('urgent');
    expect(extractFields('תגיעו דחוף בבקשה', areas).urgency).toBe('high');
    expect(extractFields('רק שאלה רגילה', areas).urgency).toBeNull();
  });

  it('extracts israeli mobile phone numbers from free text', () => {
    const result = extractFields('אפשר להתקשר אליי ל-050-1234567 בבקשה', areas);
    expect(result.phoneNumbers).toEqual(['050-1234567']);
  });

  it('deduplicates repeated phone numbers', () => {
    const result = extractFields('התקשרו ל0501234567 או ל0501234567', areas);
    expect(result.phoneNumbers).toHaveLength(1);
  });
});
