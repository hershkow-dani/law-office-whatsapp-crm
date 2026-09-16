import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

function uniqueEmail() {
  return `owner-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('POST /api/auth/register', () => {
  it('creates an office and its owner, and sets a session cookie', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ officeName: 'משרד בדיקה', name: 'בעל המשרד', email, password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.office.name).toBe('משרד בדיקה');
    expect(res.body.user.role).toBe('owner');
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toContain('crm_session=');
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד א', name: 'א', email, password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ officeName: 'משרד ב', name: 'ב', email, password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ officeName: 'משרד', name: 'שם', email: uniqueEmail(), password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ officeName: 'משרד', name: 'שם', email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and rejects wrong ones', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });

    const ok = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(email.toLowerCase());

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rejects login for an unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: uniqueEmail(), password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user when logged in, 401 otherwise', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail();
    await agent.post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email.toLowerCase());

    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session so subsequent requests are unauthenticated', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail();
    await agent.post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email, password: 'password123' });

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});

describe('office data isolation', () => {
  it('blocks a logged-in user from reading a different office', async () => {
    const agentA = request.agent(app);
    const emailA = uniqueEmail();
    const regA = await agentA.post('/api/auth/register').send({ officeName: 'משרד א', name: 'א', email: emailA, password: 'password123' });

    const agentB = request.agent(app);
    const emailB = uniqueEmail();
    const regB = await agentB.post('/api/auth/register').send({ officeName: 'משרד ב', name: 'ב', email: emailB, password: 'password123' });

    const crossAccess = await agentA.get(`/api/offices/${regB.body.office.id}`);
    expect(crossAccess.status).toBe(403);

    const ownAccess = await agentB.get(`/api/offices/${regB.body.office.id}`);
    expect(ownAccess.status).toBe(200);
    expect(regA.body.office.id).not.toBe(regB.body.office.id);
  });

  it('rejects requests with no session at all', async () => {
    const res = await request(app).post('/api/auth/register').send({ officeName: 'משרד', name: 'שם', email: uniqueEmail(), password: 'password123' });
    const anon = await request(app).get(`/api/offices/${res.body.office.id}`);
    expect(anon.status).toBe(401);
  });
});
