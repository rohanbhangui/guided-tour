import { useTour } from 'guided-tour';
import { useEffect, useState } from 'react';
import { tours } from '../tours';

type EscMode = 'hold' | 'tap';

function readEntries() {
  const out: [string, string][] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith('guided-tour:')) {
        const v = JSON.parse(localStorage.getItem(key)!) as { status: string; step: number };
        out.push([key.replace('guided-tour:', ''), `${v.status} @ step ${v.step + 1}`]);
      }
    }
  } catch {
    /* storage blocked */
  }
  return out.sort();
}

/** Dev-only harness: inspect storage and drive tours by hand. */
type Look = { overlay: boolean; highlight: boolean };

interface DevPanelProps {
  escMode: EscMode;
  onEscMode: (m: EscMode) => void;
  look: Look;
  onLook: (l: Look) => void;
}

export function DevPanel({ escMode, onEscMode, look, onLook }: DevPanelProps) {
  const tour = useTour();
  const [open, setOpen] = useState(true);
  const [entries, setEntries] = useState(readEntries);

  // Storage changes when a tour ends or resets; both change `useTour` state.
  useEffect(() => setEntries(readEntries()), [tour.isActive, tour.activeTourId]);
  const refresh = () => setTimeout(() => setEntries(readEntries()));

  if (!open) {
    return (
      <button className="devpanel-toggle" onClick={() => setOpen(true)}>
        Tours
      </button>
    );
  }

  return (
    <div className="devpanel">
      <div className="devpanel-head">
        <strong>Tour dev panel</strong>
        <button className="link" onClick={() => setOpen(false)}>
          hide
        </button>
      </div>
      <div className="devpanel-state">
        {tour.isActive ? (
          <>
            <span className="pill on">active</span> {tour.activeTourId} · {tour.stepIndex + 1}/{tour.totalSteps}
          </>
        ) : (
          <span className="pill">idle</span>
        )}
      </div>
      <table>
        <tbody>
          {tours.map((t) => (
            <tr key={t.id}>
              <td className="mono">{t.id}</td>
              <td>
                <button onClick={() => tour.start(t.id)}>start</button>
                <button
                  onClick={() => {
                    tour.reset(t.id);
                    refresh();
                  }}
                >
                  reset
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="devpanel-row">
        <button onClick={() => (tour.stop(), refresh())} disabled={!tour.isActive}>
          stop
        </button>
        <button onClick={() => (tour.reset(), refresh())}>reset all</button>
        <button onClick={() => (tour.reset('dashboard-intro'), location.reload())}>reset intro + reload</button>
      </div>
      <div className="devpanel-row">
        <span>Esc:</span>
        {(['hold', 'tap'] as const).map((m) => (
          <label key={m}>
            <input type="radio" name="esc" checked={escMode === m} onChange={() => onEscMode(m)} /> {m}
          </label>
        ))}
      </div>
      <div className="devpanel-row">
        <span>Look:</span>
        {(['overlay', 'highlight'] as const).map((k) => (
          <label key={k}>
            <input type="checkbox" checked={look[k]} onChange={(e) => onLook({ ...look, [k]: e.target.checked })} /> {k}
          </label>
        ))}
        <span className="muted">(applies from next step)</span>
      </div>
      <div className="devpanel-storage">
        <div className="muted">localStorage</div>
        {entries.length === 0 ? (
          <div className="muted">(empty: tours will auto-start)</div>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="mono">
              {k} <span className="muted">→ {v}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
