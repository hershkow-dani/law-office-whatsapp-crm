import { Router } from 'express';
import * as repo from '../repo.js';
import * as crm from '../repoCrm.js';

export const documentTemplatesRouter = Router({ mergeParams: true });

function officeOr404(req: any, res: any): string | null {
  const office = repo.getOffice(req.params.officeId);
  if (!office) {
    res.status(404).json({ error: 'office_not_found' });
    return null;
  }
  return office.id;
}

documentTemplatesRouter.get('/', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(crm.listDocumentTemplates(id));
});

documentTemplatesRouter.post('/', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { name, body } = req.body ?? {};
  if (!name || !body) return res.status(400).json({ error: 'name_and_body_required' });
  res.status(201).json(crm.createDocumentTemplate(id, { name, body }));
});

documentTemplatesRouter.patch('/:templateId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = crm.updateDocumentTemplate(id, req.params.templateId, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'template_not_found' });
  res.json(updated);
});

documentTemplatesRouter.delete('/:templateId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const ok = crm.deleteDocumentTemplate(id, req.params.templateId);
  res.status(ok ? 204 : 404).end();
});

export const documentsRouter = Router({ mergeParams: true });

documentsRouter.get('/:documentId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const doc = crm.getDocument(id, req.params.documentId);
  if (!doc) return res.status(404).json({ error: 'document_not_found' });
  res.json(doc);
});
