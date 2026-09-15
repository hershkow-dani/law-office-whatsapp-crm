import express from 'express';
import cors from 'cors';
import { officesRouter } from './routes/offices.js';
import { conversationsRouter } from './routes/conversations.js';
import { casesRouter, reportsRouter } from './routes/cases.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/offices', officesRouter);
  app.use('/api/offices/:officeId/conversations', conversationsRouter);
  app.use('/api/offices/:officeId/cases', casesRouter);
  app.use('/api/offices/:officeId/reports', reportsRouter);

  return app;
}
