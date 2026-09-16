import { Router } from 'express';
import * as repo from '../repo.js';
import { resolveBusinessHoursStatus, shouldHandoffToHuman } from '../engine/decision.js';

export const officesRouter = Router();

function officeOr404(req: any, res: any): string | null {
  const office = repo.getOffice(req.params.officeId);
  if (!office) {
    res.status(404).json({ error: 'office_not_found' });
    return null;
  }
  return office.id;
}

// ---- offices ----

officesRouter.get('/', (_req, res) => {
  res.json(repo.listOffices());
});

officesRouter.post('/', (req, res) => {
  const { name, logoUrl, address } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name_required' });
  }
  res.status(201).json(repo.createOffice({ name, logoUrl, address }));
});

officesRouter.get('/:officeId', (req, res) => {
  const profile = repo.getOfficeProfile(req.params.officeId);
  if (!profile) return res.status(404).json({ error: 'office_not_found' });
  res.json(profile);
});

officesRouter.patch('/:officeId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = repo.updateOffice(id, req.body ?? {});
  res.json(updated);
});

officesRouter.delete('/:officeId', (req, res) => {
  const ok = repo.deleteOffice(req.params.officeId);
  res.status(ok ? 204 : 404).end();
});

// ---- whatsapp ----

officesRouter.put('/:officeId/whatsapp', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { numberType, phoneNumber } = req.body ?? {};
  if (numberType !== 'existing' && numberType !== 'dedicated') {
    return res.status(400).json({ error: 'invalid_number_type' });
  }
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return res.status(400).json({ error: 'phone_number_required' });
  }
  res.json(repo.setWhatsappConnection(id, req.body));
});

officesRouter.post('/:officeId/whatsapp/regenerate-webhook-token', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = repo.regenerateWebhookVerifyToken(id);
  if (!updated) return res.status(400).json({ error: 'no_whatsapp_connection' });
  res.json(updated);
});

// ---- representative ----

officesRouter.put('/:officeId/representative', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { name, role } = req.body ?? {};
  if (!name || !['secretary', 'representative', 'digital_assistant'].includes(role)) {
    return res.status(400).json({ error: 'invalid_representative' });
  }
  res.json(repo.setRepresentative(id, { name, role }));
});

// ---- disclosure ----

officesRouter.put('/:officeId/disclosure', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { enabled, messageText } = req.body ?? {};
  if (typeof messageText !== 'string') {
    return res.status(400).json({ error: 'message_text_required' });
  }
  res.json(repo.setDisclosure(id, { enabled: !!enabled, messageText }));
});

// ---- conversation style ----

officesRouter.put('/:officeId/style', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { tone, customNotes } = req.body ?? {};
  if (!['professional', 'warm', 'businesslike', 'formal'].includes(tone)) {
    return res.status(400).json({ error: 'invalid_tone' });
  }
  res.json(repo.setStyle(id, { tone, customNotes }));
});

// ---- practice areas ----

officesRouter.get('/:officeId/practice-areas', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(repo.listPracticeAreas(id));
});

officesRouter.post('/:officeId/practice-areas', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { name, parentId, logoUrl } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  res.status(201).json(repo.addPracticeArea(id, { name, parentId, logoUrl }));
});

officesRouter.patch('/:officeId/practice-areas/:areaId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = repo.updatePracticeArea(id, req.params.areaId, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'practice_area_not_found' });
  res.json(updated);
});

officesRouter.delete('/:officeId/practice-areas/:areaId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const ok = repo.deletePracticeArea(id, req.params.areaId);
  res.status(ok ? 204 : 404).end();
});

// ---- service regions ----

officesRouter.put('/:officeId/service-regions', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { mode, regions } = req.body ?? {};
  if (!['national', 'regional'].includes(mode)) {
    return res.status(400).json({ error: 'invalid_mode' });
  }
  const config = repo.setServiceRegionsConfig(id, { mode });
  const list = repo.replaceServiceRegions(id, Array.isArray(regions) ? regions : []);
  res.json({ config, regions: list });
});

// ---- business hours ----

officesRouter.put('/:officeId/business-hours', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { hours } = req.body ?? {};
  if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours_required' });
  res.json(repo.replaceBusinessHours(id, hours));
});

// ---- holidays ----

officesRouter.get('/:officeId/holidays', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(repo.listHolidays(id));
});

officesRouter.post('/:officeId/holidays', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { date, name, isRecurringAnnual } = req.body ?? {};
  if (!date || !name) return res.status(400).json({ error: 'date_and_name_required' });
  res.status(201).json(repo.addHoliday(id, { date, name, isRecurringAnnual }));
});

officesRouter.delete('/:officeId/holidays/:holidayId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const ok = repo.deleteHoliday(id, req.params.holidayId);
  res.status(ok ? 204 : 404).end();
});

// ---- after hours policy ----

officesRouter.put('/:officeId/after-hours', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { inHoursBehavior, outOfHoursBehavior, outOfHoursMessage } = req.body ?? {};
  if (!inHoursBehavior || !outOfHoursBehavior) {
    return res.status(400).json({ error: 'behaviors_required' });
  }
  res.json(repo.setAfterHoursPolicy(id, { inHoursBehavior, outOfHoursBehavior, outOfHoursMessage }));
});

// ---- staff ----

officesRouter.get('/:officeId/staff', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(repo.listStaff(id));
});

officesRouter.post('/:officeId/staff', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { name, role, permissions, responsibilityAreas, isActive, photoUrl } = req.body ?? {};
  if (!name || !role) return res.status(400).json({ error: 'name_and_role_required' });
  res.status(201).json(repo.addStaff(id, { name, role, permissions, responsibilityAreas, isActive, photoUrl }));
});

officesRouter.patch('/:officeId/staff/:staffId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = repo.updateStaff(id, req.params.staffId, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'staff_not_found' });
  res.json(updated);
});

officesRouter.delete('/:officeId/staff/:staffId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const ok = repo.deleteStaff(id, req.params.staffId);
  res.status(ok ? 204 : 404).end();
});

// ---- handoff rules ----

officesRouter.get('/:officeId/handoff-rules', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  res.json(repo.listHandoffRules(id));
});

officesRouter.post('/:officeId/handoff-rules', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const { ruleType, value, action, preserveContext, isActive } = req.body ?? {};
  if (!['urgency', 'area', 'explicit_request', 'keyword'].includes(ruleType) || !value) {
    return res.status(400).json({ error: 'invalid_rule' });
  }
  res.status(201).json(repo.addHandoffRule(id, { ruleType, value, action, preserveContext, isActive }));
});

officesRouter.patch('/:officeId/handoff-rules/:ruleId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const updated = repo.updateHandoffRule(id, req.params.ruleId, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'rule_not_found' });
  res.json(updated);
});

officesRouter.delete('/:officeId/handoff-rules/:ruleId', (req, res) => {
  const id = officeOr404(req, res);
  if (!id) return;
  const ok = repo.deleteHandoffRule(id, req.params.ruleId);
  res.status(ok ? 204 : 404).end();
});

// ---- decision preview (for testing / demoing planned behavior) ----

officesRouter.post('/:officeId/decision-preview', (req, res) => {
  const profile = repo.getOfficeProfile(req.params.officeId);
  if (!profile) return res.status(404).json({ error: 'office_not_found' });

  const at = req.body?.at ? new Date(req.body.at) : new Date();
  const hoursStatus = resolveBusinessHoursStatus(profile, at);
  const handoff = shouldHandoffToHuman(profile, req.body?.message ?? { text: '' });

  res.json({ at: at.toISOString(), hoursStatus, handoff });
});
