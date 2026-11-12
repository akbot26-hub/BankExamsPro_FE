const BASE = import.meta.env.VITE_API_URL || '/api';

// The UI can be previewed before a backend is connected. Set
// VITE_USE_MOCK_API=false once the real API is ready.
export const MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
const DEMO_EXAM_ID = 'demo-ibps-po';
const DEMO_EXAM = {
  id: DEMO_EXAM_ID, name: 'IBPS PO Prelims', organisation: 'IBPS', tier: 'Prelims', year: 2025,
  status: 'published', difficulty: 'Moderate', durationMin: 60, cutoffTotal: 55,
  sectionalTiming: true, languages: ['en', 'hi'], plannedMockCount: 10,
  sections: [
    { id: 'english', name: 'English Language', questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 9 },
    { id: 'quant', name: 'Quantitative Aptitude', questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 10 },
    { id: 'reasoning', name: 'Reasoning Ability', questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 10 },
  ],
};
const DEMO_MOCKS = Array.from({ length: 10 }, (_, i) => ({
  id: `demo-mock-${i + 1}`, examId: DEMO_EXAM_ID, index: i + 1,
  title: `IBPS PO Prelims — Mock Test ${i + 1}`, questionCount: 100,
  available: true, published: true, availableFrom: null,
  attemptStatus: i < 3 ? 'submitted' : 'not-started', attemptId: i < 3 ? `demo-attempt-${i + 1}` : null,
  score: i < 3 ? [68, 72, 76][i] : null, maxScore: 100,
}));
const DEMO_EXAMS = [{ ...DEMO_EXAM, mockCount: 10, completedCount: 3, lastScore: 76 }];

function demoJourney() {
  const scores = [68, 72, 76];
  const sectionScores = [[22, 23, 23], [23, 24, 25], [24, 25, 27]];
  const timeline = scores.map((score, i) => ({
    day: i + 1,
    attemptId: `demo-attempt-${i + 1}`,
    score,
    maxScore: 100,
    accuracy: 78 + i * 3,
    label: `Mock ${i + 1}`,
    sections: DEMO_EXAM.sections.map((section, sectionIndex) => ({ sectionId: section.id, score: sectionScores[i][sectionIndex] })),
  }));
  const sectionTrends = DEMO_EXAM.sections.map((s, i) => ({
    sectionId: s.id, name: s.name, avgScore: [22, 25, 25][i], bestScore: [24, 27, 27][i], avgAccuracy: [78, 82, 84][i], accuracyDelta: [4, 5, 3][i],
    avgTimePerQuestion: 42 + i * 3, consistency: 86, cutoffClearRate: 100,
    accuracySeries: timeline.map((_, j) => [74, 78, 82][j] + i * 2), scoreSeries: timeline.map((_, j) => [20, 22, 24][j] + i),
  }));
  const topics = [
    { topic: 'Reading Comprehension', sectionName: 'English Language', seen: 12, correct: 10, accuracy: 83, lossPotential: 2, trend: 5 },
    { topic: 'Number Series', sectionName: 'Quantitative Aptitude', seen: 10, correct: 6, accuracy: 60, lossPotential: 4, trend: 3 },
    { topic: 'Puzzles', sectionName: 'Reasoning Ability', seen: 15, correct: 11, accuracy: 73, lossPotential: 4, trend: 6 },
  ];
  const prediction = { expectedScore: 78, range: [71, 84], readiness: 74, qualificationProbability: 82, band: 'High', cutoff: 55, maxScore: 100, readinessComponents: { scoreMargin: 82, accuracy: 80, sectionalSafety: 100, consistency: 86, momentum: 72 } };
  const journey = { ready: true, examId: DEMO_EXAM_ID, examName: DEMO_EXAM.name, attemptCount: 3, plannedMockCount: 10, timeline, sectionTrends, prediction, overall: { latestScore: 76, bestScore: 76, avgScore: 72, scoreSlope: 4, consistency: 86, firstScore: 68 }, strengths: [topics[0]], weaknesses: [topics[1], topics[2]], topics };
  const insights = [
    { kind: 'strength', title: 'English is a reliable scoring area', body: 'Your accuracy and pace have improved across recent mocks.', metric: { value: '83%', label: 'accuracy' } },
    { kind: 'weakness', title: 'Number series needs focused practice', body: 'This topic is currently costing marks. Add short timed drills to your revision plan.', metric: { value: '60%', label: 'accuracy' } },
    { kind: 'trend', title: 'Your scores are moving in the right direction', body: 'Your score has risen from 68 to 76 over three submitted mocks.', metric: { value: '+4', label: 'marks per mock' } },
  ];
  const plan = [
    { priority: 1, focus: 'Number series drills', section: 'Quantitative Aptitude', action: 'Complete two timed sets and review every incorrect answer.', minutes: 25 },
    { priority: 2, focus: 'Puzzle practice', section: 'Reasoning Ability', action: 'Solve one moderate puzzle set without checking hints.', minutes: 25 },
    { priority: 3, focus: 'Mistake review', section: 'All sections', action: 'Revisit questions missed in your latest mock.', minutes: 20 },
  ];
  const strategy = ['Start with your strongest section to settle into the paper.', 'Keep a strict pace and move on when a question is taking too long.', 'Avoid guesses when the options do not narrow down confidently.'];
  return { journey, insights, plan, strategy, source: 'preview', summary: 'A sample preparation summary for previewing the analysis screens.' };
}

function demoResult(id) {
  const exam = DEMO_EXAM;
  const mockTest = DEMO_MOCKS.find((m) => m.attemptId === id) || DEMO_MOCKS[0];
  const responses = {};
  const perQuestion = Array.from({ length: 5 }, (_, i) => {
    const questionId = `demo-q-${i + 1}`;
    const correct = i !== 1;
    responses[questionId] = { selected: correct ? 0 : 1, status: 'answered', timeSec: 45 + i * 8 };
    return { questionId, attempted: true, correct, overtime: i === 4, timeSec: 45 + i * 8, answer: 0, score: correct ? 1 : -0.25 };
  });
  const sections = exam.sections.map((s, i) => ({ sectionId: s.id, name: s.name, total: [30, 35, 35][i], attempted: [25, 28, 29][i], correct: [20, 23, 25][i], wrong: [5, 5, 4][i], skipped: [5, 7, 6][i], accuracy: [80, 82, 86][i], timeSec: 1200, score: [19, 22, 24][i], cutoff: s.cutoff, clearedCutoff: true, avgTimePerQuestion: 48, perQuestion: i === 0 ? perQuestion : [] }));
  return {
    attempt: { id, submittedAt: new Date().toISOString(), autoSubmitted: false, responses, result: { score: 68, maxScore: 100, accuracy: 82, correct: 68, wrong: 14, skipped: 18, attempted: 82, timeSec: 3300, percentile: 78, cohortSize: 146, topperScore: 92, clearedOverallCutoff: true, clearedAllSectionalCutoffs: true, sections } },
    exam, mockTest, questions: perQuestion.map((p, i) => ({ id: p.questionId, text: ['A shopkeeper marks an item at ₹800 and offers a discount of 10%. What is the selling price?', 'Choose the word most similar in meaning to “abundant”.', 'Find the next number: 3, 8, 15, 24, ?', 'If BANK is coded as C B O L, how is LOAN coded?', 'A train travels 120 km in 2 hours. What is its average speed?'][i], options: ['₹700', '₹720', '₹740', '₹760'], solution: 'Work through the information step by step and eliminate options that do not fit.', answer: 0 })),
  };
}

export async function mockApi(path, { method = 'GET', body } = {}) {
  const user = (() => { try { return JSON.parse(sessionStorage.getItem('bxp_preview_user') || 'null'); } catch { return null; } })();
  const examData = (id = DEMO_EXAM_ID) => ({ exam: DEMO_EXAM, mockTests: DEMO_MOCKS, ...{ id } });
  if (path === '/auth/request-otp') return { sent: true, to: 'ar•••@student.in', expiresInSec: 300, devOtp: '123456' };
  if (path === '/auth/verify-otp') return { token: 'preview-token', user: user || { id: 'preview_student', name: 'Arjun Sharma', email: body?.identifier || 'arjun@student.in', role: 'student', enrolledExamIds: [DEMO_EXAM_ID] } };
  if (path === '/auth/me') return { user: user || { id: 'preview_student', name: 'Arjun Sharma', email: 'arjun@student.in', role: 'student' } };
  if (path === '/exams') return { exams: DEMO_EXAMS };
  let match = path.match(/^\/exams\/([^/]+)$/);
  if (match) return examData(match[1]);
  match = path.match(/^\/mock-tests\/([^/]+)\/summary$/);
  if (match) { const mock = DEMO_MOCKS.find((m) => m.id === match[1]) || DEMO_MOCKS[0]; return { exam: DEMO_EXAM, mockTest: { ...mock, sections: DEMO_EXAM.sections.map((s) => ({ sectionId: s.id, count: s.questionCount })) }, attemptStatus: mock.attemptStatus, attemptId: mock.attemptId }; }
  match = path.match(/^\/analytics\/journey\/([^/?]+)/);
  if (match) return demoJourney();
  match = path.match(/^\/analytics\/report\/([^/?]+)/);
  if (match) { const d = demoJourney(); return { ...d, student: { id: 'preview_student', name: user?.name || 'Arjun Sharma', email: user?.email || 'arjun@student.in' }, generatedAt: new Date().toISOString(), repeatedMistakes: d.journey.weaknesses.map((t) => ({ topic: t.topic, section: t.sectionName, seen: t.seen, missed: t.seen - t.correct, accuracy: t.accuracy })) }; }
  match = path.match(/^\/attempts\/([^/]+)$/);
  if (match) return demoResult(match[1]);
  if (path === '/admin/overview') return { totals: { exams: 1, mockTests: 10, questions: 1000, students: 248 }, perMock: DEMO_MOCKS.map((m, i) => ({ mockTestId: m.id, title: m.title, attempts: 24 - i, avgScore: 54 + i, topScore: 92 })) };
  if (path === '/admin/students') return { students: [{ id: 'preview_student', name: 'Arjun Sharma', email: 'arjun@student.in', attempts: 3 }] };
  if (path.startsWith('/admin/')) return { exams: DEMO_EXAMS, questions: [], total: 0, mockTest: DEMO_MOCKS[0], filled: [] };
  if (method === 'POST' && path === '/attempts') throw Object.assign(new Error('The exam paper needs the backend API. The preview screens are available, but starting and saving a live attempt is not enabled yet.'), { status: 503 });
  if (method !== 'GET') return { ok: true };
  return {};
}

let token = null;
try { token = window.sessionStorage.getItem('bxp_token'); } catch { /* private mode */ }

export const setToken = (t) => {
  token = t;
  try { t ? sessionStorage.setItem('bxp_token', t) : sessionStorage.removeItem('bxp_token'); } catch { /* noop */ }
};
export const getToken = () => token;

export async function api(path, { method = 'GET', body, signal } = {}) {
  if (MOCK_API) return mockApi(path, { method, body });
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

/** Fire-and-forget save that still lands if the tab is closing. */
export function beacon(path, body) {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    navigator.sendBeacon(`${BASE}${path}?token=${token}`, blob);
  } catch { /* noop */ }
}

export const fmtTime = (totalSec) => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

export const fmtClock = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
};
