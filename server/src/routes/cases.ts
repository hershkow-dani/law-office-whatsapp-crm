import { Router } from 'express';
import * as repo from '../repo.js';
import * as crm from '../repoCrm.js';
import { scoreConversation } from '../engine/scoring.js';
import { buildDocumentContext, renderTemplate } from '../engine/documentRender.js';
import type { CaseStatus } from '../types.js';

export const casesRouter = Router({ mergeParams: true });

const CASE_STATUSES: CaseStatus[] = ['new', 'in_progress', 'waiting_client', 'closed'];

function officeOr404(req: any, res: any): string | null {
  const office = repo.getOffice(req.params.officeId);
  if (!office) {
    res.status(404).json({ error: 'office_not_found' });
    return null;
  }
  return office.id;
}

casesRouter.get('/', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const status = req.query.status as CaseStatus | undefined;
  if (status && !CASE_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' });
  res.json(crm.listCases(id, status));
});

casesRouter.post('/', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { title, conversationId, practiceArea, assignedStaffId } = req.body ?? {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  res.status(201).json(crm.createCase(id, { title, conversationId, practiceArea, assignedStaffId }));
});

casesRouter.get('/:caseId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const caseRecord = crm.getCase(id, req.params.caseId);
  if (!caseRecord) return res.status(404).json({ error: 'case_not_found' });
  res.json({ case: caseRecord, tasks: crm.listTasks(id, caseRecord.id) });
});

casesRouter.patch('/:caseId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { title, status, assignedStaffId } = req.body ?? {};
  if (status && !CASE_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid_status' });
  const updated = crm.updateCase(id, req.params.caseId, { title, status, assignedStaffId });
  if (!updated) return res.status(404).json({ error: 'case_not_found' });
  res.json(updated);
});

/**
 * Computes and stores a 0-100 score for the case (see engine/scoring.ts).
 * When the case is linked to a conversation, responsiveness and field
 * completeness are derived from the real conversation/message data;
 * otherwise the score falls back to a neutral estimate. This is a Stage B
 * approximation — see README for what a fuller scoring model would need.
 */
casesRouter.post('/:caseId/score', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const caseRecord = crm.getCase(id, req.params.caseId);
  if (!caseRecord) return res.status(404).json({ error: 'case_not_found' });

  let firstResponseSeconds: number | null = null;
  let fieldsCaptured = 0;
  let fieldsExpected = 0;
  let handoffWasNeeded = false;

  if (caseRecord.conversationId) {
    const conversation = crm.getConversation(id, caseRecord.conversationId);
    if (conversation) {
      const messages = crm.listMessages(conversation.id);
      const firstOutbound = messages.find((m) => m.direction === 'outbound');
      if (firstOutbound) {
        firstResponseSeconds = (new Date(firstOutbound.createdAt).getTime() - new Date(conversation.createdAt).getTime()) / 1000;
      }
      fieldsExpected = 3;
      fieldsCaptured = (conversation.contactName ? 1 : 0) + (conversation.practiceArea ? 1 : 0) + (conversation.contactPhone ? 1 : 0);
      handoffWasNeeded = conversation.everHandoff;
    }
  }

  const score = scoreConversation({
    firstResponseSeconds,
    fieldsCaptured,
    fieldsExpected,
    handoffWasNeeded,
    handoffWasTriggered: handoffWasNeeded,
  });

  const updated = crm.updateCase(id, caseRecord.id, { score });
  res.json(updated);
});

casesRouter.post('/:caseId/tasks', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const caseRecord = crm.getCase(id, req.params.caseId);
  if (!caseRecord) return res.status(404).json({ error: 'case_not_found' });
  const { title, dueDate, assignedStaffId } = req.body ?? {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  res.status(201).json(crm.addTask(id, caseRecord.id, { title, dueDate, assignedStaffId }));
});

casesRouter.patch('/:caseId/tasks/:taskId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = crm.updateTask(id, req.params.taskId, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'task_not_found' });
  res.json(updated);
});

casesRouter.get('/:caseId/documents', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const caseRecord = crm.getCase(id, req.params.caseId);
  if (!caseRecord) return res.status(404).json({ error: 'case_not_found' });
  res.json(crm.listDocumentsForCase(id, caseRecord.id));
});

/**
 * Generates a document for a case from one of the office's templates,
 * filling {{placeholders}} from the case's own fields and, if linked, its
 * conversation's contact details (see engine/documentRender.ts). Any
 * placeholder with no available value is left in the text and reported in
 * `missingFields` so office staff know exactly what to fill in by hand.
 */
casesRouter.post('/:caseId/documents', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const caseRecord = crm.getCase(id, req.params.caseId);
  if (!caseRecord) return res.status(404).json({ error: 'case_not_found' });

  const { templateId } = req.body ?? {};
  const template = templateId ? crm.getDocumentTemplate(id, templateId) : null;
  if (!template) return res.status(400).json({ error: 'template_not_found' });

  const profile = repo.getOfficeProfile(id)!;
  const conversation = caseRecord.conversationId ? crm.getConversation(id, caseRecord.conversationId) : null;
  const context = buildDocumentContext(profile, caseRecord, conversation);
  const { content, missingFields } = renderTemplate(template.body, context);

  const document = crm.createDocument(id, {
    caseId: caseRecord.id,
    templateId: template.id,
    title: `${template.name} — ${caseRecord.title}`,
    content,
    missingFields,
  });
  res.status(201).json(document);
});

export const reportsRouter = Router({ mergeParams: true });

reportsRouter.get('/summary', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(crm.getReportsSummary(id));
});
