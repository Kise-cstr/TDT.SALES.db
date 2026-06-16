import { memo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMoon, FiSun, FiUploadCloud } from 'react-icons/fi';
import PresentButton from '../common/PresentButton';
import {
  metricOptions,
  readDashboardFilters,
  subscribeDashboardFilters,
  writeDashboardFilters
} from '../../utils/dashboardFilters';
import { applyDashboardTheme, DASHBOARD_THEMES, readDashboardTheme } from '../../utils/dashboardTheme';
import tdtLogo from '../../assets/logos/tdt_logo.png';
import '../../styles/navbar.css';

const headerPeriodOptions = ['Monthly', 'Weekly', 'Daily'];

function Navbar({ isPresenting = false, onTogglePresentation }) {
  const [filters, setFilters] = useState(() => readDashboardFilters());
  const [theme, setTheme] = useState(() => readDashboardTheme());
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isSalesTeamRoute = ['/sales-team', '/sales-reps', '/rankings'].includes(pathname);

  const handleUploadClick = () => {
    navigate('/upload');
  };

  useEffect(() => subscribeDashboardFilters(setFilters), []);

  const updateFilter = key => event => {
    setFilters(writeDashboardFilters({ [key]: event.target.value }));
  };

  const toggleTheme = () => {
    setTheme(currentTheme => applyDashboardTheme(
      currentTheme === DASHBOARD_THEMES.light ? DASHBOARD_THEMES.dark : DASHBOARD_THEMES.light
    ));
  };

  const nextThemeLabel = theme === DASHBOARD_THEMES.light ? 'dark' : 'light';

  return (
    <div className="navbar">
      <div className="navbar-brand">
        <img className="navbar-logo" src={tdtLogo} alt="TDT Powersteel - The No. 1 Steel Supplier" />
        <span className="navbar-report-title">Key Integrated Tracking &amp; Analytics</span>
      </div>

      <div className="navbar-right">
        <label className="navbar-compact-control">
          <span>Period</span>
          <select value={filters.period} onChange={updateFilter('period')} aria-label="Dashboard period">
            {headerPeriodOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        {!isSalesTeamRoute && (
          <label className="navbar-compact-control">
            <span>Metrics</span>
            <select value={filters.metric} onChange={updateFilter('metric')} aria-label="Dashboard metric">
              {metricOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}

        {!isSalesTeamRoute && (
          <>
            <PresentButton isPresenting={isPresenting} onToggle={onTogglePresentation} />

            <button className="nav-btn nav-btn-secondary" type="button" onClick={handleUploadClick}>
              <FiUploadCloud size={16} />
              Upload New
            </button>
          </>
        )}

        <button
          className="nav-btn nav-btn-theme"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${nextThemeLabel} mode`}
          title={`Switch to ${nextThemeLabel} mode`}
        >
          <span className={`theme-icon-stack is-${theme}`} aria-hidden="true">
            <FiSun className="theme-icon theme-icon-sun" size={18} />
            <FiMoon className="theme-icon theme-icon-moon" size={18} />
          </span>
        </button>
      </div>
    </div>
  );
}

export default memo(Navbar);
