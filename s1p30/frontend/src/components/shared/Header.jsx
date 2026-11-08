import { useFormat } from '../../context/FormatContext.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

export function Header({ projectName, updatedAt }) {
  const fmt = useFormat();
  return (
    <header className="app-header">
      <h1>{projectName}</h1>
      <div className="header-meta">
        <span>{updatedAt ? 'Updated ' + fmt.relative(updatedAt) : 'Update time unknown'}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
