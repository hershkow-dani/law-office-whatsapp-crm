export type NumberType = 'existing' | 'dedicated';
export type ConnectionStatus = 'not_connected' | 'pending' | 'connected';
export type RepresentativeRole = 'secretary' | 'representative' | 'digital_assistant';
export type ConversationTone = 'professional' | 'warm' | 'businesslike' | 'formal';
export type ServiceMode = 'national' | 'regional';
export type HandoffRuleType = 'urgency' | 'area' | 'explicit_request' | 'keyword';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

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
}

export interface BusinessHour {
  id: string;
  officeId: string;
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  isClosed: boolean;
  openTime: string | null; // "HH:MM"
  closeTime: string | null; // "HH:MM"
}

export interface Holiday {
  id: string;
  officeId: string;
  date: string; // ISO date "YYYY-MM-DD"
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
