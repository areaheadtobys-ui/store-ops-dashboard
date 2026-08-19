import express from 'express';
import cors from 'cors';
import importsRouter from './routes/imports.js';
import storesRouter from './routes/stores.js';
import salesRouter from './routes/sales.js';
import performanceRouter from './routes/performance.js';
import remarksRouter from './routes/remarks.js';
import widgetsRouter from './routes/widgets.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/imports', importsRouter);
app.use('/api/stores', storesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/remarks', remarksRouter);
app.use('/api/widgets', widgetsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Retail sales server listening on http://localhost:${PORT}`);
});
