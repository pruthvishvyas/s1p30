import * as A from './adapters.js';

export { chartFilePath } from './adapters.js';

export const DATASETS = {
  summary:         { outcome: 'meta',       key: 'summary',         fallback: 'meta/summary.json',            adapt: A.adaptSummary },
  runLog:          { outcome: 'meta',       key: 'run_log',         fallback: 'meta/run_log.json',            adapt: A.adaptRunLog },
  kpis:            { outcome: 'understand', key: 'kpis',            fallback: 'understand/kpis.json',         adapt: A.adaptKpis },
  charts:          { outcome: 'understand', key: 'charts',          fallback: 'understand/charts.json',       adapt: A.adaptCharts },
  segments:        { outcome: 'understand', key: 'segments',        fallback: 'understand/segments.json',     adapt: A.adaptSegments },
  anomalies:       { outcome: 'understand', key: 'anomalies',       fallback: 'understand/anomalies.json',    adapt: A.adaptAnomalies },
  insights:        { outcome: 'decide',     key: 'insights',        fallback: 'decide/insights.json',         adapt: A.adaptInsights },
  recommendations: { outcome: 'decide',     key: 'recommendations', fallback: 'decide/recommendations.json',  adapt: A.adaptRecommendations },
  goals:           { outcome: 'decide',     key: 'goals',           fallback: 'decide/goals.json',            adapt: A.adaptGoals },
  forecast:        { outcome: 'monitor',    key: 'forecast',        fallback: 'monitor/forecast.json',        adapt: A.adaptForecast },
  goalProgress:    { outcome: 'monitor',    key: 'goal_progress',   fallback: 'monitor/goal_progress.json',   adapt: A.adaptGoalProgress },
  alerts:          { outcome: 'monitor',    key: 'alerts',          fallback: 'monitor/alerts.json',          adapt: A.adaptAlerts },
};

const safeRel = rel => typeof rel === 'string' && rel.endsWith('.json') && !rel.includes('..');

export function resolveDatasetPath(contract, def) {
  const rel = contract && contract.outcomes && contract.outcomes[def.outcome] && contract.outcomes[def.outcome][def.key];
  return '/data/' + String(safeRel(rel) ? rel : def.fallback).replace(/^\/+/, '');
}

function titleFromFile(file) {
  const name = file.split('/').pop().replace(/\.json$/, '');
  return A.humanize(name);
}

// the contract lists simulations either as an array of files or as one index file
export function simulationRefs(contract) {
  const value = contract && contract.outcomes && contract.outcomes.decide && contract.outcomes.decide.simulations;
  if (Array.isArray(value)) {
    const files = value.filter(safeRel).map(f => {
      const file = f.replace(/^\/+/, '');
      return { id: file.split('/').pop().replace(/\.json$/, ''), title: titleFromFile(file), file };
    });
    return { indexPath: null, files };
  }
  if (safeRel(value)) return { indexPath: '/data/' + value.replace(/^\/+/, ''), files: [] };
  return { indexPath: null, files: [] };
}
