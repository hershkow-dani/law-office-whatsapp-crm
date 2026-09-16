import { Router } from 'express';
import * as repoAuth from '../repoAuth.js';
import { hashPassword } from '../engine/auth.js';
import { requireRole } from '../middleware/auth.js';

export const usersRouter = Router({ mergeParams: true });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

usersRouter.get('/', (req: any, res) => {
  res.json(repoAuth.listUsersForOffice(req.params.officeId));
});

usersRouter.post('/', requireRole('owner'), (req: any, res) => {
  const officeId = req.params.officeId;
  const { name, email, password, role } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name_required' });
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'valid_email_required' });
  if (!password || typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'password_min_8_chars' });
  if (role !== 'owner' && role !== 'staff') return res.status(400).json({ error: 'invalid_role' });
  if (repoAuth.getUserByEmailWithHash(email)) return res.status(409).json({ error: 'email_already_registered' });

  const user = repoAuth.createUser({ officeId, name: name.trim(), email, passwordHash: hashPassword(password), role });
  res.status(201).json(user);
});

usersRouter.delete('/:userId', requireRole('owner'), (req: any, res) => {
  const officeId = req.params.officeId;
  const target = repoAuth.listUsersForOffice(officeId).find((u) => u.id === req.params.userId);
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.role === 'owner' && repoAuth.countOwners(officeId) <= 1) {
    return res.status(400).json({ error: 'cannot_remove_last_owner' });
  }
  const ok = repoAuth.deleteUser(officeId, req.params.userId);
  res.status(ok ? 204 : 404).end();
});
