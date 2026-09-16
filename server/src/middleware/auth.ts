import type { Request, Response, NextFunction } from 'express';
import { verifySessionToken, getSessionSecret } from '../engine/auth.js';
import { parseCookies, SESSION_COOKIE_NAME } from '../engine/cookies.js';

/** Reads the session cookie (if any) and attaches req.user — never blocks the request. */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req.header('cookie'));
  const token = cookies[SESSION_COOKIE_NAME];
  const payload = verifySessionToken(token, getSessionSecret());
  if (payload) req.user = payload;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

/** For routes with :officeId in the path — blocks cross-office access. */
export function requireOfficeMatch(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  if (req.user.officeId !== req.params.officeId) return res.status(403).json({ error: 'forbidden' });
  next();
}

export function requireRole(...roles: Array<'owner' | 'staff'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'insufficient_role' });
    next();
  };
}
