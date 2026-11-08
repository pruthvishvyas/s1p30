import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useChartColors } from '../../hooks/useChartColors.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { truncate } from '../../utils/text.js';

function Heatmap({ chart, fmt }) {
  const lookup = new Map(chart.cells.map(c => [c.row + '\u0000' + c.col, c.value]));
  const max = Math.max(...chart.cells.map(c => Math.abs(c.value)), 0.000001);
  return (
    <div className="table-scroll" style={{ height: '100%', overflow: 'auto' }}>
      <table className="heat">
        <thead>
          <tr>
            <th scope="col">{chart.yLabel || ''}</th>
            {chart.colNames.map(c => <th scope="col" key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {chart.rowNames.map(r => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {chart.colNames.map(c => {
                const v = lookup.get(r + '\u0000' + c);
                const has = v !== undefined;
                const style = has ? { background: 'color-mix(in srgb, var(--color-accent) ' + Math.round((Math.abs(v) / max) * 80) + '%, transparent)' } : undefined;
                return <td key={c} style={style}>{has ? fmt.number(v) : ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartBody({ chart }) {
  const colors = useChartColors();
  const fmt = useFormat();
  const axis = { fill: colors.text, fontSize: 12 };
  const tooltipStyle = { background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary };

  if (chart.type === 'heatmap') return <Heatmap chart={chart} fmt={fmt} />;

  if (chart.type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={chart.xLabel || 'x'} tick={axis} tickFormatter={fmt.number} label={{ value: chart.xLabel, position: 'insideBottom', offset: -12, fill: colors.text }} />
          <YAxis type="number" dataKey="y" name={chart.yLabel || 'y'} tick={axis} tickFormatter={fmt.number} width={64} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} formatter={v => fmt.number(v)} />
          <Scatter data={chart.points} fill={colors.series[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  const keys = chart.seriesKeys;
  const singleName = chart.yLabel || 'Value';
  const nameOf = k => (k === 'value' ? singleName : k);
  let rows = chart.rows;
  if (chart.type === 'bar' && rows.length > 40) rows = [...rows].sort((a, b) => (b[keys[0]] || 0) - (a[keys[0]] || 0)).slice(0, 40);
  const longLabels = chart.type === 'bar' && rows.some(r => String(r.label).length > 14);
  const tick = v => truncate(v, 14);

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={axis} tickFormatter={tick} minTickGap={24} />
          <YAxis tick={axis} tickFormatter={fmt.number} width={64} />
          <Tooltip contentStyle={tooltipStyle} formatter={v => fmt.number(v)} />
          {keys.length > 1 ? <Legend /> : null}
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} name={nameOf(k)} stroke={colors.series[i % 6]} strokeWidth={2} dot={rows.length <= 60} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const histogram = chart.type === 'histogram';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout={longLabels ? 'vertical' : 'horizontal'} barCategoryGap={histogram ? 0 : '20%'} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
        {longLabels ? (
          <XAxis type="number" tick={axis} tickFormatter={fmt.number} />
        ) : (
          <XAxis dataKey="label" tick={axis} tickFormatter={tick} interval="preserveStartEnd" minTickGap={12} />
        )}
        {longLabels ? (
          <YAxis type="category" dataKey="label" tick={axis} tickFormatter={tick} width={120} />
        ) : (
          <YAxis tick={axis} tickFormatter={fmt.number} width={64} />
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={v => fmt.number(v)} labelFormatter={v => String(v)} />
        {keys.length > 1 ? <Legend /> : null}
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} name={nameOf(k)} fill={colors.series[i % 6]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartPanel({ chart }) {
  const trimmed = chart.type === 'bar' && chart.rows && chart.rows.length > 40;
  return (
    <article className="card">
      <h3 className="chart-card-title">{chart.title}</h3>
      {chart.question ? <p className="muted">{chart.question}</p> : null}
      <div className="chart-box">
        <ChartBody chart={chart} />
      </div>
      <p className="muted chart-note">
        {[chart.xLabel ? 'Horizontal: ' + chart.xLabel : '', chart.yLabel ? 'Vertical: ' + chart.yLabel : '', trimmed ? 'Showing the top 40 values.' : '']
          .filter(Boolean)
          .join('. ')}
      </p>
    </article>
  );
}
