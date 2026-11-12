import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Ledger, LineChart, ChartLegend, Gauge, BarRow, Diverging, SECTION_COLORS } from '../components/Charts.jsx';

const KIND_LABEL = { strength: 'Strength', weakness: 'Weakness', speed: 'Speed', trend: 'Trend' };

export default function Analytics() {
  const { examId } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/analytics/journey/${examId}`).then(setData).catch((e) => setError(e.message));
  }, [examId]);

  if (error) return <div className="notice error">{error}</div>;
  if (!data) return <p className="muted">Reading every mock you have submitted…</p>;
  if (!data.journey.ready) {
    return (
      <div className="card">
        <h2>Nothing to analyse yet</h2>
        <p className="muted">{data.empty}</p>
        <Link className="btn btn-primary" to={`/exam/${examId}`}>Go to the mock series</Link>
      </div>
    );
  }

  const j = data.journey;
  const labels = j.timeline.map((t) => `M${t.day}`);
  const insights = tab === 'all' ? data.insights : data.insights.filter((i) => i.kind === tab);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Across {j.attemptCount} of {j.plannedMockCount} mock tests</div>
          <h1>{j.examName} — performance analysis</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="tag">{data.source === 'claude' ? 'written by Claude' : 'analysis engine'}</span>
          <Link className="btn" to={`/exam/${examId}/report`}>Final report</Link>
        </div>
      </div>

      {data.summary && <div className="notice info" style={{ fontSize: 13.5 }}>{data.summary}</div>}

      {/* Prediction */}
      <div className="card">
        <div className="card-head"><h2>Where this is heading</h2><span className="muted" style={{ fontSize: 12.5 }}>Projected from your last {j.attemptCount} papers, weighted towards the most recent</span></div>
        <div className="gauge-wrap">
          <Gauge value={j.prediction.readiness} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="grid stat" style={{ gap: 10 }}>
              <div className="stat-box" style={{ border: 0, padding: 0 }}>
                <div className="k">Expected score</div>
                <div className="v">{j.prediction.expectedScore}<small> / {j.prediction.maxScore}</small></div>
                <div className="sub">Likely between {j.prediction.range[0]} and {j.prediction.range[1]}</div>
              </div>
              <div className="stat-box" style={{ border: 0, padding: 0 }}>
                <div className="k">Qualification chance</div>
                <div className="v">{j.prediction.qualificationProbability}%</div>
                <div className="sub">{j.prediction.band} · cut-off {j.prediction.cutoff}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {j.prediction.sectionalProbability.filter((s) => s.probability != null).map((s) => (
                <BarRow key={s.sectionId} label={`${s.name} cut-off`} value={s.probability}
                  color={s.probability >= 70 ? 'var(--answered)' : s.probability >= 45 ? 'var(--amber)' : 'var(--not-answered)'} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="card-head" style={{ marginTop: 24 }}>
        <h2>Score progression</h2>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {j.overall.scoreSlope >= 0 ? `Gaining ${j.overall.scoreSlope}` : `Losing ${Math.abs(j.overall.scoreSlope)}`} marks per mock · consistency {j.overall.consistency}%
        </span>
      </div>
      <Ledger timeline={j.timeline} sections={j.sectionTrends} cutoff={j.prediction.cutoff} maxScore={j.prediction.maxScore} />

      {/* Trend charts */}
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head"><h2>Accuracy by section</h2></div>
          <LineChart
            labels={labels}
            domain={[0, 100]}
            yLabel="Accuracy percent by section across mocks"
            series={j.sectionTrends.map((s, i) => ({ name: s.name, points: s.accuracySeries, color: SECTION_COLORS[i % SECTION_COLORS.length] }))}
          />
          <ChartLegend series={j.sectionTrends.map((s, i) => ({ name: s.name, color: SECTION_COLORS[i % SECTION_COLORS.length] }))} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Marks by section</h2></div>
          <LineChart
            labels={labels}
            yLabel="Section score across mocks"
            series={j.sectionTrends.map((s, i) => ({ name: s.name, points: s.scoreSeries, color: SECTION_COLORS[i % SECTION_COLORS.length] }))}
          />
          <ChartLegend series={j.sectionTrends.map((s, i) => ({ name: s.name, color: SECTION_COLORS[i % SECTION_COLORS.length] }))} />
        </div>
      </div>

      {/* Insights */}
      <div className="card-head" style={{ marginTop: 26 }}>
        <h2>What the numbers are telling you</h2>
        <div className="chips">
          {['all', 'strength', 'weakness', 'speed', 'trend'].map((k) => (
            <button key={k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              {k === 'all' ? 'Everything' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        {insights.map((ins, i) => (
          <div key={i} className={`insight ${ins.kind}`}>
            {ins.metric && (
              <span className="metric"><b>{ins.metric.value}</b><span>{ins.metric.label}</span></span>
            )}
            <h3>{ins.title}</h3>
            <p>{ins.body}</p>
          </div>
        ))}
      </div>

      {/* Topics */}
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head"><h2>Topic movement</h2><span className="muted" style={{ fontSize: 12 }}>later mocks vs earlier</span></div>
          <Diverging rows={[...j.topics].filter((t) => t.seen >= 3).sort((a, b) => b.trend - a.trend).slice(0, 10).map((t) => ({ label: t.topic, value: t.trend }))} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Pace against target</h2><span className="muted" style={{ fontSize: 12 }}>1.0 = on time</span></div>
          {[...j.topics].filter((t) => t.attempted >= 3).sort((a, b) => b.paceRatio - a.paceRatio).slice(0, 8).map((t) => (
            <BarRow key={t.topic} label={t.topic} value={t.paceRatio} max={2.5} suffix="×"
              color={t.paceRatio > 1.3 ? 'var(--not-answered)' : t.paceRatio > 1.05 ? 'var(--amber)' : 'var(--answered)'} />
          ))}
        </div>
      </div>

      {/* Topic table */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Every topic you have faced</h2></div>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <div className="table-scroll"><table>
            <thead>
              <tr>
                <th>Topic</th><th>Section</th><th className="num">Seen</th><th className="num">Attempted</th>
                <th className="num">Accuracy</th><th className="num">Skipped</th><th className="num">Avg time</th><th className="num">Marks lost / exam</th>
              </tr>
            </thead>
            <tbody>
              {[...j.topics].sort((a, b) => b.lossPotential - a.lossPotential).map((t) => (
                <tr key={`${t.sectionId}-${t.topic}`}>
                  <td>{t.topic}</td>
                  <td className="muted">{t.sectionName}</td>
                  <td className="num">{t.seen}</td>
                  <td className="num">{t.attempted}</td>
                  <td className="num" style={{ color: t.accuracy >= 70 ? 'var(--answered)' : t.accuracy < 50 ? 'var(--not-answered)' : 'inherit' }}>{t.accuracy}%</td>
                  <td className="num">{t.skipRate}%</td>
                  <td className="num">{t.avgTimeSec}s <span className="muted">/ {t.expectedTimeSec}s</span></td>
                  <td className="num"><b>{t.lossPotential}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* Plan */}
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-head"><h2>What to do today</h2><span className="muted" style={{ fontSize: 12 }}>{data.plan.reduce((a, p) => a + p.minutes, 0)} minutes</span></div>
          <div className="table-scroll"><table>
            <tbody>
              {data.plan.map((p) => (
                <tr key={p.priority}>
                  <td className="mono muted" style={{ width: 26 }}>{p.priority}</td>
                  <td>
                    <b>{p.focus}</b> <span className="muted">· {p.section}</span>
                    <div style={{ color: 'var(--ink-2)' }}>{p.action}</div>
                  </td>
                  <td className="num muted" style={{ width: 50 }}>{p.minutes}m</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Exam-day strategy</h2></div>
          <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.65 }}>
            {data.strategy.map((s, i) => <li key={i} style={{ marginBottom: 8 }}>{s}</li>)}
          </ol>
        </div>
      </div>
    </>
  );
}
