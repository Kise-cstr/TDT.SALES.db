import { Suspense, lazy, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import logo from '../assets/logos/tdt_logo.png';
import { useAuth } from '../auth/AuthContext';
import PasswordField from '../components/common/PasswordField';
import TeamCredits from '../components/common/TeamCredits';
import {
  PASSWORD_MIN_LENGTH,
  RECOVERY_PHRASE_MIN_LENGTH,
  resetForgotPassword,
  verifyForgotPasswordIdentity,
} from '../auth/authService';
import '../styles/auth.css';

const pageMotion = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const QRScanner = lazy(() => import('../components/cards/QRScanner'));

export default function Login() {
  const { login, loginWithQr } = useAuth();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState({ message: '', tone: 'success' });
  const [recoveryForm, setRecoveryForm] = useState({
    email: '',
    recoveryPhrase: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      const result = await login(identity, password);
      if (!result.ok) {
        setError(result.message);
        if (result.recoveryRequired) {
          setPassword('');
          openRecoveryModal(identity);
        }
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleQrScan = async value => {
    setBusy(true);
    setError('');
    try {
      const result = await loginWithQr(value);
      if (!result.ok) {
        setError(result.message);
        return false;
      }
      return true;
    } catch (err) {
      setError('An error occurred during QR login. Please try again.');
      console.error(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateRecoveryField = key => event => {
    setRecoveryForm(current => ({ ...current, [key]: event.target.value }));
  };

  const openRecoveryModal = prefillEmail => {
    setRecoveryStep(1);
    setRecoveryNotice({ message: '', tone: 'success' });
    setRecoveryForm(current => ({
      email: String(prefillEmail || '').includes('@') ? prefillEmail : (current.email.includes('@') ? current.email : ''),
      recoveryPhrase: '',
      newPassword: '',
      confirmPassword: ''
    }));
    setIsRecoveryModalOpen(true);
  };

  const closeRecoveryModal = () => {
    setIsRecoveryModalOpen(false);
    setRecoveryStep(1);
    setRecoveryNotice({ message: '', tone: 'success' });
    setRecoveryBusy(false);
  };

  const backToLogin = () => {
    closeRecoveryModal();
    setError('');
  };

  const getPasswordStrength = value => {
    const score = [
      value.length >= 6,
      /[A-Z]/.test(value),
      /[a-z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value),
      value.length >= 10,
    ].filter(Boolean).length;

    if (score <= 1) return { label: 'Weak', percent: 18, tone: 'weak' };
    if (score <= 3) return { label: 'Fair', percent: 48, tone: 'fair' };
    if (score <= 4) return { label: 'Good', percent: 72, tone: 'good' };
    return { label: 'Strong', percent: 100, tone: 'strong' };
  };

  const handleRecoveryVerify = async event => {
    event.preventDefault();
    setRecoveryBusy(true);
    setRecoveryNotice({ message: '', tone: 'success' });
    const result = await verifyForgotPasswordIdentity(
      recoveryForm.email,
      recoveryForm.recoveryPhrase
    );
    setRecoveryBusy(false);
    if (!result.ok) {
      setRecoveryNotice({ message: result.message || 'Invalid recovery credentials.', tone: 'error' });
      return;
    }
    setRecoveryStep(2);
    setRecoveryNotice({ message: 'Identity verified. Create your new password.', tone: 'success' });
  };

  const handleRecoveryReset = async event => {
    event.preventDefault();
    if (recoveryForm.newPassword.length < PASSWORD_MIN_LENGTH) {
      setRecoveryNotice({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, tone: 'error' });
      return;
    }
    if (recoveryForm.newPassword !== recoveryForm.confirmPassword) {
      setRecoveryNotice({ message: 'Passwords do not match.', tone: 'error' });
      return;
    }

    setRecoveryBusy(true);
    const result = await resetForgotPassword(
      recoveryForm.email,
      recoveryForm.recoveryPhrase,
      recoveryForm.newPassword,
      recoveryForm.confirmPassword
    );
    setRecoveryBusy(false);
    if (!result.ok) {
      setRecoveryNotice({ message: result.message || 'Unable to reset password.', tone: 'error' });
      return;
    }

    setRecoveryStep(3);
    setRecoveryNotice({ message: result.message || 'Password Updated Successfully', tone: 'success' });
  };

  const strength = getPasswordStrength(recoveryForm.newPassword);

  return (
    <div className="auth-page-wrapper auth-login-page">
      <div className="auth-steel-bg" />
      <div className="auth-vignette" />
      <div className="auth-ambient-glow" />

      <motion.div className="auth-page" variants={pageMotion} initial="hidden" animate="visible">
        <div className="auth-container auth-layout">
          <section className="auth-panel left auth-left">
            <div className="auth-content">
              <div className="auth-branding">
                <span className="auth-label">Key Integrated Tracking & Analytics</span>
                <img src={logo} alt="TDT logo" className="auth-logo" />
                <p></p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="auth-field">
                  <span>EMAIL OR NAME</span>
                  <input value={identity} onChange={e => setIdentity(e.target.value)} placeholder="Enter Email or Name" required />
                </div>
                <div className="auth-field">
                  <span>PASSWORD</span>
                  <PasswordField
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="auth-form-feedback auth-form-feedback-error">{error}</p>}
                <div className="auth-options-row">
                  <label className="auth-checkbox">
                    <input type="checkbox" checked={remember} onChange={() => setRemember(!remember)} />
                    Remember me
                  </label>
                  <button className="auth-change-password-link" type="button" onClick={() => openRecoveryModal(identity)}>Forgot Password?</button>
                </div>
                <div className="auth-action-row">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="primary-btn" type="submit" disabled={busy}>
                    {busy ? 'AUTHENTICATING...' : 'LOGIN'}
                  </motion.button>
                  <Link to="/signup" className="auth-alt-link auth-bottom-link">Create account</Link>
                </div>
              </form>
            </div>
          </section>

          <section className="auth-panel right auth-right">
            <Suspense fallback={<div className="qr-scanner-fallback" />}>
              <QRScanner
                title="Scan Your QR Code"
                subtitle="Align your employee QR code inside the scanner frame"
                onScan={handleQrScan}
              />
            </Suspense>
          </section>
        </div>
      </motion.div>

      {isRecoveryModalOpen && (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={closeRecoveryModal}>
          <motion.div
            className="auth-password-modal auth-recovery-modal"
            onMouseDown={event => event.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
          >
            <div className="auth-modal-header">
              <span className="auth-section-label">Secure Account</span>
              <h3>Forgot Password?</h3>
              <p className="auth-modal-copy">Verify your identity using your email address and account recovery phrase.</p>
            </div>
            {recoveryStep === 1 && (
              <form className="auth-modal-step" onSubmit={handleRecoveryVerify}>
                <label className="auth-field">
                  <span>Email Address</span>
                  <input
                    type="email"
                    value={recoveryForm.email}
                    onChange={updateRecoveryField('email')}
                    placeholder="Enter your email address"
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Account Recovery Phrase</span>
                  <PasswordField
                    value={recoveryForm.recoveryPhrase}
                    onChange={updateRecoveryField('recoveryPhrase')}
                    placeholder="Enter account recovery phrase"
                    autoComplete="off"
                    required
                  />
                  <p className="auth-field-message">Minimum {RECOVERY_PHRASE_MIN_LENGTH} characters. Case-sensitive.</p>
                </label>
                {recoveryNotice.message && (
                  <p className={`auth-form-feedback auth-form-feedback-${recoveryNotice.tone}`}>{recoveryNotice.message}</p>
                )}
                <div className="auth-modal-actions">
                  <button className="auth-modal-secondary" type="button" onClick={closeRecoveryModal}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={recoveryBusy}>{recoveryBusy ? 'VERIFYING...' : 'VERIFY IDENTITY'}</button>
                </div>
              </form>
            )}
            {recoveryStep === 2 && (
              <form className="auth-modal-step" onSubmit={handleRecoveryReset}>
                <label className="auth-field">
                  <span>Email Address</span>
                  <input
                    type="email"
                    value={recoveryForm.email}
                    onChange={updateRecoveryField('email')}
                    placeholder="Enter your email address"
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>New Password</span>
                  <PasswordField
                    value={recoveryForm.newPassword}
                    onChange={updateRecoveryField('newPassword')}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    required
                  />
                  <div className="auth-strength-shell">
                    <div className="auth-strength-track" aria-hidden="true">
                      <div className={`auth-strength-fill auth-strength-${strength.tone}`} style={{ width: `${strength.percent}%` }} />
                    </div>
                    <span className="auth-strength-label">{strength.label}</span>
                  </div>
                </label>
                <label className="auth-field">
                  <span>Confirm New Password</span>
                  <PasswordField
                    value={recoveryForm.confirmPassword}
                    onChange={updateRecoveryField('confirmPassword')}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                </label>
                {recoveryNotice.message && (
                  <p className={`auth-form-feedback auth-form-feedback-${recoveryNotice.tone}`}>{recoveryNotice.message}</p>
                )}
                <div className="auth-modal-actions">
                  <button className="auth-modal-secondary" type="button" onClick={closeRecoveryModal}>Cancel</button>
                  <button className="primary-btn" type="submit" disabled={recoveryBusy}>{recoveryBusy ? 'RESETTING...' : 'RESET PASSWORD'}</button>
                </div>
              </form>
            )}
            {recoveryStep === 3 && (
              <div className="auth-modal-step auth-recovery-success">
                <p className="auth-recovery-title">Password Updated Successfully</p>
                <p className="auth-recovery-copy">Your password has been changed successfully. You may now sign in using your new password.</p>
                <div className="auth-modal-actions">
                  <button className="primary-btn" type="button" onClick={backToLogin}>Back to Login</button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      <button className="login-team-credit" type="button" onClick={() => setIsTeamPanelOpen(true)}>
        System Development Team
      </button>
      <TeamCredits isOpen={isTeamPanelOpen} onClose={() => setIsTeamPanelOpen(false)} />
    </div>
  );
}
