import express from 'express';
import cors from 'cors';
import importsRouter from './routes/imports.js';
import storesRouter from './routes/stores.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/imports', importsRouter);
app.use('/api/stores', storesRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Retail sales server listening on http://localhost:${PORT}`);
});
