import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

async function createOfficeWithSettings() {
  const office = await request(app).post('/api/offices').send({ name: 'משרד בדיקה' }).then((r) => r.body);
  await request(app).put(`/api/offices/${office.id}/disclosure`).send({ enabled: true, messageText: 'שיחה זו מנוהלת אוטומטית.' });
  await request(app).put(`/api/offices/${office.id}/representative`).send({ name: 'נועה', role: 'digital_assistant' });
  await request(app).put(`/api/offices/${office.id}/style`).send({ tone: 'professional' });
  await request(app)
    .put(`/api/offices/${office.id}/after-hours`)
    .send({ inHoursBehavior: 'auto_reply_full', outOfHoursBehavior: 'collect_message_only', outOfHoursMessage: 'המשרד סגור כעת.' });
  return office;
}

describe('conversations API', () => {
  it('creates a conversation and starts it in auto status', async () => {
    const office = await createOfficeWithSettings();
    const res = await request(app).post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('auto');
    expect(res.body.contactPhotoUrl).toBeNull();
  });

  it('accepts a contact photo on creation and lets it be replaced via PATCH', async () => {
    const office = await createOfficeWithSettings();
    const created = await request(app)
      .post(`/api/offices/${office.id}/conversations`)
      .send({ contactPhone: '+972501234567', contactPhotoUrl: 'data:image/png;base64,AAAA' });
    expect(created.body.contactPhotoUrl).toBe('data:image/png;base64,AAAA');

    const patched = await request(app)
      .patch(`/api/offices/${office.id}/conversations/${created.body.id}`)
      .send({ contactPhotoUrl: 'data:image/png;base64,BBBB' });
    expect(patched.status).toBe(200);
    expect(patched.body.contactPhotoUrl).toBe('data:image/png;base64,BBBB');
    expect(patched.body.contactName).toBe(created.body.contactName);
  });

  it('auto-replies to the first inbound message with disclosure + representative intro', async () => {
    const office = await createOfficeWithSettings();
    const conv = await request(app).post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' }).then((r) => r.body);

    const res = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'שלום, יש לי שאלה' });
    expect(res.status).toBe(200);
    expect(res.body.autoReplied).toBe(true);
    expect(res.body.replyText).toContain('שיחה זו מנוהלת אוטומטית.');
    expect(res.body.replyText).toContain('נועה');
    expect(res.body.conversation.status).toBe('auto');

    const detail = await request(app).get(`/api/offices/${office.id}/conversations/${conv.id}`);
    expect(detail.body.messages).toHaveLength(2);
    expect(detail.body.messages[0].direction).toBe('inbound');
    expect(detail.body.messages[1].direction).toBe('outbound');
  });

  it('switches to pending_human and stops auto-replying once a handoff rule matches', async () => {
    const office = await createOfficeWithSettings();
    await request(app).post(`/api/offices/${office.id}/handoff-rules`).send({ ruleType: 'keyword', value: 'דחוף' });
    const conv = await request(app).post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' }).then((r) => r.body);

    const first = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'זה מקרה דחוף מאוד' });
    expect(first.body.conversation.status).toBe('pending_human');
    expect(first.body.handoff.handoff).toBe(true);

    // Further inbound messages should be recorded but not trigger another auto-reply.
    const second = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'עוד פרטים' });
    expect(second.status).toBe(200);
    expect(second.body.autoReplied).toBe(false);

    const detail = await request(app).get(`/api/offices/${office.id}/conversations/${conv.id}`);
    // 2 inbound + 1 auto-reply outbound = 3
    expect(detail.body.messages).toHaveLength(3);
  });

  it('records a manual staff outbound message', async () => {
    const office = await createOfficeWithSettings();
    const conv = await request(app).post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' }).then((r) => r.body);
    const res = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/outbound`).send({ text: 'שלום, כאן עו״ד ישראלי' });
    expect(res.status).toBe(201);
    expect(res.body.senderType).toBe('staff');
  });

  it('detects the practice area mentioned in the message and tags the conversation', async () => {
    const office = await createOfficeWithSettings();
    await request(app).post(`/api/offices/${office.id}/practice-areas`).send({ name: 'דיני משפחה' });
    const conv = await request(app).post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' }).then((r) => r.body);
    const res = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'יש לי תיק דיני משפחה' });
    expect(res.body.conversation.practiceArea).toBe('דיני משפחה');
  });

  it('closes and resumes a conversation', async () => {
    const office = await createOfficeWithSettings();
    const conv = await request(app).post(`/api/offices/${office.id}/conversations`).send({ contactPhone: '+972501234567' }).then((r) => r.body);
    const closed = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/close`);
    expect(closed.body.status).toBe('closed');
    const resumed = await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/resume-auto`);
    expect(resumed.body.status).toBe('auto');
  });
});
