import { useTourSteps } from 'guided-tour';
import { activity } from '../data';
import { introTour } from '../tours';

export function ActivityFeed() {
  const { Step } = useTourSteps(introTour);
  return (
    <Step
      id="activity"
      title="Live activity"
      content="Orders, refunds, sign-ups and system alerts as they happen. It scrolls on its own."
      placement={{ side: 'left', align: 'start', offset: 20 }}
    >
      <section className="card activity">
        <div className="card-head">
          <h3>Activity</h3>
          <span className="live">Live</span>
        </div>
        <ol className="feed">
          {activity.map((a) => (
            <li key={a.id} data-kind={a.kind}>
              <span className="feed-dot" />
              <div>
                <p>
                  <strong>{a.who}</strong> {a.what}
                </p>
                <time>{a.when}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </Step>
  );
}
