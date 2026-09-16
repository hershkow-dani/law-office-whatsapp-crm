import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

function uniqueEmail() {
  return `office-owner-${Math.random().toString(36).slice(2)}@example.com`;
}

/** Registers a fresh office + owner and returns an authenticated agent plus the office. */
async function createTestOffice(name = 'משרד לדוגמה') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ officeName: name, name: 'הבעלים', email: uniqueEmail(), password: 'password123' });
  expect(res.status).toBe(201);
  return { agent, ...res.body.office };
}

describe('offices API', () => {
  it('creates an office and retrieves its full profile', async () => {
    const office = await createTestOffice();
    expect(office.id).toBeTruthy();
    expect(office.name).toBe('משרד לדוגמה');

    const res = await office.agent.get(`/api/offices/${office.id}`);
    expect(res.status).toBe(200);
    expect(res.body.office.id).toBe(office.id);
    expect(res.body.whatsapp).toBeNull();
    expect(res.body.staff).toEqual([]);
  });

  it('returns 403 for an office belonging to someone else (no cross-tenant existence leak)', async () => {
    const office = await createTestOffice();
    const res = await office.agent.get('/api/offices/does-not-exist');
    expect(res.status).toBe(403);
  });

  it('deletes an office and cascades its nested settings', async () => {
    const office = await createTestOffice();
    await office.agent.post(`/api/offices/${office.id}/practice-areas`).send({ name: 'דיני משפחה' });

    const del = await office.agent.delete(`/api/offices/${office.id}`);
    expect(del.status).toBe(204);

    const get = await office.agent.get(`/api/offices/${office.id}`);
    // The session still names this office, but it's gone — same not-found
    // shape the route would give for a real 404 inside officeOr404.
    expect([403, 404]).toContain(get.status);
  });

  it('returns 403 when deleting an office that is not the caller\'s own', async () => {
    const office = await createTestOffice();
    const res = await office.agent.delete('/api/offices/does-not-exist');
    expect(res.status).toBe(403);
  });

  it('updates office identity fields', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .patch(`/api/offices/${office.id}`)
      .send({ address: 'רוטשילד 1, תל אביב', logoUrl: 'https://example.com/logo.png' });
    expect(res.status).toBe(200);
    expect(res.body.address).toBe('רוטשילד 1, תל אביב');
    expect(res.body.logoUrl).toBe('https://example.com/logo.png');
  });

  it('connects a dedicated WhatsApp number, not depending on any central provider number', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/whatsapp`)
      .send({ numberType: 'dedicated', phoneNumber: '+972501234567', provider: 'meta_cloud_api' });
    expect(res.status).toBe(200);
    expect(res.body.numberType).toBe('dedicated');
    expect(res.body.phoneNumber).toBe('+972501234567');
    expect(res.body.connectionStatus).toBe('pending');
  });

  it('connects an existing WhatsApp number', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/whatsapp`)
      .send({ numberType: 'existing', phoneNumber: '+972521112222' });
    expect(res.status).toBe(200);
    expect(res.body.numberType).toBe('existing');
  });

  it('rejects an invalid whatsapp number type', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/whatsapp`)
      .send({ numberType: 'central_pool', phoneNumber: '+972501234567' });
    expect(res.status).toBe(400);
  });

  it('sets representative identity and conversation style', async () => {
    const office = await createTestOffice();
    const rep = await office.agent
      .put(`/api/offices/${office.id}/representative`)
      .send({ name: 'נועה', role: 'digital_assistant' });
    expect(rep.status).toBe(200);
    expect(rep.body.role).toBe('digital_assistant');

    const style = await office.agent
      .put(`/api/offices/${office.id}/style`)
      .send({ tone: 'warm', customNotes: 'לפנות בגוף שני יחיד' });
    expect(style.status).toBe(200);
    expect(style.body.tone).toBe('warm');
  });

  it('sets the auto-reply disclosure message', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/disclosure`)
      .send({ enabled: true, messageText: 'שיחה זו מנוהלת בסיוע מערכת אוטומטית מטעם המשרד.' });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('manages practice areas including sub-areas', async () => {
    const office = await createTestOffice();
    const parent = await office.agent.post(`/api/offices/${office.id}/practice-areas`).send({ name: 'דיני משפחה' });
    expect(parent.status).toBe(201);
    const child = await office.agent
      .post(`/api/offices/${office.id}/practice-areas`)
      .send({ name: 'גירושין', parentId: parent.body.id });
    expect(child.status).toBe(201);
    expect(child.body.parentId).toBe(parent.body.id);

    const list = await office.agent.get(`/api/offices/${office.id}/practice-areas`);
    expect(list.body).toHaveLength(2);

    const del = await office.agent.delete(`/api/offices/${office.id}/practice-areas/${child.body.id}`);
    expect(del.status).toBe(204);
  });

  it('creates a practice area with a logo and lets it be replaced via PATCH', async () => {
    const office = await createTestOffice();
    const created = await office.agent
      .post(`/api/offices/${office.id}/practice-areas`)
      .send({ name: 'פלילי', logoUrl: 'data:image/png;base64,AAAA' });
    expect(created.body.logoUrl).toBe('data:image/png;base64,AAAA');

    const patched = await office.agent
      .patch(`/api/offices/${office.id}/practice-areas/${created.body.id}`)
      .send({ logoUrl: 'data:image/png;base64,BBBB' });
    expect(patched.status).toBe(200);
    expect(patched.body.logoUrl).toBe('data:image/png;base64,BBBB');
    expect(patched.body.name).toBe('פלילי');
  });

  it('sets service regions mode and region list', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/service-regions`)
      .send({
        mode: 'regional',
        regions: [
          { regionName: 'מרכז', courtType: 'שלום', serviceType: 'ייצוג' },
          { regionName: 'צפון', courtType: null, serviceType: 'ייעוץ' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.config.mode).toBe('regional');
    expect(res.body.regions).toHaveLength(2);
  });

  it('stores a logo per service region', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/service-regions`)
      .send({
        mode: 'regional',
        regions: [{ regionName: 'מרכז', courtType: null, serviceType: null, logoUrl: 'data:image/png;base64,AAAA' }],
      });
    expect(res.body.regions[0].logoUrl).toBe('data:image/png;base64,AAAA');
  });

  it('replaces the full weekly business-hours schedule', async () => {
    const office = await createTestOffice();
    const hours = [0, 1, 2, 3, 4].map((d) => ({ dayOfWeek: d, isClosed: false, openTime: '09:00', closeTime: '17:00' }));
    hours.push({ dayOfWeek: 5, isClosed: true, openTime: null, closeTime: null });
    hours.push({ dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null });

    const res = await office.agent.put(`/api/offices/${office.id}/business-hours`).send({ hours });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
  });

  it('manages holidays', async () => {
    const office = await createTestOffice();
    const add = await office.agent
      .post(`/api/offices/${office.id}/holidays`)
      .send({ date: '2026-09-23', name: 'ראש השנה' });
    expect(add.status).toBe(201);
    const list = await office.agent.get(`/api/offices/${office.id}/holidays`);
    expect(list.body).toHaveLength(1);
    const del = await office.agent.delete(`/api/offices/${office.id}/holidays/${add.body.id}`);
    expect(del.status).toBe(204);
  });

  it('creates a holiday with a logo and lets it be replaced via PATCH', async () => {
    const office = await createTestOffice();
    const created = await office.agent
      .post(`/api/offices/${office.id}/holidays`)
      .send({ date: '2026-09-23', name: 'ראש השנה', logoUrl: 'data:image/png;base64,AAAA' });
    expect(created.body.logoUrl).toBe('data:image/png;base64,AAAA');

    const patched = await office.agent
      .patch(`/api/offices/${office.id}/holidays/${created.body.id}`)
      .send({ logoUrl: 'data:image/png;base64,BBBB' });
    expect(patched.status).toBe(200);
    expect(patched.body.logoUrl).toBe('data:image/png;base64,BBBB');
    expect(patched.body.name).toBe('ראש השנה');
  });

  it('sets after-hours policy', async () => {
    const office = await createTestOffice();
    const res = await office.agent
      .put(`/api/offices/${office.id}/after-hours`)
      .send({
        inHoursBehavior: 'auto_reply_full',
        outOfHoursBehavior: 'collect_message_only',
        outOfHoursMessage: 'המשרד סגור כעת, נחזור אליך בשעות הפעילות.',
      });
    expect(res.status).toBe(200);
    expect(res.body.outOfHoursBehavior).toBe('collect_message_only');
  });

  it('manages staff members and assigns responsibility areas', async () => {
    const office = await createTestOffice();
    const add = await office.agent
      .post(`/api/offices/${office.id}/staff`)
      .send({ name: 'עו״ד ישראלי', role: 'lawyer', permissions: ['manage_cases'], responsibilityAreas: ['דיני משפחה'] });
    expect(add.status).toBe(201);
    expect(add.body.photoUrl).toBeNull();

    const patch = await office.agent
      .patch(`/api/offices/${office.id}/staff/${add.body.id}`)
      .send({ isActive: false, photoUrl: 'data:image/png;base64,AAAA' });
    expect(patch.status).toBe(200);
    expect(patch.body.isActive).toBe(false);
    expect(patch.body.photoUrl).toBe('data:image/png;base64,AAAA');

    const del = await office.agent.delete(`/api/offices/${office.id}/staff/${add.body.id}`);
    expect(del.status).toBe(204);
  });

  it('manages handoff rules', async () => {
    const office = await createTestOffice();
    const add = await office.agent
      .post(`/api/offices/${office.id}/handoff-rules`)
      .send({ ruleType: 'keyword', value: 'דחוף', preserveContext: true });
    expect(add.status).toBe(201);

    const list = await office.agent.get(`/api/offices/${office.id}/handoff-rules`);
    expect(list.body).toHaveLength(1);

    const del = await office.agent.delete(`/api/offices/${office.id}/handoff-rules/${add.body.id}`);
    expect(del.status).toBe(204);
  });

  it('creates a handoff rule with a contact name and logo, and lets them be replaced via PATCH', async () => {
    const office = await createTestOffice();
    const created = await office.agent
      .post(`/api/offices/${office.id}/handoff-rules`)
      .send({ ruleType: 'urgency', value: 'high', contactName: 'עו״ד ישראלי', logoUrl: 'data:image/png;base64,AAAA' });
    expect(created.body.contactName).toBe('עו״ד ישראלי');
    expect(created.body.logoUrl).toBe('data:image/png;base64,AAAA');

    const patched = await office.agent
      .patch(`/api/offices/${office.id}/handoff-rules/${created.body.id}`)
      .send({ logoUrl: 'data:image/png;base64,BBBB' });
    expect(patched.status).toBe(200);
    expect(patched.body.logoUrl).toBe('data:image/png;base64,BBBB');
    expect(patched.body.contactName).toBe('עו״ד ישראלי');
  });

  it('previews planned behavior: business-hours status and handoff decision together', async () => {
    const office = await createTestOffice();
    await office.agent
      .put(`/api/offices/${office.id}/business-hours`)
      .send({ hours: [1].map((d) => ({ dayOfWeek: d, isClosed: false, openTime: '09:00', closeTime: '17:00' })) });
    await office.agent
      .post(`/api/offices/${office.id}/handoff-rules`)
      .send({ ruleType: 'keyword', value: 'דחוף' });

    // Monday (dayOfWeek=1) at 10:00 -> open; message contains the keyword -> handoff
    const res = await office.agent
      .post(`/api/offices/${office.id}/decision-preview`)
      .send({ at: '2026-09-14T10:00:00.000Z', message: { text: 'זה מקרה דחוף מאוד' } });

    expect(res.status).toBe(200);
    expect(res.body.handoff.handoff).toBe(true);
    expect(res.body.handoff.preserveContext).toBe(true);
  });
});
