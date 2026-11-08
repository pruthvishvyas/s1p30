import { useState } from 'react';
import { useContract } from '../../hooks/useContract.js';
import { useDataFile } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { simulationRefs } from '../../utils/datasets.js';
import { adaptSimulation, adaptSimulationIndex } from '../../utils/adapters.js';
import { interpolate } from '../../utils/sim.js';
import { DataError } from '../../utils/errors.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

function SimulationView({ file }) {
  const query = useDataFile('/data/' + file, adaptSimulation);
  const fmt = useFormat();
  const [x, setX] = useState(null);
  if (query.loading || query.error) {
    return <DataState query={query} label="scenario" skeleton={<SkeletonCard count={1} height={200} />} />;
  }
  const sim = query.data;
  const v = sim.variable;
  const current = x === null ? v.defaultValue : x;
  const baseline = sim.table[0].values;
  const scenario = interpolate(sim.table, current) || baseline;
  const inputId = 'sim-' + sim.id;
  return (
    <article className="card stack">
      <h3>{sim.title}</h3>
      {sim.description ? <p className="muted">{sim.description}</p> : null}
      <div className="field">
        <label htmlFor={inputId}>{v.label}{v.unit ? ' (' + v.unit + ')' : ''}: <strong>{fmt.byFormat(v.format, current)}</strong></label>
        <input id={inputId} className="slider" type="range" min={v.min} max={v.max} step={v.step} value={current} onChange={e => setX(Number(e.target.value))} />
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr><th scope="col">Result</th><th scope="col">At {fmt.byFormat(v.format, sim.table[0].x)}</th><th scope="col">At {fmt.byFormat(v.format, current)}</th><th scope="col">Difference</th></tr>
          </thead>
          <tbody>
            {sim.outputs.map(o => {
              const a = baseline[o.key];
              const b = scenario[o.key];
              const diff = typeof a === 'number' && typeof b === 'number' ? b - a : null;
              return (
                <tr key={o.key}>
                  <td>{o.label}</td>
                  <td>{fmt.byFormat(o.format, a)}</td>
                  <td>{fmt.byFormat(o.format, b)}</td>
                  <td className={diff === null ? '' : diff >= 0 ? 'delta-up' : 'delta-down'}>{diff === null ? '-' : (diff >= 0 ? '+' : '-') + fmt.byFormat(o.format, Math.abs(diff))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sim.assumptions.length > 0 ? (
        <div>
          <h4>Assumptions</h4>
          <ul>
            {sim.assumptions.map(a => <li key={a}>{a}</li>)}
          </ul>
        </div>
      ) : null}
      <p className="muted">Values between the listed steps are interpolated. These are scenarios, not measured results.</p>
    </article>
  );
}

export function WhatIfSimulator() {
  const contract = useContract();
  const refs = simulationRefs(contract.data);
  const index = useDataFile(refs.indexPath, adaptSimulationIndex, Boolean(refs.indexPath));
  const [selected, setSelected] = useState(null);
  if (contract.loading) return <SkeletonCard count={1} height={200} />;
  const options = refs.files.length > 0 ? refs.files : index.data ? index.data.items : [];
  if (options.length === 0) {
    if (refs.indexPath && index.loading) return <SkeletonCard count={1} height={200} />;
    const failure = index.error || new DataError('missing', 'No scenarios are listed');
    return <DataState query={{ loading: false, error: failure, reload: index.reload }} label="scenarios" />;
  }
  const activeFile = options.some(o => o.file === selected) ? selected : options[0].file;
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="sim-picker">Scenario</label>
        <select id="sim-picker" className="select" value={activeFile} onChange={e => setSelected(e.target.value)}>
          {options.map(o => <option key={o.file} value={o.file}>{o.title}</option>)}
        </select>
      </div>
      <SimulationView key={activeFile} file={activeFile} />
    </div>
  );
}
