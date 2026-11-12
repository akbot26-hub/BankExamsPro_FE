import { Router } from 'express';
import { db, id, persist, hashPassword, verifyPassword } from '../store.js';
import { signToken, authenticate } from '../auth.js';

export const authRouter = Router();

/**
 * Sign-in is OTP-only. No SMS or email gateway is wired in this build, so the
 * code is delivered in "dev mode": logged to the server console and returned
 * in the response as devOtp. Point sendOtp() at a real gateway to go live —
 * and stop returning devOtp when you do.
 */
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;
const OTP_MAX_TRIES = 5;

const normalise = (v) => String(v || '').trim().toLowerCase();
const isPhone = (v) => /^[0-9+\s-]{8,15}$/.test(v);

function findUser(store, identifier) {
  const id = normalise(identifier);
  return store.users.find(
    (u) => u.email.toLowerCase() === id || (u.phone && u.phone.replace(/\D/g, '') === id.replace(/\D/g, '') && id.replace(/\D/g, '').length >= 8)
  );
}

function sendOtp(user, code) {
  // Gateway seam. Today: console only.
  console.log(`[otp] ${user.email}${user.phone ? ' / ' + user.phone : ''} → ${code}`);
}

const maskEmail = (e) => e.replace(/^(..).*(@.*)$/, '$1•••$2');
const maskPhone = (p) => p ? p.replace(/\d(?=\d{2})/g, '•') : '';

authRouter.post('/request-otp', (req, res) => {
  const store = db();
  const identifier = normalise(req.body?.identifier);
  if (!identifier) return res.status(400).json({ error: 'Enter your email or mobile number.' });

  let user = findUser(store, identifier);

  // Unknown identifier: either ask for a name, or register with the one given.
  if (!user) {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(404).json({
        needsRegistration: true,
        error: 'We could not find that account. Add your name below to register.',
      });
    }
    user = {
      id: id('usr'),
      name,
      email: isPhone(identifier) ? '' : identifier,
      phone: isPhone(identifier) ? identifier : String(req.body?.phone || '').trim(),
      role: 'student',
      createdAt: new Date().toISOString(),
      enrolledExamIds: store.exams.filter((e) => e.status === 'published').map((e) => e.id),
    };
    if (!user.email && !user.phone) return res.status(400).json({ error: 'Enter a valid email or mobile number.' });
    store.users.push(user);
  }

  store.otps = store.otps || [];
  const existing = store.otps.find((o) => o.userId === user.id);
  if (existing && Date.now() - existing.sentAt < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - existing.sentAt)) / 1000);
    return res.status(429).json({ error: `An OTP was just sent. You can request another in ${wait} seconds.` });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.otps = store.otps.filter((o) => o.userId !== user.id);
  store.otps.push({
    userId: user.id,
    codeHash: hashPassword(code),
    sentAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
    tries: 0,
  });
  sendOtp(user, code);
  persist();

  res.json({
    sent: true,
    to: user.email ? maskEmail(user.email) : maskPhone(user.phone),
    expiresInSec: OTP_TTL_MS / 1000,
    // Dev-mode delivery only — remove once a real SMS/email gateway is wired in.
    devOtp: code,
  });
});

authRouter.post('/verify-otp', (req, res) => {
  const store = db();
  const identifier = normalise(req.body?.identifier);
  const code = String(req.body?.code || '').trim();
  const user = findUser(store, identifier);
  if (!user) return res.status(404).json({ error: 'We could not find that account. Request an OTP first.' });

  store.otps = store.otps || [];
  const otp = store.otps.find((o) => o.userId === user.id);
  if (!otp) return res.status(400).json({ error: 'No OTP is pending for this account. Request a new one.' });
  if (Date.now() > otp.expiresAt) {
    store.otps = store.otps.filter((o) => o !== otp); persist();
    return res.status(400).json({ error: 'That OTP has expired. Request a new one.' });
  }
  if (otp.tries >= OTP_MAX_TRIES) {
    store.otps = store.otps.filter((o) => o !== otp); persist();
    return res.status(429).json({ error: 'Too many wrong attempts. Request a new OTP.' });
  }
  if (!/^[0-9]{6}$/.test(code) || !verifyPassword(code, otp.codeHash)) {
    otp.tries += 1; persist();
    return res.status(401).json({ error: `That code is not right. ${OTP_MAX_TRIES - otp.tries} attempts left.` });
  }

  store.otps = store.otps.filter((o) => o !== otp);
  persist();
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  enrolledExamIds: u.enrolledExamIds || [], createdAt: u.createdAt,
});

// ---------------------------------------------------------------------------

export const catalogRouter = Router();
catalogRouter.use(authenticate);

catalogRouter.get('/exams', (req, res) => {
  const store = db();
  const exams = store.exams
    .filter((e) => req.user.role === 'admin' || e.status === 'published')
    .map((exam) => {
      const mocks = store.mockTests.filter((m) => m.examId === exam.id && (req.user.role === 'admin' || m.published));
      const attempts = store.attempts.filter((a) => a.userId === req.user.id && a.examId === exam.id && a.status === 'submitted');
      return {
        ...exam,
        mockCount: mocks.length,
        completedCount: attempts.length,
        lastScore: attempts.at(-1)?.result?.score ?? null,
      };
    });
  res.json({ exams });
});

/** Meta for the instructions screen — deliberately does NOT start the clock. */
catalogRouter.get('/mock-tests/:id/summary', (req, res) => {
  const store = db();
  const mock = store.mockTests.find((m) => m.id === req.params.id);
  if (!mock) return res.status(404).json({ error: 'That mock test is not available.' });
  const exam = store.exams.find((e) => e.id === mock.examId);
  const attempt = store.attempts.find((a) => a.userId === req.user.id && a.mockTestId === mock.id);
  res.json({
    exam,
    mockTest: {
      id: mock.id, title: mock.title, index: mock.index,
      questionCount: mock.sections.reduce((a, s) => a + s.questionIds.length, 0),
      sections: mock.sections.map((s) => ({ sectionId: s.sectionId, count: s.questionIds.length })),
    },
    attemptStatus: attempt?.status || 'not-started',
    attemptId: attempt?.id || null,
  });
});

catalogRouter.get('/exams/:examId', (req, res) => {
  const store = db();
  const exam = store.exams.find((e) => e.id === req.params.examId);
  if (!exam) return res.status(404).json({ error: 'That exam is not on the platform.' });

  const mockTests = store.mockTests
    .filter((m) => m.examId === exam.id && (req.user.role === 'admin' || m.published))
    .sort((a, b) => a.index - b.index)
    .map((m) => {
      const attempt = store.attempts.find((a) => a.userId === req.user.id && a.mockTestId === m.id);
      const available = !m.availableFrom || new Date(m.availableFrom) <= new Date();
      return {
        id: m.id, title: m.title, index: m.index, availableFrom: m.availableFrom,
        published: m.published, questionCount: m.sections.reduce((a, s) => a + s.questionIds.length, 0),
        available,
        attemptStatus: attempt?.status || 'not-started',
        attemptId: attempt?.id || null,
        score: attempt?.result?.score ?? null,
        maxScore: attempt?.result?.maxScore ?? null,
      };
    });

  res.json({ exam, mockTests });
});
