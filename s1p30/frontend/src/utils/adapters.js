import { DataError } from './errors.js';

const asNumber = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const cleaned = String(v).replace(/[,\s$\u20ac\u00a3\u00a5%]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const asText = (v, fallback = '') => (v === null || v === undefined ? fallback : String(v));
export const humanize = key =>
  asText(key).replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^./, c => c.toUpperCase());
const shape = message => new DataError('shape', message);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// the backend wraps lists under different keys; accept a bare array too
function pick(raw, keys) {
  if (Array.isArray(raw)) return raw;
  if (isObject(raw)) {
    for (const k of keys) if (Array.isArray(raw[k])) return raw[k];
  }
  return null;
}

const PERSONAL = /(^|_)(email|phone|full_?name|first_?name|last_?name|ssn|dob|address)($|_)/i;
function dropPersonal(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) if (!PERSONAL.test(k)) out[k] = v;
  return out;
}

function guessFormat(key, value) {
  const k = asText(key).toLowerCase();
  if (/(rate|share|pct|percent|ratio)/.test(k)) return 'percent';
  if (/(revenue|sales|cost|price|mrr|arr|profit|amount|spend|gain|saved|loss|lost|fee|value)/.test(k)) return 'currency';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'decimal';
  return 'text';
}

// a number shown beside a label: ratios under 1 become percentages, pct keys already are
function metricFor(key, n) {
  const k = asText(key).toLowerCase();
  if (/(pct|percent)/.test(k)) return { label: humanize(key), value: n, format: 'percent' };
  if (/(rate|share)/.test(k)) return { label: humanize(key), value: Math.abs(n) <= 1 ? n * 100 : n, format: 'percent' };
  return { label: humanize(key), value: n, format: guessFormat(key, n) };
}

const UNIT_FORMAT = { count: 'integer', currency: 'currency', ratio: 'percent', percent: 'percent', number: 'decimal' };

export function adaptContract(raw) {
  if (!isObject(raw)) throw shape('The contract file has an unexpected shape');
  const project = isObject(raw.project) ? raw.project : {};
  const defaults = { revenue: 'Revenue', customer: 'Customer', product: 'Product', transaction: 'Transaction' };
  const terminology = { ...defaults };
  if (isObject(raw.terminology)) {
    for (const k of Object.keys(defaults)) if (raw.terminology[k]) terminology[k] = asText(raw.terminology[k]);
  }
  return {
    schemaVersion: asText(raw.schema_version, '1'),
    generatedAt: asText(raw.generated_at),
    project: {
      name: asText(project.name, 'Dashboard'),
      domain: asText(project.domain),
      clientId: asText(project.client_id, 'project'),
      description: asText(project.description),
    },
    terminology,
    source: isObject(raw.source) ? raw.source : {},
    outcomes: isObject(raw.outcomes) ? raw.outcomes : {},
    model: isObject(raw.model) ? raw.model : {},
    files: Array.isArray(raw.files) ? raw.files : [],
  };
}

export function adaptSummary(raw) {
  if (!isObject(raw)) throw shape('The summary file has an unexpected shape');
  const range = isObject(raw.date_range) ? raw.date_range : {};
  return {
    project: asText(raw.project),
    domain: asText(raw.domain),
    rows: asNumber(raw.rows),
    lastRun: asText(raw.last_run),
    dateRange: { start: asText(range.start), end: asText(range.end) },
    currency: raw.currency === null ? null : isObject(raw.currency) ? raw.currency : { code: 'USD', symbol: '$' },
    locale: asText(raw.locale, 'en-US'),
    source: asText(raw.source),
  };
}

export function adaptRunLog(raw) {
  if (!isObject(raw)) throw shape('The run log has an unexpected shape');
  const stageOf = s => ({
    name: asText(s && (s.name ?? s.stage)), status: asText(s && s.status).toUpperCase(),
    seconds: asNumber(s && s.seconds), reason: asText(s && s.reason),
  });
  let runs = [];
  if (Array.isArray(raw.runs)) {
    runs = raw.runs.map(r => ({ finished: asText(r && (r.finished ?? r.started)), stages: Array.isArray(r && r.stages) ? r.stages.map(stageOf) : [] }));
  } else if (Array.isArray(raw.history)) {
    runs = raw.history.map(r => ({ finished: asText(r && r.finished_at), stages: Array.isArray(r && r.stages) ? r.stages.map(stageOf) : [] })).reverse();
  }
  if (runs.length === 0 && Array.isArray(raw.stages)) runs = [{ finished: asText(raw.updated_at), stages: raw.stages.map(stageOf) }];
  return { updatedAt: asText(raw.updated_at), runs };
}

export function adaptKpis(raw) {
  let rows = pick(raw, ['items', 'kpis']);
  if (!rows && isObject(raw)) {
    rows = Object.entries(raw)
      .filter(([k, v]) => !k.startsWith('_') && k !== 'generated_at' && ['number', 'string', 'boolean'].includes(typeof v))
      .map(([key, value]) => ({ key, value }));
  }
  if (!rows) throw shape('The key numbers file has an unexpected shape');
  const out = rows
    .map((k, i) => {
      if (!isObject(k)) return null;
      const key = asText(k.key ?? k.id ?? k.label ?? 'kpi_' + i);
      let value = typeof k.value === 'boolean' ? (k.value ? 'Yes' : 'No') : k.value;
      if (value === undefined || value === null) return null;
      const unit = asText(k.unit).toLowerCase();
      const n = asNumber(value);
      let format = k.format || UNIT_FORMAT[unit] || guessFormat(key, value);
      if (format !== 'text' && n === null) format = 'text';
      const scale = !k.format && n !== null && (unit === 'ratio' || (!UNIT_FORMAT[unit] && format === 'percent' && Math.abs(n) <= 1));
      if (scale) value = n * 100;
      return { key, label: asText(k.label, humanize(key)), value: format === 'text' ? value : (scale ? n * 100 : n), format, trend: asNumber(k.trend), note: asText(k.note) };
    })
    .filter(Boolean);
  if (out.length === 0) throw shape('No usable key numbers found');
  return out;
}

const KNOWN_CHARTS = ['bar', 'line', 'histogram', 'scatter', 'heatmap'];

export function adaptChart(raw) {
  if (!isObject(raw)) throw shape('A chart file has an unexpected shape');
  if (raw.status === 'skipped') throw new DataError('skipped', asText(raw.reason, 'This chart was skipped'));
  const type = asText(raw.type, 'bar').toLowerCase();
  let rows = Array.isArray(raw.data) ? raw.data : null;
  if (!rows && Array.isArray(raw.x) && Array.isArray(raw.y)) {
    if (raw.x.length !== raw.y.length) throw shape('Chart x and y lengths differ');
    rows = raw.x.map((x, i) => ({ label: x, value: raw.y[i] }));
  }
  if (!rows) throw shape('Chart has no data');
  const base = {
    id: asText(raw.id, 'chart'), title: asText(raw.title, 'Chart'), type: KNOWN_CHARTS.includes(type) ? type : 'bar',
    question: asText(raw.question), outcome: asText(raw.outcome), xLabel: asText(raw.x_label), yLabel: asText(raw.y_label),
  };
  if (type === 'scatter') {
    const points = rows
      .map(r => ({ x: asNumber(r && (r.x ?? r.label)), y: asNumber(r && (r.y ?? r.value)) }))
      .filter(p => p.x !== null && p.y !== null)
      .slice(0, 1500);
    if (points.length === 0) throw shape('Chart has no plottable points');
    return { ...base, type: 'scatter', points };
  }
  if (type === 'heatmap') {
    const cells = rows
      .map(r => {
        let row = r && r.row;
        let col = r && r.col;
        if (row === undefined && r && typeof r.label === 'string' && r.label.includes(' | ')) {
          const parts = r.label.split(' | ');
          row = parts[0];
          col = parts.slice(1).join(' | ');
        }
        return { row: asText(row), col: asText(col), value: asNumber(r && r.value) };
      })
      .filter(c => c.value !== null && c.row !== '');
    if (cells.length === 0) throw shape('Chart has no plottable cells');
    return { ...base, type: 'heatmap', cells, rowNames: [...new Set(cells.map(c => c.row))], colNames: [...new Set(cells.map(c => c.col))] };
  }
  const flat = rows
    .map(r => ({ label: asText(r && (r.label ?? r.x)), value: asNumber(r && (r.value ?? r.y)) }))
    .filter(r => r.value !== null);
  if (flat.length === 0) throw shape('Chart has no plottable rows');
  // labels written as "bin | group" become one series per group
  if (flat.every(r => r.label.includes(' | '))) {
    const keys = [];
    const byBin = new Map();
    for (const r of flat) {
      const at = r.label.lastIndexOf(' | ');
      const bin = r.label.slice(0, at);
      const group = r.label.slice(at + 3);
      if (!keys.includes(group)) keys.push(group);
      const row = byBin.get(bin) || { label: bin };
      row[group] = r.value;
      byBin.set(bin, row);
    }
    return { ...base, rows: [...byBin.values()], seriesKeys: keys };
  }
  return { ...base, rows: flat, seriesKeys: ['value'] };
}

export function chartFilePath(entry) {
  const file = entry && entry.file;
  return typeof file === 'string' && file.endsWith('.json') && !file.includes('..') ? file.replace(/^\/+/, '') : null;
}

export function adaptCharts(raw) {
  const rows = pick(raw, ['items', 'charts']);
  if (!rows) throw shape('The charts file has an unexpected shape');
  const out = [];
  for (const r of rows) {
    if (!isObject(r)) continue;
    let inline = null;
    if (Array.isArray(r.data) || (Array.isArray(r.x) && Array.isArray(r.y))) {
      try { inline = adaptChart(r); } catch { inline = null; }
    }
    const file = chartFilePath(r);
    if (!inline && !file) continue;
    out.push({
      id: asText(r.id, 'chart_' + out.length), title: asText(r.title, humanize(r.id)), type: asText(r.type, 'bar'),
      outcome: asText(r.outcome), question: asText(r.question), path: file ? '/data/' + file : null, inline,
    });
  }
  if (out.length === 0) throw shape('No usable charts found');
  const order = { understand: 0, decide: 1, monitor: 2 };
  return out.sort((a, b) => (order[a.outcome] ?? 3) - (order[b.outcome] ?? 3));
}

const SEGMENT_ORDER = ['Low', 'Medium', 'High'];

export function adaptSegments(raw) {
  const rows = pick(raw, ['items', 'segments']);
  if (!rows) throw shape('The segments file has an unexpected shape');
  const skip = ['name', 'segment', 'size', 'returns', 'count', 'share', 'description', 'summary'];
  const total = rows.reduce((s, r) => s + (asNumber(r && (r.size ?? r.returns ?? r.count)) || 0), 0);
  const items = rows.filter(isObject).map((r, i) => {
    const size = asNumber(r.size ?? r.returns ?? r.count) ?? 0;
    let share = asNumber(r.share);
    if (share === null) share = total > 0 ? (size / total) * 100 : 0;
    const summary = [];
    const source = isObject(r.summary) ? r.summary : r;
    for (const [k, v] of Object.entries(source)) {
      if (source === r && skip.includes(k)) continue;
      const n = asNumber(v);
      if (n !== null) summary.push(metricFor(k, n));
    }
    return { name: asText(r.name ?? r.segment, 'Segment ' + (i + 1)), size, share, description: asText(r.description), summary };
  });
  if (items.length === 0) throw shape('No usable segments found');
  const rank = n => (SEGMENT_ORDER.includes(n) ? SEGMENT_ORDER.indexOf(n) : 99);
  items.sort((a, b) => rank(a.name) - rank(b.name));
  const meta = isObject(raw) && isObject(raw.meta) ? raw.meta : {};
  return { items, method: asText(isObject(raw) ? raw.method : '', 'Segments grouped by return behaviour'), silhouette: asNumber(meta.silhouette) };
}

export function adaptAnomalies(raw) {
  if (!isObject(raw) && !Array.isArray(raw)) throw shape('The anomalies file has an unexpected shape');
  const rows = pick(raw, ['items', 'rows']) || [];
  const real = isObject(raw) && raw.count !== undefined;
  const total = asNumber(isObject(raw) ? (raw.total ?? raw.count) : null) ?? rows.length;
  let rate = asNumber(isObject(raw) ? raw.rate : null);
  if (rate !== null && real) rate *= 100;
  const items = rows.filter(isObject).map(dropPersonal).map((r, i) => ({
    id: asText(r.id ?? r.return, 'row ' + (i + 1)), group: asText(r.category ?? r.metric), date: asText(r.date),
    value: asNumber(r.value ?? r.profit_lost), expected: asNumber(r.expected), score: asNumber(r.score), reason: asText(r.reason),
  }));
  const byGroup = isObject(raw) && isObject(raw.by_category)
    ? Object.entries(raw.by_category).map(([label, v]) => ({ label, value: (asNumber(v) || 0) * 100 }))
    : [];
  if (!isObject(raw) && items.length === 0) throw shape('No usable anomaly rows found');
  return { total, rate, items, byGroup };
}

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const normSeverity = v => {
  const s = asText(v).toUpperCase();
  return SEVERITY_ORDER[s] === undefined ? 'LOW' : s;
};

export function adaptInsights(raw) {
  const rows = pick(raw, ['items', 'insights']);
  if (!rows) throw shape('The insights file has an unexpected shape');
  const items = rows
    .filter(r => isObject(r) && r.finding)
    .map(r => ({
      severity: normSeverity(r.severity), category: asText(r.category, 'General'), finding: asText(r.finding),
      evidence: asText(r.evidence), action: asText(r.action),
    }));
  if (items.length === 0) throw shape('No usable insights found');
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

const normPriority = v => {
  const s = asText(v).toUpperCase();
  if (s.includes('P1') || s.includes('URGENT')) return 'P1_URGENT';
  if (s.includes('P2') || s.includes('HIGH')) return 'P2_HIGH';
  if (s.includes('P3') || s.includes('MEDIUM')) return 'P3_MEDIUM';
  return 'P4_ROUTINE';
};

export function adaptRecommendations(raw) {
  if (!isObject(raw) && !Array.isArray(raw)) throw shape('The recommendations file has an unexpected shape');
  const rows = pick(raw, ['items', 'rows']);
  if (!rows) throw shape('The recommendations file has no rows');
  const items = rows.filter(isObject).map(dropPersonal).map((r, i) => {
    const alerts = asText(r.alerts).split('|').filter(Boolean).map(humanize).join(', ');
    return {
      id: asText(r.id ?? r.return ?? i), priority: normPriority(r.priority),
      title: asText(r.title, r.return ? 'Return ' + r.return : 'Action ' + (i + 1)),
      action: asText(r.action ?? r.recommendations), evidence: asText(r.evidence, alerts),
      impactText: asText(r.impact), impactValue: asNumber(r.profit_lost), when: asText(r.when), count: asNumber(r.count) ?? 1,
    };
  });
  const summary = isObject(raw) && isObject(raw.summary)
    ? Object.entries(raw.summary).map(([key, v]) => ({ key, label: humanize(key), count: asNumber(v) ?? 0 })).sort((a, b) => b.count - a.count)
    : [];
  if (items.length === 0 && summary.length === 0) throw shape('No usable recommendations found');
  return { items, summary };
}

export function adaptGoals(raw) {
  const rows = isObject(raw) && Array.isArray(raw.items) ? raw.items : null;
  const entries = rows
    ? rows.filter(isObject).map(g => [asText(g.key), g])
    : isObject(raw) ? Object.entries(raw).filter(([, g]) => isObject(g)) : null;
  if (!entries) throw shape('The goals file has an unexpected shape');
  const items = entries.map(([key, g]) => ({
    key, label: asText(g.label, humanize(key)), value: asNumber(g.value), unit: asText(g.unit),
    description: asText(g.description), clientSets: Boolean(g.client_sets),
  }));
  if (items.length === 0) throw shape('No goals found');
  return items;
}

const goalStatus = text => {
  const s = asText(text).toLowerCase();
  if (s.includes('not set') || s === '') return 'no_target';
  if (s.includes('over')) return 'off_track';
  if (s.includes('within')) return 'on_track';
  return 'no_target';
};

export function adaptGoalProgress(raw) {
  if (!isObject(raw)) throw shape('The goal progress file has an unexpected shape');
  if (Array.isArray(raw.items)) {
    const items = raw.items.filter(isObject).map(g => ({
      key: asText(g.key), label: asText(g.label, humanize(g.key)), target: asNumber(g.target), actual: asNumber(g.actual),
      unit: asText(g.unit), pct: asNumber(g.pct), status: asText(g.status, 'no_target'),
    }));
    return { items, weekly: null };
  }
  const cap = asNumber(raw.profit_loss_cap);
  const latest = asNumber(raw.latest_month_profit_lost);
  const ceiling = asNumber(raw.abuse_ceiling_pct);
  const rate = asNumber(raw.abuse_rate_pct);
  const items = [];
  if (latest !== null) {
    items.push({ key: 'profit_loss', label: 'Profit lost in ' + asText(raw.latest_month, 'the latest month'), target: cap, actual: latest, unit: 'currency',
      pct: cap ? (latest / cap) * 100 : null, status: goalStatus(raw.cap_status) });
  }
  if (rate !== null) {
    items.push({ key: 'abuse_rate', label: 'Suspected abuse rate', target: ceiling, actual: rate, unit: 'percent',
      pct: ceiling ? (rate / ceiling) * 100 : null, status: goalStatus(raw.abuse_status) });
  }
  if (items.length === 0) throw shape('No usable goal progress found');
  const w = isObject(raw.weekly_alert) ? raw.weekly_alert : null;
  return { items, weekly: w ? { week: asText(w.week), changePct: asNumber(w.change_pct), thresholdPct: asNumber(w.threshold_pct), triggered: Boolean(w.triggered) } : null };
}

export function adaptAlerts(raw) {
  if (!isObject(raw) && !Array.isArray(raw)) throw shape('The alerts file has an unexpected shape');
  const rows = pick(raw, ['items']);
  let items = [];
  if (rows) {
    items = rows.filter(isObject).map(a => ({
      severity: normSeverity(a.severity), title: asText(a.title, 'Alert'), message: asText(a.message), since: asText(a.since),
    }));
  }
  const w = isObject(raw) && isObject(raw.weekly_alert) ? raw.weekly_alert : null;
  const weekly = w ? { week: asText(w.week), changePct: asNumber(w.change_pct), thresholdPct: asNumber(w.threshold_pct), triggered: Boolean(w.triggered) } : null;
  if (weekly && weekly.triggered) {
    items.push({ severity: 'HIGH', title: 'Weekly profit lost is rising', since: weekly.week,
      message: 'Profit lost changed by ' + weekly.changePct + '% against the previous week, above the ' + weekly.thresholdPct + '% alert line.' });
  }
  const count = obj => (isObject(obj) ? Object.entries(obj).map(([key, v]) => ({ key, label: humanize(key), count: asNumber(v) ?? 0 })).sort((a, b) => b.count - a.count) : []);
  items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { items, weekly, priorityCounts: count(isObject(raw) ? raw.priority_counts : null), alertCounts: count(isObject(raw) ? raw.alert_counts : null) };
}

export function adaptForecast(raw) {
  if (!isObject(raw)) throw shape('The forecast file has an unexpected shape');
  if (isObject(raw.metrics) && Array.isArray(raw.series)) {
    const m = raw.metrics;
    const model = isObject(m.model) ? m.model : {};
    const baseline = isObject(m.baseline) ? m.baseline : {};
    const points = raw.series.filter(isObject).map(s => {
      const kind = asText(s.kind);
      const predicted = asNumber(s.predicted);
      return {
        t: asText(s.week_start), actual: kind === 'forecast' ? null : asNumber(s.actual), holdout: kind === 'holdout' ? predicted : null,
        baseline: kind === 'holdout' ? asNumber(s.baseline) : null, forecast: kind === 'forecast' ? predicted : null,
      };
    });
    const lastActual = points.map(p => p.actual !== null).lastIndexOf(true);
    if (lastActual >= 0 && points.some(p => p.forecast !== null)) points[lastActual].forecast = points[lastActual].actual;
    if (points.length === 0) throw shape('The forecast has no rows');
    const mape = asNumber(model.mape);
    const baseMape = asNumber(baseline.mape);
    return {
      metric: asText(m.series, 'Value'), unit: 'currency', horizon: m.horizon_days ? m.horizon_days + ' days' : '', method: asText(model.name),
      points, error: { mae: asNumber(model.mae), mape: mape === null ? null : mape * 100, baselineMae: asNumber(baseline.mae), baselineMape: baseMape === null ? null : baseMape * 100, period: asNumber(m.holdout_weeks) ? m.holdout_weeks + ' held-out weeks, ' + asText(m.evaluation) : '' },
      beatsBaseline: Boolean(m.beats_baseline), lowSample: Boolean(m.low_sample), note: '',
    };
  }
  if (Array.isArray(raw.history) || Array.isArray(raw.forecast)) {
    const hist = (raw.history || []).filter(isObject).map(h => ({ t: asText(h.t), actual: asNumber(h.value), holdout: null, baseline: null, forecast: null }));
    const fut = (raw.forecast || []).filter(isObject).map(f => ({ t: asText(f.t), actual: null, holdout: null, baseline: null, forecast: asNumber(f.value), low: asNumber(f.low), high: asNumber(f.high) }));
    const e = isObject(raw.error) ? raw.error : {};
    if (hist.length + fut.length === 0) throw shape('The forecast has no rows');
    return {
      metric: asText(raw.metric, 'Value'), unit: asText(raw.unit), horizon: asText(raw.horizon), method: asText(raw.method), points: [...hist, ...fut],
      error: { mae: asNumber(e.mae), mape: asNumber(e.mape), baselineMae: asNumber(e.baseline_mae), baselineMape: null, period: asText(e.period) },
      beatsBaseline: asNumber(e.mae) !== null && asNumber(e.baseline_mae) !== null ? asNumber(e.mae) < asNumber(e.baseline_mae) : false, lowSample: false, note: asText(raw.note),
    };
  }
  throw shape('The forecast file has an unexpected shape');
}

export function adaptSimulationIndex(raw) {
  const rows = pick(raw, ['items']);
  if (!rows) throw shape('The simulation index has an unexpected shape');
  const items = rows
    .filter(r => isObject(r) && typeof r.file === 'string' && r.file.endsWith('.json') && !r.file.includes('..'))
    .map(r => ({ id: asText(r.id, r.file), title: asText(r.title, humanize(r.id)), file: r.file.replace(/^\/+/, '') }));
  if (items.length === 0) throw shape('No usable simulations found');
  return { items };
}

export function adaptSimulation(raw) {
  if (!isObject(raw)) throw shape('A simulation file has an unexpected shape');
  if (raw.status === 'skipped') throw new DataError('skipped', asText(raw.reason, 'This simulation was skipped'));
  let table;
  let variable;
  let outputs;
  if (Array.isArray(raw.table) && isObject(raw.variable)) {
    table = raw.table.filter(isObject).map(r => ({ x: asNumber(r.x), values: isObject(r.values) ? r.values : {} })).filter(r => r.x !== null);
    variable = { key: asText(raw.variable.key), label: asText(raw.variable.label, humanize(raw.variable.key)), unit: asText(raw.variable.unit),
      min: asNumber(raw.variable.min), max: asNumber(raw.variable.max), step: asNumber(raw.variable.step) || 1, defaultValue: asNumber(raw.variable.default), format: asText(raw.variable.format, 'decimal') };
    outputs = Array.isArray(raw.outputs) ? raw.outputs.filter(isObject).map(o => ({ key: asText(o.key), label: asText(o.label, humanize(o.key)), format: asText(o.format, 'decimal') })) : [];
  } else if (Array.isArray(raw.points) && typeof raw.variable === 'string') {
    const xKey = raw.variable;
    table = raw.points.filter(isObject).map(p => {
      const values = {};
      for (const [k, v] of Object.entries(p)) {
        const n = asNumber(v);
        if (k !== xKey && n !== null) values[k] = n;
      }
      return { x: asNumber(p[xKey]), values };
    }).filter(r => r.x !== null);
    const xs = table.map(r => r.x);
    const diffs = xs.slice(1).map((x, i) => x - xs[i]).filter(d => d > 0);
    variable = { key: xKey, label: humanize(xKey), unit: asText(raw.unit), min: xs[0], max: xs[xs.length - 1], step: diffs.length ? Math.min(...diffs) : 1,
      defaultValue: xs[0], format: guessFormat(xKey, 1) === 'percent' ? 'percent' : guessFormat(xKey, 1) === 'currency' ? 'currency' : 'decimal' };
    const keys = table.length ? Object.keys(table[0].values) : [];
    outputs = keys.map(k => ({ key: k, label: humanize(k), format: guessFormat(k, 1.5) === 'text' ? 'decimal' : guessFormat(k, 1.5) }));
  } else {
    throw shape('A simulation file has an unexpected shape');
  }
  if (table.length < 2) throw shape('A simulation needs at least two rows');
  table.sort((a, b) => a.x - b.x);
  if (outputs.length === 0) throw shape('A simulation has no outputs');
  let assumptions = [];
  if (Array.isArray(raw.assumptions)) assumptions = raw.assumptions.map(a => asText(a));
  else if (isObject(raw.assumptions)) assumptions = Object.entries(raw.assumptions).map(([k, v]) => humanize(k) + ': ' + asText(v));
  if (variable.min === null) variable.min = table[0].x;
  if (variable.max === null) variable.max = table[table.length - 1].x;
  if (variable.defaultValue === null) variable.defaultValue = variable.min;
  return { id: asText(raw.id), title: asText(raw.title, 'Scenario'), description: asText(raw.description), variable, outputs, table, assumptions };
}
