import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { LogoutConfirm, SettingsPanel, SettingsToast } from './DashboardOverlays';
import TeamCredits from '../common/TeamCredits';
import PresentationMode from '../../pages/PresentationMode';
import '../../styles/dashboard.css';
import '../../styles/presentation.css';
import '../../styles/presentation-palette.css';
import { getDashboardSettings, getSessionTimeoutMs, subscribeDashboardSettings } from '../../utils/settingsService';
import { resolvePresentationVariant } from '../../utils/presentationVariant';

function DashboardLayout({ children, onLogout }) {
  const { pathname } = useLocation();
  const [settings, setSettings] = useState(() => getDashboardSettings());
  const [isPresenting, setIsPresenting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !getDashboardSettings().sidebarCollapsed);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [settingsToast, setSettingsToast] = useState({ isVisible: false, message: 'Settings saved', tone: 'success' });
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, tone = 'success') => {
    window.clearTimeout(toastTimerRef.current);
    setSettingsToast({ isVisible: true, message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setSettingsToast(current => ({ ...current, isVisible: false }));
    }, 2600);
  }, []);

  const exitPresentation = useCallback(() => {
    setIsPresenting(false);

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, []);

  const enterPresentation = useCallback(() => {
    setIsPresenting(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const togglePresentation = useCallback(() => {
    if (isPresenting) {
      exitPresentation();
      return;
    }

    enterPresentation();
  }, [enterPresentation, exitPresentation, isPresenting]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(open => !open);
  }, []);

  const handleSaveSettings = useCallback(() => {
    setIsSettingsOpen(false);
    showToast('Settings saved', 'success');
  }, [showToast]);

  const handleConfirmLogout = useCallback(() => {
    setIsLogoutOpen(false);
    onLogout?.();
  }, [onLogout]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openTeamPanel = useCallback(() => setIsTeamPanelOpen(true), []);
  const closeTeamPanel = useCallback(() => setIsTeamPanelOpen(false), []);
  const openLogout = useCallback(() => setIsLogoutOpen(true), []);
  const closeLogout = useCallback(() => setIsLogoutOpen(false), []);
  const pageClassName = useMemo(
    () => [
      'dashboard-page',
      isPresenting ? 'presentation-mode' : '',
      isSidebarOpen ? 'sidebar-open' : 'sidebar-closed',
      settings.compactMode ? 'dashboard-compact' : '',
      settings.denseTables ? 'dashboard-dense-tables' : '',
      `dashboard-animation-${String(settings.animationSpeed || 'Balanced').toLowerCase()}`
    ].filter(Boolean).join(' '),
    [isPresenting, isSidebarOpen, settings.animationSpeed, settings.compactMode, settings.denseTables]
  );
  const pageStyle = useMemo(
    () => ({
      willChange: 'opacity',
      // Reduce expanded sidebar width so content gap is smaller
      '--sidebar-width': isSidebarOpen ? '14rem' : '4.875rem',
      '--dashboard-zoom': settings.zoom / 100,
      '--dashboard-glow-opacity': settings.glow / 100
    }),
    [isSidebarOpen, settings.glow, settings.zoom]
  );
  const presentationVariant = useMemo(() => resolvePresentationVariant(pathname), [pathname]);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape' && isPresenting) {
        exitPresentation();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.clearTimeout(toastTimerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [exitPresentation, isPresenting]);

  useEffect(() => {
    return subscribeDashboardSettings(nextSettings => {
      setSettings(nextSettings);
      setIsSidebarOpen(!nextSettings.sidebarCollapsed);
    });
  }, []);

  useEffect(() => {
    const timeoutMs = getSessionTimeoutMs(settings);
    if (!timeoutMs) return undefined;

    let timerId;
    const resetTimer = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        onLogout?.();
      }, timeoutMs);
    };
    const events = ['pointerdown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(eventName => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(timerId);
      events.forEach(eventName => window.removeEventListener(eventName, resetTimer));
    };
  }, [onLogout, settings]);

  return (
    <motion.div
      className={pageClassName}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      style={pageStyle}
    >
      {isPresenting ? (
        <PresentationMode variant={presentationVariant} onExit={exitPresentation} />
      ) : (
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={toggleSidebar}
            onOpenSettings={openSettings}
            onOpenTeam={openTeamPanel}
            onOpenLogout={openLogout}
          />

          <main className="dashboard-content">
            <div className="dashboard-shell">
              <Navbar isPresenting={isPresenting} onTogglePresentation={togglePresentation} />
              <div className="dashboard-body">
                {children}
              </div>
            </div>
          </main>

          <div className="sidebar-backdrop" onClick={toggleSidebar} />
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={closeSettings}
            onSave={handleSaveSettings}
            onNotify={showToast}
          />
          <TeamCredits isOpen={isTeamPanelOpen} onClose={closeTeamPanel} />
          <LogoutConfirm isOpen={isLogoutOpen} onCancel={closeLogout} onConfirm={handleConfirmLogout} />
          <SettingsToast isVisible={settingsToast.isVisible} message={settingsToast.message} tone={settingsToast.tone} />
        </>
      )}
    </motion.div>
  );
}

export default memo(DashboardLayout);
