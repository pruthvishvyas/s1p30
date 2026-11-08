import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const STATUS = {
  on_track: { label: 'On track', cls: 'sev-low' },
  at_risk: { label: 'At risk', cls: 'sev-medium' },
  off_track: { label: 'Off track', cls: 'sev-high' },
  no_target: { label: 'No target set', cls: 'muted' },
};

export function GoalProgress() {
  const query = useDataset('goalProgress');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="goal progress" skeleton={<SkeletonCard count={2} height={140} />} />;
  }
  const show = (unit, v) => (v === null ? 'Not set' : unit === 'currency' ? fmt.money(v) : unit === 'percent' ? fmt.percent(v) : fmt.decimal(v));
  return (
    <div className="grid-wide">
      {query.data.items.map(g => {
        const status = STATUS[g.status] || STATUS.no_target;
        return (
          <article className="card stack" key={g.key}>
            <div className="row-between">
              <h3>{g.label}</h3>
              <span className={'badge ' + status.cls}>{status.label}</span>
            </div>
            <p>Actual <strong>{show(g.unit, g.actual)}</strong>, target <strong>{show(g.unit, g.target)}</strong></p>
            {g.pct !== null ? (
              <div>
                <div className="bar-track" role="img" aria-label={'Progress ' + Math.round(g.pct) + ' percent of target'}>
                  <div className="bar-fill" style={{ width: Math.min(100, Math.max(0, g.pct)) + '%' }} />
                </div>
                <p className="muted">{fmt.percent(g.pct)} of target</p>
              </div>
            ) : (
              <p className="muted">Set a target on the Goals page to track progress.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
