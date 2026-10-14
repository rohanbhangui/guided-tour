// Deterministic fake data so the dashboard looks the same on every load.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

const DAY = 86_400_000;
const today = new Date('2026-10-13T00:00:00Z').getTime();

export interface RevenuePoint {
  date: Date;
  revenue: number;
}

export const revenue: RevenuePoint[] = Array.from({ length: 90 }, (_, i) => {
  const trend = 8200 + i * 38;
  const weekly = Math.sin((i / 7) * Math.PI * 2) * 900;
  const noise = (rand() - 0.5) * 1800;
  return { date: new Date(today - (89 - i) * DAY), revenue: Math.round(trend + weekly + noise) };
});

export type OrderStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed';

export interface Order {
  id: string;
  customer: string;
  email: string;
  date: Date;
  amount: number;
  status: OrderStatus;
  items: number;
}

const FIRST = ['Ava', 'Liam', 'Maya', 'Noah', 'Zoe', 'Ethan', 'Priya', 'Leo', 'Isla', 'Omar', 'Chloe', 'Kai', 'Nora', 'Ravi', 'Elena', 'Jonah'];
const LAST = ['Patel', 'Kim', 'Nguyen', 'Garcia', 'Smith', 'Okafor', 'Rossi', 'Chen', 'Silva', 'Novak', 'Haddad', 'Larsen'];
const STATUSES: OrderStatus[] = ['Paid', 'Paid', 'Paid', 'Paid', 'Pending', 'Pending', 'Refunded', 'Failed'];

export const orders: Order[] = Array.from({ length: 64 }, (_, i) => {
  const first = pick(FIRST);
  const last = pick(LAST);
  return {
    id: `#${(10432 - i).toString()}`,
    customer: `${first} ${last}`,
    email: `${first}.${last}@example.com`.toLowerCase(),
    date: new Date(today - Math.floor(rand() * 30) * DAY - Math.floor(rand() * DAY)),
    amount: Math.round((20 + rand() * 480) * 100) / 100,
    status: pick(STATUSES),
    items: 1 + Math.floor(rand() * 5),
  };
});

export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: number;
  series: number[];
  /** Higher is better? */
  positive: boolean;
}

const series = (base: number, spread: number) => Array.from({ length: 20 }, (_, i) => base + i * (spread / 20) + (rand() - 0.5) * spread);

export const kpis: Kpi[] = [
  { id: 'revenue', label: 'Revenue', value: '$284,920', delta: 12.4, series: series(100, 40), positive: true },
  { id: 'orders', label: 'Orders', value: '3,148', delta: 8.1, series: series(80, 25), positive: true },
  { id: 'conversion', label: 'Conversion', value: '3.42%', delta: -0.6, series: series(50, -8), positive: true },
  { id: 'churn', label: 'Churn', value: '1.9%', delta: -0.4, series: series(30, -10), positive: false },
];

export interface Activity {
  id: number;
  who: string;
  what: string;
  when: string;
  kind: 'order' | 'refund' | 'signup' | 'comment' | 'alert';
}

export const activity: Activity[] = [
  { id: 1, who: 'Maya Chen', what: 'placed order #10432 · $212.40', when: '2m ago', kind: 'order' },
  { id: 2, who: 'System', what: 'Checkout latency above 800ms', when: '9m ago', kind: 'alert' },
  { id: 3, who: 'Leo Rossi', what: 'requested a refund on #10418', when: '14m ago', kind: 'refund' },
  { id: 4, who: 'Priya Patel', what: 'signed up from the spring campaign', when: '22m ago', kind: 'signup' },
  { id: 5, who: 'Jonah Kim', what: 'commented on "Q4 pricing"', when: '38m ago', kind: 'comment' },
  { id: 6, who: 'Ava Okafor', what: 'placed order #10429 · $89.00', when: '51m ago', kind: 'order' },
  { id: 7, who: 'Omar Haddad', what: 'signed up via referral', when: '1h ago', kind: 'signup' },
  { id: 8, who: 'Elena Silva', what: 'placed order #10425 · $340.15', when: '1h ago', kind: 'order' },
  { id: 9, who: 'System', what: 'Daily export finished', when: '2h ago', kind: 'alert' },
  { id: 10, who: 'Kai Novak', what: 'requested a refund on #10401', when: '3h ago', kind: 'refund' },
  { id: 11, who: 'Nora Larsen', what: 'placed order #10420 · $64.99', when: '3h ago', kind: 'order' },
  { id: 12, who: 'Ravi Garcia', what: 'commented on "Holiday banner"', when: '4h ago', kind: 'comment' },
];

export const notifications = [
  { id: 1, title: 'Refund requested', body: 'Leo Rossi · order #10418', unread: true },
  { id: 2, title: 'Weekly report ready', body: 'Revenue up 12.4% week over week', unread: true },
  { id: 3, title: 'New team member', body: 'Isla joined the Support team', unread: false },
];

export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
