import { db } from './db.js';
import { newId } from './repo.js';
import type {
  CaseRecord,
  CaseStatus,
  CaseTask,
  Conversation,
  ConversationStatus,
  CrmDocument,
  DocumentTemplate,
  Message,
  MessageDirection,
  MessageSenderType,
  ReportsSummary,
  TaskStatus,
} from './types.js';

const now = () => new Date().toISOString();

// ---- conversations ----

export function createConversation(officeId: string, input: { contactPhone: string; contactName?: string | null }): Conversation {
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO conversations (id, office_id, contact_phone, contact_name, status, practice_area, assigned_staff_id, created_at, updated_at, last_message_at)
     VALUES (?, ?, ?, ?, 'auto', NULL, NULL, ?, ?, ?)`
  ).run(id, officeId, input.contactPhone, input.contactName ?? null, ts, ts, ts);
  return getConversation(officeId, id)!;
}

export function listConversations(officeId: string): Conversation[] {
  const rows = db.prepare(`SELECT * FROM conversations WHERE office_id = ? ORDER BY last_message_at DESC`).all(officeId) as any[];
  return rows.map(mapConversation);
}

export function getConversation(officeId: string, id: string): Conversation | null {
  const row = db.prepare(`SELECT * FROM conversations WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapConversation(row) : null;
}

export function updateConversation(
  officeId: string,
  id: string,
  patch: Partial<{
    status: ConversationStatus;
    practiceArea: string | null;
    assignedStaffId: string | null;
    everHandoff: boolean;
    lastMessageAt: string;
  }>
): Conversation | null {
  const existing = getConversation(officeId, id);
  if (!existing) return null;
  const ts = now();
  db.prepare(
    `UPDATE conversations SET status = ?, practice_area = ?, assigned_staff_id = ?, ever_handoff = ?, updated_at = ?, last_message_at = ? WHERE office_id = ? AND id = ?`
  ).run(
    patch.status ?? existing.status,
    patch.practiceArea !== undefined ? patch.practiceArea : existing.practiceArea,
    patch.assignedStaffId !== undefined ? patch.assignedStaffId : existing.assignedStaffId,
    patch.everHandoff !== undefined ? (patch.everHandoff ? 1 : 0) : existing.everHandoff ? 1 : 0,
    ts,
    patch.lastMessageAt ?? existing.lastMessageAt,
    officeId,
    id
  );
  return getConversation(officeId, id);
}

function mapConversation(r: any): Conversation {
  return {
    id: r.id,
    officeId: r.office_id,
    contactPhone: r.contact_phone,
    contactName: r.contact_name,
    status: r.status,
    practiceArea: r.practice_area,
    assignedStaffId: r.assigned_staff_id,
    everHandoff: !!r.ever_handoff,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastMessageAt: r.last_message_at,
  };
}

// ---- messages ----

export function addMessage(
  officeId: string,
  conversationId: string,
  input: { direction: MessageDirection; senderType: MessageSenderType; text: string }
): Message {
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, office_id, direction, sender_type, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, conversationId, officeId, input.direction, input.senderType, input.text, ts);
  updateConversation(officeId, conversationId, { lastMessageAt: ts });
  return getMessage(id)!;
}

export function listMessages(conversationId: string): Message[] {
  const rows = db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`).all(conversationId) as any[];
  return rows.map(mapMessage);
}

function getMessage(id: string): Message | null {
  const row = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
  return row ? mapMessage(row) : null;
}

function mapMessage(r: any): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    officeId: r.office_id,
    direction: r.direction,
    senderType: r.sender_type,
    text: r.text,
    createdAt: r.created_at,
  };
}

// ---- cases ----

export function createCase(
  officeId: string,
  input: { title: string; conversationId?: string | null; practiceArea?: string | null; assignedStaffId?: string | null }
): CaseRecord {
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO cases (id, office_id, conversation_id, title, practice_area, status, assigned_staff_id, score, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'new', ?, NULL, ?, ?)`
  ).run(id, officeId, input.conversationId ?? null, input.title, input.practiceArea ?? null, input.assignedStaffId ?? null, ts, ts);
  return getCase(officeId, id)!;
}

export function listCases(officeId: string, status?: CaseStatus): CaseRecord[] {
  const rows = status
    ? (db.prepare(`SELECT * FROM cases WHERE office_id = ? AND status = ? ORDER BY created_at DESC`).all(officeId, status) as any[])
    : (db.prepare(`SELECT * FROM cases WHERE office_id = ? ORDER BY created_at DESC`).all(officeId) as any[]);
  return rows.map(mapCase);
}

export function getCase(officeId: string, id: string): CaseRecord | null {
  const row = db.prepare(`SELECT * FROM cases WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapCase(row) : null;
}

export function updateCase(
  officeId: string,
  id: string,
  patch: Partial<{ title: string; status: CaseStatus; assignedStaffId: string | null; score: number | null }>
): CaseRecord | null {
  const existing = getCase(officeId, id);
  if (!existing) return null;
  const ts = now();
  db.prepare(`UPDATE cases SET title = ?, status = ?, assigned_staff_id = ?, score = ?, updated_at = ? WHERE office_id = ? AND id = ?`).run(
    patch.title ?? existing.title,
    patch.status ?? existing.status,
    patch.assignedStaffId !== undefined ? patch.assignedStaffId : existing.assignedStaffId,
    patch.score !== undefined ? patch.score : existing.score,
    ts,
    officeId,
    id
  );
  return getCase(officeId, id);
}

function mapCase(r: any): CaseRecord {
  return {
    id: r.id,
    officeId: r.office_id,
    conversationId: r.conversation_id,
    title: r.title,
    practiceArea: r.practice_area,
    status: r.status,
    assignedStaffId: r.assigned_staff_id,
    score: r.score,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---- case tasks ----

export function addTask(
  officeId: string,
  caseId: string,
  input: { title: string; dueDate?: string | null; assignedStaffId?: string | null }
): CaseTask {
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO case_tasks (id, case_id, office_id, title, due_date, assigned_staff_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, caseId, officeId, input.title, input.dueDate ?? null, input.assignedStaffId ?? null, ts);
  return getTask(officeId, id)!;
}

export function listTasks(officeId: string, caseId: string): CaseTask[] {
  const rows = db.prepare(`SELECT * FROM case_tasks WHERE office_id = ? AND case_id = ? ORDER BY created_at ASC`).all(officeId, caseId) as any[];
  return rows.map(mapTask);
}

export function updateTask(officeId: string, id: string, patch: Partial<{ status: TaskStatus; title: string; dueDate: string | null }>): CaseTask | null {
  const existing = getTask(officeId, id);
  if (!existing) return null;
  db.prepare(`UPDATE case_tasks SET title = ?, due_date = ?, status = ? WHERE office_id = ? AND id = ?`).run(
    patch.title ?? existing.title,
    patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
    patch.status ?? existing.status,
    officeId,
    id
  );
  return getTask(officeId, id);
}

function getTask(officeId: string, id: string): CaseTask | null {
  const row = db.prepare(`SELECT * FROM case_tasks WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapTask(row) : null;
}

// ---- reports ----

export function getReportsSummary(officeId: string): ReportsSummary {
  const convCounts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'auto' THEN 1 ELSE 0 END) AS auto_count,
         SUM(CASE WHEN status = 'pending_human' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
         SUM(CASE WHEN ever_handoff = 1 THEN 1 ELSE 0 END) AS handoff_count
       FROM conversations WHERE office_id = ?`
    )
    .get(officeId) as any;

  const caseCounts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
         SUM(CASE WHEN status = 'waiting_client' THEN 1 ELSE 0 END) AS waiting_count,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
         AVG(score) AS avg_score
       FROM cases WHERE office_id = ?`
    )
    .get(officeId) as any;

  const firstResponseRows = db
    .prepare(
      `SELECT c.id AS conversation_id, c.created_at AS created_at, MIN(m.created_at) AS first_outbound
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id AND m.direction = 'outbound'
       WHERE c.office_id = ?
       GROUP BY c.id`
    )
    .all(officeId) as { conversation_id: string; created_at: string; first_outbound: string }[];

  const responseSeconds = firstResponseRows.map(
    (r) => (new Date(r.first_outbound).getTime() - new Date(r.created_at).getTime()) / 1000
  );
  const averageFirstResponseSeconds =
    responseSeconds.length > 0 ? responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length : null;

  const total = convCounts.total ?? 0;
  const handoffCount = convCounts.handoff_count ?? 0;

  return {
    conversations: {
      total,
      auto: convCounts.auto_count ?? 0,
      pendingHuman: convCounts.pending_count ?? 0,
      closed: convCounts.closed_count ?? 0,
    },
    cases: {
      total: caseCounts.total ?? 0,
      new: caseCounts.new_count ?? 0,
      inProgress: caseCounts.in_progress_count ?? 0,
      waitingClient: caseCounts.waiting_count ?? 0,
      closed: caseCounts.closed_count ?? 0,
    },
    handoffRate: total > 0 ? handoffCount / total : 0,
    averageScore: caseCounts.avg_score !== null && caseCounts.avg_score !== undefined ? Math.round(caseCounts.avg_score) : null,
    averageFirstResponseSeconds,
  };
}

function mapTask(r: any): CaseTask {
  return {
    id: r.id,
    caseId: r.case_id,
    officeId: r.office_id,
    title: r.title,
    dueDate: r.due_date,
    assignedStaffId: r.assigned_staff_id,
    status: r.status,
    createdAt: r.created_at,
  };
}

// ---- document templates ----

export function createDocumentTemplate(officeId: string, input: { name: string; body: string }): DocumentTemplate {
  const id = newId();
  const ts = now();
  db.prepare(`INSERT INTO document_templates (id, office_id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id,
    officeId,
    input.name,
    input.body,
    ts,
    ts
  );
  return getDocumentTemplate(officeId, id)!;
}

export function listDocumentTemplates(officeId: string): DocumentTemplate[] {
  const rows = db.prepare(`SELECT * FROM document_templates WHERE office_id = ? ORDER BY created_at DESC`).all(officeId) as any[];
  return rows.map(mapTemplate);
}

export function getDocumentTemplate(officeId: string, id: string): DocumentTemplate | null {
  const row = db.prepare(`SELECT * FROM document_templates WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapTemplate(row) : null;
}

export function updateDocumentTemplate(officeId: string, id: string, patch: Partial<{ name: string; body: string }>): DocumentTemplate | null {
  const existing = getDocumentTemplate(officeId, id);
  if (!existing) return null;
  const ts = now();
  db.prepare(`UPDATE document_templates SET name = ?, body = ?, updated_at = ? WHERE office_id = ? AND id = ?`).run(
    patch.name ?? existing.name,
    patch.body ?? existing.body,
    ts,
    officeId,
    id
  );
  return getDocumentTemplate(officeId, id);
}

export function deleteDocumentTemplate(officeId: string, id: string): boolean {
  const result = db.prepare(`DELETE FROM document_templates WHERE office_id = ? AND id = ?`).run(officeId, id);
  return result.changes > 0;
}

function mapTemplate(r: any): DocumentTemplate {
  return { id: r.id, officeId: r.office_id, name: r.name, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at };
}

// ---- documents ----

export function createDocument(
  officeId: string,
  input: { caseId?: string | null; templateId?: string | null; title: string; content: string; missingFields: string[] }
): CrmDocument {
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO documents (id, office_id, case_id, template_id, title, content, missing_fields, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, officeId, input.caseId ?? null, input.templateId ?? null, input.title, input.content, JSON.stringify(input.missingFields), ts);
  return getDocument(officeId, id)!;
}

export function listDocumentsForCase(officeId: string, caseId: string): CrmDocument[] {
  const rows = db.prepare(`SELECT * FROM documents WHERE office_id = ? AND case_id = ? ORDER BY created_at DESC`).all(officeId, caseId) as any[];
  return rows.map(mapDocument);
}

export function getDocument(officeId: string, id: string): CrmDocument | null {
  const row = db.prepare(`SELECT * FROM documents WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapDocument(row) : null;
}

function mapDocument(r: any): CrmDocument {
  return {
    id: r.id,
    officeId: r.office_id,
    caseId: r.case_id,
    templateId: r.template_id,
    title: r.title,
    content: r.content,
    missingFields: JSON.parse(r.missing_fields),
    createdAt: r.created_at,
  };
}
