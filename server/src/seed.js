/**
 * Seeds a working platform: IBPS PO Prelims 2026 + SBI Clerk Prelims 2026,
 * a tagged question bank, 10 published mocks, an admin, and a demo student
 * with 7 mocks already submitted so the AI analysis has a journey to read.
 *
 *   npm run seed
 */
import { reset, id } from './store.js';
import { scoreAttempt, percentileFor } from './ai/metrics.js';

const rnd = (() => { let s = 20260729; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const shuffleAnswer = (correct, distractors) => {
  const opts = [correct, ...distractors];
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return { options: opts.map(String), answer: opts.indexOf(correct) };
};

const questions = [];
const stimuli = [];

function addQ(q) {
  const question = {
    id: id('qst'), type: 'mcq', marks: 1, negativeMarks: 0.25,
    chapter: q.topic, difficulty: 'Moderate', expectedTimeSec: 45,
    textHi: '', optionsHi: [], image: null, table: null, stimulusId: null,
    createdAt: new Date().toISOString(), ...q,
  };
  questions.push(question);
  return question;
}

// ---------------------------------------------------------------------------
// Quantitative Aptitude — generated, and genuinely solvable
// ---------------------------------------------------------------------------
const quantGenerators = {
  'Simplification': () => {
    const a = int(12, 40), b = int(3, 12), c = int(5, 25);
    const ans = a * b - c;
    return {
      text: `Solve: ${a} × ${b} − ${c} = ?`,
      ...shuffleAnswer(ans, [ans + int(3, 9), ans - int(3, 9), ans + int(11, 22)]),
      explanation: `${a} × ${b} = ${a * b}; ${a * b} − ${c} = ${ans}.`,
      expectedTimeSec: 25, difficulty: 'Easy',
    };
  },
  'Percentage': () => {
    const total = int(20, 60) * 25, p = pick([12, 15, 18, 24, 35, 45]);
    const ans = (total * p) / 100;
    return {
      text: `${p}% of ${total} is what number?`,
      ...shuffleAnswer(ans, [ans + total / 100 * 5, ans - total / 100 * 4, ans + total / 100 * 9]),
      explanation: `${p}% of ${total} = ${total} × ${p}/100 = ${ans}.`,
      expectedTimeSec: 30, difficulty: 'Easy',
    };
  },
  'Average': () => {
    const n = int(5, 9), avg = int(20, 60), extra = int(10, 90);
    const ans = Number(((avg * n + extra) / (n + 1)).toFixed(2));
    return {
      text: `The average of ${n} numbers is ${avg}. When one more number is included, the average of all ${n + 1} numbers becomes what, if the new number is ${extra}?`,
      ...shuffleAnswer(ans, [Number((ans + 2.5).toFixed(2)), Number((ans - 1.75).toFixed(2)), Number((ans + 4.2).toFixed(2))]),
      explanation: `Sum of ${n} numbers = ${avg * n}. New sum = ${avg * n + extra}. New average = ${avg * n + extra}/${n + 1} = ${ans}.`,
      expectedTimeSec: 50,
    };
  },
  'Profit and Loss': () => {
    const cp = int(8, 30) * 50, p = pick([10, 12, 15, 20, 25]);
    const ans = cp + (cp * p) / 100;
    return {
      text: `An article bought for ₹${cp} is sold at a profit of ${p}%. Find the selling price.`,
      ...shuffleAnswer(ans, [cp + (cp * (p + 5)) / 100, cp - (cp * p) / 100, cp + (cp * (p - 4)) / 100]),
      explanation: `SP = CP × (100 + ${p})/100 = ${cp} × ${(100 + p) / 100} = ₹${ans}.`,
      expectedTimeSec: 45,
    };
  },
  'Simple Interest': () => {
    const p = int(4, 20) * 500, r = pick([4, 5, 6, 8, 10, 12]), t = int(2, 5);
    const ans = (p * r * t) / 100;
    return {
      text: `Find the simple interest on ₹${p} at ${r}% per annum for ${t} years.`,
      ...shuffleAnswer(ans, [(p * r * (t + 1)) / 100, (p * (r + 2) * t) / 100, (p * r * t) / 200]),
      explanation: `SI = PRT/100 = ${p} × ${r} × ${t} / 100 = ₹${ans}.`,
      expectedTimeSec: 40,
    };
  },
  'Time and Work': () => {
    const a = int(6, 15), b = int(8, 24);
    const ans = Number(((a * b) / (a + b)).toFixed(2));
    return {
      text: `A can finish a piece of work in ${a} days and B in ${b} days. Working together, they finish it in how many days?`,
      ...shuffleAnswer(ans, [Number((ans + 1.5).toFixed(2)), Number((ans - 1.2).toFixed(2)), Number(((a + b) / 2).toFixed(2))]),
      explanation: `Combined one-day work = 1/${a} + 1/${b}. Days = ${a}×${b}/(${a}+${b}) = ${ans}.`,
      expectedTimeSec: 60, difficulty: 'Hard',
    };
  },
  'Number Series': () => {
    const start = int(3, 9), d = int(2, 6);
    const seq = [start, start + d, start + 2 * d + 1, start + 3 * d + 3, start + 4 * d + 6];
    const ans = start + 5 * d + 10;
    return {
      text: `Find the next term: ${seq.join(', ')}, ?`,
      ...shuffleAnswer(ans, [ans + d, ans - 2, ans + 2 * d]),
      explanation: `Differences increase by 1 each step: ${d}, ${d + 1}, ${d + 2}, ${d + 3}, so the next difference is ${d + 4}, giving ${ans}.`,
      expectedTimeSec: 55, difficulty: 'Hard',
    };
  },
  'Ratio and Proportion': () => {
    const x = int(2, 7), y = int(3, 9), total = (x + y) * int(8, 30);
    const ans = (total * x) / (x + y);
    return {
      text: `₹${total} is divided between two people in the ratio ${x} : ${y}. What is the larger share of the first person's ratio part?`,
      ...shuffleAnswer(ans, [(total * y) / (x + y), total / 2, (total * x) / (x + y) + 40]),
      explanation: `First share = ${total} × ${x}/${x + y} = ₹${ans}.`,
      expectedTimeSec: 45,
    };
  },
};

function makeDataInterpretation(examId, sectionId) {
  const branches = ['Andheri', 'Borivali', 'Chembur', 'Dadar'];
  const rows = branches.map((b) => ({ branch: b, savings: int(120, 480) * 10, current: int(60, 300) * 10 }));
  const stim = {
    id: id('stm'), type: 'di',
    title: 'Accounts opened at four branches during the quarter',
    text: 'Study the table and answer the questions that follow. All figures are the number of accounts opened.',
    table: {
      headers: ['Branch', 'Savings accounts', 'Current accounts'],
      rows: rows.map((r) => [r.branch, String(r.savings), String(r.current)]),
    },
  };
  stimuli.push(stim);

  const totalSavings = rows.reduce((a, r) => a + r.savings, 0);
  const first = rows[0], second = rows[1];
  const ratioAns = `${(first.savings / 10)} : ${(first.current / 10)}`;
  const out = [];
  out.push(addQ({
    examId, sectionId, stimulusId: stim.id, topic: 'Data Interpretation — Table',
    text: `What is the total number of savings accounts opened across all four branches?`,
    ...shuffleAnswer(totalSavings, [totalSavings + 200, totalSavings - 150, totalSavings + 430]),
    explanation: `${rows.map((r) => r.savings).join(' + ')} = ${totalSavings}.`,
    expectedTimeSec: 55,
  }));
  out.push(addQ({
    examId, sectionId, stimulusId: stim.id, topic: 'Data Interpretation — Table',
    text: `The number of savings accounts at ${first.branch} is what percent of the savings accounts at ${second.branch}? (rounded to the nearest whole number)`,
    ...shuffleAnswer(Math.round((first.savings / second.savings) * 100),
      [Math.round((first.savings / second.savings) * 100) + 7, Math.round((second.savings / first.savings) * 100), Math.round((first.savings / second.savings) * 100) - 11]),
    explanation: `${first.savings}/${second.savings} × 100 ≈ ${Math.round((first.savings / second.savings) * 100)}%.`,
    expectedTimeSec: 60, difficulty: 'Hard',
  }));
  out.push(addQ({
    examId, sectionId, stimulusId: stim.id, topic: 'Data Interpretation — Table',
    text: `What is the ratio of savings accounts to current accounts at ${first.branch}, in its simplest stated form?`,
    ...shuffleAnswer(ratioAns, [`${first.current / 10} : ${first.savings / 10}`, `${second.savings / 10} : ${second.current / 10}`, `${first.savings / 20} : ${first.current / 10}`]),
    explanation: `${first.savings} : ${first.current}, divided through by 10.`,
    expectedTimeSec: 50,
  }));
  return out;
}

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------
const reasoningBank = [
  { topic: 'Syllogism', text: 'Statements: All ledgers are files. Some files are drafts.\nConclusions: I. Some ledgers are drafts. II. All drafts being files is a possibility.', options: ['Only I follows', 'Only II follows', 'Both follow', 'Neither follows'], answer: 1, explanation: 'No definite link is established between ledgers and drafts, so I does not follow. II is a valid possibility case.', expectedTimeSec: 50 },
  { topic: 'Syllogism', text: 'Statements: No cheque is a coin. All coins are notes.\nConclusions: I. Some notes are not cheques. II. No note is a cheque.', options: ['Only I follows', 'Only II follows', 'Either I or II follows', 'Both follow'], answer: 0, explanation: 'Coins are notes and no coin is a cheque, so at least those notes are not cheques. II is too strong.', expectedTimeSec: 55 },
  { topic: 'Blood Relations', text: 'Pointing to a photograph, Rahul said, "She is the daughter of the only son of my grandmother." How is the woman in the photograph related to Rahul?', options: ['Sister', 'Cousin', 'Niece', 'Aunt'], answer: 0, explanation: "The only son of Rahul's grandmother is his father, so the woman is his sister.", expectedTimeSec: 45 },
  { topic: 'Blood Relations', text: 'A is the mother of B. B is the brother of C. C is the daughter of D. How is A related to D?', options: ['Sister', 'Wife', 'Daughter', 'Cannot be determined'], answer: 1, explanation: 'A and D are the parents of B and C, so A is the wife of D.', expectedTimeSec: 40 },
  { topic: 'Direction Sense', text: 'Meera walks 8 m north, turns right and walks 6 m, then turns right and walks 8 m. How far is she from her starting point and in which direction?', options: ['6 m east', '6 m west', '14 m east', '10 m north-east'], answer: 0, explanation: 'The two 8 m stretches cancel, leaving 6 m to the east of the start.', expectedTimeSec: 45 },
  { topic: 'Direction Sense', text: 'A point P is 5 m south of Q. R is 12 m east of P. What is the shortest distance between Q and R?', options: ['13 m', '17 m', '15 m', '7 m'], answer: 0, explanation: '√(5² + 12²) = 13 m.', expectedTimeSec: 40 },
  { topic: 'Inequality', text: 'Statements: P ≥ Q > R = S ≤ T\nConclusions: I. P > R  II. T ≥ R', options: ['Only I follows', 'Only II follows', 'Both follow', 'Neither follows'], answer: 2, explanation: 'P ≥ Q > R gives P > R. S ≤ T with R = S gives T ≥ R.', expectedTimeSec: 40, difficulty: 'Easy' },
  { topic: 'Inequality', text: 'Statements: A < B ≤ C; D ≥ C\nConclusions: I. D > A  II. B ≤ D', options: ['Only I follows', 'Only II follows', 'Both follow', 'Neither follows'], answer: 2, explanation: 'D ≥ C ≥ B > A gives both.', expectedTimeSec: 40, difficulty: 'Easy' },
  { topic: 'Coding-Decoding', text: "In a certain code, BANK is written as CBOL. How is LOAN written in that code?", options: ['MPBO', 'MPBN', 'KNZM', 'MOBP'], answer: 0, explanation: 'Each letter moves one step forward: L→M, O→P, A→B, N→O.', expectedTimeSec: 45 },
  { topic: 'Coding-Decoding', text: "If 'money' is coded as 'yenom', how is 'credit' coded?", options: ['tiderc', 'tidcre', 'ticred', 'derctil'], answer: 0, explanation: 'The word is reversed.', expectedTimeSec: 30, difficulty: 'Easy' },
  { topic: 'Alphanumeric Series', text: 'Series: 5 P @ 3 K # 9 W 2 & M 7. How many symbols are immediately preceded by a number?', options: ['One', 'Two', 'Three', 'None'], answer: 1, explanation: '@ is preceded by 3? No — @ is preceded by P. # is preceded by K. & is preceded by 2. Counting carefully gives two.', expectedTimeSec: 55, difficulty: 'Hard' },
  { topic: 'Order and Ranking', text: 'In a row of 40 students, Ankit is 12th from the left and Bela is 18th from the right. How many students are between them?', options: ['10', '11', '9', '12'], answer: 0, explanation: "Bela's position from the left is 40 − 18 + 1 = 23. Students between = 23 − 12 − 1 = 10.", expectedTimeSec: 45 },
];


// ---------------------------------------------------------------------------
// Image-based questions — figure series with SVG images in the question AND
// in every option, the way non-verbal reasoning appears in the real paper.
// Data-URI SVGs keep the seed self-contained; admin uploads use /api/media.
// ---------------------------------------------------------------------------
const svgUri = (inner, w = 210, h = 70) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="white"/>${inner}</svg>`
  );

const shapeAt = (x, rot, kind) => {
  const cx = x + 30, cy = 35;
  const body = kind === 'square'
    ? `<rect x="${cx - 14}" y="${cy - 14}" width="28" height="28" fill="none" stroke="black" stroke-width="2.5"/>`
    : `<polygon points="${cx},${cy - 16} ${cx + 15},${cy + 12} ${cx - 15},${cy + 12}" fill="none" stroke="black" stroke-width="2.5"/>`;
  const dot = `<circle cx="${cx}" cy="${cy - 22}" r="3.5" fill="black"/>`;
  return `<g transform="rotate(${rot} ${cx} ${cy})">${body}${dot}</g>`;
};

const cellSvg = (rot, kind) => svgUri(shapeAt(2, rot, kind), 66, 70);

function makeFigureSeries(examId, sectionId, mockIndex) {
  const out = [];
  const configs = [
    { kind: 'square', step: 45 },
    { kind: 'triangle', step: 90 },
  ];
  configs.forEach((cfg, ci) => {
    const start = ((mockIndex * 37 + ci * 53) % 8) * 45;
    const rots = [0, 1, 2, 3].map((i) => (start + i * cfg.step) % 360);
    const answerRot = (start + 4 * cfg.step) % 360;
    // The question shows the four-frame series; the fifth frame is asked for.
    const series = svgUri(
      rots.map((r, i) => shapeAt(6 + i * 68, r, cfg.kind)).join('') +
      `<rect x="${6 + 4 * 68}" y="8" width="60" height="54" fill="none" stroke="black" stroke-dasharray="4 3"/>` +
      `<text x="${6 + 4 * 68 + 30}" y="42" text-anchor="middle" font-size="26" font-family="Verdana">?</text>`,
      360, 70
    );
    const wrongRots = [
      (answerRot + cfg.step) % 360,
      (answerRot + 180 + cfg.step / 2) % 360,
      (answerRot - cfg.step + 360 - 15) % 360,
    ];
    const optionImages = [cellSvg(answerRot, cfg.kind), ...wrongRots.map((r) => cellSvg(r, cfg.kind))];
    const order = [0, 1, 2, 3].sort(() => rnd() - 0.5);
    const options = order.map((oi) => ({ text: '', image: optionImages[oi] }));
    const answer = order.indexOf(0);

    out.push(addQ({
      examId, sectionId,
      topic: 'Figure Series', chapter: 'Non-verbal Reasoning',
      difficulty: 'Moderate', expectedTimeSec: 50,
      text: 'Select the figure that continues the series shown below.',
      image: series,
      options,
      answer,
      explanation: `The figure rotates ${cfg.step}° clockwise at each step; the fifth frame continues the same rotation.`,
    }));
  });
  return out;
}

function makeSeatingPuzzle(examId, sectionId) {
  const stim = {
    id: id('stm'), type: 'puzzle',
    title: 'Seating arrangement',
    text: 'Eight bank officers — A, B, C, D, E, F, G and H — sit around a circular table facing the centre. C sits third to the left of A. B sits second to the right of A. D is an immediate neighbour of neither A nor C. E sits between F and G. H is not adjacent to B.',
  };
  stimuli.push(stim);
  return [
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Seating Arrangement', difficulty: 'Hard', expectedTimeSec: 70,
      text: 'Who sits second to the left of C?', options: ['D', 'F', 'H', 'E'], answer: 2,
      explanation: 'Fixing A, then C third to its left and B second to its right, the remaining constraints place H second to the left of C.' }),
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Seating Arrangement', difficulty: 'Hard', expectedTimeSec: 70,
      text: 'How many officers sit between B and D when counted clockwise from B?', options: ['Two', 'Three', 'Four', 'One'], answer: 1,
      explanation: 'From the completed arrangement, three officers fall between B and D in the clockwise direction.' }),
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Seating Arrangement', difficulty: 'Hard', expectedTimeSec: 65,
      text: 'Which of the following pairs sit adjacent to each other?', options: ['A and D', 'E and F', 'B and H', 'C and D'], answer: 1,
      explanation: 'E sits between F and G, so E and F are adjacent by the given condition.' }),
  ];
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------
const englishBank = [
  { topic: 'Error Spotting', text: 'Identify the part containing the error: "Neither the manager nor the clerks (A) / was aware of the (B) / revised guidelines issued (C) / by the head office. (D)"', options: ['A', 'B', 'C', 'D'], answer: 1, explanation: 'With "neither… nor", the verb agrees with the nearer subject "clerks", so it should be "were aware".', expectedTimeSec: 45 },
  { topic: 'Error Spotting', text: 'Identify the part containing the error: "The committee have decided (A) / to defer the matter (B) / until the next quarter (C) / without further discussion. (D)"', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'A committee acting as one body takes a singular verb: "has decided".', expectedTimeSec: 45 },
  { topic: 'Sentence Improvement', text: 'Choose the best replacement for the underlined part: The bank has been "issuing loans since the last five years".', options: ['issuing loans for the last five years', 'issued loans since five years', 'issuing loans from five years', 'No improvement required'], answer: 0, explanation: '"For" is used with a period of time; "since" needs a point in time.', expectedTimeSec: 40 },
  { topic: 'Fillers', text: 'The RBI has ______ strict norms to ______ the flow of unaccounted money.', options: ['imposed / curb', 'proposed / curbing', 'impose / curbed', 'imposing / curbs'], answer: 0, explanation: 'The present perfect needs "imposed", and the infinitive "to curb" follows.', expectedTimeSec: 35, difficulty: 'Easy' },
  { topic: 'Fillers', text: 'Despite the ______ in digital payments, cash remains ______ in rural markets.', options: ['surge / dominant', 'surging / dominance', 'surge / dominate', 'surged / dominantly'], answer: 0, explanation: 'A noun follows "the", and an adjective follows "remains".', expectedTimeSec: 35, difficulty: 'Easy' },
  { topic: 'Cloze Test', text: 'Financial inclusion is not merely about opening accounts; it is about ______ them meaningfully.', options: ['using', 'used', 'use', 'uses'], answer: 0, explanation: 'The preposition "about" takes a gerund.', expectedTimeSec: 35 },
  { topic: 'Para Jumbles', text: 'Arrange to form a coherent paragraph:\n(P) This changed after the payments bank licences were issued.\n(Q) Rural banking was long seen as unprofitable.\n(R) Costs fell sharply once services moved to mobile phones.\n(S) Branch networks were simply too expensive to maintain.', options: ['QSPR', 'QPSR', 'SQRP', 'PQRS'], answer: 0, explanation: 'Q states the view, S explains why, P marks the turn, R gives the result.', expectedTimeSec: 60, difficulty: 'Hard' },
  { topic: 'Vocabulary', text: 'Choose the word most nearly similar in meaning to PRUDENT.', options: ['Judicious', 'Reckless', 'Lavish', 'Indifferent'], answer: 0, explanation: 'Prudent means careful and judicious.', expectedTimeSec: 25, difficulty: 'Easy' },
  { topic: 'Vocabulary', text: 'Choose the word most nearly opposite in meaning to CURTAIL.', options: ['Extend', 'Reduce', 'Abridge', 'Restrict'], answer: 0, explanation: 'Curtail means to cut short; its opposite is to extend.', expectedTimeSec: 25, difficulty: 'Easy' },
];

function makeComprehension(examId, sectionId) {
  const stim = {
    id: id('stm'), type: 'passage',
    title: 'Reading comprehension',
    text: `India's shift to digital payments has been described as sudden, but the groundwork was laid over a decade. A shared public infrastructure allowed any bank to talk to any other bank in real time, and because the rails were free to use, competition moved to the quality of the application rather than the cost of the transfer. Small merchants adopted the system faster than large retailers, largely because the cost of accepting a payment fell to almost nothing.

The consequences have not been uniformly positive. Fraud has grown alongside volume, and grievance redress has not kept pace. Regulators now face a familiar dilemma: tighten the rules and risk slowing an engine of inclusion, or leave them loose and let losses fall on the least equipped users. Most policy proposals in circulation try to split the difference, placing the burden of verification on the institutions best able to bear it.`,
  };
  stimuli.push(stim);
  return [
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Reading Comprehension', expectedTimeSec: 60,
      text: 'According to the passage, why did competition shift to the quality of applications?', options: ['Because the transfer rails cost nothing to use', 'Because banks were barred from charging fees', 'Because large retailers refused to adopt the system', 'Because regulators mandated better applications'], answer: 0,
      explanation: 'The passage states the rails were free to use, so competition moved to the application layer.' }),
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Reading Comprehension', expectedTimeSec: 55,
      text: 'Which group adopted the system fastest, and why?', options: ['Small merchants, because acceptance cost almost nothing', 'Large retailers, because of volume discounts', 'Banks, because of regulatory pressure', 'Urban consumers, because of smartphone access'], answer: 0,
      explanation: 'Small merchants adopted fastest as the cost of accepting a payment fell to nearly zero.' }),
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Reading Comprehension', expectedTimeSec: 60, difficulty: 'Hard',
      text: 'The regulatory dilemma described in the passage is best summarised as a choice between', options: ['inclusion and consumer protection', 'public and private infrastructure', 'urban and rural coverage', 'domestic and foreign banks'], answer: 0,
      explanation: 'Tightening rules risks slowing inclusion; loosening them shifts losses to vulnerable users.' }),
    addQ({ examId, sectionId, stimulusId: stim.id, topic: 'Reading Comprehension', expectedTimeSec: 40,
      text: 'The word "redress" in the passage most nearly means', options: ['remedy', 'refusal', 'reversal of policy', 'repetition'], answer: 0,
      explanation: 'Grievance redress refers to remedying complaints.' }),
  ];
}

// ---------------------------------------------------------------------------
// Blueprints
// ---------------------------------------------------------------------------
const ibps = {
  id: id('exm'), code: 'IBPS-PO-PRE-2026', name: 'IBPS PO 2026', year: 2026,
  organisation: 'Institute of Banking Personnel Selection', tier: 'Prelims',
  durationMin: 60, sectionalTiming: true, cutoffTotal: 58, difficulty: 'Moderate',
  languages: ['en', 'hi'], plannedMockCount: 10, status: 'published',
  sections: [
    { id: 'eng', name: 'English Language', questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 9 },
    { id: 'rea', name: 'Reasoning Ability', questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 12 },
    { id: 'qua', name: 'Quantitative Aptitude', questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 11 },
  ],
  createdAt: new Date().toISOString(),
};

const sbi = {
  id: id('exm'), code: 'SBI-CLERK-PRE-2026', name: 'SBI Clerk 2026', year: 2026,
  organisation: 'State Bank of India', tier: 'Prelims',
  durationMin: 60, sectionalTiming: true, cutoffTotal: 72, difficulty: 'Easy to Moderate',
  languages: ['en', 'hi'], plannedMockCount: 10, status: 'published',
  sections: [
    { id: 'eng', name: 'English Language', questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 8 },
    { id: 'num', name: 'Numerical Ability', questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 10 },
    { id: 'rea', name: 'Reasoning Ability', questionCount: 35, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 11 },
  ],
  createdAt: new Date().toISOString(),
};

/** Build a full paper for one mock test of the given exam. */
function buildPaper(exam, mockIndex) {
  return exam.sections.map((section) => {
    const ids = [];
    const isEnglish = section.id === 'eng';
    const isQuant = section.id === 'qua' || section.id === 'num';

    if (isEnglish) {
      ids.push(...makeComprehension(exam.id, section.id).map((q) => q.id));
      while (ids.length < section.questionCount) {
        const base = englishBank[(ids.length + mockIndex) % englishBank.length];
        ids.push(addQ({ examId: exam.id, sectionId: section.id, ...base }).id);
      }
    } else if (isQuant) {
      ids.push(...makeDataInterpretation(exam.id, section.id).map((q) => q.id));
      const topics = Object.keys(quantGenerators);
      while (ids.length < section.questionCount) {
        const topic = topics[(ids.length + mockIndex) % topics.length];
        ids.push(addQ({ examId: exam.id, sectionId: section.id, topic, ...quantGenerators[topic]() }).id);
      }
    } else {
      ids.push(...makeSeatingPuzzle(exam.id, section.id).map((q) => q.id));
      ids.push(...makeFigureSeries(exam.id, section.id, mockIndex).map((q) => q.id));
      while (ids.length < section.questionCount) {
        const base = reasoningBank[(ids.length + mockIndex) % reasoningBank.length];
        ids.push(addQ({ examId: exam.id, sectionId: section.id, ...base }).id);
      }
    }
    return { sectionId: section.id, questionIds: ids.slice(0, section.questionCount) };
  });
}

const exams = [ibps, sbi];
const mockTests = [];
const day0 = Date.now() - 9 * 86400000;

for (const exam of exams) {
  for (let i = 1; i <= exam.plannedMockCount; i++) {
    mockTests.push({
      id: id('mck'), examId: exam.id,
      title: `${exam.name} — Mock Test ${i}`, index: i,
      availableFrom: new Date(day0 + (i - 1) * 86400000).toISOString(),
      published: true,
      sections: buildPaper(exam, i),
      createdAt: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const admin = {
  id: id('usr'), name: 'Priya Menon', email: 'admin@bankexamspro.in', phone: '',
  role: 'admin', createdAt: new Date().toISOString(),
  enrolledExamIds: exams.map((e) => e.id),
};
const student = {
  id: id('usr'), name: 'Arjun Nair', email: 'arjun@student.in', phone: '9876543210',
  role: 'student', createdAt: new Date().toISOString(),
  enrolledExamIds: exams.map((e) => e.id),
};
const rival = {
  id: id('usr'), name: 'Sneha Kulkarni', email: 'sneha@student.in', phone: '',
  role: 'student', createdAt: new Date().toISOString(),
  enrolledExamIds: exams.map((e) => e.id),
};

// ---------------------------------------------------------------------------
// Simulated attempt history — gives the AI engine a real journey to read.
// The profile below is deliberately opinionated: strong English, improving
// Reasoning, and a Quant time problem that never quite resolves.
// ---------------------------------------------------------------------------
const skillProfile = {
  eng: { base: 0.78, growth: 0.008, pace: 0.95, attemptRate: 0.9 },
  rea: { base: 0.52, growth: 0.035, pace: 1.05, attemptRate: 0.82 },
  qua: { base: 0.66, growth: 0.012, pace: 1.45, attemptRate: 0.68 },
  num: { base: 0.7, growth: 0.015, pace: 1.3, attemptRate: 0.75 },
};
const topicModifier = {
  'Figure Series': -0.05,
  'Seating Arrangement': -0.3, 'Number Series': -0.28, 'Time and Work': -0.22,
  'Data Interpretation — Table': -0.12, 'Para Jumbles': -0.2, 'Syllogism': 0.05,
  'Simplification': 0.22, 'Percentage': 0.15, 'Vocabulary': 0.2, 'Inequality': 0.18,
  'Reading Comprehension': 0.08, 'Coding-Decoding': 0.1,
};
const paceModifier = { 'Seating Arrangement': 1.6, 'Data Interpretation — Table': 1.5, 'Number Series': 1.45, 'Time and Work': 1.35, 'Para Jumbles': 1.3 };

const attempts = [];
function simulate(user, exam, count, skillShift = 0) {
  const mocks = mockTests.filter((m) => m.examId === exam.id).slice(0, count);
  mocks.forEach((mock, dayIndex) => {
    const responses = {};
    for (const sec of mock.sections) {
      const profile = skillProfile[sec.sectionId] || skillProfile.rea;
      for (const qid of sec.questionIds) {
        const q = questions.find((x) => x.id === qid);
        const mod = topicModifier[q.topic] || 0;
        const pAttempt = Math.min(0.97, profile.attemptRate + dayIndex * 0.015 + mod * 0.4);
        const pCorrect = Math.min(0.96, Math.max(0.2, profile.base + skillShift + dayIndex * profile.growth + mod));
        const pace = profile.pace * (paceModifier[q.topic] || 1) * (1 - dayIndex * 0.015);
        const timeSec = Math.round(q.expectedTimeSec * pace * (0.75 + rnd() * 0.6));

        if (rnd() > pAttempt) {
          responses[qid] = { selected: null, status: rnd() > 0.7 ? 'marked' : 'not-answered', timeSec: Math.round(timeSec * 0.35), visits: 1 };
          continue;
        }
        const correct = rnd() < pCorrect;
        const wrongChoice = [0, 1, 2, 3].filter((o) => o !== q.answer)[int(0, 2)];
        responses[qid] = {
          selected: correct ? q.answer : wrongChoice,
          status: rnd() > 0.85 ? 'answered-marked' : 'answered',
          timeSec, visits: 1,
        };
      }
    }
    const paperQuestions = mock.sections.flatMap((s) => s.questionIds.map((qid) => questions.find((q) => q.id === qid)));
    const result = scoreAttempt({ exam, mockTest: mock, questions: paperQuestions, responses });
    const submittedAt = new Date(day0 + dayIndex * 86400000 + 9.5 * 3600000).toISOString();
    attempts.push({
      id: id('att'), userId: user.id, examId: exam.id, mockTestId: mock.id,
      mockTitle: mock.title, status: 'submitted', language: 'en',
      startedAt: new Date(new Date(submittedAt).getTime() - exam.durationMin * 60000).toISOString(),
      endsAt: submittedAt, sectionEndsAt: null, currentSectionIndex: exam.sections.length - 1,
      responses, submittedAt, autoSubmitted: dayIndex % 4 === 0, result,
    });
  });
}

simulate(student, ibps, 7);
simulate(rival, ibps, 7, 0.06);

// Percentiles once every attempt exists.
for (const a of attempts) {
  const cohort = attempts.filter((x) => x.mockTestId === a.mockTestId).map((x) => x.result.score);
  a.result.percentile = percentileFor(a.result.score, cohort);
  a.result.cohortSize = cohort.length;
  a.result.topperScore = Math.max(...cohort);
  a.result.averageScore = Number((cohort.reduce((x, y) => x + y, 0) / cohort.length).toFixed(1));
}

reset({ users: [admin, student, rival], exams, mockTests, questions, stimuli, attempts });

console.log(`Seeded BankExamsPro
  exams        ${exams.length}
  mock tests   ${mockTests.length}
  questions    ${questions.length}
  attempts     ${attempts.length}

  Sign-in is OTP-only. Request a code for:
  Admin    admin@bankexamspro.in
  Student  arjun@student.in   (7 mocks already submitted)
  The OTP prints on this console and appears on the sign-in screen (dev mode).`);
