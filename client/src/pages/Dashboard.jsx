import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGetExamsQuery, useGetExamQuery, useGetJourneyQuery } from '../store/apiSlice.js';
import { useAuth } from '../auth.jsx';
import { Ledger, Gauge } from '../components/Charts.jsx';
import { examDeviceCheck, DesktopOnlyModal } from '../components/DeviceGate.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gate, setGate] = useState(null);
  const examsQuery = useGetExamsQuery();
  const exams = examsQuery.data?.exams || null;
  const primaryExam = exams?.find((e) => e.completedCount > 0) || exams?.[0];
  const focusQuery = useGetExamQuery(primaryExam?.id, { skip: !primaryExam });
  const journeyQuery = useGetJourneyQuery({ examId: primaryExam?.id, narrate: false }, { skip: !primaryExam });
  const focus = focusQuery.data;
  const journey = journeyQuery.data;

  function startExam(mockId) {
    const check = examDeviceCheck();
    if (!check.ok) { setGate(check.reason); return; }
    navigate(`/mock/${mockId}/instructions`);
  }

  useEffect(() => { if (examsQuery.error) console.error('Could not load exams', examsQuery.error); }, [examsQuery.error]);

  if (!exams) return <p className="muted">Loading your dashboard…</p>;
  if (!exams.length) return <p className="muted">No mock series have been published yet. Check back soon.</p>;

  const j = journey?.journey;
  const next = focus?.mockTests.find((m) => m.attemptStatus === 'not-started' && m.available);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greeting}, {user.name.split(' ')[0]}</h1>
        </div>
        {next && (
          <button className="primary" onClick={() => startExam(next.id)}>
            Start {next.title.split('—')[1]?.trim() || next.title}
          </button>
        )}
      </div>

      {j?.ready ? (
        <>
          <div className="grid stat" style={{ marginBottom: 14 }}>
            <div className="stat-box">
              <div className="k">Latest score</div>
              <div className="v">{j.overall.latestScore}<small> / {j.prediction.maxScore}</small></div>
              <div className="sub">
                {j.overall.scoreSlope >= 0 ? '▲' : '▼'} {Math.abs(j.overall.scoreSlope)} marks per mock
              </div>
            </div>
            <div className="stat-box">
              <div className="k">Best so far</div>
              <div className="v">{j.overall.bestScore}</div>
              <div className="sub">Average {j.overall.avgScore}</div>
            </div>
            <div className="stat-box">
              <div className="k">Expected on exam day</div>
              <div className="v">{j.prediction.expectedScore}</div>
              <div className="sub">Range {j.prediction.range[0]}–{j.prediction.range[1]}</div>
            </div>
            <div className="stat-box">
              <div className="k">Qualification chance</div>
              <div className="v" style={{ color: j.prediction.band === 'High' ? 'var(--answered)' : j.prediction.band === 'Moderate' ? 'var(--amber)' : 'var(--not-answered)' }}>
                {j.prediction.qualificationProbability}%
              </div>
              <div className="sub">Cut-off {j.prediction.cutoff}</div>
            </div>
          </div>

          <div className="card-head" style={{ marginTop: 22 }}>
            <div>
              <h2>{j.examName} — the ledger</h2>
              <span className="muted" style={{ fontSize: 13 }}>
                One column per mock, sections stacked. Click a column to open that paper.
              </span>
            </div>
            <Link className="btn" to={`/exam/${j.examId}/analysis`}>Full analysis</Link>
          </div>
          <Ledger
            timeline={j.timeline}
            sections={j.sectionTrends}
            cutoff={j.prediction.cutoff}
            maxScore={j.prediction.maxScore}
            onSelect={(t) => navigate(`/attempt/${t.attemptId}`)}
          />

          <div className="grid two" style={{ marginTop: 14 }}>
            <div className="card">
              <div className="card-head"><h2>Exam readiness</h2></div>
              <div className="gauge-wrap">
                <Gauge value={j.prediction.readiness} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 13.5 }}>
                    Built from your score margin over the cut-off, accuracy, consistency between mocks,
                    sectional safety and the direction you are moving in.
                  </p>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {Object.entries(j.prediction.readinessComponents).map(([k, v]) => (
                      <span key={k} className="tag">
                        {k.replace(/([A-Z])/g, ' $1').toLowerCase()} {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h2>Tonight's priority</h2></div>
              {journey.plan.slice(0, 3).map((p) => (
                <div key={p.priority} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span className="mono muted" style={{ fontSize: 12, paddingTop: 2 }}>{p.minutes}m</span>
                  <div>
                    <b style={{ fontSize: 13.5 }}>{p.focus}</b>
                    <span className="muted" style={{ fontSize: 12 }}> · {p.section}</span>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{p.action}</div>
                  </div>
                </div>
              ))}
              <Link className="btn" style={{ marginTop: 12 }} to={`/exam/${j.examId}/analysis`}>See the full plan</Link>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h2>Your analysis starts after the first mock</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Attempt Mock Test 1 and this page fills with your score ledger, topic breakdown and a
            daily revision plan. The analysis gets sharper with every paper you add.
          </p>
          {next && <button className="primary" onClick={() => startExam(next.id)}>Start Mock Test 1</button>}
        </div>
      )}

      <h2 style={{ marginTop: 26, marginBottom: 10 }}>Your mock series</h2>
      <div className="grid three">
        {exams.map((e) => (
          <Link key={e.id} to={`/exam/${e.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div className="eyebrow">{e.organisation} · {e.tier}</div>
            <h3 style={{ fontSize: 17 }}>{e.name}</h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 10px' }}>
              {e.sections.length} sections · {e.durationMin} min · cut-off {e.cutoffTotal}
            </p>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${(e.completedCount / (e.mockCount || 1)) * 100}%` }} /></div>
            <div className="spread" style={{ marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 12 }}>{e.completedCount} of {e.mockCount} done</span>
              {e.lastScore != null && <span className="tag green">last {e.lastScore}</span>}
            </div>
          </Link>
        ))}
      </div>
      {gate && <DesktopOnlyModal reason={gate} onClose={() => setGate(null)} />}
    </>
  );
}
