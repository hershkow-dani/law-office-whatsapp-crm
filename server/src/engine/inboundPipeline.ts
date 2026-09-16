import * as repo from '../repo.js';
import * as crm from '../repoCrm.js';
import { resolveBusinessHoursStatus, shouldHandoffToHuman, type HandoffDecision, type HoursStatus } from './decision.js';
import { extractFields } from './extraction.js';
import { buildAutoReply } from './autoReply.js';
import { getWhatsappProvider } from './provider.js';
import type { Conversation, ExtractedFields } from '../types.js';

export interface InboundResult {
  conversation: Conversation;
  autoReplied: boolean;
  replyText?: string;
  hoursStatus?: HoursStatus;
  handoff?: HandoffDecision;
  extracted?: ExtractedFields;
}

/**
 * The single place that turns "a client sent this text" into stored
 * messages, an auto-reply (or not), and an updated conversation status.
 * Used by both the manual /inbound endpoint (for testing/demoing without a
 * live number) and the real WhatsApp webhook, so the two paths can never
 * drift apart.
 */
export async function processInboundMessage(
  officeId: string,
  conversation: Conversation,
  text: string,
  options: { at?: Date; explicitHumanRequest?: boolean } = {}
): Promise<InboundResult> {
  const priorMessages = crm.listMessages(conversation.id);
  const isFirstMessage = priorMessages.length === 0;

  crm.addMessage(officeId, conversation.id, { direction: 'inbound', senderType: 'client', text });

  const wasClosed = conversation.status === 'closed';
  if (conversation.status === 'pending_human') {
    // A human is already handling this thread — record the message but don't
    // let the bot jump back in.
    return { conversation: crm.getConversation(officeId, conversation.id)!, autoReplied: false };
  }

  const profile = repo.getOfficeProfile(officeId)!;
  const extracted = extractFields(text, profile.practiceAreas);
  const at = options.at ?? new Date();
  const hoursStatus = resolveBusinessHoursStatus(profile, at);
  const handoff = shouldHandoffToHuman(profile, {
    text,
    explicitHumanRequest: !!options.explicitHumanRequest,
    urgency: extracted.urgency ?? undefined,
    practiceArea: extracted.practiceArea ?? undefined,
  });

  const replyText = buildAutoReply(profile, { isFirstMessage: isFirstMessage || wasClosed, hoursStatus, handoff, extracted });
  const provider = getWhatsappProvider();
  await provider.sendMessage(conversation.contactPhone, replyText, { phoneNumberId: profile.whatsapp?.providerPhoneNumberId });
  crm.addMessage(officeId, conversation.id, { direction: 'outbound', senderType: 'system', text: replyText });

  const updated = crm.updateConversation(officeId, conversation.id, {
    status: handoff.handoff ? 'pending_human' : 'auto',
    practiceArea: extracted.practiceArea ?? conversation.practiceArea,
    everHandoff: conversation.everHandoff || handoff.handoff,
  });

  return { conversation: updated!, autoReplied: true, replyText, hoursStatus, handoff, extracted };
}

/** Finds the conversation for a contact phone number, creating one if this is their first message. */
export function findOrCreateConversation(officeId: string, contactPhone: string, contactName?: string | null): Conversation {
  const existing = crm.listConversations(officeId).find((c) => c.contactPhone === contactPhone);
  if (existing) return existing;
  return crm.createConversation(officeId, { contactPhone, contactName: contactName ?? null });
}
