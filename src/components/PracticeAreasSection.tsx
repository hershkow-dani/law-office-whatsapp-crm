import { useRef, useState } from 'react';
import type { PracticeArea } from '../types';
import { api } from '../api';
import { ImageUploadField } from './ImageUploadField';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

function AreaLogo({ area, onUploaded }: { area: PracticeArea; onUploaded: (logoUrl: string) => void }) {
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
        title="העלאת/החלפת לוגו לתחום"
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        {area.logoUrl ? (
          <img
            src={area.logoUrl}
            alt={area.name}
            style={{ height: 24, width: 24, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 5, background: '#fff' }}
          />
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 24,
              width: 24,
              borderRadius: 5,
              border: '1px dashed var(--border)',
              fontSize: 9,
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

export function PracticeAreasSection({
  officeId,
  areas,
  onSaved,
}: {
  officeId: string;
  areas: PracticeArea[];
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topLevel = areas.filter((a) => !a.parentId);
  const childrenOf = (id: string) => areas.filter((a) => a.parentId === id);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPracticeArea(officeId, { name: name.trim(), parentId: parentId || null, logoUrl: logoUrl || null });
      setName('');
      setLogoUrl('');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAreaLogo(areaId: string, newLogoUrl: string) {
    await api.updatePracticeArea(officeId, areaId, { logoUrl: newLogoUrl });
    onSaved();
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api.deletePracticeArea(officeId, id);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>6. תחומי עיסוק</h2>
      <p className="hint">תחומים ותתי-תחומים שהמשרד מקבל — ישמשו בעתיד להתאמת הטיפול בכל פנייה.</p>

      {topLevel.map((area) => (
        <div key={area.id}>
          <div className="list-item">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AreaLogo area={area} onUploaded={(url) => uploadAreaLogo(area.id, url)} />
              {area.name}
            </span>
            <button className="danger" onClick={() => remove(area.id)} disabled={busy}>
              הסר
            </button>
          </div>
          {childrenOf(area.id).map((child) => (
            <div key={child.id} className="list-item" style={{ marginRight: 20 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AreaLogo area={child} onUploaded={(url) => uploadAreaLogo(child.id, url)} />↳ {child.name}
              </span>
              <button className="danger" onClick={() => remove(child.id)} disabled={busy}>
                הסר
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <div className="field">
          <label>שם תחום / תת-תחום</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: דיני משפחה" />
        </div>
        <div className="field">
          <label>שייך תחת (אופציונלי)</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— תחום ראשי —</option>
            {topLevel.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>לוגו לתחום (אופציונלי)</label>
        <ImageUploadField value={logoUrl} onChange={setLogoUrl} alt="לוגו תחום עיסוק" size={40} />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || !name.trim()}>
          הוספה
        </button>
        {error && <span className="status error">{error}</span>}
      </div>
    </section>
  );
}
