import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

function uniqueEmail() {
  return `user-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerOwner(officeName = 'משרד בדיקה') {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const res = await agent.post('/api/auth/register').send({ officeName, name: 'הבעלים', email, password: 'password123' });
  return { agent, office: res.body.office, user: res.body.user };
}

describe('users API', () => {
  it('the owner appears in the office user list right after registering', async () => {
    const { agent, office, user } = await registerOwner();
    const list = await agent.get(`/api/offices/${office.id}/users`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(user.id);
    expect(list.body[0].role).toBe('owner');
  });

  it('an owner can add a staff user, who can log in and see office data but not manage settings', async () => {
    const { agent, office } = await registerOwner();
    const staffEmail = uniqueEmail();

    const added = await agent.post(`/api/offices/${office.id}/users`).send({ name: 'עובד', email: staffEmail, password: 'password123', role: 'staff' });
    expect(added.status).toBe(201);
    expect(added.body.role).toBe('staff');

    const staffAgent = request.agent(app);
    const login = await staffAgent.post('/api/auth/login').send({ email: staffEmail, password: 'password123' });
    expect(login.status).toBe(200);

    // Staff can read/manage conversations...
    const conv = await staffAgent.post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' });
    expect(conv.status).toBe(201);

    // ...but cannot touch office settings.
    const settings = await staffAgent.patch(`/api/offices/${office.id}`).send({ name: 'שם חדש' });
    expect(settings.status).toBe(403);

    const templates = await staffAgent.post(`/api/offices/${office.id}/document-templates`).send({ name: 'x', body: 'y' });
    expect(templates.status).toBe(403);
  });

  it('rejects a non-owner adding a user', async () => {
    const { agent, office } = await registerOwner();
    const staffEmail = uniqueEmail();
    await agent.post(`/api/offices/${office.id}/users`).send({ name: 'עובד', email: staffEmail, password: 'password123', role: 'staff' });

    const staffAgent = request.agent(app);
    await staffAgent.post('/api/auth/login').send({ email: staffEmail, password: 'password123' });

    const res = await staffAgent.post(`/api/offices/${office.id}/users`).send({ name: 'עוד מישהו', email: uniqueEmail(), password: 'password123', role: 'staff' });
    expect(res.status).toBe(403);
  });

  it('lets an owner remove a staff user', async () => {
    const { agent, office } = await registerOwner();
    const added = await agent
      .post(`/api/offices/${office.id}/users`)
      .send({ name: 'עובד', email: uniqueEmail(), password: 'password123', role: 'staff' })
      .then((r) => r.body);

    const del = await agent.delete(`/api/offices/${office.id}/users/${added.id}`);
    expect(del.status).toBe(204);

    const list = await agent.get(`/api/offices/${office.id}/users`);
    expect(list.body).toHaveLength(1);
  });

  it('refuses to remove the last owner', async () => {
    const { agent, office, user } = await registerOwner();
    const res = await agent.delete(`/api/offices/${office.id}/users/${user.id}`);
    expect(res.status).toBe(400);
  });

  it('allows removing an owner when another owner remains', async () => {
    const { agent, office, user } = await registerOwner();
    const secondOwner = await agent
      .post(`/api/offices/${office.id}/users`)
      .send({ name: 'בעלים שני', email: uniqueEmail(), password: 'password123', role: 'owner' })
      .then((r) => r.body);

    const res = await agent.delete(`/api/offices/${office.id}/users/${user.id}`);
    expect(res.status).toBe(204);
    expect(secondOwner.role).toBe('owner');
  });
});
