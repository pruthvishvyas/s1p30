const MCP_PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SERVER_INFO = { name: 's1p30-analytics', version: '1.0.0' };
const MAX_CHARS = 60000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) return await handleMcp(request, env, url);
    } catch (err) {
      console.error('worker error', err && err.message);
      return json({ error: 'Unexpected server error' }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

async function readAsset(env, url, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(path, url.origin).toString()));
  if (!res.ok) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) return null;
  try { return await res.json(); } catch { return null; }
}

async function loadContract(env, url) {
  return (await readAsset(env, url, '/data/frontend_contract.json')) || {};
}

function contractPath(contract, outcome, key, fallback) {
  const rel = contract && contract.outcomes && contract.outcomes[outcome] && contract.outcomes[outcome][key];
  const chosen = typeof rel === 'string' && rel.endsWith('.json') && !rel.includes('..') ? rel : fallback;
  return '/data/' + chosen.replace(/^\/+/, '');
}

function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}

// nearest-entry lookup in a precomputed table, only when the backend wrote one
async function handleApi(request, env, url) {
  if (url.pathname !== '/api/forecast') return json({ error: 'Not found' }, 404);
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, { Allow: 'POST' });
  if (!sameOrigin(request, url)) return json({ error: 'Forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Send JSON such as {"input": 12}' }, 400); }
  const x = Number(body && body.input);
  if (!Number.isFinite(x)) return json({ error: 'input must be a number' }, 400);
  const lookup = await readAsset(env, url, '/data/monitor/forecast_lookup.json');
  const table = lookup && Array.isArray(lookup.table) ? lookup.table.filter(r => r && Number.isFinite(Number(r.x))) : [];
  if (table.length === 0) return json({ error: 'No lookup table is available for this project' }, 404);
  const nearest = table.reduce((best, r) => (Math.abs(r.x - x) < Math.abs(best.x - x) ? r : best), table[0]);
  return json({
    input: x,
    matched_input: nearest.x,
    value: nearest.value ?? null,
    low: nearest.low ?? null,
    high: nearest.high ?? null,
  });
}

const TOOLS = [
  { name: 'get_kpis', outcome: 'understand', key: 'kpis', fallback: 'understand/kpis.json', description: 'Current key numbers for the business.' },
  { name: 'get_segments', outcome: 'understand', key: 'segments', fallback: 'understand/segments.json', description: 'Record segments with sizes.' },
  { name: 'get_anomalies', outcome: 'understand', key: 'anomalies', fallback: 'understand/anomalies.json', description: 'Unusual records the analysis flagged.' },
  { name: 'get_insights', outcome: 'decide', key: 'insights', fallback: 'decide/insights.json', description: 'Findings with evidence and the action to take. Optional severity filter.', severity: true },
  { name: 'get_recommendations', outcome: 'decide', key: 'recommendations', fallback: 'decide/recommendations.json', description: 'Prioritised actions.' },
  { name: 'get_forecast', outcome: 'monitor', key: 'forecast', fallback: 'monitor/forecast.json', description: 'Forecast with its held-out error.' },
  { name: 'get_alerts', outcome: 'monitor', key: 'alerts', fallback: 'monitor/alerts.json', description: 'Active alerts.' },
  { name: 'get_summary', outcome: 'meta', key: 'summary', fallback: 'meta/summary.json', description: 'Project summary and data freshness.' },
];

function toolList() {
  return TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.severity
      ? { type: 'object', properties: { severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW', 'ALL'] } }, additionalProperties: false }
      : { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  }));
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function originAllowed(origin, env) {
  const list = String(env.MCP_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(origin);
}

async function handleMcp(request, env, url) {
  const mode = String(env.MCP_MODE || 'off').toLowerCase();
  if (mode === 'off') return json({ error: 'MCP access is turned off for this site' }, 404);
  if (mode !== 'open' && mode !== 'token') return json({ error: 'MCP_MODE must be off, token or open' }, 500);
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin && !originAllowed(origin, env)) return json({ error: 'Forbidden origin' }, 403);
  if (mode === 'token') {
    const header = request.headers.get('Authorization') || '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!env.MCP_TOKEN || !safeEqual(given, env.MCP_TOKEN)) {
      return json({ error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
    }
  }
  let message;
  try { message = await request.json(); } catch { return json(rpcError(null, -32700, 'Parse error'), 400); }
  const batch = Array.isArray(message);
  const replies = [];
  for (const m of batch ? message : [message]) {
    const reply = await handleRpc(m, env, url);
    if (reply) replies.push(reply);
  }
  if (replies.length === 0) return new Response(null, { status: 202 });
  return json(batch ? replies : replies[0]);
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}

async function handleRpc(m, env, url) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return rpcError(m && m.id, -32600, 'Invalid request');
  const isNotification = m.id === undefined || m.id === null;
  if (isNotification) return null;
  switch (m.method) {
    case 'initialize': {
      const asked = m.params && m.params.protocolVersion;
      const protocolVersion = MCP_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOLS[0];
      return {
        jsonrpc: '2.0', id: m.id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: 'Read-only business analytics. All numbers come from the latest published analysis run.',
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id: m.id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id: m.id, result: { tools: toolList() } };
    case 'tools/call': {
      const name = m.params && m.params.name;
      const tool = TOOLS.find(t => t.name === name);
      if (!tool) return rpcError(m.id, -32602, 'Unknown tool: ' + String(name));
      const contract = await loadContract(env, url);
      const path = contractPath(contract, tool.outcome, tool.key, tool.fallback);
      let data = await readAsset(env, url, path);
      if (data === null) {
        return { jsonrpc: '2.0', id: m.id, result: { isError: true, content: [{ type: 'text', text: 'No data is available for ' + tool.name + ' yet.' }] } };
      }
      const wanted = String((m.params.arguments && m.params.arguments.severity) || 'ALL').toUpperCase();
      if (tool.severity && wanted !== 'ALL' && data) {
        const key = Array.isArray(data.insights) ? 'insights' : 'items';
        if (Array.isArray(data[key])) data = { ...data, [key]: data[key].filter(i => i && i.severity === wanted) };
      }
      return { jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: fitJson(data) }] } };
    }
    default:
      return rpcError(m.id, -32601, 'Method not found: ' + m.method);
  }
}

function fitJson(data) {
  let text = JSON.stringify(data);
  if (text.length <= MAX_CHARS) return text;
  const key = data && Array.isArray(data.items) ? 'items' : data && Array.isArray(data.rows) ? 'rows' : null;
  if (key) {
    let list = data[key];
    while (list.length > 1 && text.length > MAX_CHARS) {
      list = list.slice(0, Math.ceil(list.length / 2));
      text = JSON.stringify({ ...data, [key]: list, truncated: true });
    }
    if (text.length <= MAX_CHARS) return text;
  }
  return JSON.stringify({ truncated: true, note: 'Result too large to return in full' });
}
