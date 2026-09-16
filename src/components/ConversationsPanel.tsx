import { useEffect, useRef, useState } from 'react';
import type { Conversation, Message } from '../types';
import { api } from '../api';
import { ImageUploadField } from './ImageUploadField';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

function ContactAvatar({ conversation, onUploaded, size = 40 }: { conversation: Conversation; onUploaded: (photoUrl: string) => void; size?: number }) {
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
    if (file.size > MAX_PHOTO_BYTES) {
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
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        title="העלאת/החלפת תמונת לקוח"
        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
      >
        {conversation.contactPhotoUrl ? (
          <img
            src={conversation.contactPhotoUrl}
            alt={conversation.contactName || conversation.contactPhone}
            style={{ height: size, width: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: size,
              width: size,
              borderRadius: '50%',
              border: '1px dashed var(--border)',
              fontSize: 10,
              color: 'var(--muted)',
            }}
          >
            +
          </span>
        )}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onClick={(e) => e.stopPropagation()} onChange={handleFileChange} style={{ display: 'none' }} />
      {error && (
        <span className="status error" style={{ fontSize: 10 }}>
          {error}
        </span>
      )}
    </span>
  );
}

const STATUS_LABEL: Record<Conversation['status'], string> = {
  auto: 'מענה אוטומטי',
  pending_human: 'ממתין לצוות',
  closed: 'סגור',
};

export function ConversationsPanel({ officeId }: { officeId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);

  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [clientText, setClientText] = useState('');
  const [staffText, setStaffText] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastAutoReply, setLastAutoReply] = useState<string | null>(null);

  async function refreshList() {
    const list = await api.listConversations(officeId);
    setConversations(list);
  }

  async function refreshDetail(id: string) {
    const detail = await api.getConversation(officeId, id);
    setSelected(detail.conversation);
    setMessages(detail.messages);
  }

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId]);

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
    else {
      setSelected(null);
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function createConversation() {
    if (!newPhone.trim()) return;
    setBusy(true);
    try {
      const conv = await api.createConversation(officeId, {
        contactPhone: newPhone.trim(),
        contactName: newName.trim() || null,
        contactPhotoUrl: newPhotoUrl || null,
      });
      setNewPhone('');
      setNewName('');
      setNewPhotoUrl('');
      await refreshList();
      setSelectedId(conv.id);
    } finally {
      setBusy(false);
    }
  }

  async function uploadContactPhoto(conversationId: string, photoUrl: string) {
    await api.updateConversation(officeId, conversationId, { contactPhotoUrl: photoUrl });
    await refreshList();
    if (selectedId === conversationId) await refreshDetail(conversationId);
  }

  async function sendAsClient() {
    if (!selectedId || !clientText.trim()) return;
    setBusy(true);
    try {
      const res = await api.sendInbound(officeId, selectedId, { text: clientText.trim() });
      setClientText('');
      setLastAutoReply(res.autoReplied ? res.replyText ?? null : null);
      await refreshDetail(selectedId);
      await refreshList();
    } finally {
      setBusy(false);
    }
  }

  async function sendAsStaff() {
    if (!selectedId || !staffText.trim()) return;
    setBusy(true);
    try {
      await api.sendOutbound(officeId, selectedId, { text: staffText.trim() });
      setStaffText('');
      await refreshDetail(selectedId);
      await refreshList();
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!selectedId) return;
    await api.closeConversation(officeId, selectedId);
    await refreshDetail(selectedId);
    await refreshList();
  }

  async function resumeAuto() {
    if (!selectedId) return;
    await api.resumeAutoConversation(officeId, selectedId);
    await refreshDetail(selectedId);
    await refreshList();
  }

  return (
    <section className="card">
      <h2>שיחות WhatsApp (מדומות)</h2>
      <p className="hint">
        אין עדיין חיבור WhatsApp חי (ראו README) — כאן ניתן לדמות הודעה נכנסת מלקוח ולראות איך המערכת מגיבה לפי
        הגדרות המשרד, שעות הפעילות ותנאי ההעברה לאדם.
      </p>

      <div className="row">
        <div className="field">
          <label>מספר טלפון של לקוח לדוגמה</label>
          <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+972501234567" />
        </div>
        <div className="field">
          <label>שם (אופציונלי)</label>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <button className="primary" onClick={createConversation} disabled={busy || !newPhone.trim()}>
            שיחה חדשה
          </button>
        </div>
      </div>

      <div className="field">
        <label>תמונת לקוח (אופציונלי)</label>
        <ImageUploadField value={newPhotoUrl} onChange={setNewPhotoUrl} alt="תמונת לקוח" round size={44} />
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 220 }}>
          {conversations.length === 0 && <p className="field-hint">אין עדיין שיחות.</p>}
          {conversations.map((c) => (
            <div
              key={c.id}
              className="list-item"
              style={{ cursor: 'pointer', borderColor: c.id === selectedId ? 'var(--primary)' : undefined }}
              onClick={() => setSelectedId(c.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ContactAvatar conversation={c} onUploaded={(url) => uploadContactPhoto(c.id, url)} size={28} />
                <span>
                  {c.contactName || c.contactPhone}
                  <span className="meta"> · {c.contactPhone}</span>
                </span>
              </span>
              <span className="pill">{STATUS_LABEL[c.status]}</span>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ flex: '2 1 320px', minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <ContactAvatar conversation={selected} onUploaded={(url) => uploadContactPhoto(selected.id, url)} />
              <strong>{selected.contactName || selected.contactPhone}</strong>
            </div>
            <p className="field-hint">
              סטטוס: <span className="pill">{STATUS_LABEL[selected.status]}</span>
              {selected.practiceArea && <> · תחום שזוהה: {selected.practiceArea}</>}
              {selected.everHandoff && <span className="pill">הועבר לאדם בעבר</span>}
            </p>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 10 }}>
              {messages.map((m) => (
                <div key={m.id} style={{ textAlign: m.direction === 'inbound' ? 'right' : 'left', marginBottom: 6 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: m.direction === 'inbound' ? '#eef2ff' : '#f1f5f9',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 13,
                      maxWidth: '85%',
                    }}
                  >
                    <strong style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {m.senderType === 'client' ? 'לקוח' : m.senderType === 'system' ? 'מערכת (אוטומטי)' : 'צוות'}
                    </strong>
                    <br />
                    {m.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="field">
              <label>הודעה נכנסת לדוגמה (בשם הלקוח)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={clientText} onChange={(e) => setClientText(e.target.value)} placeholder="לדוגמה: זה מקרה דחוף" />
                <button className="primary" onClick={sendAsClient} disabled={busy || !clientText.trim() || selected.status === 'closed'}>
                  שלח
                </button>
              </div>
            </div>
            {lastAutoReply && <p className="field-hint">תגובה אוטומטית אחרונה: {lastAutoReply}</p>}

            <div className="field">
              <label>תגובת צוות ידנית</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={staffText} onChange={(e) => setStaffText(e.target.value)} />
                <button onClick={sendAsStaff} disabled={busy || !staffText.trim()}>
                  שלח כצוות
                </button>
              </div>
            </div>

            <div className="toolbar">
              {selected.status !== 'closed' && <button className="danger" onClick={close}>סגור שיחה</button>}
              {selected.status !== 'auto' && <button onClick={resumeAuto}>החזר למענה אוטומטי</button>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
