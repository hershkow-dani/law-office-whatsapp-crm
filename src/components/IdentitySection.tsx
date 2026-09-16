import { useState } from 'react';
import type { Office } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';
import { ImageUploadField } from './ImageUploadField';

export function IdentitySection({ office, onSaved }: { office: Office; onSaved: () => void }) {
  const [name, setName] = useState(office.name);
  const [logoUrl, setLogoUrl] = useState(office.logoUrl ?? '');
  const [address, setAddress] = useState(office.address ?? '');
  const { status, run } = useSaveStatus();

  function save() {
    run(async () => {
      await api.updateOffice(office.id, { name, logoUrl: logoUrl || null, address: address || null });
      onSaved();
    });
  }

  return (
    <section className="card">
      <h2>2. זהות המשרד</h2>
      <p className="hint">שם המשרד, לוגו וכתובת — המערכת משתמשת בפרטים אלה בתקשורת מול הלקוח.</p>
      <div className="field">
        <label>שם המשרד</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="field">
        <label>לוגו המשרד</label>
        <ImageUploadField value={logoUrl} onChange={setLogoUrl} alt="לוגו המשרד" />
      </div>

      <div className="row">
        <div className="field">
          <label>כתובת המשרד</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="רחוב, עיר" />
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
