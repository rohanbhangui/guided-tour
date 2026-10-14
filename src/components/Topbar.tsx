import { useTourActions, useTourSteps } from 'guided-tour';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { notifications } from '../data';
import { introTour } from '../tours';
import { Icon } from './Icon';

function Dropdown({ button, label, children }: { button: ReactNode; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {button}
      </button>
      {open && <div className="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Topbar({ range, onRange }: { range: string; onRange: (r: string) => void }) {
  const { Step } = useTourSteps(introTour);
  const { start, reset } = useTourActions();
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="topbar">
      <Step
        id="search"
        title="Search everything"
        content={
          <>
            Find orders, customers and products from anywhere. Press <kbd>/</kbd> to focus it.
          </>
        }
        placement="bottom-start"
      >
        <label className="search">
          <Icon name="search" size={16} />
          <input placeholder="Search orders, customers…" />
          <kbd>/</kbd>
        </label>
      </Step>

      <div className="topbar-actions">
        <label className="select">
          <Icon name="calendar" size={16} />
          <select value={range} onChange={(e) => onRange(e.target.value)} aria-label="Date range">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
        </label>

        <Dropdown
          label="Notifications"
          button={
            <>
              <Icon name="bell" />
              {unread > 0 && <span className="badge">{unread}</span>}
            </>
          }
        >
          {() => (
            <>
              <div className="menu-title">Notifications</div>
              {notifications.map((n) => (
                <div key={n.id} className="menu-note" data-unread={n.unread || undefined}>
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                </div>
              ))}
            </>
          )}
        </Dropdown>

        <Step
          id="help-menu"
          title="Help is always here"
          content="Replay this tour, take a deeper tour of the orders table or settings, or reset all tours."
          // Inset placement: anchored below the button, right edges aligned.
          placement={{ top: '130%', right: 0 }}
        >
          <div>
            <Dropdown label="Help" button={<Icon name="help" />}>
              {(close) => (
                <>
                  <div className="menu-title">Guided tours</div>
                  <button className="menu-item" onClick={() => (close(), start('dashboard-intro'))}>
                    Replay intro tour
                  </button>
                  <button className="menu-item" onClick={() => (close(), start('orders-table'))}>
                    Orders table tour
                  </button>
                  <button className="menu-item" onClick={() => (close(), start('settings'))}>
                    Settings tour
                  </button>
                  <hr />
                  <button className="menu-item" onClick={() => (close(), reset())}>
                    Reset all tours
                  </button>
                </>
              )}
            </Dropdown>
          </div>
        </Step>

        <div className="avatar" title="Rohan B.">RB</div>
      </div>
    </header>
  );
}
