import { defaultDashboardFilters, DASHBOARD_FILTERS_EVENT, DASHBOARD_FILTERS_KEY } from './dashboardFilters';
import { ACTIVE_UPLOAD_KEY } from './uploadHistory';

const runtimeKeys = [
  'tdt_live_dashboard_data',
  'tdt_live_upload_mode',
  ACTIVE_UPLOAD_KEY,
  DASHBOARD_FILTERS_KEY,
  'tdt_google_sheets_connected',
  'tdt_sales_import_status'
];

const runtimePrefixes = [
  `${ACTIVE_UPLOAD_KEY}:`
];

export function clearDashboardRuntimeSession() {
  if (typeof window === 'undefined') return;

  runtimeKeys.forEach(key => window.localStorage.removeItem(key));
  Object.keys(window.localStorage)
    .filter(key => runtimePrefixes.some(prefix => key.startsWith(prefix)))
    .forEach(key => window.localStorage.removeItem(key));

  window.localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(defaultDashboardFilters));
  window.dispatchEvent(new Event('tdt-live-data-updated'));
  window.dispatchEvent(new Event('tdt-upload-history-updated'));
  window.dispatchEvent(new Event('tdt-google-sheets-status'));
  window.dispatchEvent(new CustomEvent(DASHBOARD_FILTERS_EVENT, { detail: defaultDashboardFilters }));
}
