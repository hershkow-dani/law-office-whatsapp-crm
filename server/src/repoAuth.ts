import { db } from './db.js';
import { newId } from './repo.js';

export interface User {
  id: string;
  officeId: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  createdAt: string;
}

interface UserWithHash extends User {
  passwordHash: string;
}

const now = () => new Date().toISOString();

export function createUser(input: { officeId: string; name: string; email: string; passwordHash: string; role: 'owner' | 'staff' }): User {
  const id = newId();
  const ts = now();
  db.prepare(`INSERT INTO users (id, office_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    input.officeId,
    input.name,
    input.email.toLowerCase(),
    input.passwordHash,
    input.role,
    ts
  );
  return getUserById(id)!;
}

export function getUserByEmailWithHash(email: string): UserWithHash | null {
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as any;
  return row ? mapUserWithHash(row) : null;
}

export function getUserById(id: string): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any;
  return row ? mapUser(row) : null;
}

export function listUsersForOffice(officeId: string): User[] {
  const rows = db.prepare(`SELECT * FROM users WHERE office_id = ? ORDER BY created_at ASC`).all(officeId) as any[];
  return rows.map(mapUser);
}

export function countOwners(officeId: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE office_id = ? AND role = 'owner'`).get(officeId) as { n: number };
  return row.n;
}

export function deleteUser(officeId: string, id: string): boolean {
  const result = db.prepare(`DELETE FROM users WHERE office_id = ? AND id = ?`).run(officeId, id);
  return result.changes > 0;
}

function mapUser(r: any): User {
  return { id: r.id, officeId: r.office_id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at };
}

function mapUserWithHash(r: any): UserWithHash {
  return { ...mapUser(r), passwordHash: r.password_hash };
}
