import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'crm.db');

if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS offices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  office_id TEXT PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  number_type TEXT NOT NULL CHECK (number_type IN ('existing','dedicated')),
  phone_number TEXT NOT NULL,
  display_name TEXT,
  connection_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (connection_status IN ('not_connected','pending','connected')),
  provider TEXT,
  notes TEXT,
  webhook_verify_token TEXT,
  provider_phone_number_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS representative_identity (
  office_id TEXT PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('secretary','representative','digital_assistant')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disclosure_settings (
  office_id TEXT PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  message_text TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_style (
  office_id TEXT PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  tone TEXT NOT NULL CHECK (tone IN ('professional','warm','businesslike','formal')),
  custom_notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_areas (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES practice_areas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_regions_config (
  office_id TEXT PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('national','regional')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_regions (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  region_name TEXT NOT NULL,
  court_type TEXT,
  service_type TEXT
);

CREATE TABLE IF NOT EXISTS business_hours (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed INTEGER NOT NULL DEFAULT 0,
  open_time TEXT,
  close_time TEXT,
  UNIQUE(office_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  is_recurring_annual INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS after_hours_policy (
  office_id TEXT PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  in_hours_behavior TEXT NOT NULL,
  out_of_hours_behavior TEXT NOT NULL,
  out_of_hours_message TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  responsibility_areas TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  photo_url TEXT
);

CREATE TABLE IF NOT EXISTS handoff_rules (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('urgency','area','explicit_request','keyword')),
  value TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'transfer_to_human',
  preserve_context INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  contact_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'auto' CHECK (status IN ('auto','pending_human','closed')),
  practice_area TEXT,
  assigned_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  ever_handoff INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client','system','staff')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  practice_area TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','waiting_client','closed')),
  assigned_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  score INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_tasks (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT,
  assigned_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES document_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  missing_fields TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
`);
