import { useEffect, useRef, useState } from 'react';
import type { DocumentTemplate } from '../types';
import { api } from '../api';
import { ImageUploadField } from './ImageUploadField';

const PLACEHOLDER_HINTS = ['officeName', 'officeAddress', 'representativeName', 'caseTitle', 'practiceArea', 'clientName', 'clientPhone', 'today'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

function TemplateLogo({ template, onUploaded }: { template: DocumentTemplate; onUploaded: (logoUrl: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('יש לבחור קובץ תמונה');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('הקובץ גדול מדי (מקס׳ 2MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onUploaded(reader.result as string);
    reader.onerror = () => setError('שגיאה בקריאת הקובץ');
    reader.readAsDataURL(file);
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="העלאת/החלפת לוגו למסמך"
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        {template.logoUrl ? (
          <img
            src={template.logoUrl}
            alt={`לוגו ${template.name}`}
            style={{ height: 36, width: 36, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
          />
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 36,
              width: 36,
              borderRadius: 6,
              border: '1px dashed var(--border)',
              fontSize: 10,
              color: 'var(--muted)',
            }}
          >
            +
          </span>
        )}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      {error && (
        <span className="status error" style={{ fontSize: 10 }}>
          {error}
        </span>
      )}
    </span>
  );
}

export function DocumentTemplatesSection({ officeId }: { officeId: string }) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
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
      await api.createDocumentTemplate(officeId, { name: name.trim(), body, logoUrl: logoUrl || null });
      setName('');
      setBody('');
      setLogoUrl('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadTemplateLogo(templateId: string, newLogoUrl: string) {
    await api.updateDocumentTemplate(officeId, templateId, { logoUrl: newLogoUrl });
    await refresh();
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
        <br />
        אפשר להוסיף לוגו/מכתב־ראש לכל תבנית בנפרד; תבנית ללא לוגו משלה תשתמש בלוגו המשרד (סעיף 2) כברירת
        מחדל בעת יצירת מסמך.
      </p>

      {templates.map((t) => (
        <div className="list-item" key={t.id} style={{ alignItems: 'flex-start' }}>
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <TemplateLogo template={t} onUploaded={(url) => uploadTemplateLogo(t.id, url)} />
            <span>
              <strong>{t.name}</strong>
              <br />
              <span className="meta" style={{ whiteSpace: 'pre-wrap' }}>
                {t.body.length > 140 ? t.body.slice(0, 140) + '…' : t.body}
              </span>
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
      <div className="field">
        <label>לוגו לתבנית זו (אופציונלי — ברירת מחדל: לוגו המשרד)</label>
        <ImageUploadField value={logoUrl} onChange={setLogoUrl} alt="לוגו תבנית" />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || !name.trim() || !body.trim()}>
          הוספת תבנית
        </button>
      </div>
    </section>
  );
}
