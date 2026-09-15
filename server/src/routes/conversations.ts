import { Router } from 'express';
import * as repo from '../repo.js';
import * as crm from '../repoCrm.js';
import { resolveBusinessHoursStatus, shouldHandoffToHuman } from '../engine/decision.js';
import { extractFields } from '../engine/extraction.js';
import { buildAutoReply } from '../engine/autoReply.js';
import { getWhatsappProvider } from '../engine/provider.js';

export const conversationsRouter = Router({ mergeParams: true });

function officeOr404(req: any, res: any): string | null {
  const office = repo.getOffice(req.params.officeId);
  if (!office) {
    res.status(404).json({ error: 'office_not_found' });
    return null;
  }
  return office.id;
}

conversationsRouter.get('/', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(crm.listConversations(id));
});

conversationsRouter.post('/', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { contactPhone, contactName } = req.body ?? {};
  if (!contactPhone) return res.status(400).json({ error: 'contact_phone_required' });
  res.status(201).json(crm.createConversation(id, { contactPhone, contactName }));
});

conversationsRouter.get('/:conversationId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const conversation = crm.getConversation(id, req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });
  res.json({ conversation, messages: crm.listMessages(conversation.id) });
});

conversationsRouter.post('/:conversationId/inbound', async (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const conversation = crm.getConversation(officeId, req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });

  const { text, at, explicitHumanRequest } = req.body ?? {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text_required' });

  const priorMessages = crm.listMessages(conversation.id);
  const isFirstMessage = priorMessages.length === 0;

  crm.addMessage(officeId, conversation.id, { direction: 'inbound', senderType: 'client', text });

  // A closed conversation re-opens automatically when the client writes again.
  const wasClosed = conversation.status === 'closed';
  if (conversation.status === 'pending_human') {
    // A human is already handling this thread — record the message but don't
    // let the bot jump back in.
    return res.json({ conversation: crm.getConversation(officeId, conversation.id), autoReplied: false });
  }

  const profile = repo.getOfficeProfile(officeId)!;
  const extracted = extractFields(text, profile.practiceAreas);
  const at_ = at ? new Date(at) : new Date();
  const hoursStatus = resolveBusinessHoursStatus(profile, at_);
  const handoff = shouldHandoffToHuman(profile, {
    text,
    explicitHumanRequest: !!explicitHumanRequest,
    urgency: extracted.urgency ?? undefined,
    practiceArea: extracted.practiceArea ?? undefined,
  });

  const replyText = buildAutoReply(profile, { isFirstMessage: isFirstMessage || wasClosed, hoursStatus, handoff, extracted });
  const provider = getWhatsappProvider();
  await provider.sendMessage(conversation.contactPhone, replyText);
  crm.addMessage(officeId, conversation.id, { direction: 'outbound', senderType: 'system', text: replyText });

  const updated = crm.updateConversation(officeId, conversation.id, {
    status: handoff.handoff ? 'pending_human' : 'auto',
    practiceArea: extracted.practiceArea ?? conversation.practiceArea,
    everHandoff: conversation.everHandoff || handoff.handoff,
  });

  res.json({ conversation: updated, autoReplied: true, replyText, hoursStatus, handoff, extracted });
});

conversationsRouter.post('/:conversationId/outbound', async (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const conversation = crm.getConversation(officeId, req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text_required' });

  const provider = getWhatsappProvider();
  await provider.sendMessage(conversation.contactPhone, text);
  const message = crm.addMessage(officeId, conversation.id, { direction: 'outbound', senderType: 'staff', text });

  res.status(201).json(message);
});

conversationsRouter.post('/:conversationId/close', (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const updated = crm.updateConversation(officeId, req.params.conversationId, { status: 'closed' });
  if (!updated) return res.status(404).json({ error: 'conversation_not_found' });
  res.json(updated);
});

conversationsRouter.post('/:conversationId/resume-auto', (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const updated = crm.updateConversation(officeId, req.params.conversationId, { status: 'auto' });
  if (!updated) return res.status(404).json({ error: 'conversation_not_found' });
  res.json(updated);
});
