import type { CaseRecord, Conversation, OfficeProfile } from '../types.js';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface RenderResult {
  content: string;
  missingFields: string[];
}

/**
 * Fills {{placeholder}} tokens in a template body from a flat context map.
 * A placeholder with no value in the context (or an empty string) is left in
 * place as-is and reported in `missingFields`, so a generated document never
 * silently loses information the office needs to fill in by hand.
 */
export function renderTemplate(body: string, context: Record<string, string | null | undefined>): RenderResult {
  const missingFields: string[] = [];
  const content = body.replace(PLACEHOLDER_RE, (match, key: string) => {
    const value = context[key];
    if (!value) {
      if (!missingFields.includes(key)) missingFields.push(key);
      return match;
    }
    return value;
  });
  return { content, missingFields };
}

/**
 * Builds the standard set of placeholders available to every office's
 * document templates, from the office profile plus an optional linked case
 * and conversation. Extending this list is how future template variables get
 * added — templates just reference {{newKey}} once it exists here.
 */
export function buildDocumentContext(
  profile: OfficeProfile,
  caseRecord: CaseRecord | null,
  conversation: Conversation | null
): Record<string, string | null> {
  return {
    officeName: profile.office.name,
    officeAddress: profile.office.address,
    representativeName: profile.representative?.name ?? null,
    caseTitle: caseRecord?.title ?? null,
    practiceArea: caseRecord?.practiceArea ?? conversation?.practiceArea ?? null,
    clientName: conversation?.contactName ?? null,
    clientPhone: conversation?.contactPhone ?? null,
    today: new Date().toLocaleDateString('he-IL'),
  };
}
