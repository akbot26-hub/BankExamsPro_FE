# BankExamsPro

A mock test platform for Indian banking examinations. Two halves:

1. **A test screen built to match the official portal.** Verdana at 13px, the standard
   palette shapes, sectional timing that closes a section for good, auto-submit on the
   timer. A candidate who practises here meets no surprises on exam day.
2. **An analysis that reads all ten mocks together.** Not ten separate scorecards —
   trend slopes, topic mastery, pace against target, a projected score and a readiness
   figure, refreshed after every paper.

## Running it

**Prerequisites: Node.js 18 or newer** (the server uses native `fetch` and
`structuredClone`; built and tested on Node 22). npm comes with it. Nothing else —
no database to install, no Docker.

From the project root, install all workspace dependencies once:

```bash
npm install
```

Then use two terminals from the project root:

```bash
# API — http://localhost:4000
npm run seed
npm run dev:server

# Web — http://localhost:5173
npm run dev
```

Sign-in is **OTP-only** — there are no passwords anywhere on the platform. Enter an
email or mobile number, receive a 6-digit code, done. New identifiers register inline
by adding a name.

No SMS or email gateway is wired in this build. Local development uses the fixed demo OTP `123456` for the two seeded demo accounts below; other accounts receive a random code printed to the server console and shown on the sign-in screen. The fixed demo OTP is disabled when `NODE_ENV=production`. Connect the gateway seam in `sendOtp()` to an OTP provider before going live. Codes expire in 5 minutes, allow 5 wrong attempts, and resend after a 45-second cooldown.

| Role    | Request an OTP for        | What you land in                         |
|---------|---------------------------|-------------------------------------------|
| Student | `arjun@student.in`        | 7 mocks already submitted, full analysis  |
| Admin   | `admin@bankexamspro.in`   | Exams, mocks, question bank, students     |

Verify the API end to end at any time:

```bash
cd server && node test/smoke.mjs     # 26 checks, needs the server running
```

To wipe all data and start fresh, run `npm run seed` again — it resets
`server/data/db.json` completely, including any accounts and attempts you created.

### Environment variables (all optional)

| Variable            | Default                          | Purpose                                   |
|---------------------|----------------------------------|-------------------------------------------|
| `PORT`              | `4000`                           | API port                                  |
| `JWT_SECRET`        | a dev constant                   | **Set your own in any real deployment**   |
| `ANTHROPIC_API_KEY` | unset → built-in engine narrates | Claude writes the coaching narrative      |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`              | Which Claude model narrates               |
| `VITE_API_URL`      | `/api` (proxied in dev)          | Client → API base URL in production       |

### Production build

```bash
cd client && npm run build      # emits client/dist/
```

Serve `client/dist/` from any static host or nginx, and run the API with
`npm start` behind it. Either proxy `/api` on the same origin to port 4000
(recommended — no CORS thought required), or set `VITE_API_URL` to the API's
full URL at build time. In dev none of this matters: Vite already proxies
`/api` to `localhost:4000` (see `client/vite.config.js`).

Before real users: set `JWT_SECRET`, wire `sendOtp()` to a real gateway, and
remove `devOtp` from the request-otp response.

## Phones study, computers examine

Everything **before and after** a paper is mobile responsive: the schedule, the
instructions, results, solution review, the full analysis and the final report all
work on a phone. The **exam itself is laptop/desktop only.** Pressing Start on a
phone or tablet (or in a window narrower than 1024px) shows a message explaining
that the exam opens only on a computer — and, importantly, the attempt clock never
starts, so no time is lost. The gate checks both the user agent and the viewport
(`client/src/components/DeviceGate.jsx`), including iPads that masquerade as Macs.
If a candidate shrinks the window mid-exam, an overlay warns that the timer is
still running rather than submitting the paper.

### Claude-written insights (optional)

Without a key the analysis engine writes the coaching itself from its own figures.
Set a key and Claude writes the narrative instead, from the same computed statistics:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6    # optional
npm start
```

Claude is given only the computed numbers and instructed to invent none. If the call
fails the engine falls back silently, so the page never breaks and never goes quiet.

## Layout

```
server/
  src/store.js            JSON persistence, debounced writes, scrypt OTP hashing
  src/auth.js             JWT issue and verify, admin guard
  src/routes/catalog.js   OTP request/verify, exam list, mock schedule, instructions
  src/routes/attempts.js  start · resume · autosave · submit · solution review
  src/routes/analytics.js journey and final report
  src/routes/admin.js     exams, mocks, question bank, students, usage
  src/ai/metrics.js       scoring and the whole analytics engine
  src/ai/insights.js      narration — Claude, or deterministic templates
  src/seed.js             blueprints, question generators, simulated history
client/
  src/pages/TestEngine.jsx  the exam screen
  src/pages/Analytics.jsx   the running analysis
  src/pages/Report.jsx      the final report
  src/components/Charts.jsx hand-rolled SVG — no chart library
  src/exam.css              official-portal styling, deliberately not modern
  src/styles.css            product styling
```

## How the analysis works

Everything in `metrics.js` is deterministic maths over the raw response log, so every
sentence on screen traces back to a figure.

**Scoring.** Per section: attempted, correct, wrong, skipped, marked, accuracy, time,
score after negative marking, sectional cut-off cleared or not. Percentile against
everyone else who submitted that paper — withheld while the cohort is one.

**Per topic**, across every mock: accuracy, skip rate, average time against the
question's target time (`paceRatio`), overtime rate, early-mocks vs late-mocks trend,
and marks lost per exam. That last figure drives the revision order — you revise what
is costing you marks, not what feels hardest.

**Per section**, over the sequence: OLS slope of accuracy and score, consistency as
inverted coefficient of variation, cut-off clear rate, speed slope.

**Projection.** Recency-weighted mean of past scores (each mock weighted 1.35× the one
before) plus the trend slope extended over the mocks remaining. Qualification
probability is a logistic of the margin over the cut-off, scaled by the standard
deviation of your own scores — so an erratic candidate gets a less confident number
than a steady one at the same average.

**Readiness** blends what actually decides selection: score margin over the cut-off
(32%), accuracy (24%), sectional safety (20%), consistency (14%), momentum (10%).

## Importing real papers

`server/tools/` has a two-step pipeline for turning published solved papers
into playable mocks:

```bash
pdftotext paper.pdf paper.txt
node tools/import-paper.mjs paper.txt > parsed.json   # parse + validation report
node tools/load-paper.mjs parsed.json "IBPS PO Mains 2024" --publish
```

The parser understands the standard solved-paper conventions: numbered
questions, five options (a)–(e), "Directions (X–Y):" blocks shared across a
run of questions (including option sets defined once in the directions, as in
statement-sufficiency), and an "Answer Key & Solutions" region whose
explanations become the platform's per-question solutions. Questions that
pdftotext mangles — fractions, diagrams — are *flagged for review with
reasons*, never silently imported broken; re-enter those by hand or attach
images via the admin upload. Verified against the actual IBPS PO Mains 2024
paper: 147 of 154 questions imported cleanly with answers and solutions.

Scoring honors per-question marks (`q.marks`) with the section value as
fallback, because real Mains papers carry non-uniform marks.

**Licensing note:** published solved papers are copyrighted by their
publishers. Importing one you own for personal practice and platform testing
is one thing; serving it to paying students requires a content licence from
the publisher. Budget for licensed or commissioned question content before
commercial launch.

## Exam patterns are data

Adding RBI Assistant or LIC AAO needs no code. An exam is a row with a `sections`
array — question count, marks, negative marks, duration, sectional cut-off. The
engine, the palette, the scoring and the analysis all read from it. The admin panel
writes it through a form, and `POST /admin/mock-tests/:id/auto-fill` builds a paper
from the bank against that blueprint, preferring questions no other mock has used.

## Deliberate limits

- **The question bank is seeded, not editorial.** The 2,000 items demonstrate the
  tagging and delivery pipeline. Quant questions are generated with genuinely correct
  arithmetic and worked solutions; English and Reasoning items are authored templates
  that repeat across mocks. Real content is an editorial job, not an engineering one.
- **Rank prediction is not implemented.** Percentile is computed against your own
  cohort on the platform, which is honest. Predicting an all-India rank needs real
  exam data, and a number invented without it would be worse than no number.
- **The store is a JSON file.** Fine for a few hundred candidates; the module boundary
  in `store.js` is the seam to swap in Postgres. Attempt responses are the write-heavy
  path and would move first.
- **No proctoring.** Tab-switch detection, webcam checks and lockdown are their own
  project.
