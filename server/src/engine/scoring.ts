export interface ScoringInput {
  firstResponseSeconds: number | null;
  fieldsCaptured: number;
  fieldsExpected: number;
  handoffWasNeeded: boolean;
  handoffWasTriggered: boolean;
}

function responsivenessScore(seconds: number | null): number {
  if (seconds === null) return 0;
  if (seconds <= 60) return 100;
  if (seconds <= 300) return 80;
  if (seconds <= 1800) return 50;
  if (seconds <= 86400) return 20;
  return 0;
}

function completenessScore(captured: number, expected: number): number {
  if (expected <= 0) return 100;
  return Math.max(0, Math.min(100, (captured / expected) * 100));
}

function handoffScore(needed: boolean, triggered: boolean): number {
  return needed === triggered ? 100 : 0;
}

/**
 * Composite 0-100 score used for the Stage B reports view: 40% how fast the
 * first reply went out, 40% how many of the office's expected fields were
 * captured from the conversation, 20% whether a handoff-to-human happened
 * exactly when the office's rules said it should.
 */
export function scoreConversation(input: ScoringInput): number {
  const responsiveness = responsivenessScore(input.firstResponseSeconds);
  const completeness = completenessScore(input.fieldsCaptured, input.fieldsExpected);
  const handoff = handoffScore(input.handoffWasNeeded, input.handoffWasTriggered);
  return Math.round(0.4 * responsiveness + 0.4 * completeness + 0.2 * handoff);
}
