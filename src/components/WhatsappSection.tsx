import { useState } from 'react';
import type { WhatsappConnection } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';

const STATUS_LABEL: Record<string, string> = {
  not_connected: 'לא מחובר',
  pending: 'ממתין להשלמת חיבור',
  connected: 'מחובר',
};

export function WhatsappSection({
  officeId,
  connection,
  onSaved,
}: {
  officeId: string;
  connection: WhatsappConnection | null;
  onSaved: () => void;
}) {
  const [numberType, setNumberType] = useState<'existing' | 'dedicated'>(connection?.numberType ?? 'existing');
  const [phoneNumber, setPhoneNumber] = useState(connection?.phoneNumber ?? '');
  const [displayName, setDisplayName] = useState(connection?.displayName ?? '');
  const [providerPhoneNumberId, setProviderPhoneNumberId] = useState(connection?.providerPhoneNumberId ?? '');
  const { status, run } = useSaveStatus();
  const [regenerating, setRegenerating] = useState(false);

  function save() {
    run(async () => {
      await api.setWhatsapp(officeId, {
        numberType,
        phoneNumber,
        displayName: displayName || null,
        providerPhoneNumberId: providerPhoneNumberId || null,
      });
      onSaved();
    });
  }

  async function regenerateToken() {
    if (!window.confirm('יצירת טוקן חדש תבטל את הטוקן הקיים — יהיה צריך לעדכן אותו גם בהגדרות ה-webhook אצל הספק. להמשיך?')) return;
    setRegenerating(true);
    try {
      await api.regenerateWebhookToken(officeId);
      onSaved();
    } finally {
      setRegenerating(false);
    }
  }

  const webhookPath = `/api/webhooks/whatsapp/${officeId}`;

  return (
    <section className="card">
      <h2>1. חיבור מספר WhatsApp</h2>
      <p className="hint">
        כל עורך דין מחבר את המספר שבחר — מספר קיים או מספר ייעודי חדש. אין תלות במספר מרכזי של ספק המערכת.
      </p>

      <div className="row">
        <div className="field">
          <label>סוג המספר</label>
          <select value={numberType} onChange={(e) => setNumberType(e.target.value as 'existing' | 'dedicated')}>
            <option value="existing">מספר קיים של המשרד</option>
            <option value="dedicated">מספר ייעודי חדש</option>
          </select>
        </div>
        <div className="field">
          <label>מספר טלפון</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+972501234567"
          />
        </div>
        <div className="field">
          <label>שם תצוגה (אופציונלי)</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>phone_number_id מהספק (אופציונלי, נדרש לחיבור חי)</label>
        <input
          type="text"
          value={providerPhoneNumberId}
          onChange={(e) => setProviderPhoneNumberId(e.target.value)}
          placeholder="המזהה המספרי שמופיע ב-Meta Business Manager, לא מספר הטלפון עצמו"
        />
      </div>

      {connection && (
        <p className="field-hint">
          סטטוס נוכחי: <span className="pill">{STATUS_LABEL[connection.connectionStatus] ?? connection.connectionStatus}</span>{' '}
          — חיבור חי דורש אישורי ספק WhatsApp Business (ראו README).
        </p>
      )}

      <div className="toolbar">
        <button className="primary" onClick={save} disabled={status === 'saving' || !phoneNumber.trim()}>
          שמירה
        </button>
        {status === 'saved' && <span className="status ok">נשמר</span>}
        {status === 'error' && <span className="status error">שגיאה בשמירה</span>}
      </div>

      {connection && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <h2 style={{ fontSize: 14 }}>פרטי חיבור webhook (להזנה אצל ספק ה-WhatsApp)</h2>
          <p className="field-hint">
            אלה עדיין לא חיבור חי — זו התשתית המוכנה לקליטת הודעות. יש להדביק את הכתובת והטוקן בטופס ה-Webhook
            במסך ההגדרות של Meta (או הספק שנבחר), על גבי הדומיין הציבורי שבו השרת ירוץ בפועל.
          </p>
          <div className="field">
            <label>נתיב ה-Webhook (להוסיף לפני זה את הדומיין הציבורי של השרת)</label>
            <input type="text" readOnly value={webhookPath} onFocus={(e) => e.target.select()} />
          </div>
          <div className="field">
            <label>Verify Token</label>
            <input type="text" readOnly value={connection.webhookVerifyToken ?? ''} onFocus={(e) => e.target.select()} />
          </div>
          <div className="toolbar">
            <button onClick={regenerateToken} disabled={regenerating}>
              {regenerating ? 'מייצר טוקן חדש...' : 'ייצור טוקן חדש'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
