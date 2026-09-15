/**
 * Outbound WhatsApp send abstraction. Stage B has no live provider credentials
 * (see README), so the only implementation is a mock that records sends
 * in-memory instead of calling a real API. A real provider (Meta Cloud API,
 * Twilio, 360dialog...) implements the same interface and is selected by the
 * WHATSAPP_PROVIDER env var without changing any caller code.
 */
export interface WhatsappProvider {
  name: string;
  sendMessage(to: string, text: string): Promise<{ ok: true; providerMessageId: string }>;
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

let provider: WhatsappProvider | null = null;

export function getWhatsappProvider(): WhatsappProvider {
  if (!provider) {
    const kind = process.env.WHATSAPP_PROVIDER ?? 'mock';
    if (kind !== 'mock') {
      throw new Error(
        `WhatsApp provider "${kind}" is not implemented yet — only "mock" is available until live credentials are configured (see README).`
      );
    }
    provider = new MockWhatsappProvider();
  }
  return provider;
}

export function resetWhatsappProviderForTests(): void {
  provider = null;
}
