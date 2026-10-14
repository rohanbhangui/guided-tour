import { useTourActions, useTourSteps } from 'guided-tour';
import { useEffect, useMemo, useState } from 'react';
import { money, orders, shortDate, type Order, type OrderStatus } from '../data';
import { introTour, ordersTour } from '../tours';
import { Icon } from './Icon';

const FILTERS: ('All' | OrderStatus)[] = ['All', 'Paid', 'Pending', 'Refunded', 'Failed'];
type SortKey = 'date' | 'customer' | 'amount';
const PAGE_SIZE = 8;

function RowActions({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return (
    <div className="dropdown">
      <button
        className="icon-button small"
        aria-label={`Actions for ${order.id}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name="dots" />
      </button>
      {open && (
        <div className="menu menu-right">
          <button className="menu-item">View order</button>
          <button className="menu-item">Email customer</button>
          <button className="menu-item danger">Refund</button>
        </div>
      )}
    </div>
  );
}

export function OrdersTable() {
  const { Step: IntroStep } = useTourSteps(introTour);
  const { Step } = useTourSteps(ordersTour);
  const { start } = useTourActions();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => filter === 'All' || o.status === filter)
      .filter((o) => !q || o.customer.toLowerCase().includes(q) || o.id.includes(q) || o.email.includes(q))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
  }, [query, filter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, f === 'All' ? orders.length : orders.filter((o) => o.status === f).length])),
    [],
  );

  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));
  const arrow = (key: SortKey) => (sort.key === key ? <Icon name={sort.dir === 1 ? 'arrowUp' : 'arrowDown'} size={12} /> : null);

  return (
    <IntroStep
      id="orders-table"
      title="Recent orders"
      content="Every order in one place. There's a deeper tour for this table. Click the ? in its corner anytime."
      placement="top"
    >
      <section className="card table-card">
        <div className="card-head">
          <h3>Orders</h3>
          <div className="table-tools">
            <Step
              id="orders-search"
              title="Search orders"
              content="Matches customer name, email or order number as you type."
              placement="bottom-end"
            >
              <label className="search small">
                <Icon name="search" size={14} />
                <input
                  placeholder="Search orders"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            </Step>
            <button className="icon-button" aria-label="Orders table tour" onClick={() => start('orders-table')}>
              <Icon name="help" />
            </button>
          </div>
        </div>

        <Step
          id="orders-filters"
          title="Try a filter"
          content={
            <>
              This step is <em>interactive</em>: click a status chip right now. Showing <strong>{filter}</strong> ·{' '}
              {rows.length} orders.
            </>
          }
          interactive
          placement={{ side: 'bottom', align: 'start', offset: 14 }}
        >
          <div className="chips" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f}
                className="chip"
                aria-pressed={f === filter}
                onClick={() => {
                  setFilter(f);
                  setPage(0);
                }}
              >
                {f} <span>{counts[f]}</span>
              </button>
            ))}
          </div>
        </Step>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <Step id="orders-sort" title="Sort any column" content="Click a header to sort; click again to flip the direction." placement="top">
                  <th>
                    <button className="th-sort" onClick={() => sortBy('customer')}>
                      Customer {arrow('customer')}
                    </button>
                  </th>
                </Step>
                <th>
                  <button className="th-sort" onClick={() => sortBy('date')}>
                    Date {arrow('date')}
                  </button>
                </th>
                <th>Status</th>
                <th className="num">
                  <button className="th-sort" onClick={() => sortBy('amount')}>
                    Amount {arrow('amount')}
                  </button>
                </th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((o, i) => (
                <tr key={o.id}>
                  <td className="mono">{o.id}</td>
                  <td>
                    <div className="customer">
                      <span>{o.customer}</span>
                      <small>{o.email}</small>
                    </div>
                  </td>
                  <td>{shortDate(o.date)}</td>
                  <td>
                    <span className="status" data-status={o.status}>
                      {o.status}
                    </span>
                  </td>
                  <td className="num">{money(o.amount)}</td>
                  <td className="actions">
                    {i === 0 ? (
                      <Step
                        id="orders-actions"
                        title="Row actions"
                        content="View, email the customer, or refund, all without leaving the table."
                        placement="left"
                        wrapper="div"
                      >
                        <RowActions order={o} />
                      </Step>
                    ) : (
                      <RowActions order={o} />
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No orders match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Step id="orders-pagination" title="Pages" content={`${rows.length} orders across ${pages} pages.`} placement="top-end">
          <div className="pagination">
            <span>
              {rows.length === 0 ? 0 : current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}
            </span>
            <div>
              <button className="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Previous
              </button>
              <button className="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Next
              </button>
            </div>
          </div>
        </Step>
      </section>
    </IntroStep>
  );
}
