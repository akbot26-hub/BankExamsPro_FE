import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db, id, persistNow, MEDIA_DIR } from '../store.js';
import { authenticate, requireAdmin } from '../auth.js';
import { publicUser } from './catalog.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

// ---- Exams ----------------------------------------------------------------
adminRouter.post('/exams', (req, res) => {
  const store = db();
  const body = req.body || {};
  if (!body.name || !Array.isArray(body.sections) || !body.sections.length) {
    return res.status(400).json({ error: 'An exam needs a name and at least one section.' });
  }
  const exam = {
    id: id('exm'),
    code: body.code || body.name.replace(/\s+/g, '-').toUpperCase(),
    name: body.name,
    year: body.year || new Date().getFullYear(),
    organisation: body.organisation || '',
    tier: body.tier || 'Prelims',
    durationMin: Number(body.durationMin) || 60,
    sectionalTiming: Boolean(body.sectionalTiming),
    cutoffTotal: body.cutoffTotal ?? null,
    difficulty: body.difficulty || 'Moderate',
    languages: body.languages?.length ? body.languages : ['en'],
    plannedMockCount: Number(body.plannedMockCount) || 10,
    status: body.status || 'draft',
    sections: body.sections.map((s, i) => ({
      id: s.id || `sec_${i + 1}`,
      name: s.name,
      questionCount: Number(s.questionCount) || 0,
      marksPerQuestion: Number(s.marksPerQuestion) || 1,
      negativeMarks: Number(s.negativeMarks) || 0,
      durationMin: Number(s.durationMin) || 0,
      cutoff: s.cutoff ?? null,
    })),
    createdAt: new Date().toISOString(),
  };
  store.exams.push(exam);
  persistNow();
  res.status(201).json({ exam });
});

adminRouter.patch('/exams/:id', (req, res) => {
  const exam = db().exams.find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  Object.assign(exam, req.body, { id: exam.id });
  persistNow();
  res.json({ exam });
});

// ---- Mock tests -----------------------------------------------------------
adminRouter.post('/mock-tests', (req, res) => {
  const store = db();
  const exam = store.exams.find((e) => e.id === req.body?.examId);
  if (!exam) return res.status(400).json({ error: 'Pick an exam for this mock test.' });
  const index = req.body.index || store.mockTests.filter((m) => m.examId === exam.id).length + 1;
  const mock = {
    id: id('mck'),
    examId: exam.id,
    title: req.body.title || `${exam.name} — Mock Test ${index}`,
    index,
    availableFrom: req.body.availableFrom || null,
    published: Boolean(req.body.published),
    sections: exam.sections.map((s) => ({
      sectionId: s.id,
      questionIds: req.body.sections?.find((x) => x.sectionId === s.id)?.questionIds || [],
    })),
    createdAt: new Date().toISOString(),
  };
  store.mockTests.push(mock);
  persistNow();
  res.status(201).json({ mockTest: mock });
});

adminRouter.patch('/mock-tests/:id', (req, res) => {
  const mock = db().mockTests.find((m) => m.id === req.params.id);
  if (!mock) return res.status(404).json({ error: 'Mock test not found.' });
  Object.assign(mock, req.body, { id: mock.id, examId: mock.examId });
  persistNow();
  res.json({ mockTest: mock });
});

/** Fill a mock automatically from the bank, respecting the exam blueprint. */
adminRouter.post('/mock-tests/:id/auto-fill', (req, res) => {
  const store = db();
  const mock = store.mockTests.find((m) => m.id === req.params.id);
  if (!mock) return res.status(404).json({ error: 'Mock test not found.' });
  const exam = store.exams.find((e) => e.id === mock.examId);
  const used = new Set(store.mockTests.filter((m) => m.id !== mock.id && m.examId === exam.id)
    .flatMap((m) => m.sections.flatMap((s) => s.questionIds)));

  mock.sections = exam.sections.map((section) => {
    const pool = store.questions.filter((q) => q.examId === exam.id && q.sectionId === section.id);
    const fresh = pool.filter((q) => !used.has(q.id));
    const chosen = [...fresh, ...pool.filter((q) => used.has(q.id))].slice(0, section.questionCount);
    return { sectionId: section.id, questionIds: chosen.map((q) => q.id) };
  });
  persistNow();
  res.json({
    mockTest: mock,
    filled: mock.sections.map((s) => ({ sectionId: s.sectionId, count: s.questionIds.length })),
  });
});

// ---- Question bank --------------------------------------------------------
adminRouter.get('/questions', (req, res) => {
  const { examId, sectionId, topic, difficulty, q } = req.query;
  const list = db().questions.filter((question) =>
    (!examId || question.examId === examId) &&
    (!sectionId || question.sectionId === sectionId) &&
    (!topic || question.topic === topic) &&
    (!difficulty || question.difficulty === difficulty) &&
    (!q || question.text.toLowerCase().includes(String(q).toLowerCase())));
  res.json({ questions: list, total: list.length });
});

/** An option is either "text" or { text?, image? } — at least one of the two. */
const normaliseOption = (o) =>
  typeof o === 'string' ? { text: o } : { text: o?.text || '', image: o?.image || null };
const validOption = (o) => Boolean(o.text || o.image);

const normaliseQuestion = (body) => ({
  examId: body.examId,
  sectionId: body.sectionId,
  type: body.type || 'mcq',
  topic: body.topic || 'Untagged',
  chapter: body.chapter || '',
  difficulty: body.difficulty || 'Moderate',
  expectedTimeSec: Number(body.expectedTimeSec) || 45,
  marks: Number(body.marks) || 1,
  negativeMarks: Number(body.negativeMarks) || 0.25,
  stimulusId: body.stimulusId || null,
  text: body.text,
  textHi: body.textHi || '',
  image: body.image || null,
  table: body.table || null,
  options: (body.options || []).map(normaliseOption),
  optionsHi: body.optionsHi || [],
  answer: Number(body.answer),
  explanation: body.explanation || '',
});

adminRouter.post('/questions', (req, res) => {
  const store = db();
  const body = req.body || {};
  const opts = (body.options || []).map(normaliseOption);
  if ((!body.text && !body.image) || opts.length < 2 || !opts.every(validOption)) {
    return res.status(400).json({ error: 'A question needs text or an image, and at least two options, each with text or an image.' });
  }
  const question = { id: id('qst'), ...normaliseQuestion(body), createdAt: new Date().toISOString() };
  store.questions.push(question);
  persistNow();
  res.status(201).json({ question });
});

/** Bulk import — the realistic way a question bank actually gets filled.
 *  Accepts { questions: [...], stimuli: [...] }. Stimuli may carry temp ids;
 *  questions referencing them are re-pointed at the stored ids. */
adminRouter.post('/questions/bulk', (req, res) => {
  const store = db();
  const rows = Array.isArray(req.body?.questions) ? req.body.questions : [];
  const created = [], rejected = [];

  const stimulusIdMap = {};
  for (const s of (Array.isArray(req.body?.stimuli) ? req.body.stimuli : [])) {
    if (!s.text && !s.table && !s.image) continue;
    const stored = {
      id: id('stm'), type: s.type || 'directions',
      title: s.title || 'Directions', text: s.text || '',
      table: s.table || null, image: s.image || null,
    };
    store.stimuli.push(stored);
    if (s.id) stimulusIdMap[s.id] = stored.id;
  }
  rows.forEach((row, i) => {
    const opts = Array.isArray(row.options) ? row.options.map(normaliseOption) : [];
    if ((!row.text && !row.image) || opts.length < 2 || !opts.every(validOption) || row.answer == null) {
      rejected.push({ row: i + 1, reason: 'Needs question text or image, two or more options (each with text or an image), and an answer index.' });
      return;
    }
    const question = { id: id('qst'), ...normaliseQuestion(row), createdAt: new Date().toISOString() };
    if (question.stimulusId && stimulusIdMap[question.stimulusId]) {
      question.stimulusId = stimulusIdMap[question.stimulusId];
    }
    store.questions.push(question);
    created.push(question.id);
  });
  persistNow();
  res.json({ imported: created.length, rejected });
});

adminRouter.patch('/questions/:id', (req, res) => {
  const question = db().questions.find((q) => q.id === req.params.id);
  if (!question) return res.status(404).json({ error: 'Question not found.' });
  Object.assign(question, req.body, { id: question.id });
  persistNow();
  res.json({ question });
});

// ---- Media (question & option images) -------------------------------------
const MEDIA_TYPES = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg',
};
const MEDIA_MAX_BYTES = 2 * 1024 * 1024;

/** Accepts { mimeType, data(base64) } → { url }. Paste the url into a question. */
adminRouter.post('/media', (req, res) => {
  const { mimeType, data } = req.body || {};
  const ext = MEDIA_TYPES[mimeType];
  if (!ext) return res.status(400).json({ error: 'Only PNG, JPEG, WebP or SVG images are accepted.' });
  let buf;
  try { buf = Buffer.from(String(data || ''), 'base64'); } catch { buf = null; }
  if (!buf || !buf.length) return res.status(400).json({ error: 'Send the image as base64 in the data field.' });
  if (buf.length > MEDIA_MAX_BYTES) {
    return res.status(413).json({ error: 'Images must be under 2 MB. Compress it and try again.' });
  }
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const name = `${id('img')}.${ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, name), buf);
  res.status(201).json({ url: `/api/media/${name}`, bytes: buf.length });
});

// ---- Students & institution reporting -------------------------------------
adminRouter.get('/students', (req, res) => {
  const store = db();
  const students = store.users.filter((u) => u.role === 'student').map((u) => {
    const attempts = store.attempts.filter((a) => a.userId === u.id && a.status === 'submitted');
    const scores = attempts.map((a) => a.result.score);
    return {
      ...publicUser(u),
      attempts: attempts.length,
      lastActive: attempts.at(-1)?.submittedAt || null,
      avgScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null,
      bestScore: scores.length ? Math.max(...scores) : null,
    };
  });
  res.json({ students });
});

adminRouter.get('/overview', (req, res) => {
  const store = db();
  const submitted = store.attempts.filter((a) => a.status === 'submitted');
  const perMock = store.mockTests.map((m) => {
    const rows = submitted.filter((a) => a.mockTestId === m.id);
    const scores = rows.map((a) => a.result.score);
    return {
      mockTestId: m.id, title: m.title, attempts: rows.length,
      avgScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null,
      topScore: scores.length ? Math.max(...scores) : null,
    };
  });
  res.json({
    totals: {
      students: store.users.filter((u) => u.role === 'student').length,
      exams: store.exams.length,
      mockTests: store.mockTests.length,
      questions: store.questions.length,
      attempts: submitted.length,
      inProgress: store.attempts.filter((a) => a.status === 'in-progress').length,
    },
    perMock,
  });
});
