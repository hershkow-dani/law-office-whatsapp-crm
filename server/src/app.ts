import express from 'express';
import cors from 'cors';
import { officesRouter } from './routes/offices.js';
import { conversationsRouter } from './routes/conversations.js';
import { casesRouter, reportsRouter } from './routes/cases.js';
import { documentTemplatesRouter, documentsRouter } from './routes/documents.js';
import { webhooksRouter } from './routes/webhooks.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(
    express.json({
      // Keep the raw bytes around so the WhatsApp webhook can verify Meta's
      // X-Hub-Signature-256 header, which is computed over the exact body
      // bytes rather than the re-serialized JSON.
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/offices', officesRouter);
  app.use('/api/offices/:officeId/conversations', conversationsRouter);
  app.use('/api/offices/:officeId/cases', casesRouter);
  app.use('/api/offices/:officeId/reports', reportsRouter);
  app.use('/api/offices/:officeId/document-templates', documentTemplatesRouter);
  app.use('/api/offices/:officeId/documents', documentsRouter);
  app.use('/api/webhooks/whatsapp/:officeId', webhooksRouter);

  return app;
}
