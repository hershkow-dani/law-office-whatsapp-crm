import { useState } from 'react';
import type { ConversationStyle } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';

const TONE_LABEL: Record<ConversationStyle['tone'], string> = {
  professional: 'מקצועי',
  warm: 'חם',
  businesslike: 'ענייני',
  formal: 'פורמלי',
};

export function StyleSection({
  officeId,
  style,
  onSaved,
}: {
  officeId: string;
  style: ConversationStyle | null;
  onSaved: () => void;
}) {
  const [tone, setTone] = useState<ConversationStyle['tone']>(style?.tone ?? 'professional');
  const [customNotes, setCustomNotes] = useState(style?.customNotes ?? '');
  const { status, run } = useSaveStatus();

  function save() {
    run(async () => {
      await api.setStyle(officeId, { tone, customNotes: customNotes || null });
      onSaved();
    });
  }

  return (
    <section className="card">
      <h2>5. סגנון השיחה</h2>
      <p className="hint">הטון קובע את הניסוח שבו המערכת עונה ללקוח לאורך כל השיחה.</p>
      <div className="field">
        <label>טון</label>
        <select value={tone} onChange={(e) => setTone(e.target.value as ConversationStyle['tone'])}>
          {(Object.keys(TONE_LABEL) as ConversationStyle['tone'][]).map((t) => (
            <option key={t} value={t}>
              {TONE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>הערות ניסוח נוספות (אופציונלי)</label>
        <textarea value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} placeholder="לדוגמה: לפנות בגוף שני יחיד" />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={save} disabled={status === 'saving'}>
          שמירה
        </button>
        {status === 'saved' && <span className="status ok">נשמר</span>}
        {status === 'error' && <span className="status error">שגיאה בשמירה</span>}
      </div>
    </section>
  );
}
