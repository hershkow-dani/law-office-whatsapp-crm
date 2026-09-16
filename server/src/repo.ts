import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import type {
  Office,
  WhatsappConnection,
  RepresentativeIdentity,
  DisclosureSettings,
  ConversationStyle,
  PracticeArea,
  ServiceRegionsConfig,
  ServiceRegion,
  BusinessHour,
  Holiday,
  AfterHoursPolicy,
  StaffMember,
  HandoffRule,
  OfficeProfile,
} from './types.js';

const now = () => new Date().toISOString();
export const newId = () => randomUUID();

// ---- offices ----

export function createOffice(input: { name: string; logoUrl?: string | null; address?: string | null }): Office {
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO offices (id, name, logo_url, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.logoUrl ?? null, input.address ?? null, ts, ts);
  return getOffice(id)!;
}

export function listOffices(): Office[] {
  const rows = db.prepare(`SELECT * FROM offices ORDER BY created_at DESC`).all() as any[];
  return rows.map(mapOffice);
}

export function deleteOffice(id: string): boolean {
  const result = db.prepare(`DELETE FROM offices WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function getOffice(id: string): Office | null {
  const row = db.prepare(`SELECT * FROM offices WHERE id = ?`).get(id) as any;
  return row ? mapOffice(row) : null;
}

export function updateOffice(
  id: string,
  input: { name?: string; logoUrl?: string | null; address?: string | null }
): Office | null {
  const existing = getOffice(id);
  if (!existing) return null;
  const ts = now();
  db.prepare(
    `UPDATE offices SET name = ?, logo_url = ?, address = ?, updated_at = ? WHERE id = ?`
  ).run(
    input.name ?? existing.name,
    input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
    input.address !== undefined ? input.address : existing.address,
    ts,
    id
  );
  return getOffice(id);
}

function mapOffice(row: any): Office {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    address: row.address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- whatsapp connection ----

export function setWhatsappConnection(
  officeId: string,
  input: {
    numberType: 'existing' | 'dedicated';
    phoneNumber: string;
    displayName?: string | null;
    provider?: string | null;
    notes?: string | null;
    providerPhoneNumberId?: string | null;
  }
): WhatsappConnection {
  const ts = now();
  const webhookVerifyToken = getWhatsappConnection(officeId)?.webhookVerifyToken ?? randomUUID();
  db.prepare(
    `INSERT INTO whatsapp_connections (office_id, number_type, phone_number, display_name, connection_status, provider, notes, webhook_verify_token, provider_phone_number_id, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET
       number_type = excluded.number_type,
       phone_number = excluded.phone_number,
       display_name = excluded.display_name,
       provider = excluded.provider,
       notes = excluded.notes,
       provider_phone_number_id = excluded.provider_phone_number_id,
       updated_at = excluded.updated_at`
  ).run(
    officeId,
    input.numberType,
    input.phoneNumber,
    input.displayName ?? null,
    input.provider ?? null,
    input.notes ?? null,
    webhookVerifyToken,
    input.providerPhoneNumberId ?? null,
    ts
  );
  return getWhatsappConnection(officeId)!;
}

export function regenerateWebhookVerifyToken(officeId: string): WhatsappConnection | null {
  if (!getWhatsappConnection(officeId)) return null;
  db.prepare(`UPDATE whatsapp_connections SET webhook_verify_token = ?, updated_at = ? WHERE office_id = ?`).run(randomUUID(), now(), officeId);
  return getWhatsappConnection(officeId);
}

export function getWhatsappConnection(officeId: string): WhatsappConnection | null {
  const row = db.prepare(`SELECT * FROM whatsapp_connections WHERE office_id = ?`).get(officeId) as any;
  if (!row) return null;
  return {
    officeId: row.office_id,
    numberType: row.number_type,
    phoneNumber: row.phone_number,
    displayName: row.display_name,
    connectionStatus: row.connection_status,
    provider: row.provider,
    notes: row.notes,
    webhookVerifyToken: row.webhook_verify_token,
    providerPhoneNumberId: row.provider_phone_number_id,
    updatedAt: row.updated_at,
  };
}

// ---- representative identity ----

export function setRepresentative(
  officeId: string,
  input: { name: string; role: 'secretary' | 'representative' | 'digital_assistant' }
): RepresentativeIdentity {
  const ts = now();
  db.prepare(
    `INSERT INTO representative_identity (office_id, name, role, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET name = excluded.name, role = excluded.role, updated_at = excluded.updated_at`
  ).run(officeId, input.name, input.role, ts);
  return getRepresentative(officeId)!;
}

export function getRepresentative(officeId: string): RepresentativeIdentity | null {
  const row = db.prepare(`SELECT * FROM representative_identity WHERE office_id = ?`).get(officeId) as any;
  if (!row) return null;
  return { officeId: row.office_id, name: row.name, role: row.role, updatedAt: row.updated_at };
}

// ---- disclosure settings ----

export function setDisclosure(officeId: string, input: { enabled: boolean; messageText: string }): DisclosureSettings {
  const ts = now();
  db.prepare(
    `INSERT INTO disclosure_settings (office_id, enabled, message_text, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET enabled = excluded.enabled, message_text = excluded.message_text, updated_at = excluded.updated_at`
  ).run(officeId, input.enabled ? 1 : 0, input.messageText, ts);
  return getDisclosure(officeId)!;
}

export function getDisclosure(officeId: string): DisclosureSettings | null {
  const row = db.prepare(`SELECT * FROM disclosure_settings WHERE office_id = ?`).get(officeId) as any;
  if (!row) return null;
  return { officeId: row.office_id, enabled: !!row.enabled, messageText: row.message_text, updatedAt: row.updated_at };
}

// ---- conversation style ----

export function setStyle(
  officeId: string,
  input: { tone: 'professional' | 'warm' | 'businesslike' | 'formal'; customNotes?: string | null }
): ConversationStyle {
  const ts = now();
  db.prepare(
    `INSERT INTO conversation_style (office_id, tone, custom_notes, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET tone = excluded.tone, custom_notes = excluded.custom_notes, updated_at = excluded.updated_at`
  ).run(officeId, input.tone, input.customNotes ?? null, ts);
  return getStyle(officeId)!;
}

export function getStyle(officeId: string): ConversationStyle | null {
  const row = db.prepare(`SELECT * FROM conversation_style WHERE office_id = ?`).get(officeId) as any;
  if (!row) return null;
  return { officeId: row.office_id, tone: row.tone, customNotes: row.custom_notes, updatedAt: row.updated_at };
}

// ---- practice areas ----

export function listPracticeAreas(officeId: string): PracticeArea[] {
  const rows = db.prepare(`SELECT * FROM practice_areas WHERE office_id = ?`).all(officeId) as any[];
  return rows.map((r) => ({ id: r.id, officeId: r.office_id, name: r.name, parentId: r.parent_id }));
}

export function addPracticeArea(officeId: string, input: { name: string; parentId?: string | null }): PracticeArea {
  const id = newId();
  db.prepare(`INSERT INTO practice_areas (id, office_id, name, parent_id) VALUES (?, ?, ?, ?)`).run(
    id,
    officeId,
    input.name,
    input.parentId ?? null
  );
  return { id, officeId, name: input.name, parentId: input.parentId ?? null };
}

export function deletePracticeArea(officeId: string, id: string): boolean {
  const result = db.prepare(`DELETE FROM practice_areas WHERE office_id = ? AND id = ?`).run(officeId, id);
  return result.changes > 0;
}

// ---- service regions ----

export function setServiceRegionsConfig(officeId: string, input: { mode: 'national' | 'regional' }): ServiceRegionsConfig {
  const ts = now();
  db.prepare(
    `INSERT INTO service_regions_config (office_id, mode, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at`
  ).run(officeId, input.mode, ts);
  return getServiceRegionsConfig(officeId)!;
}

export function getServiceRegionsConfig(officeId: string): ServiceRegionsConfig | null {
  const row = db.prepare(`SELECT * FROM service_regions_config WHERE office_id = ?`).get(officeId) as any;
  if (!row) return null;
  return { officeId: row.office_id, mode: row.mode, updatedAt: row.updated_at };
}

export function listServiceRegions(officeId: string): ServiceRegion[] {
  const rows = db.prepare(`SELECT * FROM service_regions WHERE office_id = ?`).all(officeId) as any[];
  return rows.map((r) => ({ id: r.id, officeId: r.office_id, regionName: r.region_name, courtType: r.court_type, serviceType: r.service_type }));
}

export function replaceServiceRegions(
  officeId: string,
  regions: { regionName: string; courtType?: string | null; serviceType?: string | null }[]
): ServiceRegion[] {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM service_regions WHERE office_id = ?`).run(officeId);
    const stmt = db.prepare(`INSERT INTO service_regions (id, office_id, region_name, court_type, service_type) VALUES (?, ?, ?, ?, ?)`);
    for (const r of regions) {
      stmt.run(newId(), officeId, r.regionName, r.courtType ?? null, r.serviceType ?? null);
    }
  });
  tx();
  return listServiceRegions(officeId);
}

// ---- business hours ----

export function listBusinessHours(officeId: string): BusinessHour[] {
  const rows = db.prepare(`SELECT * FROM business_hours WHERE office_id = ? ORDER BY day_of_week`).all(officeId) as any[];
  return rows.map(mapBusinessHour);
}

export function replaceBusinessHours(
  officeId: string,
  hours: { dayOfWeek: number; isClosed: boolean; openTime?: string | null; closeTime?: string | null }[]
): BusinessHour[] {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM business_hours WHERE office_id = ?`).run(officeId);
    const stmt = db.prepare(
      `INSERT INTO business_hours (id, office_id, day_of_week, is_closed, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const h of hours) {
      stmt.run(newId(), officeId, h.dayOfWeek, h.isClosed ? 1 : 0, h.openTime ?? null, h.closeTime ?? null);
    }
  });
  tx();
  return listBusinessHours(officeId);
}

function mapBusinessHour(r: any): BusinessHour {
  return { id: r.id, officeId: r.office_id, dayOfWeek: r.day_of_week, isClosed: !!r.is_closed, openTime: r.open_time, closeTime: r.close_time };
}

// ---- holidays ----

export function listHolidays(officeId: string): Holiday[] {
  const rows = db.prepare(`SELECT * FROM holidays WHERE office_id = ? ORDER BY date`).all(officeId) as any[];
  return rows.map(mapHoliday);
}

export function addHoliday(officeId: string, input: { date: string; name: string; isRecurringAnnual?: boolean }): Holiday {
  const id = newId();
  db.prepare(`INSERT INTO holidays (id, office_id, date, name, is_recurring_annual) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    officeId,
    input.date,
    input.name,
    input.isRecurringAnnual ? 1 : 0
  );
  return { id, officeId, date: input.date, name: input.name, isRecurringAnnual: !!input.isRecurringAnnual };
}

export function deleteHoliday(officeId: string, id: string): boolean {
  const result = db.prepare(`DELETE FROM holidays WHERE office_id = ? AND id = ?`).run(officeId, id);
  return result.changes > 0;
}

function mapHoliday(r: any): Holiday {
  return { id: r.id, officeId: r.office_id, date: r.date, name: r.name, isRecurringAnnual: !!r.is_recurring_annual };
}

// ---- after hours policy ----

export function setAfterHoursPolicy(
  officeId: string,
  input: { inHoursBehavior: string; outOfHoursBehavior: string; outOfHoursMessage?: string | null }
): AfterHoursPolicy {
  const ts = now();
  db.prepare(
    `INSERT INTO after_hours_policy (office_id, in_hours_behavior, out_of_hours_behavior, out_of_hours_message, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(office_id) DO UPDATE SET in_hours_behavior = excluded.in_hours_behavior, out_of_hours_behavior = excluded.out_of_hours_behavior, out_of_hours_message = excluded.out_of_hours_message, updated_at = excluded.updated_at`
  ).run(officeId, input.inHoursBehavior, input.outOfHoursBehavior, input.outOfHoursMessage ?? null, ts);
  return getAfterHoursPolicy(officeId)!;
}

export function getAfterHoursPolicy(officeId: string): AfterHoursPolicy | null {
  const row = db.prepare(`SELECT * FROM after_hours_policy WHERE office_id = ?`).get(officeId) as any;
  if (!row) return null;
  return {
    officeId: row.office_id,
    inHoursBehavior: row.in_hours_behavior,
    outOfHoursBehavior: row.out_of_hours_behavior,
    outOfHoursMessage: row.out_of_hours_message,
    updatedAt: row.updated_at,
  };
}

// ---- staff ----

export function listStaff(officeId: string): StaffMember[] {
  const rows = db.prepare(`SELECT * FROM staff WHERE office_id = ?`).all(officeId) as any[];
  return rows.map(mapStaff);
}

export function addStaff(
  officeId: string,
  input: {
    name: string;
    role: string;
    permissions?: string[];
    responsibilityAreas?: string[];
    isActive?: boolean;
    photoUrl?: string | null;
  }
): StaffMember {
  const id = newId();
  db.prepare(
    `INSERT INTO staff (id, office_id, name, role, permissions, responsibility_areas, is_active, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    officeId,
    input.name,
    input.role,
    JSON.stringify(input.permissions ?? []),
    JSON.stringify(input.responsibilityAreas ?? []),
    input.isActive === false ? 0 : 1,
    input.photoUrl ?? null
  );
  return getStaffMember(officeId, id)!;
}

export function updateStaff(
  officeId: string,
  id: string,
  input: Partial<{
    name: string;
    role: string;
    permissions: string[];
    responsibilityAreas: string[];
    isActive: boolean;
    photoUrl: string | null;
  }>
): StaffMember | null {
  const existing = getStaffMember(officeId, id);
  if (!existing) return null;
  db.prepare(
    `UPDATE staff SET name = ?, role = ?, permissions = ?, responsibility_areas = ?, is_active = ?, photo_url = ? WHERE office_id = ? AND id = ?`
  ).run(
    input.name ?? existing.name,
    input.role ?? existing.role,
    JSON.stringify(input.permissions ?? existing.permissions),
    JSON.stringify(input.responsibilityAreas ?? existing.responsibilityAreas),
    input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.isActive ? 1 : 0,
    input.photoUrl !== undefined ? input.photoUrl : existing.photoUrl,
    officeId,
    id
  );
  return getStaffMember(officeId, id);
}

export function deleteStaff(officeId: string, id: string): boolean {
  const result = db.prepare(`DELETE FROM staff WHERE office_id = ? AND id = ?`).run(officeId, id);
  return result.changes > 0;
}

function getStaffMember(officeId: string, id: string): StaffMember | null {
  const row = db.prepare(`SELECT * FROM staff WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapStaff(row) : null;
}

function mapStaff(r: any): StaffMember {
  return {
    id: r.id,
    officeId: r.office_id,
    name: r.name,
    role: r.role,
    permissions: JSON.parse(r.permissions),
    responsibilityAreas: JSON.parse(r.responsibility_areas),
    isActive: !!r.is_active,
    photoUrl: r.photo_url,
  };
}

// ---- handoff rules ----

export function listHandoffRules(officeId: string): HandoffRule[] {
  const rows = db.prepare(`SELECT * FROM handoff_rules WHERE office_id = ?`).all(officeId) as any[];
  return rows.map(mapHandoffRule);
}

export function addHandoffRule(
  officeId: string,
  input: { ruleType: 'urgency' | 'area' | 'explicit_request' | 'keyword'; value: string; action?: string; preserveContext?: boolean; isActive?: boolean }
): HandoffRule {
  const id = newId();
  db.prepare(
    `INSERT INTO handoff_rules (id, office_id, rule_type, value, action, preserve_context, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    officeId,
    input.ruleType,
    input.value,
    input.action ?? 'transfer_to_human',
    input.preserveContext === false ? 0 : 1,
    input.isActive === false ? 0 : 1
  );
  return getHandoffRule(officeId, id)!;
}

export function updateHandoffRule(
  officeId: string,
  id: string,
  input: Partial<{ ruleType: 'urgency' | 'area' | 'explicit_request' | 'keyword'; value: string; action: string; preserveContext: boolean; isActive: boolean }>
): HandoffRule | null {
  const existing = getHandoffRule(officeId, id);
  if (!existing) return null;
  db.prepare(
    `UPDATE handoff_rules SET rule_type = ?, value = ?, action = ?, preserve_context = ?, is_active = ? WHERE office_id = ? AND id = ?`
  ).run(
    input.ruleType ?? existing.ruleType,
    input.value ?? existing.value,
    input.action ?? existing.action,
    input.preserveContext !== undefined ? (input.preserveContext ? 1 : 0) : existing.preserveContext ? 1 : 0,
    input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.isActive ? 1 : 0,
    officeId,
    id
  );
  return getHandoffRule(officeId, id);
}

export function deleteHandoffRule(officeId: string, id: string): boolean {
  const result = db.prepare(`DELETE FROM handoff_rules WHERE office_id = ? AND id = ?`).run(officeId, id);
  return result.changes > 0;
}

function getHandoffRule(officeId: string, id: string): HandoffRule | null {
  const row = db.prepare(`SELECT * FROM handoff_rules WHERE office_id = ? AND id = ?`).get(officeId, id) as any;
  return row ? mapHandoffRule(row) : null;
}

function mapHandoffRule(r: any): HandoffRule {
  return {
    id: r.id,
    officeId: r.office_id,
    ruleType: r.rule_type,
    value: r.value,
    action: r.action,
    preserveContext: !!r.preserve_context,
    isActive: !!r.is_active,
  };
}

// ---- full profile ----

export function getOfficeProfile(officeId: string): OfficeProfile | null {
  const office = getOffice(officeId);
  if (!office) return null;
  return {
    office,
    whatsapp: getWhatsappConnection(officeId),
    representative: getRepresentative(officeId),
    disclosure: getDisclosure(officeId),
    style: getStyle(officeId),
    practiceAreas: listPracticeAreas(officeId),
    serviceRegionsConfig: getServiceRegionsConfig(officeId),
    serviceRegions: listServiceRegions(officeId),
    businessHours: listBusinessHours(officeId),
    holidays: listHolidays(officeId),
    afterHoursPolicy: getAfterHoursPolicy(officeId),
    staff: listStaff(officeId),
    handoffRules: listHandoffRules(officeId),
  };
}
