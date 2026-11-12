import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toast } from 'react-toastify';

const TABS = ['Overview', 'Exams', 'Mock tests', 'Question bank', 'Students'];

export default function Admin() {
  const [tab, setTab] = useState('Overview');
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>Manage the platform</h1>
        </div>
        <div className="chips">
          {TABS.map((t) => (
            <button key={t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Exams' && <Exams />}
      {tab === 'Mock tests' && <Mocks />}
      {tab === 'Question bank' && <Bank />}
      {tab === 'Students' && <Students />}
    </>
  );
}

function Overview() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/admin/overview').then(setD); }, []);
  if (!d) return <p className="muted">Loading…</p>;
  return (
    <>
      <div className="grid stat">
        {Object.entries(d.totals).map(([k, v]) => (
          <div className="stat-box" key={k}>
            <div className="k">{k.replace(/([A-Z])/g, ' $1')}</div>
            <div className="v">{v}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Mock test participation</h2></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Mock test</th><th className="num">Attempts</th><th className="num">Average</th><th className="num">Top score</th></tr></thead>
          <tbody>
            {d.perMock.filter((m) => m.attempts > 0).map((m) => (
              <tr key={m.mockTestId}>
                <td>{m.title}</td><td className="num">{m.attempts}</td>
                <td className="num">{m.avgScore ?? '—'}</td><td className="num">{m.topScore ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

function Exams() {
  const [exams, setExams] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '', organisation: '', tier: 'Prelims', durationMin: 60, cutoffTotal: 55,
    sectionalTiming: true, plannedMockCount: 10, status: 'draft',
    sections: [{ id: 'sec_1', name: '', questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 9 }],
  });

  const load = () => api('/exams').then((d) => setExams(d.exams));
  useEffect(() => { load(); }, []);

  const setSection = (i, key, value) => {
    const sections = form.sections.map((s, j) => (j === i ? { ...s, [key]: value } : s));
    setForm({ ...form, sections });
  };

  async function create(e) {
    e.preventDefault();
    try {
      await api('/admin/exams', { method: 'POST', body: form });
      setMsg(`${form.name} created as a draft. Publish it when the mocks are ready.`);
      toast.success('Examination created');
      load();
    } catch (err) { setMsg(err.message); }
  }

  async function togglePublish(exam) {
    await api(`/admin/exams/${exam.id}`, { method: 'PATCH', body: { status: exam.status === 'published' ? 'draft' : 'published' } });
    toast.success(exam.status === 'published' ? 'Examination unpublished' : 'Examination published');
    load();
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><h2>Examinations</h2></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Exam</th><th>Pattern</th><th className="num">Duration</th><th className="num">Cut-off</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id}>
                <td><b>{e.name}</b><div className="muted" style={{ fontSize: 12 }}>{e.organisation} · {e.tier}</div></td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {e.sections.map((s) => `${s.name} ${s.questionCount}q`).join(' · ')}
                </td>
                <td className="num">{e.durationMin}m</td>
                <td className="num">{e.cutoffTotal}</td>
                <td><span className={`tag ${e.status === 'published' ? 'green' : ''}`}>{e.status}</span></td>
                <td className="right">
                  <button onClick={() => togglePublish(e)}>{e.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Add an examination</h2>
          <span className="muted" style={{ fontSize: 12.5 }}>Patterns are data, not code — add a section and the engine follows it.</span>
        </div>
        {msg && <div className="notice info">{msg}</div>}
        <form onSubmit={create}>
          <div className="grid three">
            <div className="field"><label>Exam name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="RBI Assistant 2026" required /></div>
            <div className="field"><label>Conducting body</label>
              <input value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} placeholder="Reserve Bank of India" /></div>
            <div className="field"><label>Stage</label>
              <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                <option>Prelims</option><option>Mains</option><option>Single tier</option>
              </select></div>
          </div>
          <div className="grid three">
            <div className="field"><label>Total duration (minutes)</label>
              <input type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></div>
            <div className="field"><label>Overall cut-off</label>
              <input type="number" value={form.cutoffTotal} onChange={(e) => setForm({ ...form, cutoffTotal: e.target.value })} /></div>
            <div className="field"><label>Mock tests planned</label>
              <input type="number" value={form.plannedMockCount} onChange={(e) => setForm({ ...form, plannedMockCount: e.target.value })} /></div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.sectionalTiming}
              onChange={(e) => setForm({ ...form, sectionalTiming: e.target.checked })} />
            Enforce sectional timing (candidates cannot return to a closed section)
          </label>

          <h3 style={{ margin: '14px 0 8px' }}>Sections</h3>
          {form.sections.map((s, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input placeholder="Section name" value={s.name} onChange={(e) => setSection(i, 'name', e.target.value)} required />
              <input type="number" placeholder="Questions" value={s.questionCount} onChange={(e) => setSection(i, 'questionCount', e.target.value)} />
              <input type="number" step="0.25" placeholder="Marks" value={s.marksPerQuestion} onChange={(e) => setSection(i, 'marksPerQuestion', e.target.value)} />
              <input type="number" step="0.25" placeholder="Negative" value={s.negativeMarks} onChange={(e) => setSection(i, 'negativeMarks', e.target.value)} />
              <input type="number" placeholder="Minutes" value={s.durationMin} onChange={(e) => setSection(i, 'durationMin', e.target.value)} />
              <input type="number" placeholder="Cut-off" value={s.cutoff ?? ''} onChange={(e) => setSection(i, 'cutoff', e.target.value)} />
            </div>
          ))}
          <button type="button" onClick={() => setForm({
            ...form,
            sections: [...form.sections, { id: `sec_${form.sections.length + 1}`, name: '', questionCount: 30, marksPerQuestion: 1, negativeMarks: 0.25, durationMin: 20, cutoff: 9 }],
          })}>Add another section</button>
          <div style={{ marginTop: 14 }}><button className="primary">Create examination</button></div>
        </form>
      </div>
    </>
  );
}

function Mocks() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [mocks, setMocks] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/exams').then((d) => { setExams(d.exams); setExamId(d.exams[0]?.id || ''); }); }, []);
  const load = (id) => id && api(`/exams/${id}`).then((d) => setMocks(d.mockTests));
  useEffect(() => { load(examId); }, [examId]);

  async function createMock() {
    const d = await api('/admin/mock-tests', { method: 'POST', body: { examId } });
    await api(`/admin/mock-tests/${d.mockTest.id}/auto-fill`, { method: 'POST' });
    setMsg(`${d.mockTest.title} created and filled from the bank. It is unpublished until you release it.`);
    toast.success('Mock test created and filled');
    load(examId);
  }

  async function toggle(m) {
    await api(`/admin/mock-tests/${m.id}`, { method: 'PATCH', body: { published: !m.published } });
    load(examId);
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Mock tests</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} style={{ width: 220 }}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button className="primary" onClick={createMock}>Create and auto-fill</button>
        </div>
      </div>
      {msg && <div className="notice info">{msg}</div>}
      <div className="table-scroll"><table>
        <thead><tr><th className="num">#</th><th>Title</th><th className="num">Questions</th><th>Opens</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {mocks.map((m) => (
            <tr key={m.id}>
              <td className="num">{m.index}</td>
              <td>{m.title}</td>
              <td className="num">{m.questionCount}</td>
              <td>{m.availableFrom ? new Date(m.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'immediately'}</td>
              <td><span className={`tag ${m.published ? 'green' : ''}`}>{m.published ? 'published' : 'draft'}</span></td>
              <td className="right"><button onClick={() => toggle(m)}>{m.published ? 'Unpublish' : 'Publish'}</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function Bank() {
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState({ examId: '', sectionId: '', difficulty: '', q: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [bulk, setBulk] = useState('');
  const [msg, setMsg] = useState('');
  const [uploaded, setUploaded] = useState(null);
  const [uploadErr, setUploadErr] = useState('');

  async function uploadImage(file) {
    setUploadErr(''); setUploaded(null);
    if (!file) return;
    try {
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(new Error('Could not read that file.'));
        r.readAsDataURL(file);
      });
      const d = await api('/admin/media', { method: 'POST', body: { mimeType: file.type, data } });
      setUploaded(d.url);
    } catch (err) { setUploadErr(err.message); }
  }

  useEffect(() => { api('/exams').then((d) => { setExams(d.exams); setFilters((f) => ({ ...f, examId: d.exams[0]?.id || '' })); }); }, []);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    api(`/admin/questions?${qs}`).then((d) => { setRows(d.questions.slice(0, 60)); setTotal(d.total); });
  }, [filters]);

  const exam = exams.find((e) => e.id === filters.examId);

  async function importBulk() {
    try {
      const parsed = JSON.parse(bulk);
      const d = await api('/admin/questions/bulk', { method: 'POST', body: { questions: parsed } });
      setMsg(`Imported ${d.imported} questions.${d.rejected.length ? ` ${d.rejected.length} rejected: ${d.rejected[0].reason}` : ''}`);
      setFilters({ ...filters });
    } catch (err) {
      setMsg(err instanceof SyntaxError ? 'That is not valid JSON. Check for a trailing comma.' : err.message);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head"><h2>Question bank</h2><span className="muted">{total} questions match</span></div>
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1.4fr 1fr 2fr', gap: 8, marginBottom: 12 }}>
          <select value={filters.examId} onChange={(e) => setFilters({ ...filters, examId: e.target.value, sectionId: '' })}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filters.sectionId} onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}>
            <option value="">All sections</option>
            {exam?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
            <option value="">Any difficulty</option><option>Easy</option><option>Moderate</option><option>Hard</option>
          </select>
          <input placeholder="Search question text" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        <div style={{ maxHeight: 460, overflow: 'auto' }}>
          <div className="table-scroll"><table>
            <thead><tr><th>Question</th><th>Topic</th><th>Difficulty</th><th className="num">Target time</th><th className="num">Answer</th></tr></thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id}>
                  <td style={{ maxWidth: 420 }}>{q.text.split('\n')[0].slice(0, 90)}{q.text.length > 90 ? '…' : ''}</td>
                  <td className="muted">{q.topic}</td>
                  <td>{q.difficulty}</td>
                  <td className="num">{q.expectedTimeSec}s</td>
                  <td className="num">{String.fromCharCode(65 + q.answer)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Bulk import</h2>
          <span className="muted" style={{ fontSize: 12.5 }}>Paste a JSON array. Rows that fail validation are reported, the rest still import.</span>
        </div>
        {msg && <div className="notice info">{msg}</div>}
        <textarea
          rows="7"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          style={{ fontFamily: 'var(--data)', fontSize: 12 }}
          placeholder={`[
  {"examId":"${filters.examId}","sectionId":"qua","topic":"Percentage","text":"25% of 480 is?","options":["120","110","130","96"],"answer":0},
  {"examId":"${filters.examId}","sectionId":"rea","topic":"Figure Series","text":"Select the figure that continues the series.","image":"/api/media/img_xxx.png","options":[{"image":"/api/media/opt_a.png"},{"image":"/api/media/opt_b.png"},{"image":"/api/media/opt_c.png"},{"image":"/api/media/opt_d.png"}],"answer":2}
]`}
        />
        <button className="primary" style={{ marginTop: 10 }} onClick={importBulk} disabled={!bulk.trim()}>Import questions</button>
      </div>

      <div className="card">
        <div className="card-head"><h2>Upload a question or option image</h2>
          <span className="muted" style={{ fontSize: 12.5 }}>PNG, JPEG, WebP or SVG, under 2 MB. Paste the returned URL into the JSON above — for the question via "image", for an option via {'{'}"image": "…"{'}'}.</span>
        </div>
        {uploadErr && <div className="notice error">{uploadErr}</div>}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ maxWidth: 340 }}
          onChange={(e) => uploadImage(e.target.files?.[0])} />
        {uploaded && (
          <div className="notice info" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <img src={uploaded} alt="Uploaded" style={{ maxHeight: 64, border: '1px solid var(--line)', background: '#fff' }} />
            <code style={{ fontFamily: 'var(--data)', fontSize: 12 }}>{uploaded}</code>
            <button onClick={() => navigator.clipboard?.writeText(uploaded)}>Copy URL</button>
          </div>
        )}
      </div>
    </>
  );
}

function Students() {
  const [students, setStudents] = useState([]);
  useEffect(() => { api('/admin/students').then((d) => setStudents(d.students)); }, []);
  return (
    <div className="card">
      <div className="card-head"><h2>Students</h2><span className="muted">{students.length} enrolled</span></div>
      <div className="table-scroll"><table>
        <thead><tr><th>Name</th><th>Email</th><th className="num">Mocks taken</th><th className="num">Average</th><th className="num">Best</th><th>Last active</th></tr></thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td><b>{s.name}</b></td>
              <td className="muted">{s.email}</td>
              <td className="num">{s.attempts}</td>
              <td className="num">{s.avgScore ?? '—'}</td>
              <td className="num">{s.bestScore ?? '—'}</td>
              <td className="muted">{s.lastActive ? new Date(s.lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'not yet'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
