import { Router } from 'express';
import { db } from '../store.js';
import { authenticate } from '../auth.js';
import { buildJourney } from '../ai/metrics.js';
import { ruleBasedInsights, dailyPlan, strategyNotes, narrateWithClaude } from '../ai/insights.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

function journeyFor(userId, examId) {
  const store = db();
  const exam = store.exams.find((e) => e.id === examId);
  if (!exam) return null;
  const attempts = store.attempts.filter((a) => a.userId === userId && a.examId === examId);
  return buildJourney({ exam, attempts });
}

/** GET /analytics/journey/:examId — the running AI analysis across all mocks. */
analyticsRouter.get('/journey/:examId', async (req, res) => {
  const userId = req.query.userId && req.user.role === 'admin' ? req.query.userId : req.user.id;
  const journey = journeyFor(userId, req.params.examId);
  if (!journey) return res.status(404).json({ error: 'That exam is not on the platform.' });
  if (!journey.ready) {
    return res.json({ journey, insights: [], plan: [], strategy: [], source: 'none',
      empty: 'Finish your first mock test and the analysis starts here.' });
  }

  const claude = req.query.narrate === 'false' ? null : await narrateWithClaude(journey);
  res.json({
    journey,
    insights: claude?.insights?.length ? claude.insights : ruleBasedInsights(journey),
    summary: claude?.summary || null,
    plan: dailyPlan(journey),
    strategy: strategyNotes(journey),
    source: claude ? 'claude' : 'engine',
  });
});

/** GET /analytics/report/:examId — the final comprehensive report. */
analyticsRouter.get('/report/:examId', async (req, res) => {
  const userId = req.query.userId && req.user.role === 'admin' ? req.query.userId : req.user.id;
  const journey = journeyFor(userId, req.params.examId);
  if (!journey?.ready) return res.status(400).json({ error: 'No submitted mock tests yet for this exam.' });

  const store = db();
  const user = store.users.find((u) => u.id === userId);
  const claude = await narrateWithClaude(journey, { section: 'report' });

  // Mistakes that repeat across mocks are the highest-value thing to show.
  const repeat = journey.topics
    .filter((t) => t.seen >= 3 && t.accuracy < 60)
    .sort((a, b) => (b.seen - b.correct) - (a.seen - a.correct))
    .slice(0, 8)
    .map((t) => ({ topic: t.topic, section: t.sectionName, missed: t.seen - t.correct, seen: t.seen, accuracy: t.accuracy }));

  res.json({
    student: { id: user.id, name: user.name, email: user.email },
    generatedAt: new Date().toISOString(),
    journey,
    insights: claude?.insights?.length ? claude.insights : ruleBasedInsights(journey),
    summary: claude?.summary || null,
    repeatedMistakes: repeat,
    plan: dailyPlan(journey),
    strategy: strategyNotes(journey),
    source: claude ? 'claude' : 'engine',
  });
});
