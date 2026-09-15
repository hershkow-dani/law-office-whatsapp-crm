import { useEffect, useState } from 'react';
import type { CaseRecord, CaseStatus, CaseTask, Conversation, CrmDocument, DocumentTemplate } from '../types';
import { api } from '../api';

const STATUS_LABEL: Record<CaseStatus, string> = {
  new: 'חדש',
  in_progress: 'בטיפול',
  waiting_client: 'ממתין ללקוח',
  closed: 'סגור',
};

export function CasesPanel({ officeId }: { officeId: string }) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CaseRecord | null>(null);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshList() {
    setCases(await api.listCases(officeId));
    setConversations(await api.listConversations(officeId));
    setTemplates(await api.listDocumentTemplates(officeId));
  }

  async function refreshDetail(id: string) {
    const detail = await api.getCase(officeId, id);
    setSelected(detail.case);
    setTasks(detail.tasks);
    setDocuments(await api.listCaseDocuments(officeId, id));
  }

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId]);

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
    else {
      setSelected(null);
      setTasks([]);
      setDocuments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function createCase() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const created = await api.createCase(officeId, { title: title.trim(), conversationId: conversationId || null });
      setTitle('');
      setConversationId('');
      await refreshList();
      setSelectedId(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: CaseStatus) {
    if (!selectedId) return;
    await api.updateCase(officeId, selectedId, { status });
    await refreshDetail(selectedId);
    await refreshList();
  }

  async function computeScore() {
    if (!selectedId) return;
    await api.scoreCase(officeId, selectedId);
    await refreshDetail(selectedId);
    await refreshList();
  }

  async function addTask() {
    if (!selectedId || !taskTitle.trim()) return;
    await api.addTask(officeId, selectedId, { title: taskTitle.trim() });
    setTaskTitle('');
    await refreshDetail(selectedId);
  }

  async function toggleTask(task: CaseTask) {
    if (!selectedId) return;
    await api.updateTask(officeId, selectedId, task.id, { status: task.status === 'open' ? 'done' : 'open' });
    await refreshDetail(selectedId);
  }

  async function generateDocument() {
    if (!selectedId || !templateId) return;
    setBusy(true);
    try {
      const doc = await api.generateDocument(officeId, selectedId, { templateId });
      await refreshDetail(selectedId);
      setExpandedDocId(doc.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>תיקים ומשימות</h2>
      <p className="hint">ניתן ליצור תיק עצמאי, או לקשר אותו לשיחה קיימת כדי שהניקוד יחושב מנתוני השיחה בפועל.</p>

      <div className="row">
        <div className="field">
          <label>כותרת תיק</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: תיק גירושין - כהן" />
        </div>
        <div className="field">
          <label>קישור לשיחה (אופציונלי)</label>
          <select
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            onFocus={() => api.listConversations(officeId).then(setConversations)}
          >
            <option value="">— ללא —</option>
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contactName || c.contactPhone}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <button className="primary" onClick={createCase} disabled={busy || !title.trim()}>
            צור תיק
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 220 }}>
          {cases.length === 0 && <p className="field-hint">אין עדיין תיקים.</p>}
          {cases.map((c) => (
            <div
              key={c.id}
              className="list-item"
              style={{ cursor: 'pointer', borderColor: c.id === selectedId ? 'var(--primary)' : undefined }}
              onClick={() => setSelectedId(c.id)}
            >
              <span>
                {c.title}
                {c.score !== null && <span className="meta"> · ניקוד: {c.score}</span>}
              </span>
              <span className="pill">{STATUS_LABEL[c.status]}</span>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ flex: '2 1 320px', minWidth: 280 }}>
            <div className="field">
              <label>סטטוס</label>
              <select value={selected.status} onChange={(e) => updateStatus(e.target.value as CaseStatus)}>
                {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="toolbar" style={{ marginBottom: 12 }}>
              <button onClick={computeScore}>חשב ניקוד</button>
              {selected.score !== null && <span className="pill">ניקוד נוכחי: {selected.score}</span>}
            </div>

            <h2 style={{ fontSize: 14 }}>משימות</h2>
            {tasks.map((t) => (
              <div className="list-item" key={t.id}>
                <span style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                <button onClick={() => toggleTask(t)}>{t.status === 'done' ? 'החזר לפתוח' : 'סמן כבוצע'}</button>
              </div>
            ))}
            <div className="toolbar">
              <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="משימה חדשה" style={{ maxWidth: 240 }} />
              <button className="primary" onClick={addTask} disabled={!taskTitle.trim()}>
                הוספה
              </button>
            </div>

            <h2 style={{ fontSize: 14, marginTop: 16 }}>מסמכים</h2>
            {documents.map((d) => (
              <div key={d.id}>
                <div className="list-item" style={{ cursor: 'pointer' }} onClick={() => setExpandedDocId(expandedDocId === d.id ? null : d.id)}>
                  <span>
                    {d.title}
                    {d.missingFields.length > 0 && <span className="pill">שדות חסרים: {d.missingFields.join(', ')}</span>}
                  </span>
                  <span className="meta">{expandedDocId === d.id ? 'סגור' : 'הצג'}</span>
                </div>
                {expandedDocId === d.id && (
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      background: '#f8fafc',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 13,
                      marginTop: -4,
                      marginBottom: 8,
                    }}
                  >
                    {d.content}
                  </pre>
                )}
              </div>
            ))}
            <div className="toolbar">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                onFocus={() => api.listDocumentTemplates(officeId).then(setTemplates)}
                style={{ maxWidth: 220 }}
              >
                <option value="">בחר תבנית</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="primary" onClick={generateDocument} disabled={busy || !templateId}>
                צור מסמך
              </button>
            </div>
            {templates.length === 0 && (
              <p className="field-hint">אין עדיין תבניות מסמכים — ניתן להוסיף בטאב "הגדרות משרד" בסעיף 11.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
