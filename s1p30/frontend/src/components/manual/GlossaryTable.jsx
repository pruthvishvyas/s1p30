import { splitMatches } from '../../utils/text.js';

export function Highlight({ text, query }) {
  return (
    <>
      {splitMatches(text, query).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </>
  );
}

export function GlossaryTable({ rows, query }) {
  return (
    <div className="table-scroll">
      <table className="data">
        <thead><tr><th scope="col">Term</th><th scope="col">Meaning</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r[0]}>
              <td><Highlight text={r[0]} query={query} /></td>
              <td><Highlight text={r[1]} query={query} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
