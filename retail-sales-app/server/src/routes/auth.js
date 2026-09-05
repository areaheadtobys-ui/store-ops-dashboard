import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';

const router = Router();

const SESSION_DAYS = 30;
const COOKIE_NAME = 'rsa_session';
const ROLES = ['super_admin', 'area_supervisor', 'store_supervisor', 'pending'];
// Restricts self-service sign-up (not the Users-page admin flow) to a company
// email domain. Empty/unset allows any domain — set this per deployment.
const SIGNUP_EMAIL_DOMAIN = (process.env.SIGNUP_EMAIL_DOMAIN || 'tobys.com').toLowerCase();

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

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, salt, ...rest } = user;
  return rest;
}

function createSession(res, req, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure}`);
}

// Resolves the signed-in user (or null) for a request. Attaches nothing by
// itself — routes call this directly, and the /api gate below stores the
// result on req.user for downstream RBAC checks.
export function getRequestUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user || user.status !== 'active') return null;
  return user;
}

export function isAuthenticated(req) {
  return !!getRequestUser(req);
}

router.get('/status', (req, res) => {
  const hasUsers = !!db.prepare('SELECT id FROM users LIMIT 1').get();
  const user = getRequestUser(req);
  res.json({
    hasUsers,
    authenticated: !!user,
    user: sanitizeUser(user),
    signupEmailDomain: SIGNUP_EMAIL_DOMAIN || null,
  });
});

// First-run only: creates the initial Super Admin account. Once any user
// exists, this is closed off — further accounts are created from the Users
// admin page by a signed-in Super Admin.
router.post('/setup', (req, res) => {
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existing) return res.status(409).json({ error: 'Setup has already been completed' });

  const { name, email, password } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, salt, role, status)
    VALUES (?, ?, ?, ?, 'super_admin', 'active')
  `).run(name.trim(), email.trim().toLowerCase(), hash, salt);

  createSession(res, req, info.lastInsertRowid);
  res.json({ ok: true });
});

// Self-service sign-up (distinct from /setup, which only ever creates the
// first Super Admin). Anyone with a matching-domain email can create their
// own account, but it starts as role 'pending' — no area/store, no access
// to anything (see rbac.js: allowedAreaIds returns [] for any role other
// than the three assigned ones) — until a Super Admin assigns them a real
// role from the Users page.
router.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const trimmedEmail = String(email || '').trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) return res.status(400).json({ error: 'A valid email is required' });
  if (SIGNUP_EMAIL_DOMAIN && !trimmedEmail.endsWith(`@${SIGNUP_EMAIL_DOMAIN}`)) {
    return res.status(400).json({ error: `Only @${SIGNUP_EMAIL_DOMAIN} addresses can sign up` });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  try {
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, status)
      VALUES (?, ?, ?, ?, 'pending', 'active')
    `).run(name.trim(), trimmedEmail, hash, salt);
    createSession(res, req, info.lastInsertRowid);
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Incorrect email or password' });

  const hash = hashPassword(password || '', user.salt);
  const valid = hash.length === user.password_hash.length
    && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.password_hash));
  if (!valid) return res.status(401).json({ error: 'Incorrect email or password' });

  createSession(res, req, user.id);
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
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const currentHash = hashPassword(currentPassword || '', user.salt);
  const valid = crypto.timingSafeEqual(Buffer.from(currentHash), Buffer.from(user.password_hash));
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  db.prepare(`UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, salt, user.id);
  // Only this user's other sessions are invalidated, not everyone's.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(
    user.id,
    parseCookies(req)[COOKIE_NAME] || '',
  );
  res.json({ ok: true });
});

export { ROLES, hashPassword, sanitizeUser };
export default router;
