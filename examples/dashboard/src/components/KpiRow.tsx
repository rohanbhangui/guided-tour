import { useTourSteps } from 'guided-tour';
import { kpis } from '../data';
import { introTour } from '../tours';
import { Icon } from './Icon';

function Sparkline({ data, good }: { data: number[]; good: boolean }) {
  const w = 120;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`);
  return (
    <svg className="sparkline" data-good={good || undefined} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} />
    </svg>
  );
}

export function KpiRow() {
  const { Step } = useTourSteps(introTour);
  return (
    <Step
      id="kpis"
      title="Key metrics"
      content="Your four headline numbers for the selected range. Green means moving the right way, even when it's down (like churn)."
      placement="bottom"
    >
      <section className="kpis">
        {kpis.map((k) => {
          const good = k.positive ? k.delta >= 0 : k.delta <= 0;
          return (
            <article key={k.id} className="card kpi">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-foot">
                <span className="delta" data-good={good || undefined}>
                  <Icon name={k.delta >= 0 ? 'arrowUp' : 'arrowDown'} size={12} />
                  {Math.abs(k.delta)}%
                </span>
                <Sparkline data={k.series} good={good} />
              </div>
            </article>
          );
        })}
      </section>
    </Step>
  );
}
