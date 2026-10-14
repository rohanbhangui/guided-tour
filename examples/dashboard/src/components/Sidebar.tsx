import { useTourSteps } from 'guided-tour';
import { introTour } from '../tours';
import { Icon, type IconName } from './Icon';

const NAV: { label: string; icon: IconName; active?: boolean }[] = [
  { label: 'Overview', icon: 'grid', active: true },
  { label: 'Orders', icon: 'bag' },
  { label: 'Customers', icon: 'users' },
  { label: 'Products', icon: 'box' },
  { label: 'Reports', icon: 'chart' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ collapsed, onToggle, onOpenSettings }: SidebarProps) {
  const { Step } = useTourSteps(introTour);

  return (
    <Step
      id="sidebar"
      title="Navigation"
      content="Jump between Overview, Orders, Customers and Reports. Collapse it with the arrow for more room."
      placement={{ side: 'right', align: 'start', offset: 16, shift: 24 }}
      spotlightPadding={0}
      spotlightRadius={0}
    >
      <aside className="sidebar" data-collapsed={collapsed || undefined}>
        <div className="sidebar-brand">
          <span className="logo">A</span>
          {!collapsed && <span>Acme</span>}
        </div>
        <nav>
          {NAV.map((item) => (
            <a key={item.label} href="#" className="nav-item" aria-current={item.active ? 'page' : undefined} onClick={(e) => e.preventDefault()}>
              <Icon name={item.icon} />
              {!collapsed && <span>{item.label}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={onOpenSettings}>
            <Icon name="gear" />
            {!collapsed && <span>Settings</span>}
          </button>
          <button className="nav-item" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </Step>
  );
}
