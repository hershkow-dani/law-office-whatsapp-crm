import { useEffect, useState } from 'react';
import type { ReportsSummary } from '../types';
import { api } from '../api';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', minWidth: 120 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

export function ReportsPanel({ officeId }: { officeId: string }) {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);

  async function refresh() {
    setSummary(await api.getReportsSummary(officeId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId]);

  if (!summary) return null;

  return (
    <section className="card">
      <h2>דוחות וניקוד</h2>
      <p className="hint">סיכום מצטבר של השיחות והתיקים במשרד זה.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <Stat label="סה״כ שיחות" value={summary.conversations.total} />
        <Stat label="מענה אוטומטי" value={summary.conversations.auto} />
        <Stat label="ממתין לצוות" value={summary.conversations.pendingHuman} />
        <Stat label="שיחות סגורות" value={summary.conversations.closed} />
        <Stat label="שיעור העברה לאדם" value={`${Math.round(summary.handoffRate * 100)}%`} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <Stat label="סה״כ תיקים" value={summary.cases.total} />
        <Stat label="חדשים" value={summary.cases.new} />
        <Stat label="בטיפול" value={summary.cases.inProgress} />
        <Stat label="ממתינים ללקוח" value={summary.cases.waitingClient} />
        <Stat label="סגורים" value={summary.cases.closed} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat label="ניקוד ממוצע" value={summary.averageScore ?? '—'} />
        <Stat
          label="זמן תגובה ראשונה ממוצע"
          value={summary.averageFirstResponseSeconds !== null ? `${Math.round(summary.averageFirstResponseSeconds)} שנ׳` : '—'}
        />
      </div>
      <div className="toolbar">
        <button onClick={refresh}>רענון</button>
      </div>
    </section>
  );
}
