import type {
  Office,
  OfficeProfile,
  WhatsappConnection,
  RepresentativeIdentity,
  DisclosureSettings,
  ConversationStyle,
  PracticeArea,
  ServiceRegion,
  ServiceRegionsConfig,
  BusinessHour,
  Holiday,
  AfterHoursPolicy,
  StaffMember,
  HandoffRule,
  Conversation,
  Message,
  CaseRecord,
  CaseTask,
  CaseStatus,
  ReportsSummary,
} from './types';

async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const base = '/api/offices';

export const api = {
  listOffices: () => http<Office[]>(base),
  createOffice: (input: { name: string; logoUrl?: string | null; address?: string | null }) =>
    http<Office>(base, { method: 'POST', body: JSON.stringify(input) }),
  getOfficeProfile: (id: string) => http<OfficeProfile>(`${base}/${id}`),
  updateOffice: (id: string, input: Partial<{ name: string; logoUrl: string | null; address: string | null }>) =>
    http<Office>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteOffice: (id: string) => http<void>(`${base}/${id}`, { method: 'DELETE' }),

  setWhatsapp: (
    id: string,
    input: { numberType: 'existing' | 'dedicated'; phoneNumber: string; displayName?: string | null; provider?: string | null; notes?: string | null }
  ) => http<WhatsappConnection>(`${base}/${id}/whatsapp`, { method: 'PUT', body: JSON.stringify(input) }),

  setRepresentative: (id: string, input: { name: string; role: RepresentativeIdentity['role'] }) =>
    http<RepresentativeIdentity>(`${base}/${id}/representative`, { method: 'PUT', body: JSON.stringify(input) }),

  setDisclosure: (id: string, input: { enabled: boolean; messageText: string }) =>
    http<DisclosureSettings>(`${base}/${id}/disclosure`, { method: 'PUT', body: JSON.stringify(input) }),

  setStyle: (id: string, input: { tone: ConversationStyle['tone']; customNotes?: string | null }) =>
    http<ConversationStyle>(`${base}/${id}/style`, { method: 'PUT', body: JSON.stringify(input) }),

  addPracticeArea: (id: string, input: { name: string; parentId?: string | null }) =>
    http<PracticeArea>(`${base}/${id}/practice-areas`, { method: 'POST', body: JSON.stringify(input) }),
  deletePracticeArea: (id: string, areaId: string) =>
    http<void>(`${base}/${id}/practice-areas/${areaId}`, { method: 'DELETE' }),

  setServiceRegions: (id: string, input: { mode: ServiceRegionsConfig['mode']; regions: Omit<ServiceRegion, 'id' | 'officeId'>[] }) =>
    http<{ config: ServiceRegionsConfig; regions: ServiceRegion[] }>(`${base}/${id}/service-regions`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  setBusinessHours: (id: string, hours: Omit<BusinessHour, 'id' | 'officeId'>[]) =>
    http<BusinessHour[]>(`${base}/${id}/business-hours`, { method: 'PUT', body: JSON.stringify({ hours }) }),

  addHoliday: (id: string, input: { date: string; name: string; isRecurringAnnual?: boolean }) =>
    http<Holiday>(`${base}/${id}/holidays`, { method: 'POST', body: JSON.stringify(input) }),
  deleteHoliday: (id: string, holidayId: string) => http<void>(`${base}/${id}/holidays/${holidayId}`, { method: 'DELETE' }),

  setAfterHours: (id: string, input: { inHoursBehavior: string; outOfHoursBehavior: string; outOfHoursMessage?: string | null }) =>
    http<AfterHoursPolicy>(`${base}/${id}/after-hours`, { method: 'PUT', body: JSON.stringify(input) }),

  addStaff: (id: string, input: { name: string; role: string; permissions?: string[]; responsibilityAreas?: string[] }) =>
    http<StaffMember>(`${base}/${id}/staff`, { method: 'POST', body: JSON.stringify(input) }),
  updateStaff: (id: string, staffId: string, input: Partial<StaffMember>) =>
    http<StaffMember>(`${base}/${id}/staff/${staffId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteStaff: (id: string, staffId: string) => http<void>(`${base}/${id}/staff/${staffId}`, { method: 'DELETE' }),

  addHandoffRule: (id: string, input: { ruleType: HandoffRule['ruleType']; value: string; preserveContext?: boolean }) =>
    http<HandoffRule>(`${base}/${id}/handoff-rules`, { method: 'POST', body: JSON.stringify(input) }),
  updateHandoffRule: (id: string, ruleId: string, input: Partial<HandoffRule>) =>
    http<HandoffRule>(`${base}/${id}/handoff-rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteHandoffRule: (id: string, ruleId: string) => http<void>(`${base}/${id}/handoff-rules/${ruleId}`, { method: 'DELETE' }),

  // ---- Stage B: conversations, cases, tasks, reports ----

  listConversations: (id: string) => http<Conversation[]>(`${base}/${id}/conversations`),
  createConversation: (id: string, input: { contactPhone: string; contactName?: string | null }) =>
    http<Conversation>(`${base}/${id}/conversations`, { method: 'POST', body: JSON.stringify(input) }),
  getConversation: (id: string, conversationId: string) =>
    http<{ conversation: Conversation; messages: Message[] }>(`${base}/${id}/conversations/${conversationId}`),
  sendInbound: (id: string, conversationId: string, input: { text: string; explicitHumanRequest?: boolean }) =>
    http<{ conversation: Conversation; autoReplied: boolean; replyText?: string }>(`${base}/${id}/conversations/${conversationId}/inbound`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  sendOutbound: (id: string, conversationId: string, input: { text: string }) =>
    http<Message>(`${base}/${id}/conversations/${conversationId}/outbound`, { method: 'POST', body: JSON.stringify(input) }),
  closeConversation: (id: string, conversationId: string) =>
    http<Conversation>(`${base}/${id}/conversations/${conversationId}/close`, { method: 'POST' }),
  resumeAutoConversation: (id: string, conversationId: string) =>
    http<Conversation>(`${base}/${id}/conversations/${conversationId}/resume-auto`, { method: 'POST' }),

  listCases: (id: string, status?: CaseStatus) =>
    http<CaseRecord[]>(`${base}/${id}/cases${status ? `?status=${status}` : ''}`),
  createCase: (id: string, input: { title: string; conversationId?: string | null; practiceArea?: string | null }) =>
    http<CaseRecord>(`${base}/${id}/cases`, { method: 'POST', body: JSON.stringify(input) }),
  getCase: (id: string, caseId: string) => http<{ case: CaseRecord; tasks: CaseTask[] }>(`${base}/${id}/cases/${caseId}`),
  updateCase: (id: string, caseId: string, input: Partial<{ title: string; status: CaseStatus }>) =>
    http<CaseRecord>(`${base}/${id}/cases/${caseId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  scoreCase: (id: string, caseId: string) => http<CaseRecord>(`${base}/${id}/cases/${caseId}/score`, { method: 'POST' }),
  addTask: (id: string, caseId: string, input: { title: string; dueDate?: string | null }) =>
    http<CaseTask>(`${base}/${id}/cases/${caseId}/tasks`, { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: string, caseId: string, taskId: string, input: Partial<{ status: TaskStatusUpdate }>) =>
    http<CaseTask>(`${base}/${id}/cases/${caseId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) }),

  getReportsSummary: (id: string) => http<ReportsSummary>(`${base}/${id}/reports/summary`),
};

type TaskStatusUpdate = 'open' | 'done';
