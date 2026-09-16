import { Router } from 'express';
import * as repo from '../repo.js';
import { verifyMetaSignature } from '../engine/webhookSecurity.js';
import { parseMetaWebhookPayload } from '../engine/metaWebhookParser.js';
import { processInboundMessage, findOrCreateConversation } from '../engine/inboundPipeline.js';

export const webhooksRouter = Router({ mergeParams: true });

/**
 * Meta's one-time handshake when you register the webhook URL in the App
 * Dashboard: it calls this with hub.verify_token, and expects hub.challenge
 * echoed back if the token matches what this office generated (shown in the
 * WhatsApp settings section so it can be pasted into Meta's form).
 */
webhooksRouter.get('/', (req: any, res) => {
  const connection = repo.getWhatsappConnection(req.params.officeId);
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (connection && mode === 'subscribe' && token && token === connection.webhookVerifyToken) {
    res.status(200).type('text/plain').send(challenge);
    return;
  }
  res.status(403).json({ error: 'verification_failed' });
});

/**
 * The actual message webhook. Requires WHATSAPP_APP_SECRET to be set to
 * verify Meta's signature — without it, the endpoint refuses all POSTs
 * rather than silently accepting unauthenticated "incoming messages" (see
 * README for what's still needed to go live).
 */
webhooksRouter.post('/', async (req: any, res) => {
  const officeId = req.params.officeId;
  const office = repo.getOffice(officeId);
  if (!office) return res.status(404).json({ error: 'office_not_found' });

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return res.status(501).json({
      error: 'webhook_not_configured',
      message: 'WHATSAPP_APP_SECRET is not set — the webhook cannot verify that requests really come from Meta yet (see README).',
    });
  }

  const signature = req.header('x-hub-signature-256');
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody || !verifyMetaSignature(rawBody, signature, appSecret)) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  const messages = parseMetaWebhookPayload(req.body);
  for (const msg of messages) {
    const contactPhone = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
    const conversation = findOrCreateConversation(officeId, contactPhone, msg.contactName);
    await processInboundMessage(officeId, conversation, msg.text, { at: msg.timestamp });
  }

  // Meta expects a fast 200 regardless of downstream outcome, or it will
  // retry (and eventually disable) the webhook.
  res.status(200).json({ received: messages.length });
});
