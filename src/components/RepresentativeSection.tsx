import { useState } from 'react';
import type { RepresentativeIdentity } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';

const ROLE_LABEL: Record<RepresentativeIdentity['role'], string> = {
  secretary: 'מזכירה',
  representative: 'נציגת המשרד',
  digital_assistant: 'עוזרת דיגיטלית',
};

export function RepresentativeSection({
  officeId,
  representative,
  onSaved,
}: {
  officeId: string;
  representative: RepresentativeIdentity | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(representative?.name ?? '');
  const [role, setRole] = useState<RepresentativeIdentity['role']>(representative?.role ?? 'digital_assistant');
  const { status, run } = useSaveStatus();

  function save() {
    run(async () => {
      await api.setRepresentative(officeId, { name, role });
      onSaved();
    });
  }

  return (
    <section className="card">
      <h2>3. זהות הנציגה</h2>
      <p className="hint">השם והתפקיד שיוצגו ללקוח בתחילת השיחה ב-WhatsApp.</p>
      <div className="row">
        <div className="field">
          <label>שם</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: נועה" />
        </div>
        <div className="field">
          <label>תפקיד</label>
          <select value={role} onChange={(e) => setRole(e.target.value as RepresentativeIdentity['role'])}>
            {(Object.keys(ROLE_LABEL) as RepresentativeIdentity['role'][]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={save} disabled={status === 'saving' || !name.trim()}>
          שמירה
        </button>
        {status === 'saved' && <span className="status ok">נשמר</span>}
        {status === 'error' && <span className="status error">שגיאה בשמירה</span>}
      </div>
    </section>
  );
}
