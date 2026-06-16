export const SETTINGS_KEY = 'tdt_dashboard_settings';
export const SETTINGS_EVENT = 'tdt-settings-updated';

export const defaultSettings = {
  dashboard: {
    defaultLandingPage: '/dashboard',
    autoRefreshData: 'Off',
    rememberLastOpenedPage: true,
    autoCollapseSidePanel: false
  },
  notifications: {
    enableNotifications: true,
    notifyOnNewUserRequests: true,
    notifyOnNewUploads: false
  },
  security: {
    sessionTimeout: '30 Minutes',
    autoLogoutOnInactivity: true
  }
};

const autoRefreshOptions = ['Off', '1 Minute', '5 Minutes', '15 Minutes'];
const landingPageOptions = [
  '/dashboard',
  '/sales-team',
  '/presentation',
  '/upload',
  '/admin/users',
  '/admin/uploads',
  '/admin'
];

const getSessionUserKey = () => {
  try {
    const session = JSON.parse(localStorage.getItem('tdt_auth_session') || 'null');
    return session?.id ? `${SETTINGS_KEY}:${session.id}` : SETTINGS_KEY;
  } catch {
    return SETTINGS_KEY;
  }
};

const coerceBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
};

const normalizeSessionTimeout = value => {
  if (value === '15 Minutes' || value === 15) return '15 Minutes';
  if (value === '1 Hour' || value === 60) return '1 Hour';
  if (value === '30 Minutes' || value === 30) return '30 Minutes';
  if (typeof value === 'string') {
    const minutes = Number(value.match(/\d+/)?.[0]);
    if (minutes === 15) return '15 Minutes';
    if (minutes === 60) return '1 Hour';
    if (minutes === 30) return '30 Minutes';
  }
  return defaultSettings.security.sessionTimeout;
};

const normalizeLandingPage = value => (
  landingPageOptions.includes(value) ? value : defaultSettings.dashboard.defaultLandingPage
);

function normalizeSection(source = {}, defaults = {}) {
  return Object.keys(defaults).reduce((result, key) => {
    const fallback = defaults[key];
    const value = source[key];
    result[key] = typeof fallback === 'boolean' ? coerceBoolean(value, fallback) : (value || fallback);
    return result;
  }, {});
}

export function normalizeDashboardSettings(settings = {}) {
  const legacyDashboard = {
    defaultLandingPage: settings.defaultLandingPage,
    autoRefreshData: settings.autoRefreshData,
    rememberLastOpenedPage: settings.rememberLastOpenedPage,
    autoCollapseSidePanel: settings.autoCollapseSidePanel
  };

  const legacyNotifications = {
    enableNotifications: settings.enableNotifications ?? settings.emailAlerts,
    notifyOnNewUserRequests: settings.notifyOnNewUserRequests ?? settings.weeklyDigest,
    notifyOnNewUploads: settings.notifyOnNewUploads
  };

  const legacySecurity = {
    sessionTimeout: settings.sessionTimeout,
    autoLogoutOnInactivity: settings.autoLogoutOnInactivity
  };

  const next = {
    dashboard: normalizeSection(
      { ...legacyDashboard, ...(settings.dashboard || {}) },
      defaultSettings.dashboard
    ),
    notifications: normalizeSection(
      { ...legacyNotifications, ...(settings.notifications || {}) },
      defaultSettings.notifications
    ),
    security: normalizeSection(
      { ...legacySecurity, ...(settings.security || {}) },
      defaultSettings.security
    )
  };

  next.dashboard.defaultLandingPage = normalizeLandingPage(next.dashboard.defaultLandingPage);
  next.dashboard.autoRefreshData = autoRefreshOptions.includes(next.dashboard.autoRefreshData)
    ? next.dashboard.autoRefreshData
    : defaultSettings.dashboard.autoRefreshData;
  next.security.sessionTimeout = normalizeSessionTimeout(next.security.sessionTimeout);

  // Backwards compatibility: older UI stored `sidebarCollapsed` at the top level.
  // If present, map it into `dashboard.autoCollapseSidePanel` so both shapes work.
  if (typeof settings.sidebarCollapsed === 'boolean' && typeof next.dashboard.autoCollapseSidePanel !== 'boolean') {
    next.dashboard.autoCollapseSidePanel = coerceBoolean(settings.sidebarCollapsed, defaultSettings.dashboard.autoCollapseSidePanel);
  }

  // Expose convenient aliases so callers can read either form
  next.sidebarCollapsed = next.dashboard.autoCollapseSidePanel;
  next.autoCollapseSidePanel = next.dashboard.autoCollapseSidePanel;

  return next;
}

export function getDashboardSettings() {
  try {
    const key = getSessionUserKey();
    const stored = localStorage.getItem(key) || localStorage.getItem(SETTINGS_KEY);
    return normalizeDashboardSettings(stored ? JSON.parse(stored) : {});
  } catch {
    return defaultSettings;
  }
}

export function saveDashboardSettings(settings) {
  const nextSettings = normalizeDashboardSettings(settings);
  localStorage.setItem(getSessionUserKey(), JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: nextSettings }));
  return nextSettings;
}

export function applyUserDashboardSettings(user) {
  if (!user) return getDashboardSettings();

  const nextSettings = saveDashboardSettings(user.preferences || {
    dashboard: {
      defaultLandingPage: user.defaultLandingPage,
      autoRefreshData: user.autoRefreshData,
      rememberLastOpenedPage: user.rememberLastOpenedPage,
      autoCollapseSidePanel: user.autoCollapseSidePanel
    },
    notifications: {
      enableNotifications: user.enableNotifications ?? user.emailAlerts,
      notifyOnNewUserRequests: user.notifyOnNewUserRequests ?? user.weeklyDigest,
      notifyOnNewUploads: user.notifyOnNewUploads
    },
    security: {
      sessionTimeout: normalizeSessionTimeout(user.sessionTimeout),
      autoLogoutOnInactivity: user.autoLogoutOnInactivity
    }
  });
  return nextSettings;
}

export const dashboardLandingPageOptions = [
  { value: '/dashboard', label: 'Main Dashboard', roles: ['employee', 'sales', 'sub-admin', 'admin'] },
  { value: '/sales-team', label: 'Sales Teams', roles: ['employee', 'sales', 'sub-admin', 'admin'] },
  { value: '/presentation', label: 'Presentation', roles: ['employee', 'sales', 'sub-admin', 'admin'] },
  { value: '/upload', label: 'Upload Panel', roles: ['employee', 'sales', 'sub-admin', 'admin'] },
  { value: '/admin/users', label: 'User Management', roles: ['sub-admin', 'admin'] },
  { value: '/admin/uploads', label: 'Manage Uploads', roles: ['admin'] },
  { value: '/admin', label: 'Admin Panel', roles: ['admin'] }
];

export function getLandingPageOptionsForRole(role) {
  const normalizedRole = String(role || '').toLowerCase();
  return dashboardLandingPageOptions.filter(option => option.roles.includes(normalizedRole));
}

export function resolveDashboardLandingPage({ user, settings = getDashboardSettings() } = {}) {
  const role = String(user?.role || '').toLowerCase();
  const allowedOptions = getLandingPageOptionsForRole(role);
  const allowedPaths = new Set(allowedOptions.map(option => option.value));
  const rememberLastOpenedPage = settings?.dashboard?.rememberLastOpenedPage !== false;
  const storageKey = user?.id ? `tdt_last_dashboard_page:${user.id}` : '';
  const lastPath = rememberLastOpenedPage && storageKey ? window.localStorage.getItem(storageKey) : '';
  const preferredPath = settings?.dashboard?.defaultLandingPage || defaultSettings.dashboard.defaultLandingPage;

  if (rememberLastOpenedPage && allowedPaths.has(lastPath)) {
    return lastPath;
  }

  if (allowedPaths.has(preferredPath)) {
    return preferredPath;
  }

  return '/dashboard';
}

export function subscribeDashboardSettings(callback) {
  if (typeof callback !== 'function') return () => {};

  const handleSettings = event => callback(event.detail || getDashboardSettings());
  const handleStorage = event => {
    if (event.key === SETTINGS_KEY || event.key === getSessionUserKey()) callback(getDashboardSettings());
  };

  window.addEventListener(SETTINGS_EVENT, handleSettings);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SETTINGS_EVENT, handleSettings);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getSessionTimeoutMs(settings = getDashboardSettings()) {
  const timeout = settings?.security?.sessionTimeout || defaultSettings.security.sessionTimeout;
  switch (timeout) {
    case '15 Minutes':
      return 15 * 60 * 1000;
    case '1 Hour':
      return 60 * 60 * 1000;
    case '30 Minutes':
    default:
      return 30 * 60 * 1000;
  }
}

export function isAutoLogoutEnabled(settings = getDashboardSettings()) {
  return settings?.security?.autoLogoutOnInactivity !== false;
}

export function getAutoRefreshMs(settings = getDashboardSettings()) {
  const mode = settings?.dashboard?.autoRefreshData || defaultSettings.dashboard.autoRefreshData;
  switch (mode) {
    case '1 Minute':
      return 60 * 1000;
    case '5 Minutes':
      return 5 * 60 * 1000;
    case '15 Minutes':
      return 15 * 60 * 1000;
    case 'Off':
    default:
      return 0;
  }
}
