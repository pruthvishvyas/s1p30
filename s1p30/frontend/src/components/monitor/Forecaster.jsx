import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { useDataset } from '../../hooks/useDataset.js';
import { useChartColors } from '../../hooks/useChartColors.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

export function Forecaster() {
  const query = useDataset('forecast');
  const colors = useChartColors();
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="forecast" skeleton={<SkeletonCard count={2} height={260} />} />;
  }
  const f = query.data;
  const axis = { fill: colors.text, fontSize: 12 };
  const money = v => (f.unit === 'currency' ? fmt.money(v) : fmt.number(v));
  const future = f.points.filter(p => p.forecast !== null && p.actual === null);
  return (
    <div className="stack">
      <article className="card">
        <h3 className="chart-card-title">{f.metric}: history, held-out check and forecast</h3>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={f.points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={axis} minTickGap={24} />
              <YAxis tick={axis} tickFormatter={fmt.compact} width={64} />
              <Tooltip formatter={v => money(v)} contentStyle={{ background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary }} />
              <Legend />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={colors.series[0]} strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="holdout" name="Model on held-out weeks" stroke={colors.series[4]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="baseline" name="Simple baseline" stroke={colors.series[1]} strokeWidth={2} strokeDasharray="2 4" dot={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={colors.series[2]} strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="muted chart-note">This is a forecast, not a guarantee.</p>
      </article>
      <div className="grid-cards">
        <article className="card">
          <p className="kpi-label">Typical error (MAE) on held-out weeks</p>
          <p className="kpi-value">{f.error.mae === null ? '-' : money(f.error.mae)}</p>
          <p className="muted">{f.error.mape === null || f.error.mape > 100 ? '' : 'About ' + fmt.percent(f.error.mape) + ' off in percentage terms. '}{f.error.period}</p>
        </article>
        <article className="card">
          <p className="kpi-label">Simple baseline error (MAE)</p>
          <p className="kpi-value">{f.error.baselineMae === null ? '-' : money(f.error.baselineMae)}</p>
          <p className="muted">{f.beatsBaseline ? 'The model was closer than the baseline on held-out weeks.' : 'The model was not closer than the baseline on held-out weeks, so treat the forecast with caution.'}</p>
        </article>
        <article className="card">
          <p className="kpi-label">Horizon and method</p>
          <p className="kpi-value">{f.horizon || '-'}</p>
          <p className="muted">{f.method}{f.lowSample ? '. Based on a short history.' : ''}</p>
        </article>
      </div>
      {future.length > 0 ? (
        <article className="card">
          <h3 className="chart-card-title">Forecast values</h3>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th scope="col">Week starting</th><th scope="col">Forecast</th></tr></thead>
              <tbody>
                {future.map(p => <tr key={p.t}><td>{p.t}</td><td>{money(p.forecast)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
      {f.note ? <p className="muted">{f.note}</p> : null}
    </div>
  );
}
