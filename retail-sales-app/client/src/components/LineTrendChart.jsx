import { useRef, useState } from 'react';
import { CHROME } from '../lib/chartColors.js';
import { formatNumber } from '../lib/format.js';

const WIDTH = 900;
const HEIGHT = 340;
const PAD = { top: 20, right: 24, bottom: 36, left: 64 };

export default function LineTrendChart({ categories, series }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const allValues = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
  const maxValue = Math.max(...allValues, 1);
  const niceMax = niceCeiling(maxValue);

  const xStep = categories.length > 1 ? plotW / (categories.length - 1) : 0;
  const xFor = (i) => PAD.left + (categories.length > 1 ? i * xStep : plotW / 2);
  const yFor = (v) => PAD.top + plotH - (v / niceMax) * plotH;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (niceMax / yTicks) * i);

  function handleMove(e) {
    if (!svgRef.current || categories.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = WIDTH / rect.width;
    const svgX = (e.clientX - rect.left) * scale;
    const relative = categories.length > 1 ? (svgX - PAD.left) / xStep : 0;
    const idx = Math.max(0, Math.min(categories.length - 1, Math.round(relative)));
    setHoverIndex(idx);
  }

  const showLegend = series.length > 1;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
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

        {categories.map((c, i) => {
          if (categories.length > 8 && i % Math.ceil(categories.length / 8) !== 0) return null;
          return (
            <text key={c} x={xFor(i)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize={11} fill={CHROME.muted}>
              {c}
            </text>
          );
        })}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)} x2={xFor(hoverIndex)}
            y1={PAD.top} y2={HEIGHT - PAD.bottom}
            stroke={CHROME.axis} strokeWidth={1} strokeDasharray="3,3"
          />
        )}

        {series.map((s) => {
          const points = s.values.map((v, i) => [xFor(i), yFor(v ?? 0)]);
          const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {hoverIndex !== null && s.values[hoverIndex] !== null && s.values[hoverIndex] !== undefined && (
                <circle cx={xFor(hoverIndex)} cy={yFor(s.values[hoverIndex])} r={4} fill={CHROME.surface} stroke={s.color} strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>

      {hoverIndex !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
            top: 8,
            transform: xFor(hoverIndex) / WIDTH > 0.7 ? 'translateX(-100%)' : 'none',
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
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{categories[hoverIndex]}</div>
          {series.map((s) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: CHROME.textSecondary }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: s.color, marginRight: 6 }} />
                {s.name}
              </span>
              <strong>{formatNumber(s.values[hoverIndex])}</strong>
            </div>
          ))}
        </div>
      )}

      {showLegend && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
          {series.map((s) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: CHROME.textSecondary }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: s.color }} />
              {s.name}
            </div>
          ))}
        </div>
      )}
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
