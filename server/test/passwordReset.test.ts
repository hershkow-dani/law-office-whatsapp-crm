import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getEmailProvider, resetEmailProviderForTests } from '../src/engine/email.js';

const app = createApp();

function uniqueEmail() {
  return `reset-${Math.random().toString(36).slice(2)}@example.com`;
}

beforeEach(() => {
  resetEmailProviderForTests();
});

function extractResetToken(emailText: string): string {
  const match = emailText.match(/resetToken=([a-f0-9]+)/);
  if (!match) throw new Error(`no reset token found in email body: ${emailText}`);
  return match[1];
}

describe('POST /api/auth/forgot-password', () => {
  it('sends a reset email for a registered address', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });

    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);

    const provider = getEmailProvider() as any;
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe(email.toLowerCase());
    expect(provider.sent[0].text).toContain('resetToken=');
  });

  it('responds identically for an email that is not registered (no enumeration)', async () => {
    const registeredEmail = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email: registeredEmail, password: 'password123' });

    const known = await request(app).post('/api/auth/forgot-password').send({ email: registeredEmail });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail() });

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);

    const provider = getEmailProvider() as any;
    expect(provider.sent).toHaveLength(1); // only the registered one actually got an email
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('throttles repeated requests for the same address', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });

    const first = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(second.status).toBe(429);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('lets a user set a new password and log in with it, invalidating the old one', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'old-password123' });
    await request(app).post('/api/auth/forgot-password').send({ email });

    const provider = getEmailProvider() as any;
    const token = extractResetToken(provider.sent[0].text);

    const reset = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'new-password456' });
    expect(reset.status).toBe(204);

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: 'old-password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email, password: 'new-password456' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a token that was already used', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });
    await request(app).post('/api/auth/forgot-password').send({ email });
    const provider = getEmailProvider() as any;
    const token = extractResetToken(provider.sent[0].text);

    const first = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'password456' });
    expect(first.status).toBe(204);

    const replay = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'password789' });
    expect(replay.status).toBe(400);
  });

  it('rejects a made-up token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', newPassword: 'password123' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    try {
      const email = uniqueEmail();
      await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });
      await request(app).post('/api/auth/forgot-password').send({ email });
      const provider = getEmailProvider() as any;
      const token = extractResetToken(provider.sent[0].text);

      vi.advanceTimersByTime(61 * 60 * 1000); // just past the 1-hour expiry

      const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'password456' });
      expect(res.status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a too-short new password', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'whatever', newPassword: '123' });
    expect(res.status).toBe(400);
  });
});
