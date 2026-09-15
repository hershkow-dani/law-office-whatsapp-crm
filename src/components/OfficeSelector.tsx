import { useState } from 'react';
import type { Office } from '../types';
import { api } from '../api';

interface Props {
  offices: Office[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (office: Office) => void;
  onDeleted: (id: string) => void;
}

export function OfficeSelector({ offices, selectedId, onSelect, onCreated, onDeleted }: Props) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const office = await api.createOffice({ name: newName.trim() });
      setNewName('');
      onCreated(office);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    const office = offices.find((o) => o.id === selectedId);
    if (!office || !window.confirm(`למחוק את המשרד "${office.name}" וכל הגדרותיו? הפעולה בלתי הפיכה.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteOffice(selectedId);
      onDeleted(selectedId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="office-picker">
      <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
        <option value="" disabled>
          בחר משרד
        </option>
        {offices.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="שם משרד חדש"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        style={{ width: 200 }}
      />
      <button className="primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
        {creating ? 'יוצר...' : 'צור משרד חדש'}
      </button>
      {selectedId && (
        <button className="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'מוחק...' : 'מחק משרד נבחר'}
        </button>
      )}
      {error && <span className="status error">{error}</span>}
    </div>
  );
}
