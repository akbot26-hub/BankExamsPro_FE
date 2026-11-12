import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { db, MEDIA_DIR } from './store.js';
import { authRouter, catalogRouter } from './routes/catalog.js';
import { attemptRouter } from './routes/attempts.js';
import { analyticsRouter } from './routes/analytics.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Uploaded question/option images. Immutable filenames → cache hard.
fs.mkdirSync(MEDIA_DIR, { recursive: true });
app.use('/api/media', express.static(MEDIA_DIR, { immutable: true, maxAge: '30d' }));

app.get('/api/health', (req, res) => {
  const store = db();
  res.json({
    ok: true,
    service: 'BankExamsPro API',
    aiNarration: Boolean(process.env.ANTHROPIC_API_KEY) ? 'claude' : 'engine',
    counts: {
      exams: store.exams.length,
      mockTests: store.mockTests.length,
      questions: store.questions.length,
      users: store.users.length,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api', catalogRouter);
app.use('/api/attempts', attemptRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something broke on our side. Try again.' });
});

export default app;
