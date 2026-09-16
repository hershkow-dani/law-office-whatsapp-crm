import express from 'express';
import cors from 'cors';
import { officesRouter } from './routes/offices.js';
import { conversationsRouter } from './routes/conversations.js';
import { casesRouter, reportsRouter } from './routes/cases.js';
import { documentTemplatesRouter, documentsRouter } from './routes/documents.js';
import { webhooksRouter } from './routes/webhooks.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { attachUser, requireAuth, requireOfficeMatch, requireRole } from './middleware/auth.js';

export function createApp() {
  const app = express();
  // credentials: true + reflecting the request origin (rather than "*") is
  // required for the session cookie to be sent/accepted on a real
  // cross-origin deployment. In dev the Vite proxy makes requests same-origin
  // anyway, so this only matters once client and server are on different hosts.
  app.use(cors({ origin: true, credentials: true }));
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
  app.use(attachUser);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Public: no office exists (or session) until one of these succeeds.
  app.use('/api/auth', authRouter);

  // Everything else under /api/offices/:officeId requires a session tied to
  // that exact office — see middleware/auth.ts. officesRouter enforces
  // owner-only itself (it's all settings); the routers below allow any
  // authenticated office member (day-to-day case/conversation work).
  app.use('/api/offices', officesRouter);
  app.use('/api/offices/:officeId/users', requireAuth, requireOfficeMatch, usersRouter);
  app.use('/api/offices/:officeId/conversations', requireAuth, requireOfficeMatch, conversationsRouter);
  app.use('/api/offices/:officeId/cases', requireAuth, requireOfficeMatch, casesRouter);
  app.use('/api/offices/:officeId/reports', requireAuth, requireOfficeMatch, reportsRouter);
  app.use('/api/offices/:officeId/document-templates', requireAuth, requireOfficeMatch, requireRole('owner'), documentTemplatesRouter);
  app.use('/api/offices/:officeId/documents', requireAuth, requireOfficeMatch, documentsRouter);

  // Meta calls this directly — authenticated by X-Hub-Signature-256, not a user session.
  app.use('/api/webhooks/whatsapp/:officeId', webhooksRouter);

  return app;
}
