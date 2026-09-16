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

export function updateUserPasswordHash(userId: string, passwordHash: string): void {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, userId);
}

// ---- password resets ----

export function createPasswordReset(userId: string, tokenHash: string, ttlSeconds: number): void {
  const id = newId();
  const ts = now();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  db.prepare(`INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    userId,
    tokenHash,
    expiresAt,
    ts
  );
}

/** Returns the user id for a valid (existing, unexpired) reset token, or null. */
export function getUserIdForValidResetToken(tokenHash: string): string | null {
  const row = db.prepare(`SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?`).get(tokenHash) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

/** Deletes every outstanding reset token for a user — called once a reset succeeds, so a used or superseded link can't be replayed. */
export function deleteAllResetTokensForUser(userId: string): void {
  db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(userId);
}

function mapUser(r: any): User {
  return { id: r.id, officeId: r.office_id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at };
}

function mapUserWithHash(r: any): UserWithHash {
  return { ...mapUser(r), passwordHash: r.password_hash };
}
