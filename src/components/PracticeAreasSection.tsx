import { useState } from 'react';
import type { PracticeArea } from '../types';
import { api } from '../api';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topLevel = areas.filter((a) => !a.parentId);
  const childrenOf = (id: string) => areas.filter((a) => a.parentId === id);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPracticeArea(officeId, { name: name.trim(), parentId: parentId || null });
      setName('');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
            <span>{area.name}</span>
            <button className="danger" onClick={() => remove(area.id)} disabled={busy}>
              הסר
            </button>
          </div>
          {childrenOf(area.id).map((child) => (
            <div key={child.id} className="list-item" style={{ marginRight: 20 }}>
              <span>↳ {child.name}</span>
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
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || !name.trim()}>
          הוספה
        </button>
        {error && <span className="status error">{error}</span>}
      </div>
    </section>
  );
}
