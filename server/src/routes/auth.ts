import { Router } from 'express';
import * as repo from '../repo.js';
import * as repoAuth from '../repoAuth.js';
import { hashPassword, verifyPassword, createSessionToken, getSessionSecret } from '../engine/auth.js';
import { serializeSessionCookie, serializeClearedSessionCookie } from '../engine/cookies.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setSessionCookie(res: any, payload: { userId: string; officeId: string; role: 'owner' | 'staff' }) {
  const token = createSessionToken(payload, getSessionSecret(), SESSION_MAX_AGE_SECONDS);
  res.setHeader('Set-Cookie', serializeSessionCookie(token, SESSION_MAX_AGE_SECONDS));
}

/**
 * Creates a brand-new office together with its first (owner) user, in one
 * step — there is no other way to create an office anymore, so every office
 * always has at least one account able to log in and manage it.
 */
authRouter.post('/register', (req, res) => {
  const { officeName, name, email, password } = req.body ?? {};
  if (!officeName || typeof officeName !== 'string' || !officeName.trim()) {
    return res.status(400).json({ error: 'office_name_required' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name_required' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'valid_email_required' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password_min_8_chars' });
  }
  if (repoAuth.getUserByEmailWithHash(email)) {
    return res.status(409).json({ error: 'email_already_registered' });
  }

  const office = repo.createOffice({ name: officeName.trim() });
  const user = repoAuth.createUser({
    officeId: office.id,
    name: name.trim(),
    email,
    passwordHash: hashPassword(password),
    role: 'owner',
  });

  setSessionCookie(res, { userId: user.id, officeId: office.id, role: user.role });
  res.status(201).json({ user, office });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });

  const user = repoAuth.getUserByEmailWithHash(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const office = repo.getOffice(user.officeId);
  if (!office) return res.status(500).json({ error: 'office_missing' });

  setSessionCookie(res, { userId: user.id, officeId: user.officeId, role: user.role });
  const { passwordHash: _passwordHash, ...publicUser } = user;
  res.json({ user: publicUser, office });
});

authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', serializeClearedSessionCookie());
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = repoAuth.getUserById(req.user!.userId);
  const office = repo.getOffice(req.user!.officeId);
  if (!user || !office) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ user, office });
});
