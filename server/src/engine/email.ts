/**
 * Outbound email abstraction, mirroring engine/provider.ts for WhatsApp:
 * selected by EMAIL_PROVIDER ("mock" by default). ResendEmailProvider is
 * wired up and ready but needs a real API key before it can actually send —
 * see README "מה נדרש לאיפוס סיסמה במייל אמיתי".
 */
export interface EmailProvider {
  name: string;
  sendMail(to: string, subject: string, text: string): Promise<{ ok: true }>;
}

export interface SentMail {
  to: string;
  subject: string;
  text: string;
  at: string;
}

class MockEmailProvider implements EmailProvider {
  name = 'mock';
  sent: SentMail[] = [];

  async sendMail(to: string, subject: string, text: string) {
    this.sent.push({ to, subject, text, at: new Date().toISOString() });
    // eslint-disable-next-line no-console
    console.log(`[mock email] to=${to} subject="${subject}"\n${text}`);
    return { ok: true as const };
  }
}

/** Real implementation against Resend's HTTP API — a single fetch call, no SDK/dependency needed. */
class ResendEmailProvider implements EmailProvider {
  name = 'resend';

  async sendMail(to: string, subject: string, text: string) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured — cannot send via resend yet (see README).');
    if (!from) throw new Error('EMAIL_FROM is not configured — set the "from" address emails should be sent as.');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const message = body?.message ?? `Resend API request failed with status ${res.status}`;
      throw new Error(`Email send failed: ${message}`);
    }
    return { ok: true as const };
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!provider) {
    const kind = process.env.EMAIL_PROVIDER ?? 'mock';
    if (kind === 'resend') provider = new ResendEmailProvider();
    else if (kind === 'mock') provider = new MockEmailProvider();
    else throw new Error(`Unknown EMAIL_PROVIDER "${kind}" — expected "mock" or "resend".`);
  }
  return provider;
}

export function resetEmailProviderForTests(): void {
  provider = null;
}
