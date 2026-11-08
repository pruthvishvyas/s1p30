const LABELS = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

export function SeverityBadge({ severity }) {
  const key = LABELS[severity] ? severity : 'LOW';
  return <span className={'badge sev-' + key.toLowerCase()}>{LABELS[key]}</span>;
}
