import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

function uniqueEmail() {
  return `case-owner-${Math.random().toString(36).slice(2)}@example.com`;
}

async function createOffice() {
  const agent = request.agent(app);
  const reg = await agent.post('/api/auth/register').send({ officeName: 'משרד תיקים', name: 'הבעלים', email: uniqueEmail(), password: 'password123' });
  return { agent, ...reg.body.office };
}

describe('cases API', () => {
  it('creates a case and lists it by status', async () => {
    const office = await createOffice();
    const created = await office.agent.post(`/api/offices/${office.id}/cases`).send({ title: 'תיק גירושין' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('new');

    const list = await office.agent.get(`/api/offices/${office.id}/cases`).query({ status: 'new' });
    expect(list.body).toHaveLength(1);

    const emptyList = await office.agent.get(`/api/offices/${office.id}/cases`).query({ status: 'closed' });
    expect(emptyList.body).toHaveLength(0);
  });

  it('updates case status and assignee', async () => {
    const office = await createOffice();
    const created = await office.agent.post(`/api/offices/${office.id}/cases`).send({ title: 'תיק' }).then((r) => r.body);
    const updated = await office.agent.patch(`/api/offices/${office.id}/cases/${created.id}`).send({ status: 'in_progress' });
    expect(updated.body.status).toBe('in_progress');
  });

  it('adds and completes tasks under a case', async () => {
    const office = await createOffice();
    const created = await office.agent.post(`/api/offices/${office.id}/cases`).send({ title: 'תיק' }).then((r) => r.body);
    const task = await office.agent.post(`/api/offices/${office.id}/cases/${created.id}/tasks`).send({ title: 'להגיש כתב תביעה' });
    expect(task.status).toBe(201);
    expect(task.body.status).toBe('open');

    const done = await office.agent.patch(`/api/offices/${office.id}/cases/${created.id}/tasks/${task.body.id}`).send({ status: 'done' });
    expect(done.body.status).toBe('done');

    const detail = await office.agent.get(`/api/offices/${office.id}/cases/${created.id}`);
    expect(detail.body.tasks).toHaveLength(1);
  });

  it('computes and stores a score derived from the linked conversation', async () => {
    const office = await createOffice();
    const conv = await office.agent
      .post(`/api/offices/${office.id}/conversations`)
      .send({ contactPhone: '+972501234567', contactName: 'לקוח' })
      .then((r) => r.body);
    await office.agent.post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'שלום' });

    const created = await office.agent.post(`/api/offices/${office.id}/cases`).send({ title: 'תיק', conversationId: conv.id }).then((r) => r.body);
    const scored = await office.agent.post(`/api/offices/${office.id}/cases/${created.id}/score`);
    expect(scored.status).toBe(200);
    expect(scored.body.score).toBeGreaterThan(0);
    expect(scored.body.score).toBeLessThanOrEqual(100);
  });

  it('returns a reports summary reflecting conversation and case state', async () => {
    const office = await createOffice();
    await office.agent.post(`/api/offices/${office.id}/handoff-rules`).send({ ruleType: 'keyword', value: 'דחוף' });
    const conv = await office.agent.post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' }).then((r) => r.body);
    await office.agent.post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'מקרה דחוף' });
    await office.agent.post(`/api/offices/${office.id}/cases`).send({ title: 'תיק' });

    const report = await office.agent.get(`/api/offices/${office.id}/reports/summary`);
    expect(report.status).toBe(200);
    expect(report.body.conversations.total).toBe(1);
    expect(report.body.conversations.pendingHuman).toBe(1);
    expect(report.body.handoffRate).toBe(1);
    expect(report.body.cases.total).toBe(1);
  });
});
