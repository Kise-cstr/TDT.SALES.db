import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiBell,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiHelpCircle,
  FiLock,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import {
  defaultSettings,
  getDashboardSettings,
  getLandingPageOptionsForRole,
  normalizeDashboardSettings,
  subscribeDashboardSettings
} from '../utils/settingsService';
import '../styles/settings.css';

const autoRefreshOptions = ['Off', '1 Minute', '5 Minutes', '15 Minutes'];
const sessionTimeoutOptions = ['15 Minutes', '30 Minutes', '1 Hour'];
const deviceLoginHistoryOptions = [
  'This Device - Windows 11 / Chrome',
  'Office Laptop - Windows 11 / Edge',
  'Mobile Device - iPhone / Safari',
  'Tablet - iPadOS / Safari'
];

function SettingsSectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="settings-section-title">
      <span className="settings-section-icon">
        <Icon size={18} />
      </span>
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

function ToggleCard({ title, description, checked, onChange, disabled, hint }) {
  return (
    <motion.label
      className={`settings-toggle-card${checked ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className="settings-toggle-card-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {hint && <small>{hint}</small>}
      </div>
      <span className="settings-toggle-shell">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
        <span className="settings-toggle" aria-hidden="true" />
      </span>
    </motion.label>
  );
}

function SectionCard({ id, icon, title, subtitle, children, className = '' }) {
  return (
    <motion.section
      id={id}
      className={`settings-card ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <SettingsSectionTitle icon={icon} title={title} subtitle={subtitle} />
      {children}
    </motion.section>
  );
}

function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast.visible && (
        <motion.div
          className="settings-toast"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
        >
          <div className="settings-toast-icon">
            <FiCheckCircle size={18} />
          </div>
          <div className="settings-toast-copy">
            <strong>Settings Saved</strong>
            <span>Your notification preferences have been updated successfully.</span>
          </div>
          <div className="settings-toast-progress" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Settings() {
  const { updatePassword, updateSettings, isAdmin, isSubAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [settings, setSettings] = useState(() => getDashboardSettings());
  const [toast, setToast] = useState({ visible: false });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [deviceLoginHistory, setDeviceLoginHistory] = useState(deviceLoginHistoryOptions[0]);

  useEffect(() => {
    setSettings(getDashboardSettings());
  }, []);

  useEffect(() => subscribeDashboardSettings(setSettings), []);

  useEffect(() => {
    if (!toast.visible) return undefined;

    const timer = window.setTimeout(() => {
      if (!toast.visible) return;
      setToast({ visible: false });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast.visible]);

  const groupedSettings = [
    { id: 'dashboard', label: 'Dashboard', icon: FiSettings },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'support', label: 'Need Help?', icon: FiHelpCircle }
  ];

  const updateDashboard = (key, value) => {
    setSettings(current => ({
      ...current,
      dashboard: {
        ...current.dashboard,
        [key]: value
      }
    }));
  };

  const updateNotifications = (key, value) => {
    setSettings(current => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: value
      }
    }));
  };

  const updateSecurity = (key, value) => {
    setSettings(current => ({
      ...current,
      security: {
        ...current.security,
        [key]: value
      }
    }));
  };

  const handleSecurityToggle = checked => {
    if (!checked) {
      const proceed = window.confirm('Disabling auto logout reduces security. Do you want to continue?');
      if (!proceed) return;
    }
    updateSecurity('autoLogoutOnInactivity', checked);
  };

  const handleSaveSettings = async () => {
    const normalized = normalizeDashboardSettings(settings);
    const result = await updateSettings?.(normalized);
    if (result?.ok) {
      setToast({ visible: true });
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  const handlePasswordSave = async event => {
    event.preventDefault();
    const result = await updatePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword,
      passwordForm.confirmPassword
    );
    setPasswordMessage(result?.message || '');
    if (result?.ok) {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  };

  const togglePasswordVisibility = key => {
    setShowPassword(current => ({ ...current, [key]: !current[key] }));
  };

  const dashboardState = settings.dashboard;
  const notificationsState = settings.notifications;
  const securityState = settings.security;
  const landingPageOptions = getLandingPageOptionsForRole(isAdmin ? 'admin' : isSubAdmin ? 'sub-admin' : 'employee');
  const activeLandingPage = landingPageOptions.some(option => option.value === dashboardState.defaultLandingPage)
    ? dashboardState.defaultLandingPage
    : '/dashboard';

  return (
    <motion.section
      className="settings-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <div className="settings-shell">
        <aside className="settings-nav">
          <div className="settings-nav-header">
            <span className="settings-kicker">KITA</span>
            <h1>Settings</h1>
            <p>Enterprise controls for dashboard refresh behavior, alerts, access, and guidance.</p>
          </div>
          <nav className="settings-nav-list" aria-label="Settings sections">
            {groupedSettings.map(item => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item${active ? ' is-active' : ''}`}
                  onClick={() => {
                    setActiveSection(item.id);
                    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <span className="settings-nav-icon"><Icon size={16} /></span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="settings-content">
          <motion.header
            className="settings-hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div>
              <span className="settings-kicker">Key Integrated Tracking &amp; Analytics</span>
              <h2>User Preferences</h2>
              <p>Refined controls for dashboard refresh behavior, notification behavior, security, account management, and user guidance.</p>
            </div>
            <div className="settings-hero-badges">
              <span><FiSettings size={14} /> Responsive</span>
              <span><FiShield size={14} /> Secure</span>
              <span><FiBell size={14} /> Premium alerts</span>
            </div>
          </motion.header>

          <div className="settings-grid">
            <SectionCard
              id="dashboard"
              icon={FiSettings}
              title="Dashboard"
              subtitle="Set refresh behavior and navigation preferences for the analytics workspace."
            >
              <div className="settings-control-grid">
                <label className="settings-field">
                  <span>Default Landing Page</span>
                  <select
                    value={activeLandingPage}
                    onChange={event => updateDashboard('defaultLandingPage', event.target.value)}
                  >
                    {landingPageOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  <span>Auto Refresh Data</span>
                  <select value={dashboardState.autoRefreshData} onChange={event => updateDashboard('autoRefreshData', event.target.value)}>
                    {autoRefreshOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <ToggleCard
                title="Remember Last Opened Page"
                description="Restore the last dashboard page when the user returns to KITA."
                checked={dashboardState.rememberLastOpenedPage}
                onChange={event => updateDashboard('rememberLastOpenedPage', event.target.checked)}
                hint="Keeps navigation context between sessions."
              />
              <ToggleCard
                title="Auto Collapse Side Panel"
                description="Collapse the sidebar automatically for a wider content canvas."
                checked={dashboardState.autoCollapseSidePanel}
                onChange={event => updateDashboard('autoCollapseSidePanel', event.target.checked)}
                hint="Helpful on smaller screens and focus-heavy views."
              />
            </SectionCard>

            <SectionCard
              id="notifications"
              icon={FiBell}
              title="Notifications"
              subtitle="Choose which events should surface in the dashboard notification stream."
            >
              <div className="settings-notification-grid">
                <ToggleCard
                  title="Enable Notifications"
                  description="Turns all dashboard notifications on or off."
                  checked={notificationsState.enableNotifications}
                  onChange={event => updateNotifications('enableNotifications', event.target.checked)}
                />
                {(isAdmin || isSubAdmin) && (
                  <ToggleCard
                    title="Notify on New User Requests"
                    description="Alert Admin and Sub-Admin users when a registration or approval request arrives."
                    checked={notificationsState.notifyOnNewUserRequests}
                    onChange={event => updateNotifications('notifyOnNewUserRequests', event.target.checked)}
                    hint="Visible to Admin and Sub-Admin roles."
                  />
                )}
                {isAdmin && (
                  <ToggleCard
                    title="Notify on New Uploads"
                    description="Show real-time alerts when a user uploads files, reports, documents, images, or datasets."
                    checked={notificationsState.notifyOnNewUploads}
                    onChange={event => updateNotifications('notifyOnNewUploads', event.target.checked)}
                    hint="Visible to Admin only."
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard
              id="security"
              icon={FiShield}
              title="Security"
              subtitle="Adjust session lifetime, inactivity protection, password access, and recent device sign-ins."
            >
              <div className="settings-control-grid">
                <label className="settings-field">
                  <span>Session Timeout</span>
                  <select value={securityState.sessionTimeout} onChange={event => updateSecurity('sessionTimeout', event.target.value)}>
                    {sessionTimeoutOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <ToggleCard
                title="Auto Logout on Inactivity"
                description="Ends inactive sessions automatically when this is enabled."
                checked={securityState.autoLogoutOnInactivity}
                onChange={event => handleSecurityToggle(event.target.checked)}
                hint="A warning appears before disabling this control."
              />
              <form className="settings-form-stack" onSubmit={handlePasswordSave}>
                <SettingsSectionTitle icon={FiLock} title="Change Password" subtitle="Protect the account with a new password at any time." />
                <div className="settings-control-grid">
                  {[
                    { key: 'currentPassword', label: 'Current Password' },
                    { key: 'newPassword', label: 'New Password' },
                    { key: 'confirmPassword', label: 'Confirm Password' }
                  ].map(field => {
                    const isVisible = showPassword[field.key];
                    const type = isVisible ? 'text' : 'password';
                    return (
                      <label className="settings-field" key={field.key}>
                        <span>{field.label}</span>
                        <div className="settings-password-shell">
                          <input
                            type={type}
                            value={passwordForm[field.key]}
                            onChange={event => setPasswordForm(current => ({ ...current, [field.key]: event.target.value }))}
                          />
                          <button type="button" className="settings-password-toggle" onClick={() => togglePasswordVisibility(field.key)} aria-label={`Toggle ${field.label.toLowerCase()}`}>
                            {isVisible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                          </button>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {passwordMessage && <p className="settings-feedback">{passwordMessage}</p>}
                <div className="settings-actions-row">
                  <button className="settings-action-btn" type="submit">
                    <FiLock size={16} />
                    Change Password
                  </button>
                </div>
              </form>

              <div className="settings-form-stack">
                <SettingsSectionTitle icon={FiUser} title="Device Log In History" subtitle="Review recent sign-ins from your trusted devices." />
                <label className="settings-field">
                  <span>Recent Device Log In</span>
                  <select value={deviceLoginHistory} onChange={event => setDeviceLoginHistory(event.target.value)}>
                    {deviceLoginHistoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <div className="settings-inline-note">
                  <FiHelpCircle size={14} />
                  <span>{deviceLoginHistory}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="support"
              icon={FiHelpCircle}
              title="Need Help?"
              subtitle="Find the right support path for account, access, or upload concerns."
            >
              <div className="guidelines-support-card">
                <FiHelpCircle size={18} />
                <div>
                  <strong>Contact us</strong>
                  <span>Contact the KITA support team for account, access, or upload assistance.</span>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="settings-footer">
            <button className="settings-action-btn" type="button" onClick={handleReset}>
              <FiRefreshCw size={16} />
              Reset to Default
            </button>
            <button className="settings-action-btn settings-action-btn-primary" type="button" onClick={handleSaveSettings}>
              <FiSave size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </motion.section>
  );
}
