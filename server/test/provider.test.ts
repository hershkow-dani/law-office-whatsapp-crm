import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWhatsappProvider, resetWhatsappProviderForTests } from '../src/engine/provider.js';

const ORIGINAL_ENV = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  resetWhatsappProviderForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = originalFetch;
  resetWhatsappProviderForTests();
});

describe('getWhatsappProvider', () => {
  it('defaults to the mock provider', async () => {
    delete process.env.WHATSAPP_PROVIDER;
    const provider = getWhatsappProvider();
    expect(provider.name).toBe('mock');
  });

  it('returns the meta_cloud_api provider when selected', () => {
    process.env.WHATSAPP_PROVIDER = 'meta_cloud_api';
    const provider = getWhatsappProvider();
    expect(provider.name).toBe('meta_cloud_api');
  });

  it('throws for an unrecognized provider name', () => {
    process.env.WHATSAPP_PROVIDER = 'not_a_real_provider';
    expect(() => getWhatsappProvider()).toThrow(/Unknown WHATSAPP_PROVIDER/);
  });

  it('is a singleton within a process', () => {
    const a = getWhatsappProvider();
    const b = getWhatsappProvider();
    expect(a).toBe(b);
  });
});

describe('MetaCloudApiProvider.sendMessage', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = 'meta_cloud_api';
  });

  it('throws a clear error when no access token is configured', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const provider = getWhatsappProvider();
    await expect(provider.sendMessage('+972501234567', 'שלום')).rejects.toThrow(/WHATSAPP_ACCESS_TOKEN/);
  });

  it('throws a clear error when no phone_number_id is available', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const provider = getWhatsappProvider();
    await expect(provider.sendMessage('+972501234567', 'שלום')).rejects.toThrow(/phone_number_id/);
  });

  it('sends via the Meta Graph API and returns the provider message id', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.OUT1' }] }),
    });
    global.fetch = fetchMock as any;

    const provider = getWhatsappProvider();
    const result = await provider.sendMessage('+972501234567', 'שלום', { phoneNumberId: 'PNID123' });

    expect(result).toEqual({ ok: true, providerMessageId: 'wamid.OUT1' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/PNID123/messages'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody).toMatchObject({ to: '+972501234567', type: 'text', text: { body: 'שלום' } });
  });

  it('surfaces Meta error messages when the API call fails', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth access token' } }),
    }) as any;

    const provider = getWhatsappProvider();
    await expect(provider.sendMessage('+972501234567', 'שלום', { phoneNumberId: 'PNID123' })).rejects.toThrow(/Invalid OAuth access token/);
  });
});
