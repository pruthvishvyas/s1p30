import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { Icon } from '../shared/Icon.jsx';

export function KPICards() {
  const query = useDataset('kpis');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="key numbers" skeleton={<SkeletonCard count={4} height={112} />} />;
  }
  return (
    <div className="grid-cards">
      {query.data.map(k => (
        <article className="card" key={k.key}>
          <p className="kpi-label">{k.label}</p>
          <p className="kpi-value">{fmt.byFormat(k.format, k.value)}</p>
          {k.trend !== null ? (
            <p className="kpi-trend">
              <Icon name={k.trend >= 0 ? 'up' : 'down'} />
              {fmt.percent(Math.abs(k.trend))} against the previous period
            </p>
          ) : null}
          {k.note ? <p className="muted">{k.note}</p> : null}
        </article>
      ))}
    </div>
  );
}
