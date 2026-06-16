const SALES_TEAM_PATHS = ['/sales-team', '/sales-reps', '/rankings', '/performance-board'];
const ANALYTICS_PATHS = [
  '/analytics',
  '/sales-analytics',
  '/lead-sources',
  '/product-analytics',
  '/kpi-monitoring',
  '/reports'
];

export function resolvePresentationVariant(pathname = '') {
  if (SALES_TEAM_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    return 'sales-team';
  }

  if (ANALYTICS_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    return 'analytics';
  }

  return 'dashboard';
}

export const presentationTitles = {
  dashboard: 'TDT POWERSTEEL DASHBOARD',
  analytics: 'ANALYTICS COMMAND CENTER',
  'sales-team': 'SALES TEAM PERFORMANCE'
};

export const presentationDateRanges = {
  dashboard: 'Reporting Period: Jan - Jun 2026',
  analytics: 'Analytics Window: YTD 2026',
  'sales-team': 'Team Performance: Current Period'
};
