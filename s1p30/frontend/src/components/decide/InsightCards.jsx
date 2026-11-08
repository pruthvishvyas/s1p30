import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { SeverityBadge } from '../shared/SeverityBadge.jsx';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'HIGH', label: 'High' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'LOW', label: 'Low' },
];

export function InsightCards() {
  const query = useDataset('insights');
  const [filter, setFilter] = useState('ALL');
  if (query.loading || query.error) {
    return <DataState query={query} label="insights" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  const items = query.data;
  const count = id => (id === 'ALL' ? items.length : items.filter(i => i.severity === id).length);
  const shown = filter === 'ALL' ? items : items.filter(i => i.severity === filter);
  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Filter by severity">
        {FILTERS.map(f => (
          <button type="button" key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({count(f.id)})
          </button>
        ))}
      </div>
      <div className="grid-wide">
        {shown.map((item, i) => (
          <article className="card stack" key={item.category + '-' + i}>
            <div className="row-between">
              <span className="tag">{item.category}</span>
              <SeverityBadge severity={item.severity} />
            </div>
            <h3>{item.finding}</h3>
            {item.evidence ? <p className="muted">{item.evidence}</p> : null}
            {item.action ? <p><strong>What to do this week: </strong>{item.action}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
