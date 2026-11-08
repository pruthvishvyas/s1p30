import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useContract } from '../../hooks/useContract.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const PROGRESS_KEY = { profit_loss_cap: 'profit_loss', abuse_rate_ceiling: 'abuse_rate' };

function readSaved(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function GoalTracker() {
  const goals = useDataset('goals');
  const progress = useDataset('goalProgress');
  const contract = useContract();
  const fmt = useFormat();
  const clientId = contract.data ? contract.data.project.clientId : 'project';
  const storageKey = 'goals:' + clientId;
  const [saved, setSaved] = useState(() => readSaved(storageKey));
  if (goals.loading || goals.error) {
    return <DataState query={goals} label="goals" skeleton={<SkeletonCard count={2} height={140} />} />;
  }
  const actuals = progress.data ? Object.fromEntries(progress.data.items.map(p => [p.key, p])) : {};
  const update = (key, text) => {
    const next = { ...saved };
    if (text === '') delete next[key];
    else next[key] = text;
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch { /* storage may be blocked; the value then lasts for this visit only */ }
  };
  const show = (g, value) => {
    if (value === null || value === undefined) return 'Not set';
    if (g.unit === 'percent') return fmt.percent(value);
    if (g.unit === 'days') return fmt.integer(value) + ' days';
    if (/cap|revenue|profit|cost|spend/.test(g.key)) return fmt.money(value);
    return fmt.decimal(value);
  };
  return (
    <div className="grid-wide">
      {goals.data.map(g => {
        const entered = saved[g.key] !== undefined ? Number(saved[g.key]) : null;
        const target = entered !== null && Number.isFinite(entered) ? entered : g.value;
        const link = actuals[PROGRESS_KEY[g.key]];
        const actual = link ? link.actual : null;
        const inputId = 'goal-' + g.key;
        return (
          <article className="card stack" key={g.key}>
            <h3>{g.label}</h3>
            {g.description ? <p className="muted">{g.description}</p> : null}
            <p>Target: <strong>{show(g, target)}</strong>{g.unit ? <span className="muted"> ({g.unit})</span> : null}</p>
            {actual !== null && target !== null ? (
              <p>
                Latest actual {link.unit === 'currency' ? fmt.money(actual) : fmt.percent(actual)}
                {': '}
                <strong>{actual <= target ? 'within target' : 'over target'}</strong>
              </p>
            ) : null}
            {g.clientSets ? (
              <div className="field">
                <label htmlFor={inputId}>Set your target</label>
                <input id={inputId} className="input" type="number" inputMode="decimal" value={saved[g.key] !== undefined ? saved[g.key] : ''} onChange={e => update(g.key, e.target.value)} />
                <span className="muted">Saved on this device only.</span>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
