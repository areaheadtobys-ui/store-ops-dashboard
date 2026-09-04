import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import db from '../db.js';
import { APP_FIELDS } from '../fields.js';
import { parseWorkbook, suggestMapping, performImport } from '../services/importService.js';
import { resolveAreaScope } from '../rbac.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

// Short-lived in-memory cache of parsed uploads awaiting mapping confirmation.
const pendingUploads = new Map();
const UPLOAD_TTL_MS = 30 * 60 * 1000;

function cacheUpload(payload) {
  const token = crypto.randomUUID();
  pendingUploads.set(token, { ...payload, expiresAt: Date.now() + UPLOAD_TTL_MS });
  return token;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pendingUploads) {
    if (entry.expiresAt < now) pendingUploads.delete(token);
  }
}, 5 * 60 * 1000).unref();

router.get('/fields', (req, res) => {
  res.json({ fields: APP_FIELDS });
});

router.post('/preview', upload.single('file'), (req, res) => {
  const { areaId: rawAreaId } = req.body;
  const { areaId, ok } = resolveAreaScope(req.user, rawAreaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  if (areaId === null) return res.status(400).json({ error: 'Select a single Area to import into' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let parsed;
  try {
    parsed = parseWorkbook(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: `Could not read spreadsheet: ${err.message}` });
  }

  if (parsed.headers.length === 0) {
    return res.status(400).json({ error: 'No columns detected in the sheet' });
  }

  const { mapping, exactMatch } = suggestMapping(areaId, parsed.headers);
  const token = cacheUpload({
    areaId,
    filename: req.file.originalname,
    headers: parsed.headers,
    rows: parsed.rows,
  });

  res.json({
    uploadToken: token,
    filename: req.file.originalname,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 5),
    rowCount: parsed.rows.length,
    suggestedMapping: mapping,
    mappingRemembered: exactMatch,
  });
});

router.post('/confirm', (req, res) => {
  const { uploadToken, mapping } = req.body;
  const entry = pendingUploads.get(uploadToken);
  if (!entry) {
    return res.status(410).json({ error: 'Upload has expired, please re-upload the file' });
  }
  const requiredFields = APP_FIELDS.filter((f) => f.required).map((f) => f.field);
  const mappedFields = new Set(Object.values(mapping).map((m) => m.field));
  const missing = requiredFields.filter((f) => !mappedFields.has(f));
  const hasPeriod = mappedFields.has('period_date') || (mappedFields.has('year') && mappedFields.has('month'));
  if (missing.length > 0) {
    return res.status(400).json({ error: `Please map a column to: ${missing.join(', ')}` });
  }
  if (!hasPeriod) {
    return res.status(400).json({ error: 'Please map a Date column, or both Year and Month columns' });
  }

  const result = performImport({
    areaId: entry.areaId,
    filename: entry.filename,
    headers: entry.headers,
    rows: entry.rows,
    mapping,
    enteredBy: req.user.id,
  });

  pendingUploads.delete(uploadToken);
  res.json(result);
});

router.get('/', (req, res) => {
  const { areaId, ok } = resolveAreaScope(req.user, req.query.areaId);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });
  const imports = areaId === null
    ? db.prepare('SELECT * FROM imports ORDER BY uploaded_at DESC LIMIT 20').all()
    : db.prepare('SELECT * FROM imports WHERE area_id = ? ORDER BY uploaded_at DESC LIMIT 20').all(areaId);
  res.json(imports.map((i) => ({ ...i, errors: JSON.parse(i.errors_json || '[]') })));
});

router.delete('/:id', (req, res) => {
  const importRow = db.prepare('SELECT * FROM imports WHERE id = ?').get(req.params.id);
  if (!importRow) return res.status(404).json({ error: 'Import not found' });
  const { ok } = resolveAreaScope(req.user, importRow.area_id);
  if (!ok) return res.status(403).json({ error: 'Not permitted for this area' });

  // Only removes rows still attributed to this import — if a later upload already
  // corrected a row, it now belongs to that later import and is left alone.
  const removed = db.prepare('DELETE FROM sales_records WHERE import_id = ?').run(req.params.id);
  db.prepare('DELETE FROM imports WHERE id = ?').run(req.params.id);

  res.json({ deleted: true, rowsRemoved: removed.changes });
});

export default router;
