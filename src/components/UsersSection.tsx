import { useEffect, useState } from 'react';
import type { AuthUser } from '../types';
import { api } from '../api';

const ROLE_LABEL: Record<AuthUser['role'], string> = { owner: 'בעלים', staff: 'צוות' };

export function UsersSection({ officeId, currentUserId }: { officeId: string; currentUserId: string }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthUser['role']>('staff');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setUsers(await api.listUsers(officeId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId]);

  async function add() {
    if (!name.trim() || !email.trim() || password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      await api.addUser(officeId, { name: name.trim(), email: email.trim(), password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('staff');
      await refresh();
    } catch (e) {
      const message = (e as Error).message;
      setError(message.includes('email_already_registered') ? 'כתובת האימייל כבר רשומה' : 'שגיאה בהוספת המשתמש/ת');
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: AuthUser) {
    if (!window.confirm(`להסיר את ${user.name} מהמשרד?`)) return;
    setError(null);
    try {
      await api.removeUser(officeId, user.id);
      await refresh();
    } catch (e) {
      const message = (e as Error).message;
      setError(message.includes('cannot_remove_last_owner') ? 'לא ניתן להסיר את הבעלים האחרון/ה במשרד' : 'שגיאה בהסרה');
    }
  }

  return (
    <section className="card">
      <h2>12. משתמשים והרשאות</h2>
      <p className="hint">
        מי יכול להתחבר למערכת הניהול. <strong>בעלים</strong> — גישה מלאה כולל הגדרות משרד וניהול משתמשים.{' '}
        <strong>צוות</strong> — שיחות, תיקים ומסמכים בלבד, ללא גישה להגדרות.
      </p>

      {users.map((u) => (
        <div className="list-item" key={u.id}>
          <span>
            {u.name} <span className="meta">({u.email})</span>
            <span className="pill">{ROLE_LABEL[u.role]}</span>
            {u.id === currentUserId && <span className="meta"> · זה אתם</span>}
          </span>
          <button className="danger" onClick={() => remove(u)} disabled={u.id === currentUserId}>
            הסר
          </button>
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <div className="field">
          <label>שם</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>אימייל</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>סיסמה זמנית</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 8 תווים" />
        </div>
        <div className="field">
          <label>תפקיד</label>
          <select value={role} onChange={(e) => setRole(e.target.value as AuthUser['role'])}>
            <option value="staff">צוות</option>
            <option value="owner">בעלים</option>
          </select>
        </div>
      </div>
      <div className="toolbar">
        <button className="primary" onClick={add} disabled={busy || !name.trim() || !email.trim() || password.length < 8}>
          הוספת משתמש/ת
        </button>
        {error && <span className="status error">{error}</span>}
      </div>
    </section>
  );
}
