import { useContract } from './hooks/useContract.js';
import { useDataset } from './hooks/useDataset.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { TerminologyProvider } from './context/TerminologyContext.jsx';
import { FormatProvider } from './context/FormatContext.jsx';
import { Sidebar, ROUTES } from './components/shared/Sidebar.jsx';
import { Header } from './components/shared/Header.jsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { PROJECT_NAME } from './utils/text.js';

const DEFAULT_ROUTE = 'understand/overview';

export default function App() {
  const contract = useContract();
  const summary = useDataset('summary');
  const [route, go] = useHashRoute(DEFAULT_ROUTE, ROUTES);
  const name = contract.data ? contract.data.project.name : PROJECT_NAME;
  const updated = contract.data ? contract.data.generatedAt : '';
  return (
    <TerminologyProvider terminology={contract.data ? contract.data.terminology : null}>
      <FormatProvider summary={summary.data}>
        <div className="app-shell">
          <Sidebar projectName={name} route={route} onNavigate={go} />
          <div className="main-col">
            <Header projectName={name} updatedAt={updated} />
            <main className="content">
              {contract.error ? (
                <div className="banner" role="status">
                  The data contract could not be read, so some pages may be empty. Run the backend export and then npm run check.
                </div>
              ) : null}
              <ErrorBoundary>
                <Dashboard route={route} />
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </FormatProvider>
    </TerminologyProvider>
  );
}
