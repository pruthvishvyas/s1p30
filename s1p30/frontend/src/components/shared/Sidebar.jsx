import { Icon } from './Icon.jsx';

export const NAV_GROUPS = [
  { title: 'Understand', items: [
    { id: 'understand/overview', label: 'Overview', icon: 'grid' },
    { id: 'understand/segments', label: 'Segments', icon: 'pie' },
    { id: 'understand/anomalies', label: 'Unusual records', icon: 'warning' },
  ] },
  { title: 'Decide', items: [
    { id: 'decide/insights', label: 'Insights', icon: 'bulb' },
    { id: 'decide/recommendations', label: 'Actions', icon: 'list' },
    { id: 'decide/what-if', label: 'What if', icon: 'sliders' },
    { id: 'decide/goals', label: 'Goals', icon: 'target' },
  ] },
  { title: 'Monitor', items: [
    { id: 'monitor/forecast', label: 'Forecast', icon: 'trend' },
    { id: 'monitor/progress', label: 'Progress', icon: 'bars' },
    { id: 'monitor/alerts', label: 'Alerts', icon: 'bell' },
  ] },
  { title: 'More', items: [
    { id: 'guide', label: 'Guide', icon: 'book' },
    { id: 'health', label: 'Data health', icon: 'pulse' },
  ] },
];

export const ROUTES = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));

export function Sidebar({ projectName, route, onNavigate }) {
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar-brand">{projectName}</div>
      {NAV_GROUPS.map(group => (
        <div className="sidebar-group" key={group.title}>
          <div className="sidebar-group-title">{group.title}</div>
          {group.items.map(item => (
            <button
              type="button"
              key={item.id}
              className="nav-item"
              aria-current={route === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
