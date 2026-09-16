import { useRef, useState } from 'react';
import type { Office } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

export function IdentitySection({ office, onSaved }: { office: Office; onSaved: () => void }) {
  const [name, setName] = useState(office.name);
  const [logoUrl, setLogoUrl] = useState(office.logoUrl ?? '');
  const [address, setAddress] = useState(office.address ?? '');
  const [logoError, setLogoError] = useState<string | null>(null);
  const { status, run } = useSaveStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function save() {
    run(async () => {
      await api.updateOffice(office.id, { name, logoUrl: logoUrl || null, address: address || null });
      onSaved();
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('יש לבחור קובץ תמונה');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('הקובץ גדול מדי (מקסימום 2MB) — אפשר לכווץ את התמונה או להזין כתובת URL במקום');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.onerror = () => setLogoError('שגיאה בקריאת הקובץ');
    reader.readAsDataURL(file);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="לוגו המשרד"
              style={{ height: 56, width: 56, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
              onError={() => setLogoError('לא ניתן לטעון את התמונה מהכתובת שהוזנה')}
            />
          ) : (
            <div
              style={{
                height: 56,
                width: 56,
                border: '1px dashed var(--border)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: 'var(--muted)',
                textAlign: 'center',
              }}
            >
              אין לוגו
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()}>העלאת תמונה</button>
            {logoUrl && (
              <button
                className="danger"
                onClick={() => {
                  setLogoUrl('');
                  setLogoError(null);
                }}
              >
                הסרה
              </button>
            )}
          </div>
        </div>
        {logoError && <span className="status error">{logoError}</span>}
        <input
          type="text"
          value={logoUrl.startsWith('data:') ? '' : logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder={logoUrl.startsWith('data:') ? 'הועלתה תמונה — אפשר להדביק כאן כתובת URL כדי להחליף אותה' : 'או הדביקו כתובת URL לתמונה'}
          style={{ marginTop: 6 }}
        />
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
