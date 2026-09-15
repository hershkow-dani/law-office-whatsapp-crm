import type { ExtractedFields, PracticeArea, UrgencyLevel } from '../types.js';

const PHONE_RE = /(?:\+972|0)5\d(?:[-\s]?\d){7}/g;

const URGENCY_KEYWORDS: [RegExp, UrgencyLevel][] = [
  [/(חירום|דחוף מאוד|מיידי)/, 'urgent'],
  [/(דחוף|בהול)/, 'high'],
];

/**
 * Rule-based, keyword-driven extraction of structured fields from free text.
 * This is a placeholder for Stage B: it needs no external AI/NLP provider and
 * works offline, but is deliberately simple. Swapping in an LLM-based
 * extractor later (would need an AI provider key) can reuse the same
 * ExtractedFields shape without touching callers.
 */
export function extractFields(text: string, practiceAreas: PracticeArea[]): ExtractedFields {
  let practiceArea: string | null = null;
  for (const area of practiceAreas) {
    if (area.name && text.includes(area.name)) {
      practiceArea = area.name;
      break;
    }
  }

  let urgency: UrgencyLevel | null = null;
  for (const [re, level] of URGENCY_KEYWORDS) {
    if (re.test(text)) {
      urgency = level;
      break;
    }
  }

  const phoneNumbers = Array.from(new Set(text.match(PHONE_RE) ?? []));

  return { practiceArea, urgency, phoneNumbers };
}
