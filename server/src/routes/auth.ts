import { Router, Request, Response } from 'express';
import db from '../db';
import { signToken, hashPassword, checkPassword, findUserByEmail, findUserById, validatePassword } from '../auth';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { seedForUser } from '../seed';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row: any) {
  return { id: row.id, email: row.email, created_at: row.created_at };
}

router.post('/register', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  const normalized = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    res.status(400).json({ error: 'EMAIL_INVALID' });
    return;
  }
  const pass = String(password || '');
  const passError = validatePassword(pass);
  if (passError) {
    res.status(400).json({ error: passError });
    return;
  }
  if (findUserByEmail(normalized)) {
    res.status(409).json({ error: 'EMAIL_EXISTS' });
    return;
  }
  let userId: number;
  try {
    userId = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(normalized, hashPassword(pass)).lastInsertRowid as number;
  } catch (e: any) {
    if (String(e?.code || '').includes('CONSTRAINT')) {
      res.status(409).json({ error: 'EMAIL_EXISTS' });
      return;
    }
    throw e;
  }
  try {
    seedForUser(userId);
  } catch (e) {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    console.error('Fallo el seed del usuario', e);
    res.status(500).json({ error: 'REGISTER_FAILED' });
    return;
  }
  const user = findUserById(userId);
  res.status(201).json({ token: signToken({ id: user.id, email: user.email }), user: publicUser(user) });
});

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  const user = findUserByEmail(String(email || ''));
  if (!user || !checkPassword(String(password || ''), user.password_hash)) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    return;
  }
  res.json({ token: signToken({ id: user.id, email: user.email }), user: publicUser(user) });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = findUserById(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'USER_NOT_FOUND' });
    return;
  }
  res.json({ user: publicUser(user) });
});

router.post('/change-password', requireAuth, (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = findUserById(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'USER_NOT_FOUND' });
    return;
  }
  if (!checkPassword(String(currentPassword || ''), user.password_hash)) {
    res.status(400).json({ error: 'CURRENT_PASSWORD_INCORRECT' });
    return;
  }
  const pass = String(newPassword || '');
  const passError = validatePassword(pass);
  if (passError) {
    res.status(400).json({ error: passError });
    return;
  }
  if (checkPassword(pass, user.password_hash)) {
    res.status(400).json({ error: 'PASSWORD_SAME' });
    return;
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pass), user.id);
  res.json({ ok: true });
});

export default router;
