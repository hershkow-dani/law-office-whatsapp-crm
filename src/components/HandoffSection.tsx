import { useRef, useState } from 'react';
import type { HandoffRule, HandoffRuleType } from '../types';
import { api } from '../api';
import { ImageUploadField } from './ImageUploadField';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

function ContactLogo({ rule, onUploaded }: { rule: HandoffRule; onUploaded: (logoUrl: string) => void }) {
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
        title="העלאת/החלפת תמונת איש קשר"
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        {rule.logoUrl ? (
          <img
            src={rule.logoUrl}
            alt={rule.contactName ?? 'איש קשר'}
            style={{ height: 28, width: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 28,
              width: 28,
              borderRadius: '50%',
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

const RULE_LABEL: Record<HandoffRuleType, string> = {
  urgency: 'רמת דחיפות',
  area: 'תחום עיסוק',
  explicit_request: 'בקשה מפורשת של הפונה',
  keyword: 'מילת מפתח',
};

const URGENCY_OPTIONS = ['low', 'normal', 'high', 'urgent'];
const URGENCY_LABEL: Record<string, string> = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחופה מאוד' };

export function HandoffSection({
  officeId,
  rules,
  onSaved,
}: {
  officeId: string;
  rules: HandoffRule[];
  onSaved: () => void;
}) {
  const [ruleType, setRuleType] = useState<HandoffRuleType>('keyword');
  const [value, setValue] = useState('');
  const [contactName, setContactName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const [previewText, setPreviewText] = useState('');
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  async function add() {
    const v = ruleType === 'explicit_request' ? 'true' : value.trim();
    if (!v) return;
    setBusy(true);
    try {
      await api.addHandoffRule(officeId, {
        ruleType,
        value: v,
        preserveContext: true,
        contactName: contactName.trim() || null,
        logoUrl: logoUrl || null,
      });
      setValue('');
      setContactName('');
      setLogoUrl('');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(rule: HandoffRule) {
    await api.updateHandoffRule(officeId, rule.id, { isActive: !rule.isActive });
    onSaved();
  }

  async function uploadContactLogo(ruleId: string, newLogoUrl: string) {
    await api.updateHandoffRule(officeId, ruleId, { logoUrl: newLogoUrl });
    onSaved();
  }

  async function remove(id: string) {
    await api.deleteHandoffRule(officeId, id);
    onSaved();
  }

  async function runPreview() {
    const res = await fetch(`/api/offices/${officeId}/decision-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { text: previewText, explicitHumanRequest: previewText.includes('נציג אנושי') } }),
    });
    const data = await res.json();
    setPreviewResult(
      data.handoff.handoff
        ? `יועבר לאדם (${data.handoff.reason}), רצף השיחה והמידע שנאסף נשמרים`
        : 'ימשיך במענה האוטומטי'
    );
  }

  return (
    <section className="card">
      <h2>10. תנאים להעברה לאדם</h2>
      <p className="hint">
        מתי המערכת מפסיקה מענה אוטומטי ומעבירה את השיחה לאדם. העברה תמיד שומרת על רצף השיחה והמידע שנאסף עד כה.
      </p>

      {rules.map((r) => (
        <div className="list-item" key={r.id}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ContactLogo rule={r} onUploaded={(url) => uploadContactLogo(r.id, url)} />
            <span>
              {RULE_LABEL[r.ruleType]}
              {r.ruleType !== 'explicit_request' && <>: {r.ruleType === 'urgency' ? URGENCY_LABEL[r.value] ?? r.value : r.value}</>}
              {r.contactName && <span className="meta"> · איש קשר: {r.contactName}</span>}
              {!r.isActive && <span className="pill">כבוי</span>}
            </span>
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => toggleActive(r)}>{r.isActive ? 'כבה' : 'הפעל'}</button>
            <button className="danger" onClick={() => remove(r.id)}>
              הסר
            </button>
          </span>
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <div className="field">
          <label>סוג תנאי</label>
          <select value={ruleType} onChange={(e) => setRuleType(e.target.value as HandoffRuleType)}>
            {(Object.keys(RULE_LABEL) as HandoffRuleType[]).map((t) => (
              <option key={t} value={t}>
                {RULE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {ruleType !== 'explicit_request' && (
          <div className="field">
            <label>ערך</label>
            {ruleType === 'urgency' ? (
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">בחר סף דחיפות</option>
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {URGENCY_LABEL[u]}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={ruleType === 'keyword' ? 'לדוגמה: דחוף' : 'שם תחום עיסוק'}
              />
            )}
          </div>
        )}
        <div className="field">
          <label>איש קשר (אופציונלי)</label>
          <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="למי מועברת הפנייה" />
        </div>
      </div>
      <div className="field">
        <label>תמונת איש הקשר (אופציונלי)</label>
        <ImageUploadField value={logoUrl} onChange={setLogoUrl} alt="תמונת איש קשר" round size={40} />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || (ruleType !== 'explicit_request' && !value.trim())}>
          הוספת תנאי
        </button>
      </div>

      <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h2 style={{ fontSize: 14 }}>בדיקת השפעת התנאים על הודעה לדוגמה</h2>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field">
          <label>טקסט הודעה לבדיקה</label>
          <input type="text" value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="לדוגמה: זה מקרה דחוף מאוד" />
        </div>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <button onClick={runPreview}>בדוק</button>
        </div>
      </div>
      {previewResult && <p className="field-hint">{previewResult}</p>}
    </section>
  );
}
