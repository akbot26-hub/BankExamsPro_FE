/**
 * Turns the journey metrics into readable coaching.
 *
 * Two paths:
 *  1. ANTHROPIC_API_KEY set  -> Claude writes the narrative, but is fed only the
 *     computed figures and is told not to invent any others.
 *  2. No key                 -> deterministic templates over the same figures.
 *
 * Either way the numbers come from metrics.js, so nothing is hallucinated.
 */

const pct = (n) => `${Math.round(n)}%`;
const secs = (n) => `${Math.round(n)}s`;

export function ruleBasedInsights(journey) {
  if (!journey?.ready) return [];
  const out = [];
  const { sectionTrends, strengths, weaknesses, timeSinks, attemptOrder, overall, prediction, timeline } = journey;

  // --- Strengths ---
  const bestSection = [...sectionTrends].sort((a, b) => b.avgAccuracy - a.avgAccuracy)[0];
  if (bestSection) {
    out.push({
      kind: 'strength',
      title: `${bestSection.name} is your anchor section`,
      body: `You average ${pct(bestSection.avgAccuracy)} accuracy here at ${secs(bestSection.avgTimePerQuestion)} per question, and you have cleared its cut-off in ${pct(bestSection.cutoffClearRate)} of your mocks. Protect this section — it is what keeps your total above the line.`,
      metric: { label: 'Average accuracy', value: pct(bestSection.avgAccuracy) },
    });
  }
  for (const t of strengths.slice(0, 2)) {
    out.push({
      kind: 'strength',
      title: `${t.topic} is close to automatic`,
      body: `${t.correct} correct out of ${t.attempted} attempted, at ${secs(t.avgTimeSec)} against an expected ${secs(t.expectedTimeSec)}. Attempt every ${t.topic} question you see — it is free marks at your current speed.`,
      metric: { label: 'Accuracy', value: pct(t.accuracy) },
    });
  }

  // --- Weaknesses ---
  for (const t of weaknesses.slice(0, 3)) {
    const reason = t.skipRate > 40
      ? `you skip ${pct(t.skipRate)} of them outright`
      : `your accuracy sits at ${pct(t.accuracy)}`;
    out.push({
      kind: 'weakness',
      title: `${t.topic} is costing you the most marks`,
      body: `Across ${t.seen} questions in ${t.sectionName}, ${reason}. That is roughly ${t.lossPotential} marks left on the table per exam cycle. ${t.trend > 3 ? `The good news: it is improving (${t.trend > 0 ? '+' : ''}${t.trend} points in your recent mocks).` : t.trend < -3 ? `It is also sliding (${t.trend} points), so treat it as urgent.` : 'It has been flat across mocks, so passive revision is not working — switch to timed drills.'}`,
      metric: { label: 'Marks lost', value: `${t.lossPotential}` },
    });
  }

  // Only flag a decline that is actually material — a one-point wobble is noise.
  const declining = sectionTrends.filter((s) => s.accuracySlope < -1 && s.accuracyDelta < -4);
  for (const s of declining) {
    out.push({
      kind: 'weakness',
      title: `${s.name} accuracy is drifting down`,
      body: `From ${pct(s.firstAccuracy)} in your first mock to ${pct(s.latestAccuracy)} in your latest. A falling accuracy with a steady attempt count usually means you are guessing under time pressure. Cut two attempts in this section and see if accuracy recovers.`,
      metric: { label: 'Change', value: `${s.accuracyDelta > 0 ? '+' : ''}${s.accuracyDelta} pts` },
    });
  }

  // --- Speed ---
  for (const t of timeSinks.slice(0, 2)) {
    out.push({
      kind: 'speed',
      title: `${t.topic} is eating ${Math.round((t.avgTimeSec - t.expectedTimeSec) * t.attempted / 60)} minutes an exam`,
      body: `You take ${secs(t.avgTimeSec)} per question against a target of ${secs(t.expectedTimeSec)} — ${t.paceRatio}× the pace it deserves. ${t.accuracy >= 65 ? 'Your accuracy here is fine, so this is purely a method problem: learn the shortcut and drill it.' : 'With accuracy at ' + pct(t.accuracy) + ' as well, the time is not buying you marks. Skip these on sight in the real exam.'}`,
      metric: { label: 'Pace', value: `${t.paceRatio}× target` },
    });
  }

  const fastest = [...sectionTrends].sort((a, b) => a.avgTimePerQuestion - b.avgTimePerQuestion)[0];
  const slowest = [...sectionTrends].sort((a, b) => b.avgTimePerQuestion - a.avgTimePerQuestion)[0];
  if (fastest && slowest && fastest.sectionId !== slowest.sectionId) {
    out.push({
      kind: 'speed',
      title: `Suggested order: ${attemptOrder.map((s) => s.name).join(' → ')}`,
      body: `${fastest.name} returns marks fastest for you (${secs(fastest.avgTimePerQuestion)} per question at ${pct(fastest.avgAccuracy)} accuracy), while ${slowest.name} is slowest at ${secs(slowest.avgTimePerQuestion)}. Bank the certain marks first, then spend what is left on ${slowest.name}.`,
      metric: { label: 'Start with', value: attemptOrder[0]?.name || fastest.name },
    });
  }

  // --- Trend ---
  const improving = [...sectionTrends].sort((a, b) => b.accuracyDelta - a.accuracyDelta)[0];
  if (improving && improving.accuracyDelta > 3) {
    // Point the lesson at a *different* section, otherwise the advice is circular.
    const laggard = [...sectionTrends]
      .filter((s) => s.sectionId !== improving.sectionId)
      .sort((a, b) => a.accuracyDelta - b.accuracyDelta)[0];
    out.push({
      kind: 'trend',
      title: `${improving.name} accuracy has climbed ${improving.accuracyDelta} points`,
      body: `From ${pct(improving.firstAccuracy)} in Mock 1 to ${pct(improving.latestAccuracy)} in Mock ${timeline.length}.${laggard ? ` ${laggard.name} has moved ${laggard.accuracyDelta > 0 ? 'only ' + laggard.accuracyDelta : laggard.accuracyDelta} points over the same period — whatever routine you changed for ${improving.name}, run it there next.` : ''}`,
      metric: { label: 'Improvement', value: `+${improving.accuracyDelta} pts` },
    });
  }
  out.push({
    kind: 'trend',
    title: overall.scoreSlope >= 0.5
      ? `You are gaining about ${overall.scoreSlope} marks per mock`
      : overall.scoreSlope <= -0.5
        ? `Your score is slipping by about ${Math.abs(overall.scoreSlope)} marks per mock`
        : 'Your score has plateaued',
    body: `Mock 1: ${overall.firstScore}. Mock ${timeline.length}: ${overall.latestScore}. Best: ${overall.bestScore}. Consistency ${pct(overall.consistency)}. ${overall.consistency < 75 ? 'The swing between mocks is wide — that volatility is itself a risk on exam day, because you only get one attempt.' : 'You are reproducing your score reliably, which matters more than one high mock.'}`,
    metric: { label: 'Latest', value: `${overall.latestScore}/${prediction.maxScore}` },
  });

  return out;
}

export function dailyPlan(journey) {
  if (!journey?.ready) return [];
  const plan = [];
  const w = journey.weaknesses;
  const sinks = journey.timeSinks;

  if (w[0]) plan.push({ priority: 1, focus: w[0].topic, section: w[0].sectionName, action: `30 untimed questions to rebuild the method, then 15 timed at ${Math.round(w[0].expectedTimeSec)}s each.`, minutes: 60 });
  if (w[1]) plan.push({ priority: 2, focus: w[1].topic, section: w[1].sectionName, action: `20 mixed-difficulty questions. Log every wrong answer with the reason — concept, calculation or misread.`, minutes: 40 });
  if (sinks[0]) plan.push({ priority: 3, focus: `${sinks[0].topic} speed`, section: sinks[0].sectionName, action: `10 questions with a hard ${Math.round(sinks[0].expectedTimeSec)}s cap. Abandon on the buzzer even if half-solved — that is the exam-day skill.`, minutes: 25 });
  const strong = journey.strengths[0];
  if (strong) plan.push({ priority: 4, focus: `${strong.topic} maintenance`, section: strong.sectionName, action: `15 questions to keep the edge. Do not over-invest here — you already score ${Math.round(strong.accuracy)}%.`, minutes: 20 });
  plan.push({ priority: 5, focus: 'Mistake ledger', section: 'All sections', action: 'Re-solve every question you got wrong in the last two mocks, from a blank page.', minutes: 30 });
  return plan;
}

export function strategyNotes(journey) {
  if (!journey?.ready) return [];
  const { attemptOrder, prediction, sectionTrends } = journey;
  const risky = sectionTrends.filter((s) => s.cutoffClearRate < 70 && s.cutoff != null);
  const notes = [
    `Open with ${attemptOrder[0]?.name}. It is where your marks-per-minute is highest, and a clean start settles the nerves.`,
    `Hold ${attemptOrder.at(-1)?.name} for last and give it a hard stop — do not let it eat the buffer you need for revision.`,
    `Target ${prediction.expectedScore} and treat ${prediction.range[0]} as the floor you must not drop below.`,
  ];
  if (risky.length) {
    notes.push(`${risky.map((s) => s.name).join(' and ')} ${risky.length > 1 ? 'are' : 'is'} your sectional-cutoff risk — clear the cut-off there before chasing extra marks anywhere else.`);
  }
  notes.push('Leave the last four minutes untouched for the palette sweep: every question marked for review either gets answered or gets abandoned deliberately.');
  return notes;
}

/** Optional Claude pass for a warmer, more specific narrative. */
export async function narrateWithClaude(journey, { section = 'insights' } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const facts = {
    exam: journey.examName,
    mocksCompleted: journey.attemptCount,
    overall: journey.overall,
    prediction: journey.prediction,
    sections: journey.sectionTrends.map(({ name, avgAccuracy, accuracyDelta, avgTimePerQuestion, cutoffClearRate, avgScore }) =>
      ({ name, avgAccuracy, accuracyDelta, avgTimePerQuestion, cutoffClearRate, avgScore })),
    strengths: journey.strengths.map(({ topic, accuracy, avgTimeSec }) => ({ topic, accuracy, avgTimeSec })),
    weaknesses: journey.weaknesses.map(({ topic, accuracy, skipRate, lossPotential, trend }) => ({ topic, accuracy, skipRate, lossPotential, trend })),
    timeSinks: journey.timeSinks.map(({ topic, avgTimeSec, expectedTimeSec, paceRatio }) => ({ topic, avgTimeSec, expectedTimeSec, paceRatio })),
  };

  const prompt = `You are the performance coach inside BankExamsPro, a mock-test platform for Indian banking exams (IBPS, SBI, RBI).

Here are the computed statistics for one candidate's mock-test journey:
${JSON.stringify(facts, null, 2)}

Write ${section === 'report' ? 'a final preparation report' : 'coaching insights'} for this candidate.

Rules:
- Use ONLY the numbers above. Never invent a figure.
- Be specific and direct. An aspirant reading this should know exactly what to do tomorrow morning.
- Indian banking exam vocabulary: sectional cut-off, attempts, accuracy, TITA, negative marking.
- No praise that isn't earned by the numbers, and no doom either.
- Return strict JSON, no markdown fences:
{"insights":[{"kind":"strength|weakness|speed|trend","title":"...","body":"...","metric":{"label":"...","value":"..."}}],"summary":"2-3 sentences"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = await res.json();
    const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (err) {
    console.warn('[ai] falling back to rule-based insights:', err.message);
    return null;
  }
}
