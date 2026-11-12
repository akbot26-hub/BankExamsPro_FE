import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Ledger, LineChart, ChartLegend, Gauge, BarRow, SECTION_COLORS } from '../components/Charts.jsx';

export default function Report() {
  const { examId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api(`/analytics/report/${examId}`).then(setData).catch((e) => setError(e.message)); }, [examId]);

  if (error) return <div className="notice error">{error}</div>;
  if (!data) return <p className="muted">Compiling your report…</p>;

  const j = data.journey;
  const labels = j.timeline.map((t) => `M${t.day}`);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Preparation report · generated {new Date(data.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <h1>{data.student.name} — {j.examName}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()}>Print or save as PDF</button>
          <Link className="btn" to={`/exam/${examId}/analysis`}>Back to analysis</Link>
        </div>
      </div>

      <div className="card">
        <div className="grid stat">
          <div className="stat-box" style={{ border: 0, padding: 0 }}>
            <div className="k">Mocks completed</div>
            <div className="v">{j.attemptCount}<small> / {j.plannedMockCount}</small></div>
          </div>
          <div className="stat-box" style={{ border: 0, padding: 0 }}>
            <div className="k">First → latest</div>
            <div className="v">{j.overall.firstScore} → {j.overall.latestScore}</div>
            <div className="sub">Best {j.overall.bestScore} · average {j.overall.avgScore}</div>
          </div>
          <div className="stat-box" style={{ border: 0, padding: 0 }}>
            <div className="k">Expected on exam day</div>
            <div className="v">{j.prediction.expectedScore}</div>
            <div className="sub">{j.prediction.range[0]}–{j.prediction.range[1]} · cut-off {j.prediction.cutoff}</div>
          </div>
          <div className="stat-box" style={{ border: 0, padding: 0 }}>
            <div className="k">Readiness</div>
            <div className="v">{j.prediction.readiness}%</div>
            <div className="sub">Qualification chance {j.prediction.qualificationProbability}% ({j.prediction.band})</div>
          </div>
        </div>
        {data.summary && <p style={{ marginTop: 16, fontSize: 14.5, borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>{data.summary}</p>}
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>1. Score progression</h2>
      <Ledger timeline={j.timeline} sections={j.sectionTrends} cutoff={j.prediction.cutoff} maxScore={j.prediction.maxScore} />

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>2. Accuracy and speed over time</h2>
      <div className="grid two">
        <div className="card">
          <div className="card-head"><h3>Accuracy by section (%)</h3></div>
          <LineChart labels={labels} domain={[0, 100]} yLabel="Accuracy by section"
            series={j.sectionTrends.map((s, i) => ({ name: s.name, points: s.accuracySeries, color: SECTION_COLORS[i % SECTION_COLORS.length] }))} />
          <ChartLegend series={j.sectionTrends.map((s, i) => ({ name: s.name, color: SECTION_COLORS[i % SECTION_COLORS.length] }))} />
        </div>
        <div className="card">
          <div className="card-head"><h3>Overall score and accuracy</h3></div>
          <LineChart labels={labels} yLabel="Overall score and accuracy"
            series={[
              { name: 'Score', points: j.timeline.map((t) => t.score), color: '#16346b' },
              { name: 'Accuracy %', points: j.timeline.map((t) => t.accuracy), color: '#0e7b4f' },
            ]} />
          <ChartLegend series={[{ name: 'Score', color: '#16346b' }, { name: 'Accuracy %', color: '#0e7b4f' }]} />
        </div>
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>3. Section summary</h2>
      <div className="card">
        <div className="table-scroll"><table>
          <thead>
            <tr>
              <th>Section</th><th className="num">Avg score</th><th className="num">Best</th><th className="num">Avg accuracy</th>
              <th className="num">Accuracy change</th><th className="num">Avg time / question</th><th className="num">Consistency</th><th className="num">Cut-off cleared</th>
            </tr>
          </thead>
          <tbody>
            {j.sectionTrends.map((s, i) => (
              <tr key={s.sectionId}>
                <td>
                  <span style={{ display: 'inline-block', width: 8, height: 8, background: SECTION_COLORS[i % SECTION_COLORS.length], marginRight: 7 }} />
                  {s.name}
                </td>
                <td className="num">{s.avgScore}</td>
                <td className="num">{s.bestScore}</td>
                <td className="num">{s.avgAccuracy}%</td>
                <td className="num" style={{ color: s.accuracyDelta >= 0 ? 'var(--answered)' : 'var(--not-answered)' }}>
                  {s.accuracyDelta > 0 ? '+' : ''}{s.accuracyDelta}
                </td>
                <td className="num">{s.avgTimePerQuestion}s</td>
                <td className="num">{s.consistency}%</td>
                <td className="num">{s.cutoffClearRate}%</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>4. Strengths and weaknesses</h2>
      <div className="grid two">
        <div className="card">
          <div className="card-head"><h3>Reliable topics</h3></div>
          {j.strengths.map((t) => (
            <BarRow key={t.topic} label={t.topic} value={t.accuracy} color="var(--answered)" />
          ))}
        </div>
        <div className="card">
          <div className="card-head"><h3>Topics costing the most marks</h3></div>
          {j.weaknesses.map((t) => (
            <BarRow key={t.topic} label={t.topic} value={t.accuracy} color="var(--not-answered)" />
          ))}
        </div>
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>5. Mistakes that keep repeating</h2>
      <div className="card">
        <div className="table-scroll"><table>
          <thead><tr><th>Topic</th><th>Section</th><th className="num">Seen</th><th className="num">Missed</th><th className="num">Accuracy</th></tr></thead>
          <tbody>
            {data.repeatedMistakes.map((m) => (
              <tr key={`${m.section}-${m.topic}`}>
                <td>{m.topic}</td><td className="muted">{m.section}</td>
                <td className="num">{m.seen}</td><td className="num">{m.missed}</td>
                <td className="num" style={{ color: 'var(--not-answered)' }}>{m.accuracy}%</td>
              </tr>
            ))}
            {!data.repeatedMistakes.length && <tr><td colSpan="5" className="muted">No topic is failing repeatedly. That is unusual and worth protecting.</td></tr>}
          </tbody>
        </table></div>
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>6. Reading of your preparation</h2>
      <div className="card">
        {data.insights.map((ins, i) => (
          <div key={i} className={`insight ${ins.kind}`}>
            {ins.metric && <span className="metric"><b>{ins.metric.value}</b><span>{ins.metric.label}</span></span>}
            <h3>{ins.title}</h3>
            <p>{ins.body}</p>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>7. Study plan and exam-day strategy</h2>
      <div className="grid two">
        <div className="card">
          <div className="card-head"><h3>Daily plan</h3><span className="muted" style={{ fontSize: 12 }}>{data.plan.reduce((a, p) => a + p.minutes, 0)} minutes</span></div>
          <div className="table-scroll"><table>
            <tbody>
              {data.plan.map((p) => (
                <tr key={p.priority}>
                  <td className="mono muted" style={{ width: 24 }}>{p.priority}</td>
                  <td><b>{p.focus}</b><div style={{ color: 'var(--ink-2)' }}>{p.action}</div></td>
                  <td className="num muted" style={{ width: 44 }}>{p.minutes}m</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="card-head"><h3>On the day</h3></div>
          <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.65 }}>
            {data.strategy.map((s, i) => <li key={i} style={{ marginBottom: 8 }}>{s}</li>)}
          </ol>
          <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
            <Gauge value={j.prediction.readiness} size={104} />
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Readiness combines your projected margin over the cut-off, accuracy, consistency between
              papers, sectional safety and momentum.
            </p>
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        Prepared by BankExamsPro from {j.attemptCount} submitted mock tests.
        {data.source === 'claude' ? ' Narrative written by Claude from the computed statistics.' : ' Narrative generated by the analysis engine.'}
        {' '}Predictions are estimates from your own attempts, not a guarantee of the result.
      </p>
    </>
  );
}
