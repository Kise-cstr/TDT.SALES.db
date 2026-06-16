import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiLogOut, FiMonitor, FiSave, FiSliders } from 'react-icons/fi';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardSettings, saveDashboardSettings } from '../../utils/settingsService';

function ToggleControl({ label, checked, onChange }) {
  return (
    <label className="settings-toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="settings-toggle" aria-hidden="true" />
    </label>
  );
}

export function SettingsPanel({ isOpen, onClose, onSave, onNotify }) {
  const { updateSettings } = useAuth();
  const [settings, setSettings] = useState(() => getDashboardSettings());

  useEffect(() => {
    if (isOpen) {
      setSettings(getDashboardSettings());
    }
  }, [isOpen]);

  const toggle = key => {
    setSettings(current => ({ ...current, [key]: !current[key] }));
  };

  const update = (key, value) => {
    setSettings(current => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    const savedSettings = saveDashboardSettings(settings);
    await updateSettings?.({
      animationSpeed: savedSettings.animationSpeed,
      sessionTimeout: savedSettings.sessionTimeout
    });
    onSave?.(savedSettings);
    onNotify?.('Settings saved', 'success');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="settings-panel"
            initial={{ x: '104%', opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '104%', opacity: 0.7 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Dashboard settings"
          >
            <div className="settings-panel-glow" />
            <header className="settings-header">
              <div>
                <span>Control Center</span>
                <h2>Settings</h2>
              </div>
              <button className="settings-close" type="button" onClick={onClose} aria-label="Close settings">x</button>
            </header>

            <div className="settings-body">
              <section className="settings-section">
                <div className="settings-section-title">
                  <FiSliders />
                  <h3>Theme</h3>
                </div>
                <label className="settings-range">
                  <span>Dark glow intensity</span>
                  <input type="range" min="0" max="100" value={settings.glow} onChange={event => update('glow', Number(event.target.value))} />
                  <strong>{settings.glow}%</strong>
                </label>
                <ToggleControl label="Enable particles background" checked={settings.particles} onChange={() => toggle('particles')} />
              </section>

              <section className="settings-section">
                <div className="settings-section-title">
                  <FiMonitor />
                  <h3>UI Preferences</h3>
                </div>
                <ToggleControl label="Sidebar collapsed by default" checked={settings.sidebarCollapsed} onChange={() => toggle('sidebarCollapsed')} />
                <ToggleControl label="Enable hover analytics popups" checked={settings.hoverPopups} onChange={() => toggle('hoverPopups')} />
                <ToggleControl label="Compact mode" checked={settings.compactMode} onChange={() => toggle('compactMode')} />
                <ToggleControl label="Dense table rows" checked={settings.denseTables} onChange={() => toggle('denseTables')} />
                <label className="settings-field">
                  <span>Animation Speed</span>
                  <select value={settings.animationSpeed} onChange={event => update('animationSpeed', event.target.value)}>
                    <option>Smooth</option>
                    <option>Balanced</option>
                    <option>Instant</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Session Timeout</span>
                  <select value={settings.sessionTimeout} onChange={event => update('sessionTimeout', Number(event.target.value))}>
                    <option value={1}>1 Minute</option>
                    <option value={3}>3 Minutes</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={20}>20 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                </label>
                <label className="settings-range">
                  <span>Dashboard zoom scale</span>
                  <input type="range" min="50" max="125" step="5" value={settings.zoom} onChange={event => setSettings(current => ({ ...current, zoom: Number(event.target.value), zoomPreferenceSet: true }))} />
                  <strong>{settings.zoom}%</strong>
                </label>
              </section>

            </div>

            <footer className="settings-footer">
              <button className="nav-btn nav-btn-secondary" type="button" onClick={onClose}>Cancel</button>
              <button className="nav-btn nav-btn-secondary" type="button" onClick={handleSave}>
                <FiSave size={16} />
                Save Settings
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function LogoutConfirm({ isOpen, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="logout-modal-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="logout-modal"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
          >
            <span className="logout-modal-kicker">Secure Session</span>
            <h3>Log out of TDT Powersteel?</h3>
            <p>Your dashboard session will be cleared and protected routes will require login again.</p>
            <div className="logout-modal-actions">
              <button className="nav-btn nav-btn-secondary" type="button" onClick={onCancel}>Cancel</button>
              <button className="nav-btn nav-btn-secondary logout-danger" type="button" onClick={onConfirm}>
                <FiLogOut size={16} />
                Logout
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SettingsToast({ isVisible, message = 'Settings saved', tone = 'success' }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`settings-toast settings-toast-${tone}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
