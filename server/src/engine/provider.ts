/**
 * Outbound WhatsApp send abstraction. Selected by the WHATSAPP_PROVIDER env
 * var ("mock" by default). MetaCloudApiProvider is wired up and ready, but
 * needs live credentials (WHATSAPP_ACCESS_TOKEN, and either a per-office
 * providerPhoneNumberId or the WHATSAPP_PHONE_NUMBER_ID fallback) before it
 * can actually send — see README "מה נדרש לחיבור חי".
 */
export interface SendOptions {
  /** Meta's numeric phone_number_id for the sending number (distinct from the human-readable phone number). */
  phoneNumberId?: string | null;
}

export interface WhatsappProvider {
  name: string;
  sendMessage(to: string, text: string, options?: SendOptions): Promise<{ ok: true; providerMessageId: string }>;
}

export interface SentRecord {
  to: string;
  text: string;
  at: string;
}

class MockWhatsappProvider implements WhatsappProvider {
  name = 'mock';
  sent: SentRecord[] = [];

  async sendMessage(to: string, text: string) {
    this.sent.push({ to, text, at: new Date().toISOString() });
    return { ok: true as const, providerMessageId: `mock-${this.sent.length}` };
  }
}

const META_GRAPH_VERSION = 'v21.0';

/**
 * Real implementation against Meta's WhatsApp Cloud API. Not exercised by
 * any live number yet — see README for the account/verification steps still
 * required. Left as the default 400-ish error a misconfigured deploy would
 * hit, rather than crashing at import time, so the rest of the app keeps
 * working (mock conversations, settings, documents...) even before
 * WhatsApp itself is wired up.
 */
class MetaCloudApiProvider implements WhatsappProvider {
  name = 'meta_cloud_api';

  async sendMessage(to: string, text: string, options?: SendOptions) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = options?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken) {
      throw new Error('WHATSAPP_ACCESS_TOKEN is not configured — cannot send via meta_cloud_api yet (see README).');
    }
    if (!phoneNumberId) {
      throw new Error(
        'No provider phone_number_id available for this office — set it in the WhatsApp settings, or WHATSAPP_PHONE_NUMBER_ID as a fallback.'
      );
    }

    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.error?.message ?? `Meta API request failed with status ${res.status}`;
      throw new Error(`WhatsApp send failed: ${message}`);
    }

    return { ok: true as const, providerMessageId: body?.messages?.[0]?.id ?? 'unknown' };
  }
}

let provider: WhatsappProvider | null = null;

export function getWhatsappProvider(): WhatsappProvider {
  if (!provider) {
    const kind = process.env.WHATSAPP_PROVIDER ?? 'mock';
    if (kind === 'meta_cloud_api') {
      provider = new MetaCloudApiProvider();
    } else if (kind === 'mock') {
      provider = new MockWhatsappProvider();
    } else {
      throw new Error(`Unknown WHATSAPP_PROVIDER "${kind}" — expected "mock" or "meta_cloud_api".`);
    }
  }
  return provider;
}

export function resetWhatsappProviderForTests(): void {
  provider = null;
}
