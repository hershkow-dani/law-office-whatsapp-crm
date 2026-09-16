import { Router } from 'express';
import * as repo from '../repo.js';
import * as repoAuth from '../repoAuth.js';
import { hashPassword, verifyPassword, createSessionToken, getSessionSecret, createResetToken, hashResetToken } from '../engine/auth.js';
import { serializeSessionCookie, serializeClearedSessionCookie } from '../engine/cookies.js';
import { requireAuth } from '../middleware/auth.js';
import { getEmailProvider } from '../engine/email.js';

export const authRouter = Router();

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lightweight per-email cooldown so this public endpoint can't be used to
// spam an inbox. Not a substitute for real rate limiting in production
// (in-memory, per-process, resets on restart) — good enough to stop the
// trivial "click send 50 times" case.
const FORGOT_PASSWORD_COOLDOWN_SECONDS = 60;
const lastForgotPasswordRequestAt = new Map<string, number>();

function resetPasswordUrl(rawToken: string): string {
  const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5180';
  return `${origin}/?resetToken=${rawToken}`;
}

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

/**
 * Always responds the same way regardless of whether the email is
 * registered — revealing that would let anyone enumerate which addresses
 * have accounts. If it does match a user, emails a one-time reset link
 * valid for an hour (server/src/engine/email.ts — mock by default, see
 * README for what a real provider needs).
 */
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'valid_email_required' });
  }

  const normalized = email.toLowerCase();
  const lastRequest = lastForgotPasswordRequestAt.get(normalized);
  if (lastRequest && Date.now() - lastRequest < FORGOT_PASSWORD_COOLDOWN_SECONDS * 1000) {
    return res.status(429).json({ error: 'too_many_requests' });
  }
  lastForgotPasswordRequestAt.set(normalized, Date.now());

  const user = repoAuth.getUserByEmailWithHash(email);
  if (user) {
    const { rawToken, tokenHash } = createResetToken();
    repoAuth.createPasswordReset(user.id, tokenHash, RESET_TOKEN_TTL_SECONDS);
    const office = repo.getOffice(user.officeId);
    const link = resetPasswordUrl(rawToken);
    try {
      await getEmailProvider().sendMail(
        user.email,
        `איפוס סיסמה — ${office?.name ?? 'מערכת CRM'}`,
        `שלום ${user.name},\n\nהתקבלה בקשה לאיפוס הסיסמה שלך.\nלאיפוס, היכנס/י לקישור הבא תוך שעה:\n${link}\n\nאם לא ביקשת זאת, אפשר להתעלם מהודעה זו.`
      );
    } catch (e) {
      // A misconfigured email provider shouldn't leak via the response
      // (same enumeration concern as above) — log it server-side instead.
      console.error('Failed to send password reset email:', e);
    }
  }

  res.json({ message: 'אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס סיסמה.' });
});

authRouter.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token_required' });
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'password_min_8_chars' });
  }

  const userId = repoAuth.getUserIdForValidResetToken(hashResetToken(token));
  if (!userId) return res.status(400).json({ error: 'invalid_or_expired_token' });

  repoAuth.updateUserPasswordHash(userId, hashPassword(newPassword));
  repoAuth.deleteAllResetTokensForUser(userId);
  res.status(204).end();
});
