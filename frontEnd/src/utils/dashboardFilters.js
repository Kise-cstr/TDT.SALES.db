export const DASHBOARD_FILTERS_EVENT = 'tdt-dashboard-filters-changed';
export const DASHBOARD_FILTERS_KEY = 'tdt_dashboard_filters';

export const defaultDashboardFilters = {
  period: 'Monthly',
  timeline: 'Disable',
  year: 'All Years',
  month: 'All Months',
  range: 'All Time',
  startDate: '',
  endDate: '',
  branch: 'all',
  metric: 'all'
};

export const metricOptions = [
  { label: 'All Metrics', value: 'all' },
  { label: 'GS (Gross Sales)', value: 'sales' },
  { label: 'GK', value: 'gk' }
];

export const timelineOptions = ['Disable', 'Yearly', 'Monthly', 'Weekly'];

export function readDashboardFilters() {
  if (typeof window === 'undefined') return defaultDashboardFilters;

  try {
    const stored = JSON.parse(window.localStorage.getItem(DASHBOARD_FILTERS_KEY) || '{}');
    const metric = metricOptions.some(option => option.value === stored.metric)
      ? stored.metric
      : defaultDashboardFilters.metric;
    const timeline = timelineOptions.includes(stored.timeline)
      ? stored.timeline
      : defaultDashboardFilters.timeline;
    return {
      ...defaultDashboardFilters,
      period: stored.period || defaultDashboardFilters.period,
      timeline,
      year: stored.year || defaultDashboardFilters.year,
      month: stored.month || defaultDashboardFilters.month,
      range: stored.range || defaultDashboardFilters.range,
      startDate: stored.startDate || defaultDashboardFilters.startDate,
      endDate: stored.endDate || defaultDashboardFilters.endDate,
      branch: stored.branch || defaultDashboardFilters.branch,
      metric
    };
  } catch {
    return defaultDashboardFilters;
  }
}

export function writeDashboardFilters(nextFilters) {
  if (typeof window === 'undefined') return defaultDashboardFilters;

  const filters = { ...readDashboardFilters(), ...nextFilters };
  window.localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(filters));
  window.dispatchEvent(new CustomEvent(DASHBOARD_FILTERS_EVENT, { detail: filters }));
  return filters;
}

export function subscribeDashboardFilters(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleFilterChange = event => {
    callback(event.detail || readDashboardFilters());
  };
  const handleStorageChange = event => {
    if (event.key === DASHBOARD_FILTERS_KEY) callback(readDashboardFilters());
  };

  window.addEventListener(DASHBOARD_FILTERS_EVENT, handleFilterChange);
  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener(DASHBOARD_FILTERS_EVENT, handleFilterChange);
    window.removeEventListener('storage', handleStorageChange);
  };
}
