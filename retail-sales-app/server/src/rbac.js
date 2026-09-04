import db from './db.js';

// Every route that reads or writes area/store-scoped data goes through these
// helpers so the three roles (super_admin, area_supervisor, store_supervisor)
// are enforced in one place instead of re-implemented per route.
//
// allowedAreaIds(user):
//   null   -> unrestricted (super_admin only)
//   [id]   -> restricted to exactly this one area
//   []     -> no access (e.g. a store_supervisor whose store was deleted)

export function allowedAreaIds(user) {
  if (user.role === 'super_admin') return null;
  if (user.role === 'area_supervisor') return user.area_id ? [user.area_id] : [];
  if (user.role === 'store_supervisor') {
    const store = db.prepare('SELECT area_id FROM stores WHERE id = ?').get(user.store_id);
    return store ? [store.area_id] : [];
  }
  return [];
}

export function canAccessArea(user, areaId) {
  const allowed = allowedAreaIds(user);
  if (allowed === null) return true;
  return allowed.includes(Number(areaId));
}

export function canAccessStore(user, storeId) {
  if (user.role === 'store_supervisor') return Number(storeId) === Number(user.store_id);
  const store = db.prepare('SELECT area_id FROM stores WHERE id = ?').get(storeId);
  if (!store) return false;
  return canAccessArea(user, store.area_id);
}

// Resolves an incoming `areaId` query/body value ('all' | number | absent)
// against what this user is allowed to see.
// Returns { areaId, ok }. areaId === null means "every area" (company-wide),
// which only ever passes ok:true for a super_admin.
export function resolveAreaScope(user, rawAreaId) {
  const allowed = allowedAreaIds(user);
  if (rawAreaId === undefined || rawAreaId === null || rawAreaId === 'all' || rawAreaId === '') {
    if (allowed === null) return { areaId: null, ok: true };
    if (allowed.length === 1) return { areaId: allowed[0], ok: true };
    return { areaId: null, ok: false };
  }
  const areaId = Number(rawAreaId);
  if (!Number.isFinite(areaId)) return { areaId: null, ok: false };
  if (allowed !== null && !allowed.includes(areaId)) return { areaId: null, ok: false };
  return { areaId, ok: true };
}

// Resolves an incoming `storeId` against the user's scope, given an already
// -resolved areaId (or null for company-wide). Returns { storeId, ok }.
export function resolveStoreScope(user, rawStoreId, areaId) {
  if (user.role === 'store_supervisor') {
    if (rawStoreId === undefined || rawStoreId === null || rawStoreId === 'all' || rawStoreId === '') {
      return { storeId: user.store_id, ok: true };
    }
    return { storeId: Number(rawStoreId), ok: Number(rawStoreId) === Number(user.store_id) };
  }
  if (rawStoreId === undefined || rawStoreId === null || rawStoreId === 'all' || rawStoreId === '') {
    return { storeId: null, ok: true };
  }
  const storeId = Number(rawStoreId);
  if (!Number.isFinite(storeId)) return { storeId: null, ok: false };
  const store = db.prepare('SELECT area_id FROM stores WHERE id = ?').get(storeId);
  if (!store) return { storeId: null, ok: false };
  if (areaId !== null && store.area_id !== areaId) return { storeId: null, ok: false };
  if (!canAccessArea(user, store.area_id)) return { storeId: null, ok: false };
  return { storeId, ok: true };
}

export function isSuperAdmin(user) {
  return user.role === 'super_admin';
}

export function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Super Admin access required' });
  next();
}
