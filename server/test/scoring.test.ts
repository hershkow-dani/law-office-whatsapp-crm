import { describe, it, expect } from 'vitest';
import { scoreConversation } from '../src/engine/scoring.js';

describe('scoreConversation', () => {
  it('gives a perfect score for a fast, complete, correctly-handled conversation', () => {
    const score = scoreConversation({
      firstResponseSeconds: 10,
      fieldsCaptured: 3,
      fieldsExpected: 3,
      handoffWasNeeded: false,
      handoffWasTriggered: false,
    });
    expect(score).toBe(100);
  });

  it('gives zero responsiveness credit when there was no response at all', () => {
    const score = scoreConversation({
      firstResponseSeconds: null,
      fieldsCaptured: 3,
      fieldsExpected: 3,
      handoffWasNeeded: false,
      handoffWasTriggered: false,
    });
    // 0.4*0 (responsiveness) + 0.4*100 (completeness) + 0.2*100 (handoff correct) = 60
    expect(score).toBe(60);
  });

  it('penalizes an incorrect handoff decision', () => {
    const missedHandoff = scoreConversation({
      firstResponseSeconds: 10,
      fieldsCaptured: 3,
      fieldsExpected: 3,
      handoffWasNeeded: true,
      handoffWasTriggered: false,
    });
    const correctHandoff = scoreConversation({
      firstResponseSeconds: 10,
      fieldsCaptured: 3,
      fieldsExpected: 3,
      handoffWasNeeded: true,
      handoffWasTriggered: true,
    });
    expect(missedHandoff).toBeLessThan(correctHandoff);
    expect(correctHandoff).toBe(100);
  });

  it('scales completeness by the ratio of captured to expected fields', () => {
    const score = scoreConversation({
      firstResponseSeconds: 10,
      fieldsCaptured: 1,
      fieldsExpected: 2,
      handoffWasNeeded: false,
      handoffWasTriggered: false,
    });
    // 0.4*100 + 0.4*50 + 0.2*100 = 80
    expect(score).toBe(80);
  });

  it('treats zero expected fields as fully complete rather than dividing by zero', () => {
    const score = scoreConversation({
      firstResponseSeconds: 10,
      fieldsCaptured: 0,
      fieldsExpected: 0,
      handoffWasNeeded: false,
      handoffWasTriggered: false,
    });
    expect(score).toBe(100);
  });

  it('degrades responsiveness score as response time grows', () => {
    const fast = scoreConversation({ firstResponseSeconds: 30, fieldsCaptured: 1, fieldsExpected: 1, handoffWasNeeded: false, handoffWasTriggered: false });
    const slow = scoreConversation({ firstResponseSeconds: 5000, fieldsCaptured: 1, fieldsExpected: 1, handoffWasNeeded: false, handoffWasTriggered: false });
    expect(fast).toBeGreaterThan(slow);
  });
});
