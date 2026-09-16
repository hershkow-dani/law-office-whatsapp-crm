import { useState } from 'react';
import type { AuthUser, Office } from '../types';
import { api } from '../api';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: { user: AuthUser; office: Office }) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [officeName, setOfficeName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const session =
        mode === 'login' ? await api.login({ email, password }) : await api.register({ officeName, name, email, password });
      onAuthenticated(session);
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes('invalid_credentials')) setError('אימייל או סיסמה שגויים');
      else if (message.includes('email_already_registered')) setError('כתובת האימייל כבר רשומה במערכת — נסו להתחבר');
      else if (message.includes('password_min_8_chars')) setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      else if (message.includes('valid_email_required')) setError('כתובת אימייל לא תקינה');
      else setError('שגיאה — נסו שוב');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = mode === 'login' ? email.trim() && password : officeName.trim() && name.trim() && email.trim() && password.length >= 8;

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="card">
        <h2 style={{ textAlign: 'center' }}>מערכת CRM למשרדי עורכי דין</h2>
        <p className="hint" style={{ textAlign: 'center' }}>
          {mode === 'login' ? 'התחברות לחשבון קיים' : 'הקמת משרד חדש וחשבון בעלים ראשון'}
        </p>

        {mode === 'register' && (
          <div className="field">
            <label>שם המשרד</label>
            <input type="text" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="לדוגמה: משרד עורכי דין כהן ושות׳" />
          </div>
        )}
        {mode === 'register' && (
          <div className="field">
            <label>שם מלא</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>אימייל</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="field">
          <label>סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && !busy && submit()}
            placeholder={mode === 'register' ? 'לפחות 8 תווים' : ''}
          />
        </div>

        {error && <p className="status error">{error}</p>}

        <div className="toolbar" style={{ justifyContent: 'center' }}>
          <button className="primary" onClick={submit} disabled={busy || !canSubmit}>
            {busy ? 'רגע...' : mode === 'login' ? 'התחברות' : 'יצירת משרד'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 14 }}>
          {mode === 'login' ? (
            <>
              אין לכם עדיין משרד במערכת?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(null); }}>
                הקמת משרד חדש
              </a>
            </>
          ) : (
            <>
              כבר יש לכם חשבון?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null); }}>
                התחברות
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
