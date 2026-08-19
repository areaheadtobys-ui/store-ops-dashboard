import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import db from '../db.js';
import { APP_FIELDS } from '../fields.js';
import { parseWorkbook, suggestMapping, performImport } from '../services/importService.js';

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
  const { dataset } = req.body;
  if (!dataset || !['company', 'franchise'].includes(dataset)) {
    return res.status(400).json({ error: 'dataset must be "company" or "franchise"' });
  }
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

  const { mapping, exactMatch } = suggestMapping(dataset, parsed.headers);
  const token = cacheUpload({
    dataset,
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
    dataset: entry.dataset,
    filename: entry.filename,
    headers: entry.headers,
    rows: entry.rows,
    mapping,
  });

  pendingUploads.delete(uploadToken);
  res.json(result);
});

router.get('/', (req, res) => {
  const { dataset } = req.query;
  if (!dataset) return res.status(400).json({ error: 'dataset is required' });
  const imports = db.prepare('SELECT * FROM imports WHERE dataset = ? ORDER BY uploaded_at DESC LIMIT 20').all(dataset);
  res.json(imports.map((i) => ({ ...i, errors: JSON.parse(i.errors_json || '[]') })));
});

export default router;
