import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  scanLogin as apiScanLogin,
  resetForgotPassword as apiResetForgotPassword,
  verifyForgotPasswordIdentity as apiVerifyForgotPasswordIdentity,
  updateProfile as apiUpdateProfile,
  updateSettings as apiUpdateSettings
} from '../api/authApi';
import { clearDashboardRuntimeSession } from '../utils/dashboardSession';
import { resolveSalesRepPhoto } from '../utils/salesRepUtils';
import { applyUserDashboardSettings } from '../utils/settingsService';

const USERS_KEY = 'tdt_auth_users';
const SESSION_KEY = 'tdt_auth_session';
const REJECTED_KEY = 'tdt_rejected_requests';

export const PASSWORD_MIN_LENGTH = 6;
export const RECOVERY_PHRASE_MIN_LENGTH = 8;

export const DEFAULT_ADMIN = {
  id: 'admin-001',
  firstName: 'System',
  lastName: 'Administrator',
  name: 'Administrator',
  position: 'Administrator',
  department: 'Executive Operations',
  email: 'admin@tdtpowersteel.com',
  password: 'admin123',
  role: 'admin',
  status: 'approved',
  animationSpeed: 'Balanced',
  sessionTimeout: 15,
  forced: false,
  token: 'admin-token'
};

const createEmployeeToken = id => `employee-token-${id}`;

const sanitizeUser = user => {
  if (!user) return null;
  const {
    password,
    recoveryPhraseHash,
    passwordFailedAttempts,
    recoveryFailedAttempts,
    recoveryLockedUntil,
    recoveryLastAttemptAt,
    ...safeUser
  } = user;
  return safeUser;
};

const normalizeUserProfile = user => {
  if (!user) return user;
  const [firstName = '', ...restName] = (user.name || '').split(' ');
  const lastName = restName.join(' ');
  const avatar = user.avatar || resolveSalesRepPhoto(user);

  return {
    ...user,
    firstName: user.firstName || firstName,
    lastName: user.lastName || lastName,
    position: user.position || (user.role === 'admin' ? 'Administrator' : 'Sales Representative'),
    avatar
  };
};

const normalizeApiUser = (user, token) => {
  if (!user) return null;
  const name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const stored = getStoredUserByEmail(user.email);

  return normalizeUserProfile({
    ...user,
    firstName: stored?.firstName || user.firstName,
    lastName: stored?.lastName || user.lastName,
    name: stored?.name || name,
    position: stored?.position || user.position,
    department: stored?.department || user.department,
    avatar: user.avatar || stored?.avatar || '',
    preferences: stored?.preferences || user.preferences || {},
    token,
    authSource: 'api',
    status: user.status || 'approved',
    role: user.role || 'sales'
  });
};

const getApiErrorMessage = error => (
  error?.response?.data?.message ||
  error?.message ||
  'Unable to connect to the authentication server.'
);

const getApiErrorData = error => error?.response?.data || null;

const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getStoredUserByEmail = email => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  return readJson(USERS_KEY, []).find(user => user.email?.toLowerCase() === normalizedEmail) || null;
};

const findStoredUserForSession = session => {
  if (!session) return null;
  const users = readJson(USERS_KEY, []);
  const sessionEmail = session.email?.toLowerCase();
  return users.find(user => (
    user.id === session.id ||
    (sessionEmail && user.email?.toLowerCase() === sessionEmail)
  )) || null;
};

export function ensureDefaultAdmin() {
  const users = readJson(USERS_KEY, []).map(normalizeUserProfile);
  const hasAdmin = users.some(user => user.email === DEFAULT_ADMIN.email);

  if (hasAdmin) {
    writeJson(USERS_KEY, users);
    return users;
  }

  const nextUsers = [normalizeUserProfile(DEFAULT_ADMIN), ...users];
  writeJson(USERS_KEY, nextUsers);
  return nextUsers;
}

export function getUsers() {
  return ensureDefaultAdmin();
}

export function getPublicUsers() {
  return getUsers().map(sanitizeUser);
}

export function getUsersWithPasswords() {
  return getUsers();
}

export function getPendingUsers() {
  return getPublicUsers().filter(user => user.status === 'pending');
}

export function getRejectedRequests() {
  return readJson(REJECTED_KEY, []);
}

export function getSession() {
  ensureDefaultAdmin();
  const session = readJson(SESSION_KEY, null);
  const stored = findStoredUserForSession(session);
  if (!session || !stored) return session;

  return normalizeUserProfile({
    ...session,
    firstName: stored.firstName || session.firstName,
    lastName: stored.lastName || session.lastName,
    name: stored.name || session.name,
    position: stored.position || session.position,
    department: stored.department || session.department,
    avatar: stored.avatar || session.avatar || ''
  });
}

export function setSession(user, remember = true) {
  const session = sanitizeUser(user);
  writeJson(SESSION_KEY, session);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const storage = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;
  if (session?.token) {
    storage.setItem('authToken', session.token);
    otherStorage.removeItem('authToken');
  }
  return session;
}

export function clearSession() {
  apiLogout().catch(() => {});
  clearDashboardRuntimeSession();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('authToken');
  sessionStorage.clear();
}

export async function loginWithCredentials(identity, password, remember = true) {
  try {
    clearDashboardRuntimeSession();
    const response = await apiLogin(identity.trim(), password);
    if (!response?.success || !response?.user || !response?.token) {
      return {
        ok: false,
        message: response?.message || 'Invalid account credentials.',
        recoveryRequired: Boolean(response?.passwordRecoveryRequired || response?.action === 'forgot-password'),
      };
    }

    const user = setSession(normalizeApiUser(response.user, response.token), remember);
    applyUserDashboardSettings(user);
    return { ok: true, user };
  } catch (error) {
    const responseData = getApiErrorData(error);
    return {
      ok: false,
      message: getApiErrorMessage(error),
      recoveryRequired: Boolean(responseData?.passwordRecoveryRequired || responseData?.action === 'forgot-password'),
      attemptsRemaining: responseData?.attemptsRemaining,
    };
  }
}

export function loginWithLocalCredentials(identity, password) {
  clearDashboardRuntimeSession();
  const normalizedIdentity = identity.trim().toLowerCase();
  const users = getUsers();
  const user = users.find(account => (
    account.email.toLowerCase() === normalizedIdentity ||
    account.name.toLowerCase() === normalizedIdentity
  ));

  if (!user || user.password !== password) {
    return { ok: false, message: 'Invalid account credentials.' };
  }
  if (user.status === 'pending_deletion') {
    return { ok: false, message: 'Account is pending deletion.' };
  }

  const session = setSession(user);
  applyUserDashboardSettings(session);
  return { ok: true, user: session };
}

function parseQrIdentity(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  try {
    const parsed = JSON.parse(rawValue);
    return parsed.token || parsed.email || parsed.id || parsed.identity || rawValue;
  } catch {
    try {
      const url = new URL(rawValue);
      return (
        url.searchParams.get('token') ||
        url.searchParams.get('email') ||
        url.searchParams.get('id') ||
        rawValue
      );
    } catch {
      return rawValue;
    }
  }
}

export function loginWithQrCode(value) {
  return loginWithScanToken(value);
}

export async function loginWithScanToken(value, remember = true) {
  try {
    clearDashboardRuntimeSession();
    const scanToken = parseQrIdentity(value).trim();
    if (!scanToken) return { ok: false, message: 'QR token is empty.' };

    const response = await apiScanLogin(scanToken);
    if (!response?.success || !response?.user || !response?.token) {
      return { ok: false, message: response?.message || 'QR login failed.' };
    }

    const user = setSession(normalizeApiUser(response.user, response.token), remember);
    applyUserDashboardSettings(user);
    return { ok: true, user };
  } catch (error) {
    return { ok: false, message: getApiErrorMessage(error) };
  }
}

export async function registerEmployee({ firstName, lastName, email, password, recoveryPhrase }) {
  try {
    clearDashboardRuntimeSession();
    const response = await apiRegister({ firstName, lastName, email, password, recoveryPhrase });
    if (!response?.success || !response?.user || !response?.token) {
      return { ok: false, message: response?.message || 'Unable to create account.' };
    }

    const user = setSession(normalizeApiUser(response.user, response.token));
    applyUserDashboardSettings(user);
    return { ok: true, user };
  } catch (error) {
    return { ok: false, message: getApiErrorMessage(error) };
  }
}

export async function verifyForgotPasswordIdentity(email, recoveryPhrase) {
  try {
    const response = await apiVerifyForgotPasswordIdentity({ email, recoveryPhrase });
    if (!response?.success) {
      return {
        ok: false,
        message: response?.message || 'Invalid recovery credentials.',
        locked: Boolean(response?.locked),
      };
    }

    return { ok: true, message: response?.message || 'Identity verified.' };
  } catch (error) {
    const responseData = getApiErrorData(error);
    return {
      ok: false,
      message: getApiErrorMessage(error),
      locked: Boolean(responseData?.locked),
    };
  }
}

export async function resetForgotPassword(email, recoveryPhrase, newPassword, confirmPassword) {
  try {
    const response = await apiResetForgotPassword({
      email,
      recoveryPhrase,
      newPassword,
      confirmPassword,
    });

    if (!response?.success) {
      return { ok: false, message: response?.message || 'Unable to reset password.' };
    }

    return { ok: true, message: response?.message || 'Password updated successfully.' };
  } catch (error) {
    return { ok: false, message: getApiErrorMessage(error) };
  }
}

export function registerLocalEmployee({ firstName, lastName, email, password }) {
  clearDashboardRuntimeSession();
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ').toLowerCase();

  if (users.some(user => user.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, message: 'An account with this email already exists.' };
  }

  if (users.some(user => `${user.firstName || ''} ${user.lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase() === normalizedName)) {
    return { ok: false, message: 'This name already has an account.' };
  }

  const id = `emp-${String(Date.now()).slice(-6)}`;
  const employee = {
    id,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    position: 'Sales Representative',
    department: '',
    email: normalizedEmail,
    password,
    role: 'employee',
    status: 'pending',
    animationSpeed: 'Balanced',
    sessionTimeout: 15,
    forced: false,
    forcePasswordReset: false,
    requestedAt: new Date().toISOString(),
    token: createEmployeeToken(id)
  };

  writeJson(USERS_KEY, [...users, employee]);
  const session = setSession(employee);
  applyUserDashboardSettings(session);
  return { ok: true, user: session };
}

export async function updateCurrentUserSettings(settings) {
  const session = getSession();
  if (!session) return { ok: false, message: 'No active profile session.' };

  try {
    const response = await apiUpdateSettings(settings);
    if (response?.success && response.user) {
      const responseUser = response.user || {};
      const nextSessionProfile = normalizeUserProfile({
        ...session,
        ...responseUser,
        token: session.token || responseUser.token,
        avatar: responseUser.avatar || session.avatar || resolveSalesRepPhoto(responseUser) || '',
        preferences: responseUser.preferences || settings || session.preferences || {}
      });
      const nextSession = setSession(nextSessionProfile);
      const users = getUsers();
      const sessionEmail = nextSession.email?.toLowerCase();
      const nextUsers = users.map(user => (
        user.id === nextSession.id || user.email?.toLowerCase() === sessionEmail
          ? normalizeUserProfile({
              ...user,
              ...nextSession,
              password: user.password || '',
              avatar: nextSession.avatar || user.avatar || session.avatar,
              preferences: responseUser.preferences || settings || user.preferences || {}
            })
          : user
      ));
      const hasStoredUser = nextUsers.some(user => user.id === nextSession.id || user.email?.toLowerCase() === sessionEmail);
      writeJson(USERS_KEY, hasStoredUser ? nextUsers : [...nextUsers, nextSession]);
      applyUserDashboardSettings(nextSession);
      return { ok: true, message: response.message || 'Settings saved.', user: nextSession };
    }
  } catch {
    // Keep local-only preferences usable when the API is unavailable.
  }

  const users = getUsers();
  const nextUsers = users.map(user => (
    user.id === session.id ? { ...user, preferences: settings } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  const nextSession = setSession({ ...session, preferences: settings });
  applyUserDashboardSettings(nextSession);
  return { ok: true, message: 'Settings saved.', user: nextSession };
}

export function approveUser(userId) {
  const users = getUsers();
  const nextUsers = users.map(user => (
    user.id === userId ? { ...user, status: 'approved' } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return getPublicUsers();
}

export function rejectUser(userId) {
  const users = getUsers();
  const rejectedUser = users.find(user => user.id === userId);
  if (rejectedUser) {
    writeJson(REJECTED_KEY, [
      ...getRejectedRequests(),
      { ...sanitizeUser(rejectedUser), status: 'rejected', rejectedAt: new Date().toISOString() }
    ]);
  }

  const nextUsers = users.map(user => (
    user.id === userId ? { ...user, status: 'rejected', rejectedAt: new Date().toISOString() } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return getPublicUsers();
}

export function deactivateUser(userId) {
  const users = getUsers();
  const nextUsers = users.map(user => (
    user.id === userId ? { ...user, status: 'inactive', inactiveAt: new Date().toISOString() } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return getPublicUsers();
}


export function activateUser(userId) {
  const users = getUsers();
  const nextUsers = users.map(user => (
    user.id === userId ? { ...user, status: 'active', inactiveAt: null, rejectedAt: null, forced: false, scheduledDeletionAt: null } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return getPublicUsers();
}

export function updateUserRole(userId, nextRole) {
  const users = getUsers();
  const nextUsers = users.map(user => {
    if (user.id !== userId) return user;
    const normalizedRole = String(nextRole || '').toLowerCase();
    if (normalizedRole === 'sub-admin') {
      return {
        ...user,
        previousRole: user.role === 'sub-admin' ? user.previousRole || 'employee' : user.role || 'employee',
        role: 'sub-admin'
      };
    }

    if (user.role?.toLowerCase() === 'sub-admin') {
      const restoredRole = user.previousRole || 'employee';
      return {
        ...user,
        role: restoredRole,
        previousRole: undefined
      };
    }

    return {
      ...user,
      role: normalizedRole,
      previousRole: user.previousRole
    };
  });

  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return getPublicUsers();
}
export function forceUserPasswordReset(userId) {
  const users = getUsers();
  const forcedAt = new Date();
  const scheduledDeletionAt = new Date(forcedAt);
  let workingDays = 15;
  while (workingDays > 0) {
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 1);
    if (![0, 6].includes(scheduledDeletionAt.getDay())) workingDays -= 1;
  }
  const nextUsers = users.map(user => (
    user.id === userId
      ? { ...user, forced: true, forcedAt: forcedAt.toISOString(), scheduledDeletionAt: scheduledDeletionAt.toISOString(), deletionCancelledAt: null, status: 'pending_deletion', forcePasswordReset: false }
      : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return { ok: true, message: 'Account forced for deletion review.', users: nextUsers };
}

export async function updateCurrentUserProfile(profile) {
  const session = getSession();
  if (!session) {
    return { ok: false, message: 'No active profile session.' };
  }

  try {
    const response = await apiUpdateProfile(profile);
    if (response?.success && response.user) {
      const nextSession = setSession(normalizeApiUser(response.user, session.token));
      const users = getUsers();
      const sessionEmail = nextSession.email?.toLowerCase();
      const nextUsers = users.map(user => (
        user.id === nextSession.id || user.email?.toLowerCase() === sessionEmail
          ? { ...user, ...nextSession, password: user.password || '' }
          : user
      ));
      const hasStoredUser = nextUsers.some(user => user.id === nextSession.id || user.email?.toLowerCase() === sessionEmail);
      writeJson(USERS_KEY, hasStoredUser ? nextUsers : [...nextUsers, nextSession]);
      applyUserDashboardSettings(nextSession);
      return { ok: true, message: response.message || 'Profile updated.', user: nextSession };
    }
  } catch (error) {
    if (error?.response) {
      return { ok: false, message: getApiErrorMessage(error) };
    }
    // Keep local profile edits usable when the API is unavailable.
  }

  const users = getUsers();
  const sessionEmail = session.email?.toLowerCase();
  const requestedFirstName = profile.firstName?.trim() || session.firstName || '';
  const requestedLastName = profile.lastName?.trim() || session.lastName || '';
  const requestedName = `${requestedFirstName} ${requestedLastName}`.replace(/\s+/g, ' ').trim().toLowerCase();

  if (requestedName && users.some(user => {
    const isCurrentUser = user.id === session.id || user.email?.toLowerCase() === sessionEmail;
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
    return !isCurrentUser && userName === requestedName;
  })) {
    return { ok: false, message: 'This name already has an account.' };
  }

  let matchedExistingUser = false;
  const nextUsers = users.map(user => {
    const isCurrentUser = user.id === session.id || user.email?.toLowerCase() === sessionEmail;
    if (!isCurrentUser) return user;

    matchedExistingUser = true;

    const firstName = profile.firstName?.trim() || user.firstName || session.firstName || '';
    const lastName = profile.lastName?.trim() || user.lastName || session.lastName || '';

    return normalizeUserProfile({
      ...user,
      id: user.id || session.id,
      email: user.email || session.email,
      role: user.role || session.role,
      status: user.status || session.status,
      token: user.token || session.token,
      authSource: user.authSource || session.authSource,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim() || user.name || session.name,
      position: profile.position?.trim() || user.position || session.position,
      department: profile.department?.trim() || user.department || session.department,
      avatar: profile.avatar ?? user.avatar ?? session.avatar
    });
  });

  const firstName = profile.firstName?.trim() || session.firstName || '';
  const lastName = profile.lastName?.trim() || session.lastName || '';
  const nextSessionProfile = normalizeUserProfile({
    ...session,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim() || session.name,
    position: profile.position?.trim() || session.position,
    department: profile.department?.trim() || session.department,
    avatar: profile.avatar ?? session.avatar
  });

  const usersToWrite = matchedExistingUser ? nextUsers : [...nextUsers, nextSessionProfile];
  writeJson(USERS_KEY, usersToWrite);
  const nextSession = setSession(nextSessionProfile);
  applyUserDashboardSettings(nextSession);
  return { ok: true, message: 'Profile updated.', user: nextSession };
}

export function syncCurrentSession(users = getUsers()) {
  const session = getSession();
  if (!session) return null;

  const sessionEmail = session.email?.toLowerCase();
  const currentUser = users.find(user => (
    user.id === session.id ||
    (sessionEmail && user.email?.toLowerCase() === sessionEmail)
  ));
  if (!currentUser) {
    if (session.authSource === 'api') return session;
    clearSession();
    return null;
  }

  const sessionUser = setSession({
    ...session,
    ...currentUser,
    token: session.token || currentUser.token,
    authSource: session.authSource || currentUser.authSource
  });
  applyUserDashboardSettings(sessionUser);
  return sessionUser;
}

export function updateCurrentUserPassword(currentPassword, newPassword, confirmPassword) {
  const session = getSession();
  const users = getUsers();
  const currentUser = users.find(user => user.id === session?.id);

  if (!currentUser || currentUser.password !== currentPassword) {
    return { ok: false, message: 'Current password is incorrect.' };
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: 'New passwords do not match.' };
  }

  const nextUsers = users.map(user => (
    user.id === currentUser.id ? { ...user, password: newPassword, forcePasswordReset: false } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return { ok: true, message: 'Password updated successfully.' };
}

export function updateUserPasswordByIdentity(identity, currentPassword, newPassword, confirmPassword) {
  const normalizedIdentity = identity.trim().toLowerCase();
  const users = getUsers();
  const targetUser = users.find(user => (
    user.email.toLowerCase() === normalizedIdentity ||
    user.name.toLowerCase() === normalizedIdentity
  ));

  if (!targetUser || targetUser.password !== currentPassword) {
    return { ok: false, message: 'Current account credentials are incorrect.' };
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: 'New passwords do not match.' };
  }

  const nextUsers = users.map(user => (
    user.id === targetUser.id ? { ...user, password: newPassword, forcePasswordReset: false } : user
  ));
  writeJson(USERS_KEY, nextUsers);
  syncCurrentSession(nextUsers);
  return { ok: true, message: 'Password updated successfully.' };
}

export function isAuthenticated() {
  return Boolean(getSession());
}

export function isApproved() {
  return getSession()?.status === 'approved';
}

export function getApprovalStatus() {
  return getSession()?.status || 'guest';
}

export function logout() {
  clearSession();
}

export const changePassword = updateCurrentUserPassword;

