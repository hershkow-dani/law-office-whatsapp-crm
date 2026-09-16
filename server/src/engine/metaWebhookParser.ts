export interface ParsedIncomingMessage {
  phoneNumberId: string;
  from: string;
  text: string;
  contactName: string | null;
  timestamp: Date;
}

/**
 * Extracts inbound text messages from a Meta WhatsApp Cloud API webhook
 * payload. Delivery-status callbacks (message read/delivered/sent) and
 * non-text message types (image, audio, location...) are skipped for now —
 * a real deployment would want to at least acknowledge those, but handling
 * them is future work, not needed to prove the pipeline end-to-end.
 */
export function parseMetaWebhookPayload(body: any): ParsedIncomingMessage[] {
  const results: ParsedIncomingMessage[] = [];
  const entries = body?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value?.messages) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      const contactsByWaId = new Map<string, string | null>((value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name ?? null]));

      for (const message of value.messages) {
        if (message.type !== 'text' || !message.text?.body) continue;
        results.push({
          phoneNumberId,
          from: message.from,
          text: message.text.body,
          contactName: contactsByWaId.get(message.from) ?? null,
          timestamp: new Date(Number(message.timestamp) * 1000),
        });
      }
    }
  }

  return results;
}
