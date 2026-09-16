import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();
const ORIGINAL_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

afterEach(() => {
  if (ORIGINAL_APP_SECRET === undefined) delete process.env.WHATSAPP_APP_SECRET;
  else process.env.WHATSAPP_APP_SECRET = ORIGINAL_APP_SECRET;
});

async function createOffice() {
  return request(app).post('/api/offices').send({ name: 'משרד webhook' }).then((r) => r.body);
}

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function metaPayload(from: string, text: string, contactName: string | null, phoneNumberId = 'PNID123') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15551234567', phone_number_id: phoneNumberId },
              contacts: contactName ? [{ profile: { name: contactName }, wa_id: from }] : [],
              messages: [{ from, id: 'wamid.ABC123', timestamp: String(Math.floor(Date.now() / 1000)), text: { body: text }, type: 'text' }],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

describe('GET /api/webhooks/whatsapp/:officeId (verification handshake)', () => {
  it('echoes the challenge when the verify token matches', async () => {
    const office = await createOffice();
    const conn = await request(app)
      .put(`/api/offices/${office.id}/whatsapp`)
      .send({ numberType: 'dedicated', phoneNumber: '+972501234567' })
      .then((r) => r.body);

    const res = await request(app)
      .get(`/api/webhooks/whatsapp/${office.id}`)
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': conn.webhookVerifyToken, 'hub.challenge': '12345' });

    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects a wrong verify token', async () => {
    const office = await createOffice();
    await request(app).put(`/api/offices/${office.id}/whatsapp`).send({ numberType: 'dedicated', phoneNumber: '+972501234567' });

    const res = await request(app)
      .get(`/api/webhooks/whatsapp/${office.id}`)
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong-token', 'hub.challenge': '12345' });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/webhooks/whatsapp/:officeId (incoming messages)', () => {
  it('refuses to process messages when WHATSAPP_APP_SECRET is not configured', async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const office = await createOffice();
    const res = await request(app).post(`/api/webhooks/whatsapp/${office.id}`).send(metaPayload('972501234567', 'שלום', 'דנה'));
    expect(res.status).toBe(501);
  });

  it('rejects a request with an invalid signature', async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const office = await createOffice();
    const bodyStr = JSON.stringify(metaPayload('972501234567', 'שלום', 'דנה'));

    const res = await request(app)
      .post(`/api/webhooks/whatsapp/${office.id}`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=' + '0'.repeat(64))
      .send(bodyStr);

    expect(res.status).toBe(401);
  });

  it('creates a conversation and processes the inbound message when the signature is valid', async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const office = await createOffice();
    await request(app).put(`/api/offices/${office.id}/disclosure`).send({ enabled: true, messageText: 'שיחה זו מנוהלת אוטומטית.' });

    const bodyStr = JSON.stringify(metaPayload('972501234567', 'שלום, אני צריכה עזרה', 'דנה כהן'));
    const res = await request(app)
      .post(`/api/webhooks/whatsapp/${office.id}`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(bodyStr, 'test-secret'))
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);

    const conversations = await request(app).get(`/api/offices/${office.id}/conversations`).then((r) => r.body);
    expect(conversations).toHaveLength(1);
    expect(conversations[0].contactPhone).toBe('+972501234567');
    expect(conversations[0].contactName).toBe('דנה כהן');

    const detail = await request(app).get(`/api/offices/${office.id}/conversations/${conversations[0].id}`).then((r) => r.body);
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0].direction).toBe('inbound');
    expect(detail.messages[1].direction).toBe('outbound');
    expect(detail.messages[1].text).toContain('שיחה זו מנוהלת אוטומטית.');
  });

  it('reuses the existing conversation for a second message from the same number', async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const office = await createOffice();

    const first = JSON.stringify(metaPayload('972501234567', 'הודעה ראשונה', 'דנה'));
    await request(app)
      .post(`/api/webhooks/whatsapp/${office.id}`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(first, 'test-secret'))
      .send(first);

    const second = JSON.stringify(metaPayload('972501234567', 'הודעה שנייה', 'דנה'));
    await request(app)
      .post(`/api/webhooks/whatsapp/${office.id}`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(second, 'test-secret'))
      .send(second);

    const conversations = await request(app).get(`/api/offices/${office.id}/conversations`).then((r) => r.body);
    expect(conversations).toHaveLength(1);
  });

  it('returns 404 for an unknown office', async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const bodyStr = JSON.stringify(metaPayload('972501234567', 'שלום', 'דנה'));
    const res = await request(app)
      .post(`/api/webhooks/whatsapp/does-not-exist`)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(bodyStr, 'test-secret'))
      .send(bodyStr);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/offices/:officeId/whatsapp/regenerate-webhook-token', () => {
  it('issues a new token different from the original', async () => {
    const office = await createOffice();
    const conn = await request(app)
      .put(`/api/offices/${office.id}/whatsapp`)
      .send({ numberType: 'dedicated', phoneNumber: '+972501234567' })
      .then((r) => r.body);

    const regenerated = await request(app).post(`/api/offices/${office.id}/whatsapp/regenerate-webhook-token`);
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.webhookVerifyToken).not.toBe(conn.webhookVerifyToken);
  });
});
