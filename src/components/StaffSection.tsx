import { useRef, useState } from 'react';
import type { PracticeArea, StaffMember } from '../types';
import { api } from '../api';
import { ImageUploadField } from './ImageUploadField';

const PERMISSION_OPTIONS = [
  { value: 'manage_cases', label: 'ניהול תיקים' },
  { value: 'view_conversations', label: 'צפייה בשיחות' },
  { value: 'manage_settings', label: 'ניהול הגדרות משרד' },
  { value: 'receive_handoffs', label: 'קבלת פניות מועברות' },
];

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

function StaffAvatar({ member, onUploaded }: { member: StaffMember; onUploaded: (photoUrl: string) => void }) {
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
    if (file.size > MAX_PHOTO_BYTES) {
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
        title="העלאת/החלפת תמונה"
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
      >
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={member.name}
            style={{ height: 32, width: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              width: 32,
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
  const [photoUrl, setPhotoUrl] = useState('');
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
      await api.addStaff(officeId, { name: name.trim(), role: role.trim(), permissions, responsibilityAreas, photoUrl: photoUrl || null });
      setName('');
      setRole('');
      setPermissions([]);
      setResponsibilityAreas([]);
      setPhotoUrl('');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(member: StaffMember) {
    await api.updateStaff(officeId, member.id, { isActive: !member.isActive });
    onSaved();
  }

  async function uploadPhoto(member: StaffMember, newPhotoUrl: string) {
    await api.updateStaff(officeId, member.id, { photoUrl: newPhotoUrl });
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StaffAvatar member={m} onUploaded={(url) => uploadPhoto(m, url)} />
            <span>
              {m.name} <span className="meta">({m.role})</span>
              {!m.isActive && <span className="pill">לא פעיל/ה</span>}
              {m.responsibilityAreas.length > 0 && <span className="meta"> · אחראי/ת: {m.responsibilityAreas.join(', ')}</span>}
            </span>
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => toggleActive(m)}>{m.isActive ? 'השבת' : 'הפעל'}</button>
            <button className="danger" onClick={() => remove(m.id)}>
              הסר
            </button>
          </span>
        </div>
      ))}

      <div className="field" style={{ marginTop: 10 }}>
        <label>תמונה (אופציונלי)</label>
        <ImageUploadField value={photoUrl} onChange={setPhotoUrl} alt="תמונת איש/אשת צוות" round size={48} />
      </div>

      <div className="row">
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
