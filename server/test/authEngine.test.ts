import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/engine/auth.js';

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password', () => {
    const hash = hashPassword('correct-horse-battery-staple');
    expect(verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('correct-horse-battery-staple');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each time (random salt)', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(verifyPassword('same-password', a)).toBe(true);
    expect(verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects a malformed stored hash without throwing', () => {
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});

describe('createSessionToken / verifySessionToken', () => {
  const secret = 'test-secret';

  it('round-trips a valid token', () => {
    const token = createSessionToken({ userId: 'u1', officeId: 'o1', role: 'owner' }, secret);
    const payload = verifySessionToken(token, secret);
    expect(payload).toMatchObject({ userId: 'u1', officeId: 'o1', role: 'owner' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken({ userId: 'u1', officeId: 'o1', role: 'owner' }, secret);
    expect(verifySessionToken(token, 'wrong-secret')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = createSessionToken({ userId: 'u1', officeId: 'o1', role: 'owner' }, secret);
    const [body, signature] = token.split('.');
    const tamperedBody = Buffer.from(JSON.stringify({ userId: 'u2', officeId: 'o1', role: 'owner', exp: 9999999999 })).toString('base64url');
    expect(verifySessionToken(`${tamperedBody}.${signature}`, secret)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createSessionToken({ userId: 'u1', officeId: 'o1', role: 'owner' }, secret, -10);
    expect(verifySessionToken(token, secret)).toBeNull();
  });

  it('rejects a missing or malformed token', () => {
    expect(verifySessionToken(undefined, secret)).toBeNull();
    expect(verifySessionToken('garbage', secret)).toBeNull();
    expect(verifySessionToken('', secret)).toBeNull();
  });
});
