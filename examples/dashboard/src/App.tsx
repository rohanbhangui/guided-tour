import { TourProvider, type TourOptions } from 'guided-tour';
import { useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from './components/ActivityFeed';
import { DevPanel } from './components/DevPanel';
import { KpiRow } from './components/KpiRow';
import { OrdersTable } from './components/OrdersTable';
import { RevenueChart } from './components/RevenueChart';
import { SettingsDrawer, type Theme } from './components/SettingsDrawer';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { tours, ui } from './tours';

export function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [range, setRange] = useState('Last 30 days');
  const [theme, setTheme] = useState<Theme>('system');
  const [escMode, setEscMode] = useState<'hold' | 'tap'>('hold');
  const [look, setLook] = useState({ overlay: true, highlight: true });

  // Let tour definitions drive app UI (e.g. open the drawer before a step inside it).
  useEffect(() => {
    ui.openSettings = () => setSettingsOpen(true);
    ui.closeSettings = () => setSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const defaults = useMemo<TourOptions>(() => ({ keyboard: { escape: escMode }, ...look }), [escMode, look]);

  return (
    <TourProvider tours={tours} defaults={defaults}>
      <div className="app" data-collapsed={collapsed || undefined}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onOpenSettings={() => setSettingsOpen(true)} />
        <div className="main">
          <Topbar range={range} onRange={setRange} />
          <div className="content">
            <div className="page-head">
              <div>
                <h1>Overview</h1>
                <p className="muted">{range} · updated 2 minutes ago</p>
              </div>
            </div>
            <KpiRow />
            <div className="grid-2">
              <RevenueChart />
              <ActivityFeed />
            </div>
            <OrdersTable />
          </div>
        </div>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onTheme={setTheme} />
      {import.meta.env.DEV && <DevPanel escMode={escMode} onEscMode={setEscMode} look={look} onLook={setLook} />}
    </TourProvider>
  );
}
