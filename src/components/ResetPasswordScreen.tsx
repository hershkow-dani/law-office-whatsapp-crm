import { useState } from 'react';
import { api } from '../api';

export function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({ token, newPassword: password });
      setDone(true);
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes('invalid_or_expired_token')) setError('הקישור לאיפוס אינו תקין או שפג תוקפו — יש לבקש קישור חדש');
      else if (message.includes('password_min_8_chars')) setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      else setError('שגיאה — נסו שוב');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = password.length >= 8 && confirm.length >= 8;

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="card">
        <h2 style={{ textAlign: 'center' }}>איפוס סיסמה</h2>

        {done ? (
          <>
            <p className="status ok" style={{ textAlign: 'center' }}>
              הסיסמה עודכנה בהצלחה.
            </p>
            <div className="toolbar" style={{ justifyContent: 'center' }}>
              <button className="primary" onClick={onDone}>
                מעבר להתחברות
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>סיסמה חדשה</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 8 תווים" />
            </div>
            <div className="field">
              <label>אימות סיסמה</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && !busy && submit()}
              />
            </div>
            {error && <p className="status error">{error}</p>}
            <div className="toolbar" style={{ justifyContent: 'center' }}>
              <button className="primary" onClick={submit} disabled={busy || !canSubmit}>
                {busy ? 'רגע...' : 'עדכון סיסמה'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
