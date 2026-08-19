import express from 'express';
import cors from 'cors';
import importsRouter from './routes/imports.js';
import storesRouter from './routes/stores.js';
import salesRouter from './routes/sales.js';
import performanceRouter from './routes/performance.js';
import remarksRouter from './routes/remarks.js';
import widgetsRouter from './routes/widgets.js';
import authRouter, { isAuthenticated } from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

app.use('/api', (req, res, next) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Not signed in' });
  next();
});

app.use('/api/imports', importsRouter);
app.use('/api/stores', storesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/remarks', remarksRouter);
app.use('/api/widgets', widgetsRouter);

app.listen(PORT, () => {
  console.log(`Retail sales server listening on http://localhost:${PORT}`);
});
