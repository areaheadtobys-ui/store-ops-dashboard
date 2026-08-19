import { useState } from 'react';
import { CHROME } from '../lib/chartColors.js';
import { formatNumber } from '../lib/format.js';

const WIDTH = 900;
const HEIGHT = 340;
const PAD = { top: 20, right: 24, bottom: 36, left: 64 };

export default function GroupedBarChart({ categories, series }) {
  const [hover, setHover] = useState(null); // { catIndex, seriesIndex }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
  const maxValue = Math.max(...allValues, 1);
  const niceMax = niceCeiling(maxValue);

  const groupWidth = categories.length > 0 ? plotW / categories.length : plotW;
  const barGap = 2;
  const groupPadding = groupWidth * 0.18;
  const barWidth = Math.max(2, (groupWidth - groupPadding * 2 - barGap * (series.length - 1)) / series.length);

  const yFor = (v) => PAD.top + plotH - (v / niceMax) * plotH;
  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (niceMax / yTicks) * i);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {tickValues.map((tv, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(tv)} y2={yFor(tv)} stroke={CHROME.gridline} strokeWidth={1} />
            <text x={PAD.left - 10} y={yFor(tv) + 4} textAnchor="end" fontSize={11} fill={CHROME.muted}>
              {formatNumber(tv)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke={CHROME.axis} strokeWidth={1} />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} stroke={CHROME.axis} strokeWidth={1} />

        {categories.map((cat, ci) => {
          const groupX = PAD.left + ci * groupWidth + groupPadding;
          return (
            <g key={cat}>
              <text x={PAD.left + ci * groupWidth + groupWidth / 2} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize={11} fill={CHROME.muted}>
                {cat}
              </text>
              {series.map((s, si) => {
                const v = s.values[ci];
                if (v === null || v === undefined) return null;
                const x = groupX + si * (barWidth + barGap);
                const y = yFor(v);
                const h = HEIGHT - PAD.bottom - y;
                const isHover = hover && hover.catIndex === ci && hover.seriesIndex === si;
                return (
                  <rect
                    key={s.name}
                    x={x} y={y} width={barWidth} height={Math.max(h, 0)}
                    fill={s.color}
                    opacity={hover && !isHover ? 0.55 : 1}
                    rx={3} ry={3}
                    onMouseEnter={() => setHover({ catIndex: ci, seriesIndex: si })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {hover && (
        <TooltipBox categories={categories} series={series} hover={hover} />
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
        {series.map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: CHROME.textSecondary }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function TooltipBox({ categories, series, hover }) {
  const leftPct = ((hover.catIndex + 0.5) / categories.length) * 100;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: 8,
        transform: leftPct > 70 ? 'translateX(-100%)' : leftPct < 15 ? 'none' : 'translateX(-50%)',
        background: 'white',
        border: `1px solid ${CHROME.gridline}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        pointerEvents: 'none',
        minWidth: 140,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{categories[hover.catIndex]}</div>
      {series.map((s, si) => (
        <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, opacity: si === hover.seriesIndex ? 1 : 0.6 }}>
          <span style={{ color: CHROME.textSecondary }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: s.color, marginRight: 6 }} />
            {s.name}
          </span>
          <strong>{formatNumber(s.values[hover.catIndex])}</strong>
        </div>
      ))}
    </div>
  );
}

function niceCeiling(value) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let niceNormalized;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}
