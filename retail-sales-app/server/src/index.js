import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import importsRouter from './routes/imports.js';
import storesRouter from './routes/stores.js';
import salesRouter from './routes/sales.js';
import performanceRouter from './routes/performance.js';
import remarksRouter from './routes/remarks.js';
import widgetsRouter from './routes/widgets.js';
import areasRouter from './routes/areas.js';
import usersRouter from './routes/users.js';
import companyRouter from './routes/company.js';
import rankingsRouter from './routes/rankings.js';
import authRouter, { getRequestUser } from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// So req.secure reflects the real protocol when running behind a hosting
// provider's reverse proxy (which terminates HTTPS and forwards plain HTTP).
app.set('trust proxy', 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

app.use('/api', (req, res, next) => {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
  next();
});

app.use('/api/imports', importsRouter);
app.use('/api/stores', storesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/remarks', remarksRouter);
app.use('/api/widgets', widgetsRouter);
app.use('/api/areas', areasRouter);
app.use('/api/users', usersRouter);
app.use('/api/company', companyRouter);
app.use('/api/rankings', rankingsRouter);

// When the client has been built (npm run build in ../client), serve it from
// this same server so the whole app runs as a single process on one port —
// useful for LAN sharing (one firewall prompt instead of two) and for hosting.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('Serving built client from', clientDist);
}

app.listen(PORT, () => {
  console.log(`Retail sales server listening on http://localhost:${PORT}`);
});
