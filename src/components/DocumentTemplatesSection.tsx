import { useEffect, useState } from 'react';
import type { DocumentTemplate } from '../types';
import { api } from '../api';

const PLACEHOLDER_HINTS = ['officeName', 'officeAddress', 'representativeName', 'caseTitle', 'practiceArea', 'clientName', 'clientPhone', 'today'];

export function DocumentTemplatesSection({ officeId }: { officeId: string }) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setTemplates(await api.listDocumentTemplates(officeId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId]);

  async function add() {
    if (!name.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await api.createDocumentTemplate(officeId, { name: name.trim(), body });
      setName('');
      setBody('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.deleteDocumentTemplate(officeId, id);
    await refresh();
  }

  return (
    <section className="card">
      <h2>11. תבניות מסמכים</h2>
      <p className="hint">
        תבנית טקסט חופשי עם שדות ממולאים אוטומטית, למשל <code>{'{{clientName}}'}</code>. שדות זמינים:{' '}
        {PLACEHOLDER_HINTS.map((p) => (
          <code key={p} style={{ marginInlineEnd: 6 }}>
            {`{{${p}}}`}
          </code>
        ))}
      </p>

      {templates.map((t) => (
        <div className="list-item" key={t.id} style={{ alignItems: 'flex-start' }}>
          <span>
            <strong>{t.name}</strong>
            <br />
            <span className="meta" style={{ whiteSpace: 'pre-wrap' }}>
              {t.body.length > 140 ? t.body.slice(0, 140) + '…' : t.body}
            </span>
          </span>
          <button className="danger" onClick={() => remove(t.id)}>
            הסר
          </button>
        </div>
      ))}

      <div className="field">
        <label>שם התבנית</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: מכתב פתיחת תיק" />
      </div>
      <div className="field">
        <label>גוף התבנית</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'לכבוד {{clientName}},\nבעניין {{practiceArea}}.\nבברכה, {{officeName}}.'}
          style={{ minHeight: 120 }}
        />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || !name.trim() || !body.trim()}>
          הוספת תבנית
        </button>
      </div>
    </section>
  );
}
