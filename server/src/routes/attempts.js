import { Router } from 'express';
import { db, id, persist, persistNow } from '../store.js';
import { authenticate } from '../auth.js';
import { scoreAttempt, percentileFor } from '../ai/metrics.js';

export const attemptRouter = Router();
attemptRouter.use(authenticate);

/** Questions are only ever sent without the answer key while a test is live. */
const stripAnswer = ({ answer, explanation, ...rest }) => rest;

function loadPaper(store, mockTest) {
  const ids = mockTest.sections.flatMap((s) => s.questionIds);
  const questions = ids.map((qid) => store.questions.find((q) => q.id === qid)).filter(Boolean);
  const stimulusIds = [...new Set(questions.map((q) => q.stimulusId).filter(Boolean))];
  const stimuli = stimulusIds.map((sid) => store.stimuli.find((s) => s.id === sid)).filter(Boolean);
  return { questions, stimuli };
}

/** POST /attempts — start or resume. Resuming is the normal case after a refresh. */
attemptRouter.post('/', (req, res) => {
  const store = db();
  const mockTest = store.mockTests.find((m) => m.id === req.body?.mockTestId);
  if (!mockTest) return res.status(404).json({ error: 'That mock test is not available.' });
  const exam = store.exams.find((e) => e.id === mockTest.examId);

  let attempt = store.attempts.find((a) => a.userId === req.user.id && a.mockTestId === mockTest.id);
  if (attempt?.status === 'submitted') {
    return res.status(409).json({ error: 'You have already submitted this mock test.', attemptId: attempt.id });
  }

  if (!attempt) {
    attempt = {
      id: id('att'),
      userId: req.user.id,
      examId: exam.id,
      mockTestId: mockTest.id,
      mockTitle: mockTest.title,
      status: 'in-progress',
      language: req.body?.language || 'en',
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + exam.durationMin * 60_000).toISOString(),
      sectionEndsAt: null,
      currentSectionIndex: 0,
      responses: {},
      submittedAt: null,
      result: null,
    };
    if (exam.sectionalTiming) {
      const first = exam.sections[0];
      attempt.sectionEndsAt = new Date(Date.now() + first.durationMin * 60_000).toISOString();
    }
    store.attempts.push(attempt);
    persistNow();
  }

  const { questions, stimuli } = loadPaper(store, mockTest);
  res.json({
    attempt,
    exam,
    mockTest,
    questions: questions.map(stripAnswer),
    stimuli,
    serverTime: new Date().toISOString(),
  });
});

/** PATCH /attempts/:id — autosave. Called every few seconds by the engine. */
attemptRouter.patch('/:id', (req, res) => {
  const store = db();
  const attempt = store.attempts.find((a) => a.id === req.params.id && a.userId === req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  if (attempt.status === 'submitted') return res.status(409).json({ error: 'This attempt is already submitted.' });

  const { responses, currentSectionIndex, sectionEndsAt, language } = req.body || {};
  if (responses && typeof responses === 'object') {
    for (const [qid, r] of Object.entries(responses)) {
      attempt.responses[qid] = {
        selected: r.selected ?? null,
        status: r.status || 'not-visited',
        timeSec: Math.max(attempt.responses[qid]?.timeSec || 0, Math.round(r.timeSec || 0)),
        visits: r.visits || 0,
      };
    }
  }
  if (Number.isInteger(currentSectionIndex)) attempt.currentSectionIndex = currentSectionIndex;
  if (sectionEndsAt) attempt.sectionEndsAt = sectionEndsAt;
  if (language) attempt.language = language;
  attempt.updatedAt = new Date().toISOString();
  persist();
  res.json({ ok: true, savedAt: attempt.updatedAt, serverTime: new Date().toISOString() });
});

/** POST /attempts/:id/submit — manual submit or auto-submit on timer end. */
attemptRouter.post('/:id/submit', (req, res) => {
  const store = db();
  const attempt = store.attempts.find((a) => a.id === req.params.id && a.userId === req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  if (attempt.status === 'submitted') return res.json({ attempt });

  if (req.body?.responses) {
    for (const [qid, r] of Object.entries(req.body.responses)) {
      attempt.responses[qid] = { ...attempt.responses[qid], ...r };
    }
  }

  const exam = store.exams.find((e) => e.id === attempt.examId);
  const mockTest = store.mockTests.find((m) => m.id === attempt.mockTestId);
  const { questions } = loadPaper(store, mockTest);

  attempt.result = scoreAttempt({ exam, mockTest, questions, responses: attempt.responses });
  attempt.status = 'submitted';
  attempt.submittedAt = new Date().toISOString();
  attempt.autoSubmitted = Boolean(req.body?.auto);

  const cohort = store.attempts
    .filter((a) => a.mockTestId === attempt.mockTestId && a.status === 'submitted')
    .map((a) => a.result.score);
  attempt.result.percentile = percentileFor(attempt.result.score, cohort);
  attempt.result.cohortSize = cohort.length;
  attempt.result.topperScore = cohort.length ? Math.max(...cohort) : attempt.result.score;
  attempt.result.averageScore = cohort.length
    ? Number((cohort.reduce((a, b) => a + b, 0) / cohort.length).toFixed(1)) : attempt.result.score;

  persistNow();
  res.json({ attempt });
});

/** GET /attempts/:id — full solution review, answers included. */
attemptRouter.get('/:id', (req, res) => {
  const store = db();
  const attempt = store.attempts.find((a) => a.id === req.params.id &&
    (a.userId === req.user.id || req.user.role === 'admin'));
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });

  const exam = store.exams.find((e) => e.id === attempt.examId);
  const mockTest = store.mockTests.find((m) => m.id === attempt.mockTestId);
  const { questions, stimuli } = loadPaper(store, mockTest);
  const reveal = attempt.status === 'submitted';

  res.json({
    attempt,
    exam,
    mockTest,
    stimuli,
    questions: reveal ? questions : questions.map(stripAnswer),
  });
});

/** GET /attempts?examId= — the student's own history. */
attemptRouter.get('/', (req, res) => {
  const list = db().attempts
    .filter((a) => a.userId === req.user.id && (!req.query.examId || a.examId === req.query.examId))
    .map(({ responses, ...rest }) => rest);
  res.json({ attempts: list });
});
