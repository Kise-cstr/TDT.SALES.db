import DashboardPresentationView from '../components/presentation/DashboardPresentationView';
import AnalyticsPresentationView from '../components/presentation/AnalyticsPresentationView';
import SalesTeamPresentationView from '../components/presentation/SalesTeamPresentationView';
import '../styles/presentation-palette.css';

const presentationViews = {
  dashboard: DashboardPresentationView,
  analytics: AnalyticsPresentationView,
  'sales-team': SalesTeamPresentationView
};

export default function PresentationMode({ variant = 'dashboard', onExit }) {
  const View = presentationViews[variant] || presentationViews.dashboard;
  return <View onExit={onExit} />;
}
