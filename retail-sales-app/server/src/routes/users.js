import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { requireSuperAdmin } from '../rbac.js';
import { ROLES, hashPassword, sanitizeUser } from './auth.js';

const router = Router();

// User management is Super Admin only — area/store supervisors don't manage
// accounts, only their assigned scope of stores and sales data.
router.use(requireSuperAdmin);

router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.*, a.area_name, s.name AS store_name
    FROM users u
    LEFT JOIN areas a ON a.id = u.area_id
    LEFT JOIN stores s ON s.id = u.store_id
    ORDER BY u.name
  `).all();
  res.json(users.map(sanitizeUser));
});

function validateAssignment(role, area_id, store_id) {
  if (!ROLES.includes(role)) return 'Invalid role';
  if (role === 'area_supervisor' && !area_id) return 'Area Supervisor requires an area';
  if (role === 'store_supervisor' && !store_id) return 'Store Supervisor requires a store';
  return null;
}

router.post('/', (req, res) => {
  const { name, email, password, role, area_id, store_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const assignmentError = validateAssignment(role, area_id, store_id);
  if (assignmentError) return res.status(400).json({ error: assignmentError });

  let resolvedAreaId = role === 'area_supervisor' ? Number(area_id) : null;
  let resolvedStoreId = role === 'store_supervisor' ? Number(store_id) : null;
  if (role === 'store_supervisor') {
    const store = db.prepare('SELECT area_id FROM stores WHERE id = ?').get(resolvedStoreId);
    if (!store) return res.status(400).json({ error: 'Store not found' });
    resolvedAreaId = store.area_id;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  try {
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, area_id, store_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(name.trim(), email.trim().toLowerCase(), hash, salt, role, resolvedAreaId, resolvedStoreId);
    res.status(201).json(sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, role, area_id, store_id, status, password } = req.body;
  const nextRole = role || user.role;
  let nextAreaId = area_id !== undefined ? (area_id ? Number(area_id) : null) : user.area_id;
  let nextStoreId = store_id !== undefined ? (store_id ? Number(store_id) : null) : user.store_id;

  const assignmentError = validateAssignment(nextRole, nextAreaId, nextStoreId);
  if (assignmentError) return res.status(400).json({ error: assignmentError });

  if (nextRole === 'store_supervisor') {
    const store = db.prepare('SELECT area_id FROM stores WHERE id = ?').get(nextStoreId);
    if (!store) return res.status(400).json({ error: 'Store not found' });
    nextAreaId = store.area_id;
  } else if (nextRole === 'super_admin') {
    nextAreaId = null;
    nextStoreId = null;
  } else if (nextRole === 'area_supervisor') {
    nextStoreId = null;
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status must be "active" or "inactive"' });
  }
  if (status === 'inactive' && user.role === 'super_admin') {
    const activeAdmins = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin' AND status = 'active' AND id != ?`).get(user.id).c;
    if (activeAdmins === 0) return res.status(400).json({ error: 'Cannot deactivate the last active Super Admin' });
  }

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name), role = ?, area_id = ?, store_id = ?,
      status = COALESCE(?, status), updated_at = datetime('now')
    WHERE id = ?
  `).run(name ?? null, nextRole, nextAreaId, nextStoreId, status ?? null, req.params.id);

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, req.params.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  }

  res.json(sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account' });
  if (user.role === 'super_admin') {
    const otherAdmins = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin' AND id != ?`).get(user.id).c;
    if (otherAdmins === 0) return res.status(400).json({ error: 'Cannot remove the last Super Admin' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

export default router;
