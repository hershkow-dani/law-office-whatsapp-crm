import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

async function createOffice() {
  return request(app).post('/api/offices').send({ name: 'משרד מסמכים' }).then((r) => r.body);
}

describe('document templates API', () => {
  it('creates, lists, updates and deletes a template', async () => {
    const office = await createOffice();
    const created = await request(app)
      .post(`/api/offices/${office.id}/document-templates`)
      .send({ name: 'מכתב פתיחת תיק', body: 'שלום {{clientName}}, מאת {{officeName}}.' });
    expect(created.status).toBe(201);

    const list = await request(app).get(`/api/offices/${office.id}/document-templates`);
    expect(list.body).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/offices/${office.id}/document-templates/${created.body.id}`)
      .send({ name: 'מכתב פתיחת תיק - מעודכן' });
    expect(updated.body.name).toBe('מכתב פתיחת תיק - מעודכן');

    const del = await request(app).delete(`/api/offices/${office.id}/document-templates/${created.body.id}`);
    expect(del.status).toBe(204);
  });

  it('creates a template with its own logo and can replace it', async () => {
    const office = await createOffice();
    const created = await request(app)
      .post(`/api/offices/${office.id}/document-templates`)
      .send({ name: 'מכתב', body: 'שלום {{clientName}}', logoUrl: 'data:image/png;base64,AAAA' });
    expect(created.body.logoUrl).toBe('data:image/png;base64,AAAA');

    const updated = await request(app)
      .patch(`/api/offices/${office.id}/document-templates/${created.body.id}`)
      .send({ logoUrl: 'data:image/png;base64,BBBB' });
    expect(updated.body.logoUrl).toBe('data:image/png;base64,BBBB');
  });
});

describe('document generation API', () => {
  it('generates a document filling in fields from the linked conversation', async () => {
    const office = await createOffice();
    const template = await request(app)
      .post(`/api/offices/${office.id}/document-templates`)
      .send({ name: 'מכתב פתיחת תיק', body: 'לכבוד {{clientName}},\nבעניין {{practiceArea}}.\nבברכה, {{officeName}}.' })
      .then((r) => r.body);

    const conv = await request(app)
      .post(`/api/offices/${office.id}/conversations`)
      .send({ contactPhone: '+972501234567', contactName: 'דנה כהן' })
      .then((r) => r.body);
    await request(app).post(`/api/offices/${office.id}/practice-areas`).send({ name: 'דיני משפחה' });
    await request(app).post(`/api/offices/${office.id}/conversations/${conv.id}/inbound`).send({ text: 'תיק דיני משפחה' });

    const caseRecord = await request(app)
      .post(`/api/offices/${office.id}/cases`)
      .send({ title: 'תיק כהן', conversationId: conv.id })
      .then((r) => r.body);

    const doc = await request(app).post(`/api/offices/${office.id}/cases/${caseRecord.id}/documents`).send({ templateId: template.id });
    expect(doc.status).toBe(201);
    expect(doc.body.content).toContain('דנה כהן');
    expect(doc.body.content).toContain('דיני משפחה');
    expect(doc.body.content).toContain('משרד מסמכים');
    expect(doc.body.missingFields).toEqual([]);

    const list = await request(app).get(`/api/offices/${office.id}/cases/${caseRecord.id}/documents`);
    expect(list.body).toHaveLength(1);

    const fetched = await request(app).get(`/api/offices/${office.id}/documents/${doc.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(doc.body.id);
  });

  it('reports missing fields when the case has no linked conversation', async () => {
    const office = await createOffice();
    const template = await request(app)
      .post(`/api/offices/${office.id}/document-templates`)
      .send({ name: 'מכתב', body: 'לכבוד {{clientName}}, טלפון {{clientPhone}}.' })
      .then((r) => r.body);
    const caseRecord = await request(app).post(`/api/offices/${office.id}/cases`).send({ title: 'תיק ללא שיחה' }).then((r) => r.body);

    const doc = await request(app).post(`/api/offices/${office.id}/cases/${caseRecord.id}/documents`).send({ templateId: template.id });
    expect(doc.status).toBe(201);
    expect(doc.body.missingFields.sort()).toEqual(['clientName', 'clientPhone']);
    expect(doc.body.content).toContain('{{clientName}}');
  });

  it('stamps the generated document with the template logo when set', async () => {
    const office = await createOffice();
    await request(app).patch(`/api/offices/${office.id}`).send({ logoUrl: 'data:image/png;base64,OFFICELOGO' });
    const template = await request(app)
      .post(`/api/offices/${office.id}/document-templates`)
      .send({ name: 'מכתב', body: 'שלום {{clientName}}', logoUrl: 'data:image/png;base64,TEMPLATELOGO' })
      .then((r) => r.body);
    const caseRecord = await request(app).post(`/api/offices/${office.id}/cases`).send({ title: 'תיק' }).then((r) => r.body);

    const doc = await request(app).post(`/api/offices/${office.id}/cases/${caseRecord.id}/documents`).send({ templateId: template.id });
    expect(doc.body.logoUrl).toBe('data:image/png;base64,TEMPLATELOGO');
  });

  it('falls back to the office logo when the template has none', async () => {
    const office = await createOffice();
    await request(app).patch(`/api/offices/${office.id}`).send({ logoUrl: 'data:image/png;base64,OFFICELOGO' });
    const template = await request(app)
      .post(`/api/offices/${office.id}/document-templates`)
      .send({ name: 'מכתב', body: 'שלום {{clientName}}' })
      .then((r) => r.body);
    const caseRecord = await request(app).post(`/api/offices/${office.id}/cases`).send({ title: 'תיק' }).then((r) => r.body);

    const doc = await request(app).post(`/api/offices/${office.id}/cases/${caseRecord.id}/documents`).send({ templateId: template.id });
    expect(doc.body.logoUrl).toBe('data:image/png;base64,OFFICELOGO');
  });

  it('returns 400 when the template does not exist', async () => {
    const office = await createOffice();
    const caseRecord = await request(app).post(`/api/offices/${office.id}/cases`).send({ title: 'תיק' }).then((r) => r.body);
    const res = await request(app).post(`/api/offices/${office.id}/cases/${caseRecord.id}/documents`).send({ templateId: 'nope' });
    expect(res.status).toBe(400);
  });
});
