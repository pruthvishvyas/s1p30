import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ChartBody } from './ChartPanel.jsx';

export function SegmentExplorer() {
  const query = useDataset('segments');
  const fmt = useFormat();
  const [selected, setSelected] = useState(null);
  if (query.loading || query.error) {
    return <DataState query={query} label="segments" skeleton={<SkeletonCard count={3} height={160} />} />;
  }
  const { items, method, silhouette } = query.data;
  const active = items.find(s => s.name === selected) || null;
  const sizeChart = { type: 'bar', rows: items.map(s => ({ label: s.name, value: s.size })), seriesKeys: ['value'], yLabel: 'Records' };
  return (
    <div className="stack">
      <p className="muted">
        {method}
        {silhouette !== null ? '. Separation score ' + fmt.decimal(silhouette) + ' (closer to 1 means clearer groups).' : ''}
      </p>
      <div className="grid-cards">
        {items.map(s => (
          <button type="button" key={s.name} className="card" style={{ textAlign: 'left' }} onClick={() => setSelected(selected === s.name ? null : s.name)} aria-pressed={selected === s.name}>
            <div className="row-between">
              <h3>{s.name}</h3>
              <span className="muted">{fmt.integer(s.size)} records</span>
            </div>
            <div className="bar-track" aria-hidden="true">
              <div className="bar-fill" style={{ width: Math.min(100, s.share) + '%' }} />
            </div>
            <p className="muted">{fmt.percent(s.share)} of all records</p>
          </button>
        ))}
      </div>
      {active ? (
        <article className="card">
          <h3>{active.name}</h3>
          {active.description ? <p>{active.description}</p> : null}
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th scope="col">Measure</th><th scope="col">Value</th></tr>
              </thead>
              <tbody>
                {active.summary.map(m => (
                  <tr key={m.label}><td>{m.label}</td><td>{fmt.byFormat(m.format, m.value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
      <article className="card">
        <h3 className="chart-card-title">Segment sizes</h3>
        <div className="chart-box"><ChartBody chart={sizeChart} /></div>
      </article>
    </div>
  );
}
