import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { examDeviceCheck, DesktopOnlyModal } from '../components/DeviceGate.jsx';

export default function Instructions() {
  const { mockTestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [gate, setGate] = useState(null);

  useEffect(() => {
    api(`/mock-tests/${mockTestId}/summary`).then(setData).catch((e) => setError(e.message));
  }, [mockTestId]);

  if (error) return <div className="instr"><div className="notice error">{error}</div><Link className="btn" to="/">Back to dashboard</Link></div>;
  if (!data) return <div className="instr muted">Loading instructions…</div>;

  const { exam, mockTest } = data;
  const totalQuestions = mockTest.questionCount;
  const totalMarks = exam.sections.reduce((a, s) => a + s.questionCount * s.marksPerQuestion, 0);

  function begin() {
    if (!agreed) return;
    const check = examDeviceCheck();
    if (!check.ok) { setGate(check.reason); return; }
    sessionStorage.setItem('bxp_lang', language);
    navigate(`/mock/${mockTestId}/live`, { replace: true });
  }

  return (
    <div className="instr">
      <h2>{exam.name} — {exam.tier}</h2>
      <p style={{ textAlign: 'center', marginBottom: 18 }} className="muted">{mockTest.title}</p>

      <div className="sheet">
        <p><b>Please read the instructions carefully.</b></p>

        <p style={{ marginTop: 14 }}><b>General instructions</b></p>
        <ol>
          <li>The total duration of the examination is <b>{exam.durationMin} minutes</b>.</li>
          <li>The clock is set at the server. The countdown timer in the top right corner of the screen displays the time remaining. When the timer reaches zero the examination ends by itself — you are not required to submit.</li>
          <li>The Question Palette on the right shows the status of every question using one of the following symbols:
            <div style={{ margin: '10px 0 4px' }}>
              {[
                ['not-visited', 'You have not visited the question yet.'],
                ['not-answered', 'You have not answered the question.'],
                ['answered', 'You have answered the question.'],
                ['marked', 'You have not answered the question but have marked it for review.'],
                ['answered-marked', 'You have answered the question and marked it for review. It will be evaluated.'],
              ].map(([s, text]) => (
                <div className="legend-row" key={s}>
                  <span className="pal mini" data-s={s} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </li>
          <li>You can click the arrow beside the palette to collapse it and use the full screen for the question.</li>
          <li><b>The examination can be taken on a laptop or desktop only.</b> Instructions, results and analysis are available on mobile, but the paper itself will not open on a phone or tablet.</li>
        </ol>

        <p style={{ marginTop: 14 }}><b>Navigating and answering</b></p>
        <ol>
          <li>To select an answer, click the button beside the option.</li>
          <li>To change your answer, click another option.</li>
          <li>To save your answer you <b>must</b> click <b>Save &amp; Next</b>.</li>
          <li>To deselect a chosen answer, click <b>Clear Response</b>.</li>
          <li>To mark a question for review, click <b>Mark for Review &amp; Next</b>. If an answer is selected for a question marked for review, that answer <b>will be evaluated</b>.</li>
          <li>You may click any question number in the palette to move to it directly. Doing so does <b>not</b> save your answer to the current question — always use Save &amp; Next.</li>
        </ol>

        <p style={{ marginTop: 14 }}><b>Sections and marking</b></p>
        <ol>
          <li>This paper has <b>{exam.sections.length} sections</b> and <b>{totalQuestions} questions</b> carrying <b>{totalMarks} marks</b> in total.</li>
          {exam.sections.map((s) => (
            <li key={s.id}>
              <b>{s.name}</b> — {s.questionCount} questions, {s.marksPerQuestion} mark each
              {exam.sectionalTiming && <>, to be completed in <b>{s.durationMin} minutes</b></>}.
              Sectional cut-off: {s.cutoff ?? 'not applicable'}.
            </li>
          ))}
          <li><b>{exam.sections[0].negativeMarks} mark will be deducted</b> for every wrong answer. No marks are deducted for questions left unanswered.</li>
          {exam.sectionalTiming && (
            <li style={{ color: '#b3261e' }}>
              Sectional timing is enforced. Once the timer for a section ends, the section closes and <b>you cannot return to it</b>.
            </li>
          )}
        </ol>

        <div className="agree">
          <input id="agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <label htmlFor="agree" style={{ margin: 0, fontSize: 13, color: '#000' }}>
            I have read and understood the instructions. I declare that I am not in possession of any prohibited
            material and that I will not use unfair means. I understand that the test will open in full screen.
          </label>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <label htmlFor="lang" style={{ margin: 0 }}>Choose your default language</label>
          <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: 'auto' }}>
            <option value="en">English</option>
            {exam.languages.includes('hi') && <option value="hi">हिन्दी</option>}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>You can switch during the test.</span>
        </div>

        <div className="actions">
          <button onClick={() => navigate(`/exam/${exam.id}`)}>Back</button>
          <button className="primary" disabled={!agreed} onClick={begin}>
            {data.attemptStatus === 'in-progress' ? 'Resume test' : 'I am ready to begin'}
          </button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>
        Candidate: {user.name}
      </p>
      {gate && <DesktopOnlyModal reason={gate} onClose={() => setGate(null)} />}
    </div>
  );
}
