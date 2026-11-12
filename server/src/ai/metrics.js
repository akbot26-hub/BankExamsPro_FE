/**
 * Scoring + performance analytics.
 *
 * Everything here is deterministic maths over the raw response log. The
 * language layer (insights.js) sits on top and only ever describes numbers
 * produced in this file — so an insight can always be traced to a figure.
 */

const round = (n, p = 2) => Number.isFinite(n) ? Number(n.toFixed(p)) : 0;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Ordinary least squares slope of y over its own index. */
export function slope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs), my = mean(ys);
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Logistic CDF — used to turn a score margin into a qualification probability. */
const logistic = (z) => 1 / (1 + Math.exp(-z));

/**
 * Grade one attempt against the exam blueprint.
 * responses: { [questionId]: { selected, status, timeSec, visits } }
 */
export function scoreAttempt({ exam, mockTest, questions, responses }) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const sections = exam.sections.map((section) => {
    const qIds = (mockTest.sections.find((s) => s.sectionId === section.id)?.questionIds) || [];
    let correct = 0, wrong = 0, attempted = 0, skipped = 0, marked = 0, timeSec = 0, score = 0;
    const perQuestion = [];

    for (const qid of qIds) {
      const q = byId.get(qid);
      if (!q) continue;
      const r = responses[qid] || {};
      const answered = r.selected !== undefined && r.selected !== null;
      const isCorrect = answered && r.selected === q.answer;
      const t = Math.max(0, Math.round(r.timeSec || 0));

      timeSec += t;
      // Real papers (IBPS Mains especially) carry different marks per
      // question; honor the question's own marks with the section as fallback.
      const qMarks = Number.isFinite(q.marks) && q.marks > 0 ? q.marks : section.marksPerQuestion;
      const qNeg = Number.isFinite(q.negativeMarks) && q.negativeMarks >= 0 ? q.negativeMarks : section.negativeMarks;
      if (r.status === 'marked' || r.status === 'answered-marked') marked += 1;
      if (answered) {
        attempted += 1;
        if (isCorrect) { correct += 1; score += qMarks; }
        else { wrong += 1; score -= qNeg; }
      } else {
        skipped += 1;
      }

      perQuestion.push({
        questionId: qid,
        topic: q.topic,
        chapter: q.chapter,
        difficulty: q.difficulty,
        expectedTimeSec: q.expectedTimeSec,
        selected: answered ? r.selected : null,
        answer: q.answer,
        correct: isCorrect,
        attempted: answered,
        timeSec: t,
        overtime: t > q.expectedTimeSec * 1.5,
      });
    }

    const total = qIds.length;
    return {
      sectionId: section.id,
      name: section.name,
      total,
      attempted,
      correct,
      wrong,
      skipped,
      marked,
      score: round(score),
      maxScore: round(qIds.reduce((a, i) => {
        const qq = byId.get(i);
        return a + (Number.isFinite(qq?.marks) && qq.marks > 0 ? qq.marks : section.marksPerQuestion);
      }, 0)),
      accuracy: round(attempted ? (correct / attempted) * 100 : 0, 1),
      attemptRate: round(total ? (attempted / total) * 100 : 0, 1),
      timeSec,
      avgTimePerQuestion: round(attempted ? timeSec / attempted : 0, 1),
      cutoff: section.cutoff ?? null,
      clearedCutoff: section.cutoff == null ? null : score >= section.cutoff,
      perQuestion,
    };
  });

  const score = round(sections.reduce((a, s) => a + s.score, 0));
  const maxScore = round(sections.reduce((a, s) => a + s.maxScore, 0));
  const attempted = sections.reduce((a, s) => a + s.attempted, 0);
  const correct = sections.reduce((a, s) => a + s.correct, 0);
  const timeSec = sections.reduce((a, s) => a + s.timeSec, 0);

  return {
    score,
    maxScore,
    attempted,
    correct,
    wrong: sections.reduce((a, s) => a + s.wrong, 0),
    skipped: sections.reduce((a, s) => a + s.skipped, 0),
    accuracy: round(attempted ? (correct / attempted) * 100 : 0, 1),
    timeSec,
    percentile: null, // filled in by the cohort comparison below
    clearedAllSectionalCutoffs: sections.every((s) => s.clearedCutoff !== false),
    clearedOverallCutoff: exam.cutoffTotal == null ? null : score >= exam.cutoffTotal,
    sections,
  };
}

/** Percentile of this score against every other submitted attempt on the same mock. */
export function percentileFor(score, cohortScores) {
  if (cohortScores.length < 2) return null;
  const below = cohortScores.filter((s) => s < score).length;
  return round((below / cohortScores.length) * 100, 1);
}

/**
 * Roll a student's full attempt history for one exam into the numbers the AI
 * layer narrates: per-topic mastery, speed, trend lines and a projection.
 */
export function buildJourney({ exam, attempts }) {
  const done = attempts
    .filter((a) => a.status === 'submitted' && a.result)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  if (!done.length) return { attemptCount: 0, ready: false };

  const timeline = done.map((a, i) => ({
    attemptId: a.id,
    mockTestId: a.mockTestId,
    label: a.mockTitle || `Mock ${i + 1}`,
    day: i + 1,
    submittedAt: a.submittedAt,
    score: a.result.score,
    maxScore: a.result.maxScore,
    accuracy: a.result.accuracy,
    attempted: a.result.attempted,
    timeSec: a.result.timeSec,
    sections: a.result.sections.map((s) => ({
      sectionId: s.sectionId,
      name: s.name,
      score: s.score,
      accuracy: s.accuracy,
      attempted: s.attempted,
      correct: s.correct,
      avgTimePerQuestion: s.avgTimePerQuestion,
      clearedCutoff: s.clearedCutoff,
    })),
  }));

  // ---- Section-level trends -------------------------------------------------
  const sectionTrends = exam.sections.map((section) => {
    const series = timeline.map((t) => t.sections.find((s) => s.sectionId === section.id) || {});
    const accuracies = series.map((s) => s.accuracy || 0);
    const scores = series.map((s) => s.score || 0);
    const speeds = series.map((s) => s.avgTimePerQuestion || 0).filter(Boolean);
    const cutoffHits = series.filter((s) => s.clearedCutoff === true).length;

    return {
      sectionId: section.id,
      name: section.name,
      cutoff: section.cutoff ?? null,
      latestScore: scores.at(-1) ?? 0,
      bestScore: Math.max(...scores),
      avgScore: round(mean(scores), 1),
      firstAccuracy: accuracies[0] ?? 0,
      latestAccuracy: accuracies.at(-1) ?? 0,
      avgAccuracy: round(mean(accuracies), 1),
      accuracyDelta: round((accuracies.at(-1) ?? 0) - (accuracies[0] ?? 0), 1),
      accuracySlope: round(slope(accuracies), 2),
      scoreSlope: round(slope(scores), 2),
      consistency: round(100 - Math.min(100, (stdev(scores) / (mean(scores) || 1)) * 100), 1),
      avgTimePerQuestion: round(mean(speeds), 1),
      speedSlope: round(slope(speeds), 2),
      cutoffClearRate: round((cutoffHits / timeline.length) * 100, 1),
      accuracySeries: accuracies,
      scoreSeries: scores,
    };
  });

  // ---- Topic-level mastery --------------------------------------------------
  const topicMap = new Map();
  done.forEach((a, attemptIndex) => {
    for (const s of a.result.sections) {
      for (const q of s.perQuestion) {
        const key = `${s.sectionId}::${q.topic}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, {
            topic: q.topic, sectionId: s.sectionId, sectionName: s.name,
            seen: 0, attempted: 0, correct: 0, timeSec: 0, expectedSec: 0,
            overtime: 0, byAttempt: [],
          });
        }
        const t = topicMap.get(key);
        t.seen += 1;
        t.expectedSec += q.expectedTimeSec || 0;
        if (q.attempted) {
          t.attempted += 1;
          t.timeSec += q.timeSec;
          if (q.correct) t.correct += 1;
          if (q.overtime) t.overtime += 1;
        }
        t.byAttempt[attemptIndex] = t.byAttempt[attemptIndex] || { attempted: 0, correct: 0 };
        t.byAttempt[attemptIndex].attempted += q.attempted ? 1 : 0;
        t.byAttempt[attemptIndex].correct += q.correct ? 1 : 0;
      }
    }
  });

  const topics = [...topicMap.values()].map((t) => {
    const half = Math.ceil(t.byAttempt.length / 2);
    const acc = (slice) => {
      const at = slice.reduce((a, x) => a + (x?.attempted || 0), 0);
      const co = slice.reduce((a, x) => a + (x?.correct || 0), 0);
      return at ? (co / at) * 100 : null;
    };
    const early = acc(t.byAttempt.slice(0, half));
    const late = acc(t.byAttempt.slice(half));
    return {
      topic: t.topic,
      sectionId: t.sectionId,
      sectionName: t.sectionName,
      seen: t.seen,
      attempted: t.attempted,
      correct: t.correct,
      accuracy: round(t.attempted ? (t.correct / t.attempted) * 100 : 0, 1),
      skipRate: round(t.seen ? ((t.seen - t.attempted) / t.seen) * 100 : 0, 1),
      avgTimeSec: round(t.attempted ? t.timeSec / t.attempted : 0, 1),
      expectedTimeSec: round(t.seen ? t.expectedSec / t.seen : 0, 1),
      paceRatio: round(t.attempted && t.expectedSec ? (t.timeSec / t.attempted) / (t.expectedSec / t.seen) : 0, 2),
      overtimeRate: round(t.attempted ? (t.overtime / t.attempted) * 100 : 0, 1),
      trend: early != null && late != null ? round(late - early, 1) : 0,
      // Marks lost here in a single exam, not across the whole history —
      // an aspirant needs to know what one paper costs them.
      lossPotential: round((t.seen - t.correct) / done.length, 1),
    };
  });

  const meaningful = topics.filter((t) => t.seen >= 3);
  const strengths = [...meaningful]
    .filter((t) => t.accuracy >= 70 && t.attempted >= 3)
    .sort((a, b) => b.accuracy - a.accuracy || a.paceRatio - b.paceRatio)
    .slice(0, 6);
  const weaknesses = [...meaningful]
    .sort((a, b) => (b.lossPotential - a.lossPotential) || (a.accuracy - b.accuracy))
    .filter((t) => t.accuracy < 70 || t.skipRate > 40)
    .slice(0, 6);
  const timeSinks = [...meaningful]
    .filter((t) => t.paceRatio > 1.15 && t.attempted >= 3)
    .sort((a, b) => b.paceRatio - a.paceRatio)
    .slice(0, 5);

  // ---- Attempt order recommendation ----------------------------------------
  // Yield = marks earned per minute spent. Highest yield section goes first.
  const attemptOrder = sectionTrends
    .map((s) => ({
      sectionId: s.sectionId,
      name: s.name,
      yieldPerMin: round(s.avgTimePerQuestion ? (s.avgScore / ((s.avgTimePerQuestion * (s.scoreSeries.length ? 1 : 1)) / 60 || 1)) : 0, 2),
      avgAccuracy: s.avgAccuracy,
      avgTimePerQuestion: s.avgTimePerQuestion,
      cutoffClearRate: s.cutoffClearRate,
    }))
    .sort((a, b) => (b.avgAccuracy / (b.avgTimePerQuestion || 1)) - (a.avgAccuracy / (a.avgTimePerQuestion || 1)));

  // ---- Projection -----------------------------------------------------------
  const scores = timeline.map((t) => t.score);
  // Recency-weighted mean: the last mock counts most.
  const weights = scores.map((_, i) => Math.pow(1.35, i));
  const weighted = scores.reduce((a, s, i) => a + s * weights[i], 0) / weights.reduce((a, w) => a + w, 0);
  const trend = slope(scores);
  const remaining = Math.max(0, (exam.plannedMockCount || timeline.length) - timeline.length);
  const projected = weighted + trend * Math.min(remaining + 1, 4) * 0.6;
  const sd = stdev(scores) || Math.max(3, projected * 0.08);

  const cutoff = exam.cutoffTotal ?? 0;
  const qualifyProb = round(logistic((projected - cutoff) / (sd || 1)) * 100, 1);
  const sectionalProb = sectionTrends.map((s) => ({
    sectionId: s.sectionId,
    name: s.name,
    cutoff: s.cutoff,
    probability: s.cutoff == null ? null
      : round(logistic((s.avgScore + s.scoreSlope * 2 - s.cutoff) / (Math.max(1, stdev(s.scoreSeries)) || 1)) * 100, 1),
  }));

  // Readiness blends what actually decides selection: score margin, accuracy,
  // consistency, sectional safety and direction of travel.
  const maxScore = timeline.at(-1).maxScore || 1;
  const components = {
    scoreMargin: Math.max(0, Math.min(100, ((projected - cutoff) / (maxScore - cutoff || 1)) * 100 + 45)),
    accuracy: mean(timeline.map((t) => t.accuracy)),
    consistency: mean(sectionTrends.map((s) => s.consistency)),
    sectionalSafety: mean(sectionTrends.map((s) => s.cutoffClearRate)),
    momentum: Math.max(0, Math.min(100, 50 + trend * 6)),
  };
  const readiness = round(
    components.scoreMargin * 0.32 +
    components.accuracy * 0.24 +
    components.consistency * 0.14 +
    components.sectionalSafety * 0.2 +
    components.momentum * 0.1, 0);

  return {
    ready: true,
    examId: exam.id,
    examName: exam.name,
    attemptCount: timeline.length,
    plannedMockCount: exam.plannedMockCount || timeline.length,
    timeline,
    sectionTrends,
    topics,
    strengths,
    weaknesses,
    timeSinks,
    attemptOrder,
    overall: {
      firstScore: scores[0],
      latestScore: scores.at(-1),
      bestScore: Math.max(...scores),
      avgScore: round(mean(scores), 1),
      scoreSlope: round(trend, 2),
      accuracyDelta: round(timeline.at(-1).accuracy - timeline[0].accuracy, 1),
      consistency: round(100 - Math.min(100, (stdev(scores) / (mean(scores) || 1)) * 100), 1),
    },
    prediction: {
      expectedScore: round(projected, 1),
      range: [round(Math.max(0, projected - sd), 1), round(Math.min(maxScore, projected + sd), 1)],
      maxScore,
      cutoff: exam.cutoffTotal ?? null,
      qualificationProbability: qualifyProb,
      band: qualifyProb >= 70 ? 'High' : qualifyProb >= 40 ? 'Moderate' : 'Low',
      sectionalProbability: sectionalProb,
      readiness: Math.max(0, Math.min(100, readiness)),
      readinessComponents: Object.fromEntries(
        Object.entries(components).map(([k, v]) => [k, round(v, 0)])
      ),
    },
  };
}
