import { describe, it, expect } from 'vitest';
import { parseMetaWebhookPayload } from '../src/engine/metaWebhookParser.js';

describe('parseMetaWebhookPayload', () => {
  it('extracts a text message with the sender contact name', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: 'PNID1' },
                contacts: [{ profile: { name: 'דנה כהן' }, wa_id: '972501234567' }],
                messages: [{ from: '972501234567', id: 'wamid.1', timestamp: '1700000000', text: { body: 'שלום' }, type: 'text' }],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const result = parseMetaWebhookPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ phoneNumberId: 'PNID1', from: '972501234567', text: 'שלום', contactName: 'דנה כהן' });
    expect(result[0].timestamp).toBeInstanceOf(Date);
  });

  it('skips delivery-status callbacks (no messages field)', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'PNID1' },
                statuses: [{ id: 'wamid.1', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    };
    expect(parseMetaWebhookPayload(payload)).toEqual([]);
  });

  it('skips non-text message types', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'PNID1' },
                messages: [{ from: '972501234567', id: 'wamid.1', timestamp: '1700000000', type: 'image', image: { id: 'x' } }],
              },
            },
          ],
        },
      ],
    };
    expect(parseMetaWebhookPayload(payload)).toEqual([]);
  });

  it('returns null contactName when no matching contact entry exists', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'PNID1' },
                contacts: [],
                messages: [{ from: '972501234567', id: 'wamid.1', timestamp: '1700000000', text: { body: 'שלום' }, type: 'text' }],
              },
            },
          ],
        },
      ],
    };
    expect(parseMetaWebhookPayload(payload)[0].contactName).toBeNull();
  });

  it('handles multiple entries and changes', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'PNID1' },
                messages: [{ from: '972501111111', id: 'wamid.1', timestamp: '1700000000', text: { body: 'א' }, type: 'text' }],
              },
            },
          ],
        },
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'PNID1' },
                messages: [{ from: '972502222222', id: 'wamid.2', timestamp: '1700000001', text: { body: 'ב' }, type: 'text' }],
              },
            },
          ],
        },
      ],
    };
    expect(parseMetaWebhookPayload(payload)).toHaveLength(2);
  });

  it('returns an empty array for an empty payload', () => {
    expect(parseMetaWebhookPayload({})).toEqual([]);
  });
});
