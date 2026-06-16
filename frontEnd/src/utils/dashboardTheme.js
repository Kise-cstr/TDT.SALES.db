export const DASHBOARD_THEME_KEY = 'dashboardTheme';
export const DASHBOARD_THEMES = {
  light: 'light',
  dark: 'dark'
};

const THEME_SWITCHING_CLASS = 'theme-switching';
export const DASHBOARD_THEME_CHANGE_EVENT = 'tdt-dashboard-theme-change';
let themeSwitchingTimer;

function markThemeSwitching() {
  if (typeof document === 'undefined') return;

  window.clearTimeout(themeSwitchingTimer);
  document.documentElement.classList.add(THEME_SWITCHING_CLASS);
  themeSwitchingTimer = window.setTimeout(() => {
    document.documentElement.classList.remove(THEME_SWITCHING_CLASS);
  }, 420);
}

function setThemeDataset(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function readDashboardTheme() {
  if (typeof window === 'undefined') return DASHBOARD_THEMES.dark;
  const savedTheme = window.localStorage.getItem(DASHBOARD_THEME_KEY);
  return savedTheme === DASHBOARD_THEMES.light ? DASHBOARD_THEMES.light : DASHBOARD_THEMES.dark;
}

export function applyDashboardTheme(theme) {
  const nextTheme = theme === DASHBOARD_THEMES.light ? DASHBOARD_THEMES.light : DASHBOARD_THEMES.dark;
  const previousTheme = typeof document !== 'undefined'
    ? document.documentElement.dataset.theme || readDashboardTheme()
    : readDashboardTheme();
  const isInitialThemeApply = typeof document !== 'undefined' && !document.documentElement.dataset.theme;

  if (typeof document !== 'undefined') {
    markThemeSwitching();

    if (isInitialThemeApply) {
      setThemeDataset(nextTheme);
    } else {
      window.requestAnimationFrame(() => setThemeDataset(nextTheme));
    }
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DASHBOARD_THEME_KEY, nextTheme);

    if (!isInitialThemeApply && previousTheme !== nextTheme) {
      window.dispatchEvent(new CustomEvent(DASHBOARD_THEME_CHANGE_EVENT, {
        detail: {
          previousTheme,
          nextTheme
        }
      }));
    }
  }
  return nextTheme;
}
