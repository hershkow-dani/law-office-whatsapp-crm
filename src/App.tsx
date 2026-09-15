import { useCallback, useEffect, useState } from 'react';
import type { Office, OfficeProfile } from './types';
import { api } from './api';
import { OfficeSelector } from './components/OfficeSelector';
import { IdentitySection } from './components/IdentitySection';
import { WhatsappSection } from './components/WhatsappSection';
import { RepresentativeSection } from './components/RepresentativeSection';
import { DisclosureSection } from './components/DisclosureSection';
import { StyleSection } from './components/StyleSection';
import { PracticeAreasSection } from './components/PracticeAreasSection';
import { ServiceRegionsSection } from './components/ServiceRegionsSection';
import { HoursSection } from './components/HoursSection';
import { StaffSection } from './components/StaffSection';
import { HandoffSection } from './components/HandoffSection';

function App() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<OfficeProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOffices = useCallback(async () => {
    const list = await api.listOffices();
    setOffices(list);
    return list;
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    try {
      const p = await api.getOfficeProfile(id);
      setProfile(p);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadOffices().then((list) => {
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, [loadOffices]);

  useEffect(() => {
    if (selectedId) loadProfile(selectedId);
    else setProfile(null);
  }, [selectedId, loadProfile]);

  function refresh() {
    if (selectedId) loadProfile(selectedId);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>מערכת CRM למשרדי עורכי דין — הגדרות משרד ו-WhatsApp</h1>
        <p>שלב א׳: תשתית חיבור והגדרות זהות, ללא תלות במספר מרכזי של ספק המערכת.</p>
      </header>

      <OfficeSelector
        offices={offices}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreated={(office) => {
          setOffices((prev) => [office, ...prev]);
          setSelectedId(office.id);
        }}
      />

      {loadError && <p className="status error">{loadError}</p>}

      {!selectedId && <p className="hint">אין עדיין משרד. צרו משרד חדש כדי להתחיל.</p>}

      {profile && (
        <>
          <WhatsappSection officeId={profile.office.id} connection={profile.whatsapp} onSaved={refresh} />
          <IdentitySection office={profile.office} onSaved={refresh} />
          <RepresentativeSection officeId={profile.office.id} representative={profile.representative} onSaved={refresh} />
          <DisclosureSection officeId={profile.office.id} disclosure={profile.disclosure} onSaved={refresh} />
          <StyleSection officeId={profile.office.id} style={profile.style} onSaved={refresh} />
          <PracticeAreasSection officeId={profile.office.id} areas={profile.practiceAreas} onSaved={refresh} />
          <ServiceRegionsSection
            officeId={profile.office.id}
            config={profile.serviceRegionsConfig}
            regions={profile.serviceRegions}
            onSaved={refresh}
          />
          <HoursSection
            officeId={profile.office.id}
            businessHours={profile.businessHours}
            holidays={profile.holidays}
            afterHoursPolicy={profile.afterHoursPolicy}
            onSaved={refresh}
          />
          <StaffSection officeId={profile.office.id} staff={profile.staff} practiceAreas={profile.practiceAreas} onSaved={refresh} />
          <HandoffSection officeId={profile.office.id} rules={profile.handoffRules} onSaved={refresh} />
        </>
      )}
    </div>
  );
}

export default App;
