import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const LEVELS = [
  { id: 'P1_URGENT', label: 'Urgent' },
  { id: 'P2_HIGH', label: 'High' },
  { id: 'P3_MEDIUM', label: 'Medium' },
  { id: 'P4_ROUTINE', label: 'Routine' },
];
const LIMIT = 10;

function Group({ level, items }) {
  const fmt = useFormat();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, LIMIT);
  return (
    <section className="stack">
      <h3>{level.label} priority ({fmt.integer(items.length)})</h3>
      <div className="grid-wide">
        {shown.map((r, i) => (
          <article className="card stack" key={r.id + '-' + i}>
            <div className="row-between">
              <strong>{r.title}</strong>
              {r.impactValue !== null ? <span className="muted">Profit lost {fmt.money(r.impactValue)}</span> : null}
            </div>
            {r.action ? <p>{r.action}</p> : null}
            {r.evidence ? <p className="muted">Why: {r.evidence}</p> : null}
            {r.impactText ? <p className="muted">Impact: {r.impactText}</p> : null}
            {r.when ? <p className="muted">When: {r.when}</p> : null}
          </article>
        ))}
      </div>
      {items.length > LIMIT ? (
        <button type="button" className="button button-ghost" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : 'Show all ' + items.length}
        </button>
      ) : null}
    </section>
  );
}

export function RecommendationEngine() {
  const query = useDataset('recommendations');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="actions" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  const { items, summary } = query.data;
  return (
    <div className="stack">
      {summary.length > 0 ? (
        <article className="card stack">
          <h3>Alerts raised across all records</h3>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th scope="col">Alert</th><th scope="col">Records</th></tr></thead>
              <tbody>
                {summary.map(s => <tr key={s.key}><td>{s.label}</td><td>{fmt.integer(s.count)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
      {items.length === 0 ? <div className="state-box"><p>No actions are listed.</p></div> : null}
      {LEVELS.map(level => {
        const group = items.filter(r => r.priority === level.id);
        return group.length > 0 ? <Group key={level.id} level={level} items={group} /> : null;
      })}
    </div>
  );
}
