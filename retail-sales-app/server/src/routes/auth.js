import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';

const router = Router();

const SESSION_DAYS = 30;
const COOKIE_NAME = 'rsa_session';

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createSession(res) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`);
}

export function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return false;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return false;
  }
  return true;
}

router.get('/status', (req, res) => {
  const auth = db.prepare('SELECT id FROM app_auth WHERE id = 1').get();
  res.json({ passwordSet: !!auth, authenticated: isAuthenticated(req) });
});

router.post('/setup', (req, res) => {
  const existing = db.prepare('SELECT id FROM app_auth WHERE id = 1').get();
  if (existing) return res.status(409).json({ error: 'A password is already set' });

  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  db.prepare('INSERT INTO app_auth (id, password_hash, salt) VALUES (1, ?, ?)').run(hash, salt);

  createSession(res);
  res.json({ ok: true });
});

router.post('/login', (req, res) => {
  const auth = db.prepare('SELECT * FROM app_auth WHERE id = 1').get();
  if (!auth) return res.status(409).json({ error: 'No password has been set up yet' });

  const { password } = req.body;
  const hash = hashPassword(password || '', auth.salt);
  const valid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(auth.password_hash));
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });

  createSession(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

router.post('/change-password', (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Not signed in' });
  const auth = db.prepare('SELECT * FROM app_auth WHERE id = 1').get();
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const currentHash = hashPassword(currentPassword || '', auth.salt);
  const valid = crypto.timingSafeEqual(Buffer.from(currentHash), Buffer.from(auth.password_hash));
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  db.prepare('UPDATE app_auth SET password_hash = ?, salt = ?, updated_at = datetime(\'now\') WHERE id = 1').run(hash, salt);
  db.prepare('DELETE FROM sessions').run();
  createSession(res);
  res.json({ ok: true });
});

export default router;
