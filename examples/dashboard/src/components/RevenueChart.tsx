import { useTourSteps } from 'guided-tour';
import { useMemo, useState } from 'react';
import { money, revenue, shortDate } from '../data';
import { introTour } from '../tours';

const RANGES = { '7D': 7, '30D': 30, '90D': 90 } as const;
type Range = keyof typeof RANGES;

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

export function RevenueChart() {
  const { Step } = useTourSteps(introTour);
  const [range, setRange] = useState<Range>('30D');
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => revenue.slice(-RANGES[range]), [range]);
  const max = Math.max(...data.map((d) => d.revenue)) * 1.1;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.revenue)}`).join('');
  const area = `${line}L${x(data.length - 1)} ${H - PAD.bottom}L${x(0)} ${H - PAD.bottom}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const hovered = hover != null ? data[hover] : undefined;

  return (
    <Step
      id="revenue-chart"
      title="Revenue over time"
      content={
        <>
          Hover the chart for daily totals. Switch the range with <strong>7D / 30D / 90D</strong>. Right now
          you're looking at <strong>{range}</strong>.
        </>
      }
      placement="left"
    >
      <section className="card chart-card">
        <div className="card-head">
          <div>
            <h3>Revenue</h3>
            <div className="big">{money(total)}</div>
          </div>
          <div className="segmented" role="group" aria-label="Range">
            {(Object.keys(RANGES) as Range[]).map((r) => (
              <button key={r} aria-pressed={r === range} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-wrap">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="chart"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - box.left) / box.width) * W;
              const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1));
              setHover(Math.max(0, Math.min(data.length - 1, i)));
            }}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
                <text className="axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                  {t >= 1000 ? `${Math.round(t / 1000)}k` : 0}
                </text>
              </g>
            ))}
            <path className="area" d={area} />
            <path className="line" d={line} />
            {hovered && hover != null && (
              <g>
                <line className="cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
                <circle className="dot" cx={x(hover)} cy={y(hovered.revenue)} r={4} />
              </g>
            )}
            <text className="axis" x={PAD.left} y={H - 6}>
              {shortDate(data[0]!.date)}
            </text>
            <text className="axis" x={W - PAD.right} y={H - 6} textAnchor="end">
              {shortDate(data[data.length - 1]!.date)}
            </text>
          </svg>
          {hovered && hover != null && (
            <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
              <span>{shortDate(hovered.date)}</span>
              <strong>{money(hovered.revenue)}</strong>
            </div>
          )}
        </div>
      </section>
    </Step>
  );
}
