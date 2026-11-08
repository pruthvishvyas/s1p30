import { useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ChartBody } from './ChartPanel.jsx';

const PAGE_SIZE = 25;
const COLUMNS = [
  { key: 'id', label: 'Record' },
  { key: 'group', label: 'Group' },
  { key: 'value', label: 'Value' },
  { key: 'expected', label: 'Expected' },
  { key: 'reason', label: 'Reason' },
];

export function AnomalyTable() {
  const query = useDataset('anomalies');
  const fmt = useFormat();
  const [sortKey, setSortKey] = useState('value');
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);
  const items = query.data ? query.data.items : null;
  const sorted = useMemo(() => {
    if (!items) return [];
    const copy = [...items];
    copy.sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      if (x === null || x === '') return 1;
      if (y === null || y === '') return -1;
      const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return descending ? -result : result;
    });
    return copy;
  }, [items, sortKey, descending]);
  if (query.loading || query.error) {
    return <DataState query={query} label="unusual records" skeleton={<SkeletonCard count={2} height={120} />} />;
  }
  const { total, rate, byGroup } = query.data;
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const sortBy = key => {
    if (key === sortKey) setDescending(!descending);
    else {
      setSortKey(key);
      setDescending(true);
    }
    setPage(0);
  };
  const cell = v => (v === null || v === '' ? '-' : typeof v === 'number' ? fmt.number(v) : v);
  const groupChart = { type: 'bar', rows: byGroup.map(g => ({ label: g.label, value: g.value })), seriesKeys: ['value'], yLabel: 'Share of records that are unusual (%)' };
  return (
    <div className="stack">
      <div className="grid-cards">
        <article className="card"><p className="kpi-label">Unusual records</p><p className="kpi-value">{fmt.integer(total)}</p></article>
        <article className="card"><p className="kpi-label">Share of all records</p><p className="kpi-value">{rate === null ? '-' : fmt.percent(rate)}</p></article>
      </div>
      {byGroup.length > 0 ? (
        <article className="card">
          <h3 className="chart-card-title">Unusual record rate by group</h3>
          <div className="chart-box"><ChartBody chart={groupChart} /></div>
        </article>
      ) : null}
      <article className="card">
        <h3 className="chart-card-title">Highest value unusual records</h3>
        <p className="muted">Record ids are anonymised. Showing {fmt.integer(items.length)} of {fmt.integer(total)}.</p>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                {COLUMNS.map(c => (
                  <th key={c.key} scope="col" aria-sort={sortKey === c.key ? (descending ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" className="sort-button" onClick={() => sortBy(c.key)}>
                      {c.label}{sortKey === c.key ? (descending ? ' (high to low)' : ' (low to high)') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={r.id + '-' + i}>
                  {COLUMNS.map(c => <td key={c.key}>{cell(r[c.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <button type="button" className="button button-ghost" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
          <span className="muted">Page {safePage + 1} of {pages}</span>
          <button type="button" className="button button-ghost" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next</button>
        </div>
      </article>
    </div>
  );
}
