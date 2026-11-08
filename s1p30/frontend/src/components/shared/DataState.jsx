import { SkeletonCard } from './SkeletonCard.jsx';

export function DataState({ query, label, skeleton }) {
  if (query.loading) return skeleton || <SkeletonCard count={1} height={96} />;
  const err = query.error;
  if (!err) return null;
  let message;
  let retry = false;
  if (err.kind === 'skipped') {
    message = 'This section was skipped: ' + err.message;
  } else if (err.kind === 'missing' || err.kind === 'empty') {
    message = 'No ' + label + ' yet. Run the backend steps, then run npm run deploy here.';
    retry = true;
  } else if (err.kind === 'network') {
    message = 'Could not load ' + label + '. Check the connection.';
    retry = true;
  } else {
    message = 'The ' + label + ' file is not in the expected format.';
  }
  return (
    <div className="state-box" role="status">
      <p>{message}</p>
      {err.kind === 'shape' || err.kind === 'invalid' ? <p className="muted">{err.message}</p> : null}
      {retry ? (
        <button type="button" className="button button-ghost" onClick={query.reload}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
