/**
 * End-to-end smoke test against a running API.
 *   node src/index.js &   (after npm run seed)
 *   node test/smoke.mjs
 */
const BASE = process.env.BASE || 'http://localhost:4000/api';
let token = '';

const call = async (path, method = 'GET', body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error || ''}`);
  return data;
};

const ok = (label, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
};

// ---- OTP sign-in ----------------------------------------------------------
async function otpSignIn(identifier) {
  const req = await call('/auth/request-otp', 'POST', { identifier });
  if (!req.devOtp) throw new Error('dev OTP missing');
  return call('/auth/verify-otp', 'POST', { identifier, code: req.devOtp });
}

const login = await otpSignIn('arjun@student.in');
token = login.token;
ok('OTP sign-in', Boolean(token), login.user.name);

const wrong = await fetch(`${BASE}/auth/verify-otp`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'arjun@student.in', code: '000000' }),
});
ok('wrong OTP rejected', wrong.status === 400 || wrong.status === 401);

const newbie = await fetch(`${BASE}/auth/request-otp`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: 'newperson@example.com' }),
});
ok('unknown identifier asks for a name', newbie.status === 404 && (await newbie.json()).needsRegistration);

const reg = await call('/auth/request-otp', 'POST', { identifier: '9812345678', name: 'Kavya Rao' });
const regVerify = await call('/auth/verify-otp', 'POST', { identifier: '9812345678', code: reg.devOtp });
ok('register + sign in by mobile number', regVerify.user.name === 'Kavya Rao', `sent to ${reg.to}`);
token = login.token;

const { exams } = await call('/exams');
const exam = exams[0];
ok('exam catalogue', exams.length > 0, `${exam.name}, ${exam.mockCount} mocks, ${exam.completedCount} done`);

const { mockTests } = await call(`/exams/${exam.id}`);
const target = mockTests.find((m) => m.attemptStatus === 'not-started' && m.available);
ok('an unattempted mock is available', Boolean(target), target?.title);

const summary = await call(`/mock-tests/${target.id}/summary`);
ok('instructions load without starting the clock', summary.attemptStatus === 'not-started');

const paper = await call('/attempts', 'POST', { mockTestId: target.id });
ok('paper served', paper.questions.length === 100, `${paper.questions.length} questions, ${paper.stimuli.length} stimuli`);
ok('answer key withheld while live', paper.questions.every((q) => q.answer === undefined));

const figures = paper.questions.filter((q) => q.topic === 'Figure Series');
ok('image questions present in the paper', figures.length >= 2,
  `${figures.length} figure-series questions`);
ok('question image + image options round-trip', figures.every((q) =>
  q.image?.startsWith('data:image/svg') &&
  q.options.every((o) => typeof o === 'object' && o.image)));
ok('sectional clock armed', Boolean(paper.attempt.sectionEndsAt));

// Answer the first 60 questions, three quarters of them correctly.
const store = JSON.parse(await (await fetch('http://localhost:4000/api/health')).text()) && null;
const responses = {};
paper.mockTest.sections.flatMap((s) => s.questionIds).slice(0, 60).forEach((qid, i) => {
  responses[qid] = { selected: i % 4 === 0 ? 3 : 0, status: 'answered', timeSec: 30 + (i % 20), visits: 1 };
});

const saved = await call(`/attempts/${paper.attempt.id}`, 'PATCH', { responses, currentSectionIndex: 0 });
ok('autosave', saved.ok);

const resumed = await call('/attempts', 'POST', { mockTestId: target.id });
ok('resume returns saved work', Object.keys(resumed.attempt.responses).length === 60);

const { attempt } = await call(`/attempts/${paper.attempt.id}/submit`, 'POST', { responses });
const r = attempt.result;
ok('scored', typeof r.score === 'number', `score ${r.score}/${r.maxScore}, accuracy ${r.accuracy}%`);
ok('negative marking applied', r.score < r.correct, `${r.correct} correct, ${r.wrong} wrong → ${r.score}`);
ok('sections graded', r.sections.length === exam.sections.length,
  r.sections.map((s) => `${s.name.split(' ')[0]} ${s.score}`).join(', '));
ok('percentile reflects cohort size',
  r.cohortSize > 1 ? r.percentile !== null : r.percentile === null,
  r.cohortSize > 1 ? `${r.percentile} of ${r.cohortSize}` : 'withheld — only one submission on this mock');

const review = await call(`/attempts/${attempt.id}`);
ok('answer key revealed after submit', review.questions.every((q) => q.answer !== undefined));

const dup = await fetch(`${BASE}/attempts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ mockTestId: target.id }),
});
ok('resubmission blocked', dup.status === 409);

const journey = await call(`/analytics/journey/${exam.id}?narrate=false`);
const j = journey.journey;
ok('journey spans every attempt', j.attemptCount === 8, `${j.attemptCount} mocks analysed`);
ok('insights generated', journey.insights.length >= 5, `${journey.insights.length} insights, source: ${journey.source}`);
ok('prediction bounded', j.prediction.readiness >= 0 && j.prediction.readiness <= 100,
  `expected ${j.prediction.expectedScore}, readiness ${j.prediction.readiness}%`);
ok('plan produced', journey.plan.length > 0, `${journey.plan.length} tasks`);

const report = await call(`/analytics/report/${exam.id}`);
ok('final report', report.journey.ready && report.strategy.length > 0);

// Admin surface
const adminLogin = await otpSignIn('admin@bankexamspro.in');
token = adminLogin.token;
const overview = await call('/admin/overview');
ok('admin overview', overview.totals.questions > 0, JSON.stringify(overview.totals));
const bulk = await call('/admin/questions/bulk', 'POST', {
  questions: [
    { examId: exam.id, sectionId: 'qua', topic: 'Percentage', text: '40% of 250?', options: ['100', '90', '110', '120'], answer: 0 },
    { examId: exam.id, sectionId: 'qua', topic: 'Broken', text: 'no options' },
  ],
});
ok('bulk import validates rows', bulk.imported === 1 && bulk.rejected.length === 1, bulk.rejected[0].reason);

// 1x1 transparent PNG
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const media = await call('/admin/media', 'POST', { mimeType: 'image/png', data: png });
const fetched = await fetch(`http://localhost:4000${media.url}`);
ok('media upload → served back', media.url.startsWith('/api/media/') && fetched.status === 200,
  `${media.url} (${media.bytes} bytes)`);

const badMedia = await fetch(`${BASE}/admin/media`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ mimeType: 'application/pdf', data: png }),
});
ok('non-image media rejected', badMedia.status === 400);

const imgQ = await call('/admin/questions', 'POST', {
  examId: exam.id, sectionId: 'rea', topic: 'Figure Series',
  text: 'Which figure completes the pattern?', image: media.url,
  options: [{ image: media.url }, { image: media.url }, { text: 'None of these' }, { image: media.url }],
  answer: 1,
});
ok('image-option question accepted via admin API', Boolean(imgQ.question.id));

token = login.token;
const forbidden = await fetch(`${BASE}/admin/students`, { headers: { authorization: `Bearer ${token}` } });
ok('students cannot reach admin', forbidden.status === 403);

console.log(process.exitCode ? '\nSome checks failed.' : '\nAll checks passed.');
