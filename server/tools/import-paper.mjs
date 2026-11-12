#!/usr/bin/env node
/**
 * BankExamsPro paper importer.
 *
 * Turns the text of a solved paper (pdftotext output) into the platform's
 * question format. Built against the conventions of published IBPS solved
 * papers: numbered questions, five options (a)-(e), "Directions (X-Y):"
 * blocks shared across a run of questions, and an "Answer Key & Solutions"
 * region with entries like "17. (c) S is the niece of O."
 *
 *   pdftotext paper.pdf paper.txt
 *   node tools/import-paper.mjs paper.txt > parsed.json
 *
 * Output: { sections, stimuli, questions, report }
 * Questions that parse cleanly but fail validation land in report.review
 * with a reason, instead of being silently dropped or silently mangled —
 * fractions and diagrams do not survive pdftotext, and pretending they do
 * would put broken questions in front of candidates.
 */
import fs from 'fs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/import-paper.mjs <paper.txt>'); process.exit(1); }
let raw = fs.readFileSync(file, 'utf8');

// ---------------------------------------------------------------------------
// Cleanup: strip running heads, page numbers, decorative lines
// ---------------------------------------------------------------------------
raw = raw
  .replace(/\r/g, '')
  .replace(/^\s*IBPS[- ]PO.*(SOLVED PAPERS?|Solved Paper \d{4})\s*$/gim, '')
  .replace(/^\s*\d{1,3}\s*$/gm, '')          // bare page numbers
  .replace(/^\s*[❖✦*]+[\s❖✦*]*$/gm, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\t/g, ' ');

// ---------------------------------------------------------------------------
// Split paper body from the solutions region
// ---------------------------------------------------------------------------
const keyIdx = raw.search(/Answer\s*Key\s*&?\s*Solutions?/i);
const body = keyIdx >= 0 ? raw.slice(0, keyIdx) : raw;
const solutions = keyIdx >= 0 ? raw.slice(keyIdx) : '';

// ---------------------------------------------------------------------------
// Section headers → section map. Extend SECTION_MAP for other papers.
// ---------------------------------------------------------------------------
const SECTION_MAP = [
  { re: /REASONING\s*&?\s*COMPUTER/i, id: 'rea', name: 'Reasoning & Computer Aptitude', expectedTimeSec: 75 },
  { re: /ENGLISH\s+LANGUAGE/i, id: 'eng', name: 'English Language', expectedTimeSec: 60 },
  { re: /DATA\s+ANALYSIS/i, id: 'dai', name: 'Data Analysis & Interpretation', expectedTimeSec: 90 },
  { re: /QUANTITATIVE\s+APTITUDE|NUMERICAL\s+ABILITY/i, id: 'qua', name: 'Quantitative Aptitude', expectedTimeSec: 70 },
  { re: /GENERAL.*(ECONOMY|BANKING|AWARENESS)/i, id: 'ga', name: 'General, Economy & Banking Awareness', expectedTimeSec: 30 },
];

// Locate section header positions in the body.
const sectionHits = [];
for (const s of SECTION_MAP) {
  const m = body.match(s.re);
  if (m) sectionHits.push({ ...s, at: m.index });
}
sectionHits.sort((a, b) => a.at - b.at);
const sectionAt = (pos) => {
  let cur = sectionHits[0] || { id: 'rea', name: 'Reasoning', expectedTimeSec: 60 };
  for (const s of sectionHits) if (s.at <= pos) cur = s;
  return cur;
};

const LETTERS = 'abcde';

// ---------------------------------------------------------------------------
// Directions blocks → stimuli.   "Directions (7-10): text..."
// ---------------------------------------------------------------------------
const stimuli = [];
const dirRe = /Directions\s*\((\d{1,3})\s*[-–]\s*(\d{1,3})\)\s*:?\s*/g;
const dirBlocks = [];
let dm;
while ((dm = dirRe.exec(body))) {
  dirBlocks.push({ from: Number(dm[1]), to: Number(dm[2]), at: dm.index, textStart: dm.index + dm[0].length });
}
// A directions block's text runs until its first question number appears.
for (const d of dirBlocks) {
  const qStart = body.slice(d.textStart).search(new RegExp(`(^|\\n)\\s*${d.from}\\.\\s`));
  d.text = body.slice(d.textStart, qStart >= 0 ? d.textStart + qStart : d.textStart + 600)
    .replace(/\s+/g, ' ').trim();
  const id = `stim_${d.from}_${d.to}`;
  stimuli.push({ id, type: 'directions', title: `Directions for questions ${d.from}–${d.to}`, text: d.text });
  d.stimulusId = id;
}
const stimulusFor = (n) => dirBlocks.find((d) => n >= d.from && n <= d.to)?.stimulusId || null;

// Statement-sufficiency convention: the five options are defined once inside
// the Directions block ("give answer: (a) ... (b) ...") and apply to every
// question in the run. Extract them so child questions can inherit.
for (const d of dirBlocks) {
  const optRe = /\(([a-e])\)\s*/g;
  const hits = [];
  let m;
  while ((m = optRe.exec(d.text))) hits.push({ letter: m[1], start: m.index + m[0].length, at: m.index });
  if (hits.length >= 4) {
    const opts = [];
    hits.forEach((h, i) => {
      const end = i + 1 < hits.length ? hits[i + 1].at : d.text.length;
      opts[LETTERS.indexOf(h.letter)] = d.text.slice(h.start, end).replace(/\s+/g, ' ').trim();
    });
    if (opts.filter(Boolean).length >= 4) d.sharedOptions = opts;
  }
}
const sharedOptionsFor = (n) => dirBlocks.find((d) => n >= d.from && n <= d.to)?.sharedOptions || null;

// ---------------------------------------------------------------------------
// Questions.  "N. stem ... (a) opt (b) opt ..." until next "M." or Directions
// ---------------------------------------------------------------------------
const qRe = /(^|\n)\s*(\d{1,3})\.\s+/g;
const qHits = [];
let qm;
while ((qm = qRe.exec(body))) qHits.push({ n: Number(qm[2]), at: qm.index, textStart: qm.index + qm[0].length });

// Keep only a sane ascending run (page artefacts can inject stray numbers).
const questionsRaw = [];
let expect = 1;
for (const h of qHits) {
  if (h.n === expect || h.n === expect + 1 || (questionsRaw.length === 0 && h.n === 1)) {
    questionsRaw.push(h);
    expect = h.n + 1;
  }
}
questionsRaw.forEach((h, i) => {
  const end = i + 1 < questionsRaw.length ? questionsRaw[i + 1].at : body.length;
  let chunk = body.slice(h.textStart, end);
  const nextDir = chunk.search(/Directions\s*\(\d/);
  if (nextDir >= 0) chunk = chunk.slice(0, nextDir);
  h.chunk = chunk;
});

// ---------------------------------------------------------------------------
// Answers + explanations from the solutions region:  "17. (c) explanation..."
// ---------------------------------------------------------------------------
const answers = new Map();
const ansRe = /(^|\n)\s*(\d{1,3})\.\s*\(([a-e])\)\s*/g;
const ansHits = [];
let am;
while ((am = ansRe.exec(solutions))) ansHits.push({ n: Number(am[2]), letter: am[3], at: am.index, textStart: am.index + am[0].length });
ansHits.forEach((h, i) => {
  if (answers.has(h.n)) return; // first occurrence wins
  const end = i + 1 < ansHits.length ? ansHits[i + 1].at : Math.min(solutions.length, h.at + 900);
  let expl = solutions.slice(h.textStart, end)
    .replace(/Solutions?\s*\(\d+[-–]\d+\)\s*:?[\s\S]*$/i, '')
    .replace(/\s+/g, ' ').trim();
  if (expl.length > 550) expl = expl.slice(0, 550).replace(/\s+\S*$/, '') + '…';
  answers.set(h.n, { letter: h.letter, explanation: expl });
});

// ---------------------------------------------------------------------------
// Per-question parse: stem + options
// ---------------------------------------------------------------------------

/** Text likely mangled by pdftotext: stray formula fragments, lone symbols. */
const looksMangled = (t) =>
  /[⇒×÷√∆]|(\d\s+\d\s+\d\s+\d)|^[^A-Za-z]*$/.test(t) && !/^\d[\d,.\s:%–-]*$/.test(t);

const questions = [];
const review = [];

for (const h of questionsRaw) {
  const sec = sectionAt(h.at);
  const optRe = /\(([a-e])\)\s*/g;
  const parts = [];
  let om, last = null;
  while ((om = optRe.exec(h.chunk))) {
    if (last) last.end = om.index;
    last = { letter: om[1], start: om.index + om[0].length, end: h.chunk.length };
    if (!parts.length) parts.stemEnd = om.index;
    parts.push(last);
  }

  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  const stem = clean(h.chunk.slice(0, parts.stemEnd ?? h.chunk.length));
  const options = [];
  for (const p of parts) {
    const idx = LETTERS.indexOf(p.letter);
    options[idx] = clean(h.chunk.slice(p.start, p.end));
  }
  // Inherit shared options from the Directions block when the question body
  // has none of its own (statement-sufficiency and similar formats).
  const shared = sharedOptionsFor(h.n);
  if (options.filter(Boolean).length < 4 && shared) {
    shared.forEach((o, i) => { if (options[i] === undefined || options[i] === '') options[i] = o; });
  }

  const ans = answers.get(h.n);
  const q = {
    number: h.n,
    sectionId: sec.id,
    sectionName: sec.name,
    stimulusId: stimulusFor(h.n),
    text: stem,
    options: options.map((o) => ({ text: o ?? '' })),
    answer: ans ? LETTERS.indexOf(ans.letter) : null,
    explanation: ans?.explanation || '',
    expectedTimeSec: sec.expectedTimeSec,
    difficulty: 'Moderate',
  };

  // ---- validation → import or review ----
  const problems = [];
  if (!stem || stem.length < 8) problems.push('stem missing or too short');
  if (options.filter(Boolean).length < 4) problems.push(`only ${options.filter(Boolean).length} options found`);
  if (options.some((o) => o !== undefined && o.length === 0)) problems.push('an option is empty');
  if (q.answer == null) problems.push('no answer found in the key');
  if (q.answer != null && !options[q.answer]) problems.push(`key says (${ans.letter}) but that option was not parsed`);
  if (looksMangled(stem) || options.some((o) => o && looksMangled(o))) {
    problems.push('contains formula/diagram content that pdftotext mangles — re-enter by hand or attach an image');
  }

  if (problems.length) review.push({ number: h.n, section: sec.name, problems, stemPreview: stem.slice(0, 90) });
  else questions.push(q);
}

// Drop stimuli nothing references cleanly
const usedStim = new Set(questions.map((q) => q.stimulusId).filter(Boolean));
const keptStimuli = stimuli.filter((s) => usedStim.has(s.id));

const sections = [...new Set(questions.map((q) => q.sectionId))].map((id) => ({
  id,
  name: questions.find((q) => q.sectionId === id).sectionName,
  count: questions.filter((q) => q.sectionId === id).length,
}));

const out = {
  sections,
  stimuli: keptStimuli,
  questions,
  report: {
    detected: questionsRaw.length,
    imported: questions.length,
    withStimulus: questions.filter((q) => q.stimulusId).length,
    withExplanation: questions.filter((q) => q.explanation).length,
    fiveOption: questions.filter((q) => q.options.length === 5).length,
    needsReview: review.length,
    review,
  },
};
console.log(JSON.stringify(out, null, 2));
console.error(`sections: ${sections.map((s) => `${s.name} ${s.count}`).join(' | ')}
detected ${out.report.detected} · imported ${out.report.imported} · review ${review.length} · with directions ${out.report.withStimulus} · with solutions ${out.report.withExplanation}`);
