export type NumberType = 'existing' | 'dedicated';
export type ConnectionStatus = 'not_connected' | 'pending' | 'connected';
export type RepresentativeRole = 'secretary' | 'representative' | 'digital_assistant';
export type ConversationTone = 'professional' | 'warm' | 'businesslike' | 'formal';
export type ServiceMode = 'national' | 'regional';
export type HandoffRuleType = 'urgency' | 'area' | 'explicit_request' | 'keyword';

export interface Office {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappConnection {
  officeId: string;
  numberType: NumberType;
  phoneNumber: string;
  displayName: string | null;
  connectionStatus: ConnectionStatus;
  provider: string | null;
  notes: string | null;
  webhookVerifyToken: string | null;
  providerPhoneNumberId: string | null;
  updatedAt: string;
}

export interface RepresentativeIdentity {
  officeId: string;
  name: string;
  role: RepresentativeRole;
  updatedAt: string;
}

export interface DisclosureSettings {
  officeId: string;
  enabled: boolean;
  messageText: string;
  updatedAt: string;
}

export interface ConversationStyle {
  officeId: string;
  tone: ConversationTone;
  customNotes: string | null;
  updatedAt: string;
}

export interface PracticeArea {
  id: string;
  officeId: string;
  name: string;
  parentId: string | null;
  logoUrl: string | null;
}

export interface ServiceRegionsConfig {
  officeId: string;
  mode: ServiceMode;
  updatedAt: string;
}

export interface ServiceRegion {
  id: string;
  officeId: string;
  regionName: string;
  courtType: string | null;
  serviceType: string | null;
  logoUrl: string | null;
}

export interface BusinessHour {
  id: string;
  officeId: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface Holiday {
  id: string;
  officeId: string;
  date: string;
  name: string;
  isRecurringAnnual: boolean;
}

export interface AfterHoursPolicy {
  officeId: string;
  inHoursBehavior: string;
  outOfHoursBehavior: string;
  outOfHoursMessage: string | null;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  officeId: string;
  name: string;
  role: string;
  permissions: string[];
  responsibilityAreas: string[];
  isActive: boolean;
  photoUrl: string | null;
}

export interface HandoffRule {
  id: string;
  officeId: string;
  ruleType: HandoffRuleType;
  value: string;
  action: string;
  preserveContext: boolean;
  isActive: boolean;
}

export type ConversationStatus = 'auto' | 'pending_human' | 'closed';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'client' | 'system' | 'staff';
export type CaseStatus = 'new' | 'in_progress' | 'waiting_client' | 'closed';
export type TaskStatus = 'open' | 'done';

export interface Conversation {
  id: string;
  officeId: string;
  contactPhone: string;
  contactName: string | null;
  contactPhotoUrl: string | null;
  status: ConversationStatus;
  practiceArea: string | null;
  assignedStaffId: string | null;
  everHandoff: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  officeId: string;
  direction: MessageDirection;
  senderType: MessageSenderType;
  text: string;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  officeId: string;
  conversationId: string | null;
  title: string;
  practiceArea: string | null;
  status: CaseStatus;
  assignedStaffId: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseTask {
  id: string;
  caseId: string;
  officeId: string;
  title: string;
  dueDate: string | null;
  assignedStaffId: string | null;
  status: TaskStatus;
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  officeId: string;
  name: string;
  body: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDocument {
  id: string;
  officeId: string;
  caseId: string | null;
  templateId: string | null;
  title: string;
  content: string;
  missingFields: string[];
  logoUrl: string | null;
  createdAt: string;
}

export interface ReportsSummary {
  conversations: { total: number; auto: number; pendingHuman: number; closed: number };
  cases: { total: number; new: number; inProgress: number; waitingClient: number; closed: number };
  handoffRate: number;
  averageScore: number | null;
  averageFirstResponseSeconds: number | null;
}

export interface OfficeProfile {
  office: Office;
  whatsapp: WhatsappConnection | null;
  representative: RepresentativeIdentity | null;
  disclosure: DisclosureSettings | null;
  style: ConversationStyle | null;
  practiceAreas: PracticeArea[];
  serviceRegionsConfig: ServiceRegionsConfig | null;
  serviceRegions: ServiceRegion[];
  businessHours: BusinessHour[];
  holidays: Holiday[];
  afterHoursPolicy: AfterHoursPolicy | null;
  staff: StaffMember[];
  handoffRules: HandoffRule[];
}
