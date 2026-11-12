import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { examDeviceCheck, DesktopOnlyModal } from '../components/DeviceGate.jsx';

export default function ExamDetail() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [gate, setGate] = useState(null);

  useEffect(() => { setData(null); api(`/exams/${examId}`).then(setData); }, [examId]);

  function startExam(mockId) {
    const check = examDeviceCheck();
    if (!check.ok) { setGate(check.reason); return; }
    navigate(`/mock/${mockId}/instructions`);
  }
  if (!data) return <p className="muted">Loading the mock series…</p>;

  const { exam, mockTests } = data;
  const done = mockTests.filter((m) => m.attemptStatus === 'submitted').length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{exam.organisation} · {exam.tier} · {exam.year}</div>
          <h1>{exam.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" to={`/exam/${exam.id}/analysis`}>Analysis</Link>
          {done >= 3 && <Link className="btn btn-primary" to={`/exam/${exam.id}/report`}>Final report</Link>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Exam pattern</h2><span className="tag">{exam.difficulty}</span></div>
        <div className="table-scroll"><table>
          <thead>
            <tr>
              <th>Section</th>
              <th className="num">Questions</th>
              <th className="num">Marks</th>
              <th className="num">Negative</th>
              <th className="num">Time</th>
              <th className="num">Sectional cut-off</th>
            </tr>
          </thead>
          <tbody>
            {exam.sections.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="num">{s.questionCount}</td>
                <td className="num">{s.marksPerQuestion}</td>
                <td className="num">−{s.negativeMarks}</td>
                <td className="num">{s.durationMin} min</td>
                <td className="num">{s.cutoff ?? '—'}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td>Total</td>
              <td className="num">{exam.sections.reduce((a, s) => a + s.questionCount, 0)}</td>
              <td className="num">{exam.sections.reduce((a, s) => a + s.questionCount * s.marksPerQuestion, 0)}</td>
              <td className="num">—</td>
              <td className="num">{exam.durationMin} min</td>
              <td className="num">{exam.cutoffTotal}</td>
            </tr>
          </tbody>
        </table></div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
          {exam.sectionalTiming
            ? 'Sectional timing is enforced. Once a section\'s timer ends you cannot return to it — exactly as in the real exam.'
            : 'You may move freely between sections until the overall timer ends.'}
          {' '}Available in {exam.languages.map((l) => (l === 'hi' ? 'Hindi' : 'English')).join(' and ')}.
        </p>
      </div>

      <div className="card-head" style={{ marginTop: 24 }}>
        <div>
          <h2>Mock schedule</h2>
          <span className="muted" style={{ fontSize: 13 }}>One paper a day. {done} of {mockTests.length} completed.</span>
        </div>
      </div>

      {mockTests.map((m) => {
        const locked = !m.available;
        const submitted = m.attemptStatus === 'submitted';
        const inProgress = m.attemptStatus === 'in-progress';
        return (
          <div key={m.id} className={`mock-row${locked ? ' locked' : ''}`}>
            <div className="day">Day<b>{m.index}</b></div>
            <div>
              <div className="title">{m.title}</div>
              <div className="meta">
                {m.questionCount} questions · {exam.durationMin} minutes
                {locked && m.availableFrom && ` · unlocks ${new Date(m.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
              </div>
            </div>
            <div className="right">
              {submitted && <span className="mono"><b>{m.score}</b> <span className="muted">/ {m.maxScore}</span></span>}
              {inProgress && <span className="tag amber">in progress</span>}
              {locked && !submitted && <span className="tag">locked</span>}
            </div>
            <div>
              {submitted ? (
                <Link className="btn" to={`/attempt/${m.attemptId}`}>View result</Link>
              ) : (
                <button
                  className={inProgress ? '' : 'primary'}
                  disabled={locked}
                  onClick={() => startExam(m.id)}
                >
                  {inProgress ? 'Resume' : 'Start test'}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {gate && <DesktopOnlyModal reason={gate} onClose={() => setGate(null)} />}
    </>
  );
}
