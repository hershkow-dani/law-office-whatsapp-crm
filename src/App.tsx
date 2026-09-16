import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, Office, OfficeProfile } from './types';
import { api } from './api';
import { AuthScreen } from './components/AuthScreen';
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
import { ConversationsPanel } from './components/ConversationsPanel';
import { CasesPanel } from './components/CasesPanel';
import { ReportsPanel } from './components/ReportsPanel';
import { DocumentTemplatesSection } from './components/DocumentTemplatesSection';
import { UsersSection } from './components/UsersSection';

type Tab = 'settings' | 'crm';
type Session = { user: AuthUser; office: Office };

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = still checking
  const [profile, setProfile] = useState<OfficeProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('crm');

  useEffect(() => {
    api
      .me()
      .then((s) => applySession(s))
      .catch(() => setSession(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A stale 'settings' tab selection from a previous (owner) session must
  // not survive into a new session — a staff login right after an owner
  // logout would otherwise immediately fire the owner-only profile fetch
  // and show a raw 403 error banner instead of the conversations view.
  function applySession(s: Session | null) {
    setSession(s);
    setTab('crm');
    setProfile(null);
    setLoadError(null);
  }

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
    if (session && session.user.role === 'owner' && tab === 'settings') loadProfile(session.office.id);
  }, [session, tab, loadProfile]);

  function refresh() {
    if (session) loadProfile(session.office.id);
  }

  async function logout() {
    await api.logout();
    applySession(null);
  }

  if (session === undefined) {
    return <div className="app-shell" />; // brief flash while checking the session
  }

  if (session === null) {
    return <AuthScreen onAuthenticated={(s) => applySession(s)} />;
  }

  const isOwner = session.user.role === 'owner';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1>{session.office.name}</h1>
            <p>
              מחוברים כ-{session.user.name} ({session.user.role === 'owner' ? 'בעלים' : 'צוות'})
            </p>
          </div>
          <button onClick={logout}>התנתקות</button>
        </div>
      </header>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button className={tab === 'crm' ? 'primary' : ''} onClick={() => setTab('crm')}>
          שיחות, תיקים ודוחות
        </button>
        {isOwner && (
          <button className={tab === 'settings' ? 'primary' : ''} onClick={() => setTab('settings')}>
            הגדרות משרד
          </button>
        )}
      </div>

      {loadError && <p className="status error">{loadError}</p>}

      {tab === 'settings' && isOwner && profile && (
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
          <DocumentTemplatesSection officeId={profile.office.id} />
          <UsersSection officeId={profile.office.id} currentUserId={session.user.id} />
        </>
      )}

      {tab === 'crm' && (
        <>
          <ConversationsPanel officeId={session.office.id} />
          <CasesPanel officeId={session.office.id} />
          <ReportsPanel officeId={session.office.id} />
        </>
      )}
    </div>
  );
}

export default App;
