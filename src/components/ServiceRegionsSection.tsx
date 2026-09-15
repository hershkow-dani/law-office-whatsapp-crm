import { useState } from 'react';
import type { ServiceRegion, ServiceRegionsConfig } from '../types';
import { api } from '../api';
import { useSaveStatus } from '../useSaveStatus';

export function ServiceRegionsSection({
  officeId,
  config,
  regions,
  onSaved,
}: {
  officeId: string;
  config: ServiceRegionsConfig | null;
  regions: ServiceRegion[];
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<ServiceRegionsConfig['mode']>(config?.mode ?? 'national');
  const [localRegions, setLocalRegions] = useState<Omit<ServiceRegion, 'id' | 'officeId'>[]>(
    regions.map((r) => ({ regionName: r.regionName, courtType: r.courtType, serviceType: r.serviceType }))
  );
  const { status, run } = useSaveStatus();

  function updateRegion(idx: number, patch: Partial<Omit<ServiceRegion, 'id' | 'officeId'>>) {
    setLocalRegions((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRegion() {
    setLocalRegions((prev) => [...prev, { regionName: '', courtType: null, serviceType: null }]);
  }

  function removeRegion(idx: number) {
    setLocalRegions((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    run(async () => {
      const cleaned = localRegions.filter((r) => r.regionName.trim());
      await api.setServiceRegions(officeId, { mode, regions: cleaned });
      onSaved();
    });
  }

  return (
    <section className="card">
      <h2>7. אזורי שירות</h2>
      <p className="hint">שירות ארצי, או אזורים מוגדרים לפי אזור גאוגרפי, ערכאה או סוג שירות.</p>

      <div className="field">
        <label>מצב שירות</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as ServiceRegionsConfig['mode'])}>
          <option value="national">שירות ארצי</option>
          <option value="regional">אזורי שירות מוגדרים</option>
        </select>
      </div>

      {mode === 'regional' && (
        <div>
          {localRegions.map((r, idx) => (
            <div className="row" key={idx} style={{ alignItems: 'flex-end' }}>
              <div className="field">
                <label>אזור גאוגרפי</label>
                <input type="text" value={r.regionName} onChange={(e) => updateRegion(idx, { regionName: e.target.value })} placeholder="מרכז" />
              </div>
              <div className="field">
                <label>ערכאה (אופציונלי)</label>
                <input
                  type="text"
                  value={r.courtType ?? ''}
                  onChange={(e) => updateRegion(idx, { courtType: e.target.value || null })}
                  placeholder="שלום / מחוזי"
                />
              </div>
              <div className="field">
                <label>סוג שירות (אופציונלי)</label>
                <input
                  type="text"
                  value={r.serviceType ?? ''}
                  onChange={(e) => updateRegion(idx, { serviceType: e.target.value || null })}
                  placeholder="ייצוג / ייעוץ"
                />
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                <button className="danger" onClick={() => removeRegion(idx)}>
                  הסר
                </button>
              </div>
            </div>
          ))}
          <button onClick={addRegion}>הוסף אזור</button>
        </div>
      )}

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
