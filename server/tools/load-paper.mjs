#!/usr/bin/env node
/**
 * Loads a parsed paper (output of import-paper.mjs) into the platform as a
 * complete examination with one mock test, writing the database directly.
 *
 *   node tools/import-paper.mjs paper.txt > parsed.json
 *   node tools/load-paper.mjs parsed.json "IBPS PO Mains 2024" --publish
 *
 * Marks note: published solved papers state section totals but not each
 * question's marks. This loader spreads the official section totals evenly
 * across that section's questions (IBPS PO Mains: Reasoning 60, English 40,
 * DAI 60, GA 40 = 200). Where you know true per-question marks, set q.marks
 * in the parsed JSON before loading — scoring honors per-question marks.
 */
import fs from 'fs';
import { db, id, persistNow } from '../src/store.js';

const [, , parsedFile, examName = 'Imported Paper', ...flags] = process.argv;
if (!parsedFile) { console.error('usage: node tools/load-paper.mjs <parsed.json> "<Exam Name>" [--publish]'); process.exit(1); }
const parsed = JSON.parse(fs.readFileSync(parsedFile, 'utf8'));
const publish = flags.includes('--publish');

// Official IBPS PO Mains 2024 pattern; unknown sections get sane defaults.
const PATTERNS = {
  rea: { name: 'Reasoning & Computer Aptitude', durationMin: 60, totalMarks: 60, cutoff: 9 },
  eng: { name: 'English Language', durationMin: 40, totalMarks: 40, cutoff: 10 },
  dai: { name: 'Data Analysis & Interpretation', durationMin: 45, totalMarks: 60, cutoff: 7.75 },
  qua: { name: 'Quantitative Aptitude', durationMin: 45, totalMarks: 50, cutoff: 10 },
  ga: { name: 'General, Economy & Banking Awareness', durationMin: 35, totalMarks: 40, cutoff: 12 },
};

const store = db();
const round2 = (n) => Number(n.toFixed(2));

const sections = parsed.sections.map((s) => {
  const pat = PATTERNS[s.id] || { name: s.name, durationMin: 40, totalMarks: s.count, cutoff: null };
  const perQ = round2(pat.totalMarks / s.count);
  return {
    id: s.id, name: pat.name, questionCount: s.count,
    marksPerQuestion: perQ, negativeMarks: round2(perQ / 4),
    durationMin: pat.durationMin, cutoff: pat.cutoff,
  };
});

const exam = {
  id: id('exm'),
  code: examName.replace(/\s+/g, '-').toUpperCase(),
  name: examName,
  year: Number((examName.match(/(20\d\d)/) || [])[1]) || new Date().getFullYear(),
  organisation: 'Imported from solved paper',
  tier: /mains/i.test(examName) ? 'Mains' : 'Prelims',
  durationMin: sections.reduce((a, s) => a + s.durationMin, 0),
  sectionalTiming: true,
  cutoffTotal: null,
  difficulty: 'As per original paper',
  languages: ['en'],
  plannedMockCount: 1,
  status: publish ? 'published' : 'draft',
  sections,
  createdAt: new Date().toISOString(),
};
store.exams.push(exam);

// Stimuli with id re-mapping
const stimMap = {};
for (const s of parsed.stimuli) {
  const stored = { id: id('stm'), type: s.type || 'directions', title: s.title, text: s.text, table: s.table || null, image: s.image || null };
  store.stimuli.push(stored);
  stimMap[s.id] = stored.id;
}

// Questions in paper order
const bySection = Object.fromEntries(sections.map((s) => [s.id, []]));
for (const q of parsed.questions.sort((a, b) => a.number - b.number)) {
  const sec = sections.find((s) => s.id === q.sectionId);
  const stored = {
    id: id('qst'),
    examId: exam.id,
    sectionId: q.sectionId,
    type: 'mcq',
    topic: q.topic || `${sec.name} — Paper ${exam.year}`,
    chapter: `Q${q.number} of original paper`,
    difficulty: q.difficulty || 'Moderate',
    expectedTimeSec: q.expectedTimeSec || 60,
    marks: sec.marksPerQuestion,
    negativeMarks: sec.negativeMarks,
    stimulusId: q.stimulusId ? stimMap[q.stimulusId] || null : null,
    text: q.text, textHi: '', image: q.image || null, table: null,
    options: q.options, optionsHi: [],
    answer: q.answer,
    explanation: q.explanation || '',
    createdAt: new Date().toISOString(),
  };
  store.questions.push(stored);
  bySection[q.sectionId].push(stored.id);
}

const mock = {
  id: id('mck'),
  examId: exam.id,
  title: `${exam.name} — Actual Paper`,
  index: 1,
  availableFrom: null,
  published: publish,
  sections: sections.map((s) => ({ sectionId: s.id, questionIds: bySection[s.id] })),
  createdAt: new Date().toISOString(),
};
store.mockTests.push(mock);

// Every existing user gets enrolled so the paper shows up immediately.
for (const u of store.users) {
  u.enrolledExamIds = [...new Set([...(u.enrolledExamIds || []), exam.id])];
}

persistNow();
console.log(`Loaded "${exam.name}" (${publish ? 'published' : 'draft'})
  sections  ${sections.map((s) => `${s.name.split(' ')[0]} ${s.questionCount}q × ${s.marksPerQuestion}m / ${s.durationMin}min`).join(' | ')}
  total     ${sections.reduce((a, s) => a + s.questionCount, 0)} questions · ${round2(sections.reduce((a, s) => a + s.questionCount * s.marksPerQuestion, 0))} marks · ${exam.durationMin} minutes
  mock      ${mock.title}`);
