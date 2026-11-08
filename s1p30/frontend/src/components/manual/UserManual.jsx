import { useState } from 'react';
import { useTerm } from '../../context/TerminologyContext.jsx';
import { PageSection } from '../shared/PageSection.jsx';
import { GlossaryTable, Highlight } from './GlossaryTable.jsx';

function buildSections(term) {
  const many = term('transaction', { plural: true, lower: true });
  const one = term('transaction', { lower: true });
  const money = term('revenue', { lower: true });
  return [
    { title: 'How to use this dashboard', body: [
      'Understand shows what is happening: key numbers, charts, groups of ' + many + ' and unusual ' + many + '.',
      'Decide shows what to do about it: findings with evidence, a list of actions, a what if tool and goals.',
      'Monitor shows whether things are on track: a forecast, progress against goals and alerts.',
      'Use the menu on the left (or at the top on a phone) to move between pages. The sun and moon button switches the colour theme.',
    ] },
    { title: 'Overview', body: [
      'What you see: key numbers on top and charts below, each chart with the question it answers.',
      'What it means: the numbers summarise every ' + one + ' in the data. Chart tags show whether a chart helps you understand, decide or monitor.',
      'What to do: start with the key numbers, then open the charts that match your question.',
    ] },
    { title: 'Segments', body: [
      'What you see: records sorted into a few groups with similar behaviour, with the size of each group.',
      'What it means: a group with a high average loss or a high abuse rate deserves more attention than its size suggests.',
      'What to do: click a group to see its measures and compare groups before changing a policy.',
    ] },
    { title: 'Unusual records', body: [
      'What you see: ' + many + ' that do not match normal behaviour, ranked by value.',
      'What it means: an unusual record is a day or record that does not match normal behaviour. It is a reason to look, not proof of a problem.',
      'What to do: sort the table, open the largest ones in your own system and check the details by hand.',
    ] },
    { title: 'Insights', body: [
      'What you see: findings with the numbers behind them and the action to take this week.',
      'What it means: High means act first, Medium means plan it, Low means keep an eye on it.',
      'What to do: filter by severity and work down the list.',
    ] },
    { title: 'Actions', body: [
      'What you see: ' + many + ' grouped by priority: Urgent, High, Medium and Routine, with the reason and the suggested action.',
      'What it means: priority combines how many warning signs a ' + one + ' has and how much ' + money + ' or profit is at stake.',
      'What to do: clear the Urgent group first. Record ids are anonymised, so match them using your own system.',
    ] },
    { title: 'What if', body: [
      'What you see: a slider and a table that compare the starting point with your chosen setting.',
      'What it means: the table was calculated in advance for a range of values and the dashboard fills the gaps between steps in a straight line. Assumptions are listed under each scenario.',
      'What to do: move the slider to see the effect, then judge whether the assumptions are realistic for your business.',
    ] },
    { title: 'Goals and progress', body: [
      'What you see: targets and how the latest period compares with them.',
      'What it means: targets you type in are saved on this device only and are not sent anywhere.',
      'What to do: enter a monthly limit or a rate ceiling, then check the Progress page.',
    ] },
    { title: 'Forecast', body: [
      'What you see: past values, how the model did on recent weeks it had not seen, and an estimate of the coming weeks.',
      'What it means: a forecast is an estimate of the future based on past patterns. The typical error is how far off the forecast was when tested on recent history it had not seen. The baseline is a simple rule used as a yardstick.',
      'What to do: trust the forecast only as far as its error and the baseline comparison allow.',
    ] },
    { title: 'Alerts', body: [
      'What you see: warnings raised from the latest data, and counts of ' + many + ' by alert type.',
      'What it means: an alert is a reason to check, based on a threshold chosen to be useful in practice.',
      'What to do: filter by severity and follow up on the High items first. No active alerts is a normal state.',
    ] },
    { title: 'Reading the charts', body: [
      'Bar charts compare groups. Histograms show how values are spread across ranges. Line charts show change over time.',
      'Scatter charts show two numbers at once, one dot per record. Heatmaps are tables where a stronger colour means a larger value.',
    ] },
    { title: 'Data health', body: [
      'This page shows when the data was last refreshed, how each part of the analysis ran and whether every data file loaded.',
      'If a page looks empty, check here first. A section that was skipped gives its reason.',
    ] },
  ];
}

const GLOSSARY = [
  ['Anomaly', 'An unusual day or record that does not match normal behavior.'],
  ['Forecast', 'An estimate of the future based on past patterns.'],
  ['Held-out error', 'How far off the forecast was when tested on recent history it had not seen.'],
  ['Baseline', 'A simple rule used as a yardstick.'],
  ['Segment', 'A group of records that behave alike.'],
  ['Severity', 'How urgent a finding is: High, Medium or Low.'],
  ['Priority', 'The order in which to deal with actions: Urgent, High, Medium, Routine.'],
  ['Interpolation', 'Filling the gap between two calculated points in a straight line.'],
];

export function UserManual() {
  const term = useTerm();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const sections = buildSections(term).filter(s => !q || (s.title + ' ' + s.body.join(' ')).toLowerCase().includes(q));
  const glossary = GLOSSARY.filter(r => !q || (r[0] + ' ' + r[1]).toLowerCase().includes(q));
  return (
    <PageSection title="Guide" subtitle="What each page shows, what it means and what to do about it.">
      <div className="field no-print">
        <label htmlFor="guide-search">Search the guide</label>
        <input id="guide-search" className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <button type="button" className="button button-ghost no-print" style={{ justifySelf: 'start' }} onClick={() => window.print()}>Print this guide</button>
      <div className="manual stack">
        {sections.map(s => (
          <section key={s.title} className="card">
            <h3><Highlight text={s.title} query={query} /></h3>
            {s.body.map((p, i) => <p key={i}><Highlight text={p} query={query} /></p>)}
          </section>
        ))}
        {glossary.length > 0 ? (
          <section className="card">
            <h3>Glossary</h3>
            <GlossaryTable rows={glossary} query={query} />
          </section>
        ) : null}
        {sections.length === 0 && glossary.length === 0 ? <div className="state-box"><p>Nothing in the guide matches that search.</p></div> : null}
      </div>
    </PageSection>
  );
}
