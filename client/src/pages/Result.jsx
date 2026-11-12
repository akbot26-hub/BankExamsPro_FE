import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtClock } from '../api.js';
import { BarRow, SECTION_COLORS } from '../components/Charts.jsx';

const asOption = (o) => (typeof o === 'string' ? { text: o, image: null } : { text: o?.text || '', image: o?.image || null });

const FILTERS = [
  ['all', 'All questions'],
  ['wrong', 'Got wrong'],
  ['skipped', 'Skipped'],
  ['slow', 'Took too long'],
  ['marked', 'Marked for review'],
];

export default function Result() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('wrong');
  const [openId, setOpenId] = useState(null);

  useEffect(() => { api(`/attempts/${attemptId}`).then(setData); }, [attemptId]);

  const rows = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.questions.map((q) => [q.id, q]));
    return data.attempt.result.sections.flatMap((s) =>
      s.perQuestion.map((p, i) => ({ ...p, sectionName: s.name, number: i + 1, q: byId.get(p.questionId) }))
    );
  }, [data]);

  if (!data) return <p className="muted">Loading your result…</p>;
  const { attempt, exam, mockTest } = data;
  const r = attempt.result;

  const totalQuestions = r.sections.reduce((a, s) => a + s.total, 0) || 1;

  const filtered = rows.filter((row) => {
    if (filter === 'wrong') return row.attempted && !row.correct;
    if (filter === 'skipped') return !row.attempted;
    if (filter === 'slow') return row.overtime;
    if (filter === 'marked') return ['marked', 'answered-marked'].includes(attempt.responses[row.questionId]?.status);
    return true;
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{exam.name} · submitted {new Date(attempt.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {attempt.autoSubmitted && ' · auto-submitted on timer'}</div>
          <h1>{mockTest.title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" to={`/exam/${exam.id}`}>All mocks</Link>
          <Link className="btn btn-primary" to={`/exam/${exam.id}/analysis`}>What this means</Link>
        </div>
      </div>

      <div className="grid stat">
        <div className="stat-box">
          <div className="k">Score</div>
          <div className="v">{r.score}<small> / {r.maxScore}</small></div>
          <div className="sub">{r.clearedOverallCutoff ? `Above the ${exam.cutoffTotal} cut-off` : `Below the ${exam.cutoffTotal} cut-off`}</div>
        </div>
        <div className="stat-box">
          <div className="k">Accuracy</div>
          <div className="v">{r.accuracy}%</div>
          <div className="sub">{r.correct} right · {r.wrong} wrong · {r.skipped} left</div>
        </div>
        <div className="stat-box">
          <div className="k">Percentile</div>
          <div className="v">{r.percentile ?? <span style={{ fontSize: 17, color: 'var(--muted)' }}>Not yet</span>}</div>
          <div className="sub">
            {r.percentile != null
              ? `${r.cohortSize} candidates · topper ${r.topperScore}`
              : 'You are first to submit this paper. A percentile appears once others attempt it.'}
          </div>
        </div>
        <div className="stat-box">
          <div className="k">Time used</div>
          <div className="v">{Math.round(r.timeSec / 60)}<small> min</small></div>
          <div className="sub">of {exam.durationMin} available</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Section by section</h2>
          <span className={`tag ${r.clearedAllSectionalCutoffs ? 'green' : 'red'}`}>
            {r.clearedAllSectionalCutoffs ? 'all sectional cut-offs cleared' : 'sectional cut-off missed'}
          </span>
        </div>
        <div className="table-scroll"><table>
          <thead>
            <tr>
              <th>Section</th><th className="num">Attempted</th><th className="num">Correct</th>
              <th className="num">Wrong</th><th className="num">Accuracy</th><th className="num">Time</th>
              <th className="num">Score</th><th className="num">Cut-off</th>
            </tr>
          </thead>
          <tbody>
            {r.sections.map((s, i) => (
              <tr key={s.sectionId}>
                <td>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 1, background: SECTION_COLORS[i % SECTION_COLORS.length], marginRight: 7 }} />
                  {s.name}
                </td>
                <td className="num">{s.attempted}/{s.total}</td>
                <td className="num">{s.correct}</td>
                <td className="num">{s.wrong}</td>
                <td className="num">{s.accuracy}%</td>
                <td className="num">{Math.round(s.timeSec / 60)}m</td>
                <td className="num"><b>{s.score}</b></td>
                <td className="num">
                  {s.cutoff == null ? '—' : (
                    <span className={`tag ${s.clearedCutoff ? 'green' : 'red'}`}>{s.cutoff}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head"><h2>Where the time went</h2></div>
          {r.sections.map((s, i) => (
            <BarRow
              key={s.sectionId}
              label={s.name}
              value={Math.round(s.timeSec / 60)}
              max={exam.durationMin}
              suffix=" min"
              color={SECTION_COLORS[i % SECTION_COLORS.length]}
            />
          ))}
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Average per attempted question:{' '}
            {r.sections.map((s) => `${s.name.split(' ')[0]} ${s.avgTimePerQuestion}s`).join(' · ')}
          </p>
        </div>

        <div className="card">
          <div className="card-head"><h2>Attempt quality</h2></div>
          <BarRow label="Accuracy" value={r.accuracy} color="var(--answered)" />
          <BarRow label="Attempt rate" value={Math.round((r.attempted / totalQuestions) * 100)} color="var(--brand)" />
          <BarRow label="Questions left" value={Math.round((r.skipped / totalQuestions) * 100)} color="var(--not-visited)" />
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Negative marking cost you {(r.wrong * exam.sections[0].negativeMarks).toFixed(2)} marks on {r.wrong} wrong answers.
            {r.wrong > r.correct * 0.4 && ' That is a high wrong-to-right ratio — being more selective would raise your score without learning anything new.'}
          </p>
        </div>
      </div>

      <div className="card-head" style={{ marginTop: 26 }}>
        <h2>Solutions</h2>
        <div className="chips">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>

      {!filtered.length && <div className="card muted">Nothing in this list — good sign.</div>}

      {filtered.map((row) => {
        const open = openId === row.questionId;
        const q = row.q;
        return (
          <div key={row.questionId} className="card" style={{ padding: 0, marginBottom: 8 }}>
            <button
              onClick={() => setOpenId(open ? null : row.questionId)}
              style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '12px 16px', display: 'grid', gridTemplateColumns: '30px 1fr auto', gap: 12, alignItems: 'center' }}
            >
              <span className="pal mini" data-s={row.attempted ? (row.correct ? 'answered' : 'not-answered') : 'not-visited'} />
              <span>
                <span className="muted mono" style={{ fontSize: 11 }}>{row.sectionName} · Q{row.number} · {row.topic}</span><br />
                <span style={{ fontSize: 13.5 }}>{q?.text?.split('\n')[0].slice(0, 120)}{(q?.text?.length || 0) > 120 ? '…' : ''}</span>
              </span>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {fmtClock(row.timeSec)}{row.overtime ? ' ⚠' : ''}
              </span>
            </button>
            {open && q && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--line-soft)' }}>
                {q.image && <img src={q.image} alt="Question figure" style={{ maxWidth: '100%', border: '1px solid var(--line)', margin: '12px 0 0' }} />}
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{q.text}</p>
                <ol type="A" style={{ paddingLeft: 20 }}>
                  {q.options.map((raw, i) => {
                    const o = asOption(raw);
                    return (
                      <li key={i} style={{
                        color: i === q.answer ? 'var(--answered)' : i === row.selected ? 'var(--not-answered)' : 'inherit',
                        fontWeight: i === q.answer ? 600 : 400,
                      }}>
                        {o.image && <img src={o.image} alt={`Option ${String.fromCharCode(65 + i)}`} style={{ display: 'block', maxHeight: 74, border: '1px solid var(--line)', margin: '4px 0', background: '#fff' }} />}
                        {o.text}
                        {i === q.answer && ' — correct answer'}
                        {i === row.selected && i !== q.answer && ' — your answer'}
                      </li>
                    );
                  })}
                </ol>
                {q.explanation && (
                  <div className="notice info" style={{ marginTop: 10 }}>
                    <b>Solution.</b> {q.explanation}
                  </div>
                )}
                <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                  You spent {fmtClock(row.timeSec)}; this question is built for about {row.expectedTimeSec}s. Difficulty: {row.difficulty}.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
