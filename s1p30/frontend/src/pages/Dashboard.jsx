import { useTerm } from '../context/TerminologyContext.jsx';
import { PageSection } from '../components/shared/PageSection.jsx';
import { ErrorBoundary } from '../components/shared/ErrorBoundary.jsx';
import { KPICards } from '../components/understand/KPICards.jsx';
import { ChartGrid } from '../components/understand/ChartGrid.jsx';
import { SegmentExplorer } from '../components/understand/SegmentExplorer.jsx';
import { AnomalyTable } from '../components/understand/AnomalyTable.jsx';
import { InsightCards } from '../components/decide/InsightCards.jsx';
import { RecommendationEngine } from '../components/decide/RecommendationEngine.jsx';
import { WhatIfSimulator } from '../components/decide/WhatIfSimulator.jsx';
import { GoalTracker } from '../components/decide/GoalTracker.jsx';
import { Forecaster } from '../components/monitor/Forecaster.jsx';
import { GoalProgress } from '../components/monitor/GoalProgress.jsx';
import { AlertCenter } from '../components/monitor/AlertCenter.jsx';
import { UserManual } from '../components/manual/UserManual.jsx';
import { DataHealth } from '../components/health/DataHealth.jsx';

export function Dashboard({ route }) {
  const term = useTerm();
  const many = term('transaction', { plural: true });
  let page;
  switch (route) {
    case 'understand/segments':
      page = <PageSection title="Segments" subtitle={'Groups of ' + many.toLowerCase() + ' with similar behaviour.'}><SegmentExplorer /></PageSection>;
      break;
    case 'understand/anomalies':
      page = <PageSection title="Unusual records" subtitle={'Individual ' + many.toLowerCase() + ' that do not fit normal behaviour.'}><AnomalyTable /></PageSection>;
      break;
    case 'decide/insights':
      page = <PageSection title="Insights" subtitle="What the data shows and what to do this week."><InsightCards /></PageSection>;
      break;
    case 'decide/recommendations':
      page = <PageSection title="Actions" subtitle={'Which ' + many.toLowerCase() + ' to deal with first.'}><RecommendationEngine /></PageSection>;
      break;
    case 'decide/what-if':
      page = <PageSection title="What if" subtitle="Try a change and see the calculated effect."><WhatIfSimulator /></PageSection>;
      break;
    case 'decide/goals':
      page = <PageSection title="Goals" subtitle="Targets for the business."><GoalTracker /></PageSection>;
      break;
    case 'monitor/forecast':
      page = <PageSection title="Forecast" subtitle="What the recent past suggests for the next weeks."><Forecaster /></PageSection>;
      break;
    case 'monitor/progress':
      page = <PageSection title="Progress" subtitle="How the latest period compares with the goals."><GoalProgress /></PageSection>;
      break;
    case 'monitor/alerts':
      page = <PageSection title="Alerts" subtitle="Warnings raised from the latest data."><AlertCenter /></PageSection>;
      break;
    case 'guide':
      page = <UserManual />;
      break;
    case 'health':
      page = <PageSection title="Data health" subtitle="When the data was refreshed and whether every file loaded."><DataHealth /></PageSection>;
      break;
    default:
      page = (
        <PageSection title={many + ' overview'} subtitle="Key numbers first, then the charts behind them.">
          <KPICards />
          <ChartGrid />
        </PageSection>
      );
  }
  return <ErrorBoundary key={route}>{page}</ErrorBoundary>;
}
