import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import logo from '../assets/logos/tdt_logo.png';
import { useAuth } from '../auth/AuthContext';
import PasswordField from '../components/common/PasswordField';
import { PASSWORD_MIN_LENGTH, RECOVERY_PHRASE_MIN_LENGTH } from '../auth/authService';
import '../styles/auth.css';

const pageMotion = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const namePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatName = value => (
  value
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : '')
    .join(' ')
);

const normalizeNameInput = value => {
  const nextValue = value.replace(/^\s+/, '');
  if (/^[A-Za-z\s]*$/.test(nextValue)) return formatName(nextValue);
  return nextValue;
};

const validateName = value => {
  const trimmed = value.trim();
  return trimmed.length > 0 && namePattern.test(trimmed);
};

const normalizeEmailInput = value => value.trim().toLowerCase();
const validateEmail = value => emailPattern.test(normalizeEmailInput(value));

function FieldCheck({ show }) {
  if (!show) return null;
  return (
    <span className="auth-field-check" aria-hidden="true">
      <Check size={15} strokeWidth={3} />
    </span>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});

  const firstNameValid = validateName(firstName);
  const lastNameValid = validateName(lastName);
  const emailValid = validateEmail(email);
  const recoveryPhraseValid = recoveryPhrase.trim().length >= RECOVERY_PHRASE_MIN_LENGTH;

  const getFieldState = (field, isValid, value) => {
    if (!touched[field] && !value) return '';
    return isValid ? 'auth-field-valid' : 'auth-field-invalid';
  };

  const markTouched = field => {
    setTouched(current => ({ ...current, [field]: true }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setTouched({
      firstName: true,
      lastName: true,
      email: true
    });

    if (!firstNameValid || !lastNameValid) {
      setError('Only letters and spaces are allowed.');
      return;
    }

    if (!emailValid) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!recoveryPhraseValid) {
      setError(`Account Recovery Phrase must be at least ${RECOVERY_PHRASE_MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      const result = await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizeEmailInput(email),
        password,
        recoveryPhrase: recoveryPhrase.trim()
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      navigate('/approval-pending', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page-wrapper auth-signup-page">
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
                <div className="auth-row">
                  <div className={`auth-field ${getFieldState('firstName', firstNameValid, firstName)}`}>
                    <label>FIRST NAME</label>
                    <div className="auth-input-shell">
                      <input
                        type="text"
                        placeholder="Enter first name"
                        value={firstName}
                        onChange={event => setFirstName(normalizeNameInput(event.target.value))}
                        onBlur={() => markTouched('firstName')}
                        required
                      />
                      <FieldCheck show={firstNameValid} />
                    </div>
                    {(firstName || touched.firstName) && !firstNameValid && (
                      <p className="auth-field-message">Only letters and spaces are allowed.</p>
                    )}
                  </div>
                  <div className={`auth-field ${getFieldState('lastName', lastNameValid, lastName)}`}>
                    <label>LAST NAME</label>
                    <div className="auth-input-shell">
                      <input
                        type="text"
                        placeholder="Enter last name"
                        value={lastName}
                        onChange={event => setLastName(normalizeNameInput(event.target.value))}
                        onBlur={() => markTouched('lastName')}
                        required
                      />
                      <FieldCheck show={lastNameValid} />
                    </div>
                    {(lastName || touched.lastName) && !lastNameValid && (
                      <p className="auth-field-message">Only letters and spaces are allowed.</p>
                    )}
                  </div>
                </div>
                <div className={`auth-field ${getFieldState('email', emailValid, email)}`}>
                  <label>EMAIL</label>
                  <div className="auth-input-shell">
                      <input
                        type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={event => setEmail(normalizeEmailInput(event.target.value))}
                      onBlur={() => markTouched('email')}
                      required
                    />
                    <FieldCheck show={emailValid} />
                  </div>
                  {(email || touched.email) && !emailValid && (
                    <p className="auth-field-message">Enter a valid email address.</p>
                  )}
                </div>
                <div className="auth-field">
                  <label>PASSWORD</label>
                  <PasswordField
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create password"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className={`auth-field ${getFieldState('recoveryPhrase', recoveryPhraseValid, recoveryPhrase)}`}>
                  <label>ACCOUNT RECOVERY PHRASE</label>
                  <PasswordField
                    value={recoveryPhrase}
                    onChange={event => setRecoveryPhrase(event.target.value)}
                    placeholder="Enter account recovery phrase"
                    onBlur={() => markTouched('recoveryPhrase')}
                    required
                    autoComplete="off"
                  />
                  {(recoveryPhrase || touched.recoveryPhrase) && !recoveryPhraseValid && (
                    <p className="auth-field-message">Minimum {RECOVERY_PHRASE_MIN_LENGTH} characters. Case-sensitive.</p>
                  )}
                </div>
                <div className="auth-field">
                  <label>CONFIRM PASSWORD</label>
                  <PasswordField
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="auth-form-feedback auth-form-feedback-error">{error}</p>}

                <div className="auth-actions">
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: '#ff8a1f' }}
                    whileTap={{ scale: 0.98 }}
                    className="auth-primary-btn"
                    type="submit"
                  >
                    {busy ? 'CREATING...' : 'SIGN UP'}
                  </motion.button>
                  <div className="auth-meta-row">
                    <Link to="/login" className="auth-switch-link auth-bottom-link">Back to login</Link>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
