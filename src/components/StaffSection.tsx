import { useState } from 'react';
import type { PracticeArea, StaffMember } from '../types';
import { api } from '../api';

const PERMISSION_OPTIONS = [
  { value: 'manage_cases', label: 'ניהול תיקים' },
  { value: 'view_conversations', label: 'צפייה בשיחות' },
  { value: 'manage_settings', label: 'ניהול הגדרות משרד' },
  { value: 'receive_handoffs', label: 'קבלת פניות מועברות' },
];

export function StaffSection({
  officeId,
  staff,
  practiceAreas,
  onSaved,
}: {
  officeId: string;
  staff: StaffMember[];
  practiceAreas: PracticeArea[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [responsibilityAreas, setResponsibilityAreas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function togglePermission(value: string) {
    setPermissions((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  function toggleArea(name: string) {
    setResponsibilityAreas((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  }

  async function add() {
    if (!name.trim() || !role.trim()) return;
    setBusy(true);
    try {
      await api.addStaff(officeId, { name: name.trim(), role: role.trim(), permissions, responsibilityAreas });
      setName('');
      setRole('');
      setPermissions([]);
      setResponsibilityAreas([]);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(member: StaffMember) {
    await api.updateStaff(officeId, member.id, { isActive: !member.isActive });
    onSaved();
  }

  async function remove(id: string) {
    await api.deleteStaff(officeId, id);
    onSaved();
  }

  return (
    <section className="card">
      <h2>9. אנשי צוות</h2>
      <p className="hint">הגדרת אנשי צוות, תפקידים, הרשאות ותחומי אחריות — לשיוך פניות לעורך הדין או לעובד המתאים.</p>

      {staff.map((m) => (
        <div className="list-item" key={m.id}>
          <span>
            {m.name} <span className="meta">({m.role})</span>
            {!m.isActive && <span className="pill">לא פעיל/ה</span>}
            {m.responsibilityAreas.length > 0 && <span className="meta"> · אחראי/ת: {m.responsibilityAreas.join(', ')}</span>}
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => toggleActive(m)}>{m.isActive ? 'השבת' : 'הפעל'}</button>
            <button className="danger" onClick={() => remove(m.id)}>
              הסר
            </button>
          </span>
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <div className="field">
          <label>שם</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>תפקיד</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="עו״ד / מזכירה / פרלגל" />
        </div>
      </div>

      <div className="field">
        <label>הרשאות</label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {PERMISSION_OPTIONS.map((p) => (
            <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="checkbox" checked={permissions.includes(p.value)} onChange={() => togglePermission(p.value)} style={{ width: 'auto' }} />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {practiceAreas.length > 0 && (
        <div className="field">
          <label>תחומי אחריות</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {practiceAreas.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input type="checkbox" checked={responsibilityAreas.includes(a.name)} onChange={() => toggleArea(a.name)} style={{ width: 'auto' }} />
                {a.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || !name.trim() || !role.trim()}>
          הוספת איש/אשת צוות
        </button>
      </div>
    </section>
  );
}
