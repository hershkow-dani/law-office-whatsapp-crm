import { Router } from 'express';
import * as repo from '../repo.js';
import * as crm from '../repoCrm.js';
import { processInboundMessage } from '../engine/inboundPipeline.js';
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
  const { contactPhone, contactName, contactPhotoUrl } = req.body ?? {};
  if (!contactPhone) return res.status(400).json({ error: 'contact_phone_required' });
  res.status(201).json(crm.createConversation(id, { contactPhone, contactName, contactPhotoUrl }));
});

conversationsRouter.get('/:conversationId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const conversation = crm.getConversation(id, req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });
  res.json({ conversation, messages: crm.listMessages(conversation.id) });
});

conversationsRouter.patch('/:conversationId', (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const { contactName, contactPhotoUrl } = req.body ?? {};
  const updated = crm.updateConversation(officeId, req.params.conversationId, { contactName, contactPhotoUrl });
  if (!updated) return res.status(404).json({ error: 'conversation_not_found' });
  res.json(updated);
});

conversationsRouter.post('/:conversationId/inbound', async (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const conversation = crm.getConversation(officeId, req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });

  const { text, at, explicitHumanRequest } = req.body ?? {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text_required' });

  const result = await processInboundMessage(officeId, conversation, text, {
    at: at ? new Date(at) : undefined,
    explicitHumanRequest,
  });
  res.json(result);
});

conversationsRouter.post('/:conversationId/outbound', async (req, res) => {
  const officeId = officeOr404(req, res);
  if (!officeId) return;
  const conversation = crm.getConversation(officeId, req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text_required' });

  const profile = repo.getOfficeProfile(officeId)!;
  const provider = getWhatsappProvider();
  await provider.sendMessage(conversation.contactPhone, text, { phoneNumberId: profile.whatsapp?.providerPhoneNumberId });
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
