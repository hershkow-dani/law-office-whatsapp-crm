import { useState } from 'react';
import type { DisclosureSettings } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';

const DEFAULT_TEXT =
  'שיחה זו מתנהלת בסיוע מערכת מענה אוטומטית מטעם המשרד. ניתן בכל שלב לבקש לעבור לשיחה עם נציג/ה אנושי/ת.';

export function DisclosureSection({
  officeId,
  disclosure,
  onSaved,
}: {
  officeId: string;
  disclosure: DisclosureSettings | null;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(disclosure?.enabled ?? true);
  const [messageText, setMessageText] = useState(disclosure?.messageText ?? DEFAULT_TEXT);
  const { status, run } = useSaveStatus();

  function save() {
    run(async () => {
      await api.setDisclosure(officeId, { enabled, messageText });
      onSaved();
    });
  }

  return (
    <section className="card">
      <h2>4. גילוי אופי המענה</h2>
      <p className="hint">
        נוסח שקוף ועדין המציג ללקוח שהוא משוחח עם מענה אוטומטי מטעם המשרד. ניתן להתאים את הנוסח למדיניות המשרד
        ולדרישות הדין — אין נוסח משפטי מובנה מראש.
      </p>
      <div className="field">
        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 'auto', marginLeft: 6 }} />
          הצג הודעת גילוי בתחילת השיחה
        </label>
      </div>
      <div className="field">
        <label>נוסח ההודעה</label>
        <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={save} disabled={status === 'saving'}>
          שמירה
        </button>
        {status === 'saved' && <span className="status ok">נשמר</span>}
        {status === 'error' && <span className="status error">שגיאה בשמירה</span>}
      </div>
    </section>
  );
}
