export const PROJECT_NAME = "s1p30";

export function truncate(value, max) {
  const text = String(value === null || value === undefined ? '' : value);
  return text.length > max ? text.slice(0, max - 1) + '...' : text;
}

const SPECIAL = '.*+?^${}()|[]\\';
export function escapeRegExp(value) {
  let out = '';
  for (const ch of String(value)) out += SPECIAL.includes(ch) ? '\\' + ch : ch;
  return out;
}

// splits text into plain and matching parts so matches can be wrapped without touching HTML
export function splitMatches(text, query) {
  const source = String(text);
  const q = String(query || '').trim();
  if (!q) return [{ text: source, match: false }];
  const parts = source.split(new RegExp('(' + escapeRegExp(q) + ')', 'ig'));
  return parts.filter(p => p !== '').map(p => ({ text: p, match: p.toLowerCase() === q.toLowerCase() }));
}
