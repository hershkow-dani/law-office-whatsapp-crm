import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from 'node:crypto';

const SCRYPT_KEYLEN = 64;

/**
 * Password-reset tokens are high-entropy random values (not user-chosen
 * secrets), so a plain salted SHA-256 hash is enough — no need for scrypt's
 * deliberate slowness. Only the hash is stored; the raw token goes out in
 * the email link and is never persisted.
 */
export function createResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashResetToken(rawToken) };
}

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Hashes a password as "salt:hash" (both hex) using scrypt — no external dependency needed. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export interface SessionPayload {
  userId: string;
  officeId: string;
  role: 'owner' | 'staff';
  exp: number; // unix seconds
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Signs a small session payload as "<base64url(json)>.<hmac-hex>" — a minimal
 * hand-rolled equivalent of a JWT, avoiding an extra dependency for what's
 * just an HMAC-signed, timestamped cookie value.
 */
export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, secret: string, maxAgeSeconds = 60 * 60 * 24 * 30): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  const body = base64url(JSON.stringify(full));
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expectedSignature = createHmac('sha256', secret).update(body).digest('hex');
  const expected = Buffer.from(expectedSignature, 'hex');
  const actual = Buffer.from(signature, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.userId || !payload.officeId || (payload.role !== 'owner' && payload.role !== 'staff')) return null;
    return payload;
  } catch {
    return null;
  }
}

let cachedSecret: string | null = null;

/**
 * SESSION_SECRET should be set in production so sessions survive restarts
 * and can't be forged by anyone who can read process memory of a different
 * deploy. Falls back to a random in-memory secret for local/dev use so the
 * app works out of the box — every restart just logs everyone out.
 */
export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!cachedSecret) {
    cachedSecret = randomBytes(32).toString('hex');
    console.warn('SESSION_SECRET is not set — using a random in-memory secret (sessions will not survive a restart). Set SESSION_SECRET in production.');
  }
  return cachedSecret;
}

export function resetSessionSecretForTests(): void {
  cachedSecret = null;
}
