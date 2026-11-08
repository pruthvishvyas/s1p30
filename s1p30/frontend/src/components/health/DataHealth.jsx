import { useContract } from '../../hooks/useContract.js';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DATASETS, simulationRefs } from '../../utils/datasets.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const NAMES = Object.keys(DATASETS);

function DatasetRow({ name }) {
  const query = useDataset(name);
  let state = 'Loaded';
  let detail = '';
  if (query.loading) state = 'Loading';
  else if (query.error) {
    const kind = query.error.kind;
    state = kind === 'skipped' ? 'Skipped' : kind === 'missing' || kind === 'empty' ? 'Missing' : kind === 'network' ? 'Unreachable' : 'Invalid';
    detail = query.error.message;
  }
  return <tr><td>{name}</td><td>{state}</td><td>{detail}</td></tr>;
}

export function DataHealth() {
  const contract = useContract();
  const summary = useDataset('summary');
  const runLog = useDataset('runLog');
  const fmt = useFormat();
  const sims = simulationRefs(contract.data);
  const latest = runLog.data && runLog.data.runs.length > 0 ? runLog.data.runs[0] : null;
  return (
    <div className="stack">
      {summary.data ? (
        <div className="grid-cards">
          <article className="card"><p className="kpi-label">Records</p><p className="kpi-value">{summary.data.rows === null ? '-' : fmt.integer(summary.data.rows)}</p></article>
          <article className="card"><p className="kpi-label">Data source</p><p className="kpi-value">{summary.data.source || '-'}</p></article>
          <article className="card">
            <p className="kpi-label">Last data export</p>
            <p className="kpi-value" style={{ fontSize: 'var(--font-size-lg)' }}>{contract.data && contract.data.generatedAt ? fmt.dateTime(contract.data.generatedAt) : '-'}</p>
            <p className="muted">{contract.data && contract.data.generatedAt ? fmt.relative(contract.data.generatedAt) : ''}</p>
          </article>
          <article className="card"><p className="kpi-label">Contract version</p><p className="kpi-value">{contract.data ? contract.data.schemaVersion : '-'}</p></article>
        </div>
      ) : (
        <DataState query={summary} label="summary" skeleton={<SkeletonCard count={2} height={100} />} />
      )}
      <article className="card stack">
        <h3>Latest analysis run{latest && latest.finished ? ' (' + fmt.dateTime(latest.finished) + ')' : ''}</h3>
        {runLog.data && latest ? (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th scope="col">Stage</th><th scope="col">Status</th><th scope="col">Seconds</th><th scope="col">Reason</th></tr></thead>
              <tbody>
                {latest.stages.map(s => (
                  <tr key={s.name}><td>{s.name}</td><td>{s.status}</td><td>{s.seconds === null ? '-' : fmt.decimal(s.seconds)}</td><td>{s.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DataState query={runLog.data ? { loading: false, error: { kind: 'missing', message: 'No stages recorded' }, reload: runLog.reload } : runLog} label="run history" />
        )}
      </article>
      <article className="card stack">
        <h3>Data files</h3>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th scope="col">Dataset</th><th scope="col">State</th><th scope="col">Detail</th></tr></thead>
            <tbody>
              {NAMES.map(name => <DatasetRow key={name} name={name} />)}
              <tr><td>scenarios</td><td>{sims.files.length > 0 || sims.indexPath ? 'Listed (' + (sims.files.length || 'index') + ')' : 'Missing'}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
