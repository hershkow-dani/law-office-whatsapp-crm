import { useRef, useState } from 'react';
import type { AfterHoursPolicy, BusinessHour, Holiday } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';
import { ImageUploadField } from './ImageUploadField';

const DAY_LABELS = ['יום א׳', 'יום ב׳', 'יום ג׳', 'יום ד׳', 'יום ה׳', 'יום ו׳', 'שבת'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB

function HolidayLogo({ holiday, onUploaded }: { holiday: Holiday; onUploaded: (logoUrl: string) => void }) {
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
        title="העלאת/החלפת לוגו לחג/חופשה"
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        {holiday.logoUrl ? (
          <img
            src={holiday.logoUrl}
            alt={holiday.name}
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

type DayRow = { dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null };

function buildInitialHours(existing: BusinessHour[]): DayRow[] {
  return DAY_LABELS.map((_, dayOfWeek) => {
    const found = existing.find((h) => h.dayOfWeek === dayOfWeek);
    if (found) return { dayOfWeek, isClosed: found.isClosed, openTime: found.openTime, closeTime: found.closeTime };
    const isWeekend = dayOfWeek === 6; // default Saturday closed
    return { dayOfWeek, isClosed: isWeekend, openTime: isWeekend ? null : '09:00', closeTime: isWeekend ? null : '17:00' };
  });
}

export function HoursSection({
  officeId,
  businessHours,
  holidays,
  afterHoursPolicy,
  onSaved,
}: {
  officeId: string;
  businessHours: BusinessHour[];
  holidays: Holiday[];
  afterHoursPolicy: AfterHoursPolicy | null;
  onSaved: () => void;
}) {
  const [hours, setHours] = useState<DayRow[]>(buildInitialHours(businessHours));
  const [inHoursBehavior, setInHoursBehavior] = useState(afterHoursPolicy?.inHoursBehavior ?? 'auto_reply_full');
  const [outOfHoursBehavior, setOutOfHoursBehavior] = useState(afterHoursPolicy?.outOfHoursBehavior ?? 'collect_message_only');
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(
    afterHoursPolicy?.outOfHoursMessage ?? 'המשרד סגור כעת. פנייתך התקבלה ותטופל בשעות הפעילות הקרובות.'
  );
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayRecurring, setHolidayRecurring] = useState(false);
  const [holidayLogoUrl, setHolidayLogoUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const hoursStatus = useSaveStatus();
  const holidayStatus = useSaveStatus();
  const afterHoursStatus = useSaveStatus();

  function updateDay(idx: number, patch: Partial<DayRow>) {
    setHours((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function saveHours() {
    hoursStatus.run(async () => {
      await api.setBusinessHours(officeId, hours);
      onSaved();
    });
  }

  function saveAfterHours() {
    afterHoursStatus.run(async () => {
      await api.setAfterHours(officeId, { inHoursBehavior, outOfHoursBehavior, outOfHoursMessage });
      onSaved();
    });
  }

  function addHoliday() {
    if (!holidayDate || !holidayName.trim()) return;
    holidayStatus.run(async () => {
      await api.addHoliday(officeId, {
        date: holidayDate,
        name: holidayName.trim(),
        isRecurringAnnual: holidayRecurring,
        logoUrl: holidayLogoUrl || null,
      });
      setHolidayDate('');
      setHolidayName('');
      setHolidayRecurring(false);
      setHolidayLogoUrl('');
      onSaved();
    });
  }

  async function uploadHolidayLogo(holidayId: string, newLogoUrl: string) {
    await api.updateHoliday(officeId, holidayId, { logoUrl: newLogoUrl });
    onSaved();
  }

  async function removeHoliday(id: string) {
    await api.deleteHoliday(officeId, id);
    onSaved();
  }

  async function checkNow() {
    const res = await fetch(`/api/offices/${officeId}/decision-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at: new Date().toISOString(), message: { text: '' } }),
    });
    const data = await res.json();
    const label: Record<string, string> = { open: 'פתוח כעת', closed: 'סגור כעת', holiday: 'חג/חופשה כעת' };
    setPreview(label[data.hoursStatus] ?? data.hoursStatus);
  }

  return (
    <section className="card">
      <h2>8. שעות פעילות, חגים וחופשות</h2>
      <p className="hint">שעות הפעילות קובעות אם ההתנהגות בתוך השעות או מחוצה להן תחול על פנייה נכנסת.</p>

      {hours.map((day, idx) => (
        <div className="hours-grid" key={day.dayOfWeek}>
          <span className="day-label">{DAY_LABELS[day.dayOfWeek]}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <input type="checkbox" checked={day.isClosed} onChange={(e) => updateDay(idx, { isClosed: e.target.checked })} style={{ width: 'auto' }} />
            סגור
          </label>
          <input
            type="time"
            value={day.openTime ?? ''}
            disabled={day.isClosed}
            onChange={(e) => updateDay(idx, { openTime: e.target.value })}
          />
          <input
            type="time"
            value={day.closeTime ?? ''}
            disabled={day.isClosed}
            onChange={(e) => updateDay(idx, { closeTime: e.target.value })}
          />
        </div>
      ))}
      <div className="toolbar">
        <button className="primary" onClick={saveHours} disabled={hoursStatus.status === 'saving'}>
          שמירת שעות פעילות
        </button>
        {hoursStatus.status === 'saved' && <span className="status ok">נשמר</span>}
        {hoursStatus.status === 'error' && <span className="status error">שגיאה בשמירה</span>}
      </div>

      <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h2 style={{ fontSize: 14 }}>חגים וחופשות</h2>
      {holidays.map((h) => (
        <div className="list-item" key={h.id}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HolidayLogo holiday={h} onUploaded={(url) => uploadHolidayLogo(h.id, url)} />
            {h.date} — {h.name} {h.isRecurringAnnual && <span className="pill">חוזר מדי שנה</span>}
          </span>
          <button className="danger" onClick={() => removeHoliday(h.id)}>
            הסר
          </button>
        </div>
      ))}
      <div className="row">
        <div className="field">
          <label>תאריך</label>
          <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
        </div>
        <div className="field">
          <label>שם החג/חופשה</label>
          <input type="text" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={holidayRecurring} onChange={(e) => setHolidayRecurring(e.target.checked)} style={{ width: 'auto' }} />
            חוזר מדי שנה
          </label>
        </div>
      </div>
      <div className="field">
        <label>לוגו לחג/חופשה (אופציונלי)</label>
        <ImageUploadField value={holidayLogoUrl} onChange={setHolidayLogoUrl} alt="לוגו חג/חופשה" size={40} />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={addHoliday} disabled={!holidayDate || !holidayName.trim()}>
          הוספת חג/חופשה
        </button>
        {holidayStatus.status === 'saved' && <span className="status ok">נשמר</span>}
      </div>

      <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h2 style={{ fontSize: 14 }}>התנהגות בתוך/מחוץ לשעות הפעילות</h2>
      <div className="row">
        <div className="field">
          <label>התנהגות בתוך שעות הפעילות</label>
          <select value={inHoursBehavior} onChange={(e) => setInHoursBehavior(e.target.value)}>
            <option value="auto_reply_full">מענה אוטומטי מלא</option>
            <option value="auto_reply_then_staff">מענה אוטומטי עם אפשרות מעבר מיידי לצוות</option>
          </select>
        </div>
        <div className="field">
          <label>התנהגות מחוץ לשעות הפעילות</label>
          <select value={outOfHoursBehavior} onChange={(e) => setOutOfHoursBehavior(e.target.value)}>
            <option value="collect_message_only">איסוף פרטים בלבד, ללא מענה מלא</option>
            <option value="auto_reply_limited">מענה אוטומטי מצומצם</option>
            <option value="no_response">ללא מענה עד לשעות הפעילות</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>הודעה מחוץ לשעות הפעילות</label>
        <textarea value={outOfHoursMessage} onChange={(e) => setOutOfHoursMessage(e.target.value)} />
      </div>
      <div className="toolbar">
        <button className="primary" onClick={saveAfterHours} disabled={afterHoursStatus.status === 'saving'}>
          שמירת מדיניות שעות
        </button>
        {afterHoursStatus.status === 'saved' && <span className="status ok">נשמר</span>}
        <button onClick={checkNow}>בדוק סטטוס נוכחי</button>
        {preview && <span className="pill">{preview}</span>}
      </div>
    </section>
  );
}
