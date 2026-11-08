import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { SeverityBadge } from '../shared/SeverityBadge.jsx';

const FILTERS = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];

function CountTable({ title, rows }) {
  const fmt = useFormat();
  if (rows.length === 0) return null;
  return (
    <article className="card stack">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table className="data">
          <thead><tr><th scope="col">Type</th><th scope="col">Records</th></tr></thead>
          <tbody>
            {rows.map(r => <tr key={r.key}><td>{r.label}</td><td>{fmt.integer(r.count)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function AlertCenter() {
  const query = useDataset('alerts');
  const fmt = useFormat();
  const [filter, setFilter] = useState('ALL');
  if (query.loading || query.error) {
    return <DataState query={query} label="alerts" skeleton={<SkeletonCard count={2} height={120} />} />;
  }
  const { items, weekly, priorityCounts, alertCounts } = query.data;
  const shown = filter === 'ALL' ? items : items.filter(a => a.severity === filter);
  return (
    <div className="stack">
      {weekly && weekly.changePct !== null ? (
        <article className="card">
          <p className="kpi-label">Latest week against the previous week</p>
          <p className="kpi-value">{(weekly.changePct >= 0 ? '+' : '-') + fmt.percent(Math.abs(weekly.changePct))}</p>
          <p className="muted">Profit lost, week {weekly.week}. An alert is raised at {weekly.thresholdPct === null ? 'the set threshold' : '+' + fmt.percent(weekly.thresholdPct)}.</p>
        </article>
      ) : null}
      <div className="chips" role="group" aria-label="Filter by severity">
        {FILTERS.map(f => (
          <button type="button" key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="state-box"><p>No active alerts.</p></div>
      ) : (
        <div className="grid-wide">
          {shown.map((a, i) => (
            <article className="card stack" key={a.title + '-' + i}>
              <div className="row-between">
                <h3>{a.title}</h3>
                <SeverityBadge severity={a.severity} />
              </div>
              <p>{a.message}</p>
              {a.since ? <p className="muted">Since {a.since}</p> : null}
            </article>
          ))}
        </div>
      )}
      <div className="grid-wide">
        <CountTable title="Records by priority" rows={priorityCounts} />
        <CountTable title="Records by alert type" rows={alertCounts} />
      </div>
    </div>
  );
}
