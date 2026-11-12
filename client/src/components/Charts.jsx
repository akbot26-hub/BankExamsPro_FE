import React from 'react';

export const SECTION_COLORS = ['#16346b', '#0e7b4f', '#b47500', '#6b3fa0', '#c0392b'];

/**
 * The Ledger — one column per mock test, section scores stacked, the dashed
 * hairline is the overall cut-off. The whole preparation journey in one glance.
 */
export function Ledger({ timeline, sections, cutoff, maxScore, onSelect }) {
  if (!timeline?.length) {
    return <div className="ledger"><div className="ledger-empty">Your first mock test will appear here as a column. Ten columns make a journey.</div></div>;
  }
  const ceiling = Math.max(maxScore * 0.85, ...timeline.map((t) => t.score)) || 1;
  const pxOf = (v) => `${Math.max(0, (v / ceiling) * 100)}%`;

  return (
    <div className="ledger">
      <div className="ledger-body">
        {/* The plot overlay shares the bars' box exactly, so the cut-off line
            lands where the bars actually measure it. */}
        {cutoff != null && (
          <div className="ledger-plot">
            <div className="ledger-cut" style={{ bottom: `${(cutoff / ceiling) * 100}%` }}>
              <span>Cut-off {cutoff}</span>
            </div>
          </div>
        )}
        {timeline.map((t) => (
          <div
            key={t.attemptId}
            className="ledger-col"
            onClick={() => onSelect?.(t)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : -1}
            onKeyDown={(e) => e.key === 'Enter' && onSelect?.(t)}
            title={`${t.label} — ${t.score}/${t.maxScore}`}
          >
            <span className="ledger-score">{t.score}</span>
            <div className="ledger-stack" style={{ height: pxOf(t.score) }}>
              {t.sections.map((s, i) => (
                <div
                  key={s.sectionId}
                  className="ledger-seg"
                  style={{
                    height: `${Math.max(0, (s.score / (t.score || 1)) * 100)}%`,
                    background: SECTION_COLORS[i % SECTION_COLORS.length],
                  }}
                />
              ))}
            </div>
            <span className="ledger-label">{t.day}</span>
          </div>
        ))}
      </div>
      <div className="ledger-legend">
        {sections.map((s, i) => (
          <span key={s.sectionId || s.id}>
            <i style={{ background: SECTION_COLORS[i % SECTION_COLORS.length] }} />{s.name}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>Day of preparation →</span>
      </div>
    </div>
  );
}

/** Multi-series line chart. Used for accuracy and speed over the mock sequence. */
export function LineChart({ series, labels, yLabel, height = 190, domain }) {
  const W = 640, H = height, padL = 34, padR = 10, padT = 12, padB = 24;
  const all = series.flatMap((s) => s.points).filter((n) => Number.isFinite(n));
  const lo = domain?.[0] ?? Math.max(0, Math.min(...all) - 8);
  const hi = domain?.[1] ?? Math.max(...all) + 8;
  const x = (i) => padL + (i / Math.max(1, labels.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label={yLabel}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = lo + f * (hi - lo);
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#eaeff4" />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="#94a3b8" fontFamily="IBM Plex Mono, monospace">{Math.round(v)}</text>
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="IBM Plex Mono, monospace">{l}</text>
      ))}
      {series.map((s, si) => (
        <g key={s.name}>
          <polyline
            fill="none"
            stroke={s.color || SECTION_COLORS[si % SECTION_COLORS.length]}
            strokeWidth="2"
            strokeLinejoin="round"
            points={s.points.map((p, i) => `${x(i)},${y(p)}`).join(' ')}
          />
          {s.points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p)} r="2.8" fill="#fff"
              stroke={s.color || SECTION_COLORS[si % SECTION_COLORS.length]} strokeWidth="1.8" />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function ChartLegend({ series }) {
  return (
    <div className="ledger-legend" style={{ marginTop: 6 }}>
      {series.map((s, i) => (
        <span key={s.name}><i style={{ background: s.color || SECTION_COLORS[i % SECTION_COLORS.length] }} />{s.name}</span>
      ))}
    </div>
  );
}

/** Readiness gauge — a 240° arc, because a full ring reads as "complete". */
export function Gauge({ value, size = 132 }) {
  const r = size / 2 - 12, cx = size / 2, cy = size / 2;
  const start = 150, sweep = 240;
  const pol = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const arc = (from, to) => {
    const [x1, y1] = pol(from), [x2, y2] = pol(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const colour = value >= 70 ? '#0e7b4f' : value >= 45 ? '#b47500' : '#c0392b';
  return (
    <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} role="img" aria-label={`Readiness ${value} percent`}>
      <path d={arc(start, start + sweep)} fill="none" stroke="#e7ecf2" strokeWidth="11" strokeLinecap="round" />
      <path d={arc(start, start + (sweep * value) / 100)} fill="none" stroke={colour} strokeWidth="11" strokeLinecap="round" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="30" fontWeight="700" fill="#0f1b2d" fontFamily="Familjen Grotesk, sans-serif">{value}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="9.5" fill="#64748b" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">READY</text>
    </svg>
  );
}

export function BarRow({ label, value, max = 100, suffix = '%', color }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
      <span className="num">{value}{suffix}</span>
    </div>
  );
}

/** Difference bar: gains right of centre, losses left. Used for topic trends. */
export function Diverging({ rows, unit = ' pts' }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="bar-row" style={{ gridTemplateColumns: '160px 1fr 62px' }}>
          <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div style={{ position: 'relative', height: 10, background: '#f4f6f9', borderRadius: 2 }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#cfd8e3' }} />
            <div style={{
              position: 'absolute', top: 1, bottom: 1,
              [r.value >= 0 ? 'left' : 'right']: '50%',
              width: `${(Math.abs(r.value) / max) * 50}%`,
              background: r.value >= 0 ? '#0e7b4f' : '#c0392b',
              borderRadius: 2,
            }} />
          </div>
          <span className="num" style={{ color: r.value >= 0 ? '#0e7b4f' : '#c0392b' }}>
            {r.value > 0 ? '+' : ''}{r.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}
