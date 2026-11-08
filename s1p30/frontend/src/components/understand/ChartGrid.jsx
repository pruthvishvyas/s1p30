import { useDataset, useDataFile } from '../../hooks/useDataset.js';
import { adaptChart } from '../../utils/adapters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ErrorBoundary } from '../shared/ErrorBoundary.jsx';
import { ChartPanel } from './ChartPanel.jsx';

function ChartLoader({ entry }) {
  const query = useDataFile(entry.path, adaptChart, !entry.inline);
  if (!entry.inline && (query.loading || query.error)) {
    return (
      <article className="card">
        <h3 className="chart-card-title">{entry.title}</h3>
        <DataState query={query} label="chart data" skeleton={<SkeletonCard count={1} height={240} />} />
      </article>
    );
  }
  return <ChartPanel chart={entry.inline || query.data} />;
}

export function ChartGrid() {
  const query = useDataset('charts');
  if (query.loading || query.error) {
    return <DataState query={query} label="charts" skeleton={<SkeletonCard count={4} height={320} />} />;
  }
  return (
    <div className="grid-wide">
      {query.data.map(entry => (
        <ErrorBoundary key={entry.id}>
          <ChartLoader entry={entry} />
        </ErrorBoundary>
      ))}
    </div>
  );
}
