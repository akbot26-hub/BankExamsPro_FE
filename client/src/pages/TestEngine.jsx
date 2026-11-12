import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtTime } from '../api.js';
import { useAuth } from '../auth.jsx';
import { examDeviceCheck, EXAM_MIN_WIDTH } from '../components/DeviceGate.jsx';

/** Options are "text" or { text, image } — normalise once for rendering. */
const asOption = (o) => (typeof o === 'string' ? { text: o, image: null } : { text: o?.text || '', image: o?.image || null });

const STATUS = {
  NOT_VISITED: 'not-visited',
  NOT_ANSWERED: 'not-answered',
  ANSWERED: 'answered',
  MARKED: 'marked',
  ANSWERED_MARKED: 'answered-marked',
};

export default function TestEngine() {
  const { mockTestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [paper, setPaper] = useState(null);        // { attempt, exam, mockTest, questions, stimuli }
  const [responses, setResponses] = useState({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [draft, setDraft] = useState(null);        // selection not yet saved
  const [remaining, setRemaining] = useState(0);
  const [sectionRemaining, setSectionRemaining] = useState(null);
  const [language, setLanguage] = useState(sessionStorage.getItem('bxp_lang') || 'en');
  const [confirm, setConfirm] = useState(null);    // 'submit' | 'section'
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState('');

  const [blocked, setBlocked] = useState(() => examDeviceCheck());
  const [tooNarrow, setTooNarrow] = useState(false);
  const enteredAt = useRef(Date.now());
  const responsesRef = useRef(responses);
  const submitting = useRef(false);
  responsesRef.current = responses;

  // ---- Load or resume -----------------------------------------------------
  useEffect(() => {
    if (!blocked.ok) return; // starting the attempt would start the clock
    let alive = true;
    api('/attempts', { method: 'POST', body: { mockTestId, language } })
      .then((d) => {
        if (!alive) return;
        setPaper(d);
        setResponses(d.attempt.responses || {});
        setSectionIndex(d.attempt.currentSectionIndex || 0);
        const drift = Date.now() - new Date(d.serverTime).getTime();
        setRemaining(Math.max(0, (new Date(d.attempt.endsAt).getTime() + drift - Date.now()) / 1000));
        if (d.attempt.sectionEndsAt) {
          setSectionRemaining(Math.max(0, (new Date(d.attempt.sectionEndsAt).getTime() + drift - Date.now()) / 1000));
        }
        document.documentElement.requestFullscreen?.().catch(() => {});
      })
      .catch((e) => {
        if (e.status === 409 && e.data?.attemptId) navigate(`/attempt/${e.data.attemptId}`, { replace: true });
        else setError(e.message);
      });
    return () => { alive = false; document.exitFullscreen?.().catch(() => {}); };
  }, [mockTestId, blocked.ok]);

  // Mid-exam window shrink: warn, never submit. The clock keeps running,
  // exactly as it would if a candidate looked away from a real terminal.
  useEffect(() => {
    const onResize = () => setTooNarrow(window.innerWidth < EXAM_MIN_WIDTH - 120);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ---- Derived ------------------------------------------------------------
  const sections = paper?.exam.sections || [];
  const section = sections[sectionIndex];
  const questionIds = useMemo(
    () => paper?.mockTest.sections.find((s) => s.sectionId === section?.id)?.questionIds || [],
    [paper, section]
  );
  const byId = useMemo(() => new Map((paper?.questions || []).map((q) => [q.id, q])), [paper]);
  const question = byId.get(questionIds[qIndex]);
  const stimulus = question?.stimulusId ? paper.stimuli.find((s) => s.id === question.stimulusId) : null;

  const statusOf = useCallback((qid) => responsesRef.current[qid]?.status || STATUS.NOT_VISITED, []);
  const counts = useMemo(() => {
    const c = { [STATUS.ANSWERED]: 0, [STATUS.NOT_ANSWERED]: 0, [STATUS.MARKED]: 0, [STATUS.ANSWERED_MARKED]: 0, [STATUS.NOT_VISITED]: 0 };
    questionIds.forEach((qid) => { c[responses[qid]?.status || STATUS.NOT_VISITED] += 1; });
    return c;
  }, [questionIds, responses]);

  // ---- Time accounting ----------------------------------------------------
  /** Bank the seconds spent on the question we are leaving. */
  const bankTime = useCallback((qid) => {
    if (!qid) return;
    const spent = (Date.now() - enteredAt.current) / 1000;
    enteredAt.current = Date.now();
    setResponses((prev) => ({
      ...prev,
      [qid]: {
        selected: prev[qid]?.selected ?? null,
        status: prev[qid]?.status || STATUS.NOT_ANSWERED,
        visits: (prev[qid]?.visits || 0) + 1,
        timeSec: Math.round((prev[qid]?.timeSec || 0) + spent),
      },
    }));
  }, []);

  // Mark a freshly opened question as visited.
  useEffect(() => {
    if (!question) return;
    enteredAt.current = Date.now();
    setDraft(responsesRef.current[question.id]?.selected ?? null);
    setResponses((prev) => prev[question.id] ? prev : {
      ...prev,
      [question.id]: { selected: null, status: STATUS.NOT_ANSWERED, timeSec: 0, visits: 1 },
    });
  }, [question?.id]);

  // ---- Countdown ----------------------------------------------------------
  useEffect(() => {
    if (!paper) return;
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
      setSectionRemaining((r) => (r == null ? r : Math.max(0, r - 1)));
    }, 1000);
    return () => clearInterval(t);
  }, [paper]);

  // The paper closes itself when the clock runs out — no submit needed.
  useEffect(() => {
    if (paper && remaining === 0 && !submitting.current) doSubmit(true);
  }, [remaining, paper]);

  // Sectional timer expiry closes the section, exactly as the real portal does.
  useEffect(() => {
    if (sectionRemaining === 0 && paper?.exam.sectionalTiming && !submitting.current) {
      if (sectionIndex < sections.length - 1) moveToSection(sectionIndex + 1, true);
      else doSubmit(true);
    }
  }, [sectionRemaining]);

  // ---- Autosave -----------------------------------------------------------
  useEffect(() => {
    if (!paper) return;
    const t = setInterval(() => {
      api(`/attempts/${paper.attempt.id}`, {
        method: 'PATCH',
        body: { responses: responsesRef.current, currentSectionIndex: sectionIndex, language },
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [paper, sectionIndex, language]);

  useEffect(() => {
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // ---- Actions ------------------------------------------------------------
  function commit(qid, selected, marked) {
    const answered = selected !== null && selected !== undefined;
    const status = marked
      ? (answered ? STATUS.ANSWERED_MARKED : STATUS.MARKED)
      : (answered ? STATUS.ANSWERED : STATUS.NOT_ANSWERED);
    const spent = (Date.now() - enteredAt.current) / 1000;
    enteredAt.current = Date.now();
    setResponses((prev) => ({
      ...prev,
      [qid]: {
        selected: answered ? selected : null,
        status,
        visits: (prev[qid]?.visits || 0) + 1,
        timeSec: Math.round((prev[qid]?.timeSec || 0) + spent),
      },
    }));
  }

  const advance = () => {
    if (qIndex < questionIds.length - 1) setQIndex(qIndex + 1);
    else if (!paper.exam.sectionalTiming && sectionIndex < sections.length - 1) moveToSection(sectionIndex + 1);
    else setQIndex(0); // wrap within the section, as the official portal does
  };

  const saveAndNext = () => { commit(question.id, draft, false); advance(); };
  const markAndNext = () => { commit(question.id, draft, true); advance(); };
  const clearResponse = () => { setDraft(null); commit(question.id, null, statusOf(question.id).includes('marked')); };
  const goTo = (i) => { bankTime(question?.id); setQIndex(i); setPaletteOpen(false); };

  function moveToSection(index, forced = false) {
    if (index === sectionIndex) return;
    bankTime(question?.id);
    setSectionIndex(index);
    setQIndex(0);
    const next = sections[index];
    if (paper.exam.sectionalTiming) {
      const endsAt = new Date(Date.now() + next.durationMin * 60000);
      setSectionRemaining(next.durationMin * 60);
      api(`/attempts/${paper.attempt.id}`, {
        method: 'PATCH',
        body: { responses: responsesRef.current, currentSectionIndex: index, sectionEndsAt: endsAt.toISOString() },
      }).catch(() => {});
    }
    if (forced) setConfirm(null);
  }

  async function doSubmit(auto = false) {
    if (submitting.current) return;
    submitting.current = true;
    const spent = (Date.now() - enteredAt.current) / 1000;
    const finalResponses = { ...responsesRef.current };
    if (question) {
      finalResponses[question.id] = {
        ...finalResponses[question.id],
        timeSec: Math.round((finalResponses[question.id]?.timeSec || 0) + spent),
      };
    }
    try {
      const d = await api(`/attempts/${paper.attempt.id}/submit`, {
        method: 'POST',
        body: { responses: finalResponses, auto },
      });
      window.onbeforeunload = null;
      document.exitFullscreen?.().catch(() => {});
      navigate(`/attempt/${d.attempt.id}`, { replace: true });
    } catch (e) {
      submitting.current = false;
      setError(e.message);
    }
  }

  // ---- Render -------------------------------------------------------------
  if (!blocked.ok) {
    return (
      <div className="instr">
        <div className="sheet" style={{ textAlign: 'center', padding: '34px 24px' }}>
          <h2 style={{ marginBottom: 10 }}>This exam opens on a laptop or desktop only</h2>
          <p>
            {blocked.reason === 'small-window'
              ? `Your browser window is too narrow for the exam screen. Maximise it to at least ${EXAM_MIN_WIDTH}px and reload this page.`
              : 'Mock tests cannot be taken on a phone or tablet. Open this same website on a computer and sign in with the same OTP — your test will be exactly where you left it.'}
          </p>
          <p className="muted" style={{ fontSize: 12.5 }}>
            Your attempt has not started and no time has been used.
          </p>
          <button className="primary" onClick={() => navigate('/', { replace: true })}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="instr">
        <div className="notice error">{error}</div>
        <button onClick={() => navigate('/')}>Back to dashboard</button>
      </div>
    );
  }
  if (!paper || !question) return <div className="instr muted">Loading your paper…</div>;

  const text = language === 'hi' && question.textHi ? question.textHi : question.text;
  const options = language === 'hi' && question.optionsHi?.length ? question.optionsHi : question.options;
  const lowTime = remaining < 300;

  return (
    <div className="exam-root">
      <div className="exam-top">
        <div className="brandline">
          {paper.exam.name} — {paper.exam.tier}
          <small>{paper.mockTest.title}</small>
        </div>
        <div className="candidate">
          <div className="who">
            <b>{user.name}</b><br />
            Roll No: {user.id.slice(-8).toUpperCase()}
          </div>
          <div className="photo">{user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>
        </div>
      </div>

      <div className="exam-strip">
        <div className="lang">
          <label htmlFor="qlang" style={{ margin: 0 }}>View in</label>
          <select id="qlang" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            {paper.exam.languages.includes('hi') && <option value="hi">हिन्दी</option>}
          </select>
        </div>
        <div className={`exam-timer${lowTime ? ' warn' : ''}`}>
          Time Left: <b>{fmtTime(remaining)}</b>
        </div>
      </div>
      <div className={`exam-timer exam-floating-timer${lowTime ? ' warn' : ''}`}>Time Left: <b>{fmtTime(remaining)}</b></div>

      <div className="exam-sections">
        {sections.map((s, i) => {
          const locked = paper.exam.sectionalTiming && i !== sectionIndex;
          return (
            <button
              key={s.id}
              className={i === sectionIndex ? 'active' : locked ? 'done' : ''}
              onClick={() => {
                if (locked) return;
                moveToSection(i);
              }}
              title={locked ? 'Sectional timing is enforced. This section is not open.' : ''}
            >
              {s.name}
            </button>
          );
        })}
        {sectionRemaining != null && (
          <div className="sec-timer">
            Section time left: <b className="mono">{fmtTime(sectionRemaining)}</b>
          </div>
        )}
      </div>

      <div className="exam-body">
        <div className="exam-question">
          <div className="exam-qbar">
            <span className="qno">Question No. {qIndex + 1}</span>
            <span className="marks">
              Marks: +{section.marksPerQuestion} <span className="neg">−{section.negativeMarks}</span>
              <button
                style={{ marginLeft: 10, padding: '2px 8px', fontSize: 11 }}
                onClick={() => setPaletteOpen((o) => !o)}
                className="only-narrow"
              >
                Palette
              </button>
            </span>
          </div>

          <div className={`exam-split${stimulus ? '' : ' single'}`}>
            {stimulus && (
              <div className="exam-stimulus">
                <h4>{stimulus.title || 'Directions'}</h4>
                {stimulus.image && <img src={stimulus.image} alt="Refer to the figure" />}
                {stimulus.text && <p>{stimulus.text}</p>}
                {stimulus.table && (
                  <table>
                    <thead><tr>{stimulus.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {stimulus.table.rows.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="exam-qtext">
              {question.image && <img src={question.image} alt="" />}
              <div className="stem">{text}</div>
              <ul className="exam-options">
                {options.map((raw, i) => {
                  const opt = asOption(raw);
                  return (
                    <li key={i}>
                      <label>
                        <input
                          type="radio"
                          name={`q_${question.id}`}
                          checked={draft === i}
                          onChange={() => setDraft(i)}
                        />
                        <span className="idx">{String.fromCharCode(65 + i)}.</span>
                        <span>
                          {opt.image && <img className="opt-img" src={opt.image} alt={`Option ${String.fromCharCode(65 + i)}`} />}
                          {opt.text && <span>{opt.text}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        <aside className={`exam-palette${paletteOpen ? ' open' : ''}`}>
          <div className="exam-legend">
            {[
              [STATUS.ANSWERED, counts[STATUS.ANSWERED], 'Answered'],
              [STATUS.NOT_ANSWERED, counts[STATUS.NOT_ANSWERED], 'Not Answered'],
              [STATUS.NOT_VISITED, counts[STATUS.NOT_VISITED], 'Not Visited'],
              [STATUS.MARKED, counts[STATUS.MARKED], 'Marked'],
              [STATUS.ANSWERED_MARKED, counts[STATUS.ANSWERED_MARKED], 'Answered & Marked'],
            ].map(([s, n, label]) => (
              <div key={s}><span className="pal mini" data-s={s} /> <b>{n}</b> {label}</div>
            ))}
          </div>

          <div className="paletitle">{section.name}</div>
          <div className="grid">
            {questionIds.map((qid, i) => (
              <button
                key={qid}
                className={`pal${i === qIndex ? ' current' : ''}`}
                data-s={responses[qid]?.status || STATUS.NOT_VISITED}
                onClick={() => goTo(i)}
                aria-label={`Question ${i + 1}, ${responses[qid]?.status || 'not visited'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className="foot">
            <button className="submit" onClick={() => setConfirm('submit')}>Submit Test</button>
          </div>
        </aside>
      </div>

      <div className="exam-foot">
        <button className="review" onClick={markAndNext}>Mark for Review &amp; Next</button>
        <button onClick={clearResponse}>Clear Response</button>
        <button onClick={() => goTo(Math.max(0, qIndex - 1))} disabled={qIndex === 0}>&laquo; Previous</button>
        <button className="save" onClick={saveAndNext}>Save &amp; Next</button>
        {paper.exam.sectionalTiming && sectionIndex < sections.length - 1 && (
          <button onClick={() => setConfirm('section')}>Move to next section &raquo;</button>
        )}
        <button className="submit" onClick={() => setConfirm('submit')}>Submit</button>
      </div>

      {tooNarrow && (
        <div className="exam-modal-bg" role="alertdialog" aria-modal="true">
          <div className="exam-modal">
            <header>Window too small</header>
            <div className="content">
              <p>The exam needs a full-size window. <b>Your timer is still running</b> — maximise the window to continue answering.</p>
            </div>
          </div>
        </div>
      )}

      {confirm === 'section' && (
        <div className="exam-modal-bg" role="dialog" aria-modal="true">
          <div className="exam-modal">
            <header>Move to the next section</header>
            <div className="content">
              <p>
                You are about to leave <b>{section.name}</b>. Sectional timing is enforced —
                once you leave, <b>you cannot return to this section</b>.
              </p>
              <p className="mono">
                Answered {counts[STATUS.ANSWERED] + counts[STATUS.ANSWERED_MARKED]} · Unanswered{' '}
                {counts[STATUS.NOT_ANSWERED] + counts[STATUS.NOT_VISITED] + counts[STATUS.MARKED]}
              </p>
            </div>
            <footer>
              <button onClick={() => setConfirm(null)}>Stay in this section</button>
              <button className="primary" onClick={() => moveToSection(sectionIndex + 1, true)}>Move on</button>
            </footer>
          </div>
        </div>
      )}

      {confirm === 'submit' && (
        <div className="exam-modal-bg" role="dialog" aria-modal="true">
          <div className="exam-modal">
            <header>Submit your test</header>
            <div className="content">
              <p>You still have <b>{fmtTime(remaining)}</b> remaining. Once submitted, the paper cannot be reopened.</p>
              <table>
                <thead>
                  <tr><th>Section</th><th>No. of questions</th><th>Answered</th><th>Not answered</th><th>Marked</th><th>Not visited</th></tr>
                </thead>
                <tbody>
                  {sections.map((s) => {
                    const ids = paper.mockTest.sections.find((x) => x.sectionId === s.id)?.questionIds || [];
                    const tally = { answered: 0, notAnswered: 0, marked: 0, notVisited: 0 };
                    ids.forEach((qid) => {
                      const st = responses[qid]?.status || STATUS.NOT_VISITED;
                      if (st === STATUS.ANSWERED || st === STATUS.ANSWERED_MARKED) tally.answered += 1;
                      else if (st === STATUS.MARKED) tally.marked += 1;
                      else if (st === STATUS.NOT_ANSWERED) tally.notAnswered += 1;
                      else tally.notVisited += 1;
                    });
                    return (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'left' }}>{s.name}</td>
                        <td>{ids.length}</td>
                        <td>{tally.answered}</td>
                        <td>{tally.notAnswered}</td>
                        <td>{tally.marked}</td>
                        <td>{tally.notVisited}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ marginTop: 12 }}>Are you sure you want to submit?</p>
            </div>
            <footer>
              <button onClick={() => setConfirm(null)}>No, go back</button>
              <button className="primary" onClick={() => doSubmit(false)}>Yes, submit</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
