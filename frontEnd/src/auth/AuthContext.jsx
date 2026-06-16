import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  activateAdminUser,
  approveAdminUser,
  deactivateAdminUser,
  forceAdminUser,
  getAdminUsers,
  rejectAdminUser,
  unforceAdminUser,
  updateAdminUserRole
} from '../api/adminApi';
import { getCurrentUser } from '../api/authApi';
import {
  clearSession,
  ensureDefaultAdmin,
  getPendingUsers,
  getPublicUsers,
  getSession,
  loginWithQrCode,
  loginWithCredentials,
  registerEmployee,
  syncCurrentSession,
  updateCurrentUserSettings,
  updateCurrentUserProfile,
  updateCurrentUserPassword,
  setSession,
} from './authService';
import { resolveSalesRepPhoto } from '../utils/salesRepUtils';
import { applyUserDashboardSettings } from '../utils/settingsService';

const AuthContext = createContext(null);
const ROLE_SYNC_KEY = 'tdt_auth_role_sync';

const isElevatedRole = role => role === 'admin' || role?.toLowerCase() === 'sub-admin';

const normalizeAdminUsers = (apiUsers = [], localUsers = []) => {
  const localByEmail = new Map(localUsers.map(account => [account.email?.toLowerCase(), account]));
  return apiUsers.map(account => {
    const localMatch = localByEmail.get(account.email?.toLowerCase());
    return {
      ...account,
      firstName: localMatch?.firstName || account.firstName,
      lastName: localMatch?.lastName || account.lastName,
      name: localMatch?.name || account.name,
      position: localMatch?.position || account.position,
      department: localMatch?.department || account.department,
      avatar: account.avatar || localMatch?.avatar || resolveSalesRepPhoto(account),
      password: localMatch?.password || account.password || ''
    };
  });
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    ensureDefaultAdmin();
    return getSession();
  });
  const [users, setUsers] = useState(() => getPublicUsers());
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);

  const refreshUsers = useCallback(async () => {
    ensureDefaultAdmin();
    let nextUsers = [];
    let nextAdminUsers = [];

    setAdminUsersLoading(true);
    try {
      const response = await getAdminUsers();
      if (response?.success && Array.isArray(response.data)) {
        nextAdminUsers = normalizeAdminUsers(response.data, []);
        nextUsers = nextAdminUsers.map(({ password, ...account }) => account);
      }
    } catch {
      nextUsers = getPublicUsers();
      nextAdminUsers = normalizeAdminUsers(
        nextUsers.map(({ password, ...account }) => account),
        nextUsers
      );
    } finally {
      setAdminUsersLoading(false);
    }

    const nextSession = syncCurrentSession();
    setUsers(nextUsers);
    setAdminUsers(nextAdminUsers);
    setUser(nextSession);
    return { users: nextUsers, user: nextSession };
  }, []);

  const refreshCurrentSession = useCallback(async () => {
    const session = getSession();
    if (!session) return null;

    try {
      const response = await getCurrentUser();
      if (response?.success && response.user) {
        const nextSession = setSession({
          ...session,
          ...response.user,
          token: session.token || response.user.token
        }, Boolean(localStorage.getItem('authToken')));
        applyUserDashboardSettings(nextSession);
        setUser(nextSession);
        setUsers(getPublicUsers());
        return nextSession;
      }
    } catch {
      // Fall back to local session sync when the API is unavailable.
    }

    const nextSession = syncCurrentSession();
    setUser(nextSession);
    setUsers(getPublicUsers());
    return nextSession;
  }, []);

  const signalRoleRefresh = useCallback(() => {
    localStorage.setItem(ROLE_SYNC_KEY, String(Date.now()));
  }, []);

  useEffect(() => {
    ensureDefaultAdmin();
    setUser(getSession());
    setUsers(getPublicUsers());
    setAdminUsers([]);
  }, []);

  useEffect(() => {
    if (isElevatedRole(user?.role) && !adminUsers.length) {
      void refreshUsers();
    }
  }, [adminUsers.length, refreshUsers, user?.role]);

  useEffect(() => {
    if (!isElevatedRole(user?.role)) return undefined;

    const handleStorage = event => {
      if (!event.key || event.key === 'tdt_auth_users' || event.key === ROLE_SYNC_KEY) {
        void refreshUsers();
      }
    };

    const interval = window.setInterval(() => {
      void refreshUsers();
    }, 10000);

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleStorage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleStorage);
    };
  }, [refreshUsers, user?.role]);

  useEffect(() => {
    const handleStorage = event => {
      if (
        !event.key ||
        event.key === 'tdt_auth_users' ||
        event.key === 'tdt_auth_session' ||
        event.key === ROLE_SYNC_KEY
      ) {
        void refreshCurrentSession();
      }
    };

    window.addEventListener('storage', handleStorage);
    void refreshCurrentSession();
    const interval = window.setInterval(() => {
      void refreshCurrentSession();
    }, 15000);
    const handleFocus = () => {
      void refreshCurrentSession();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshCurrentSession]);

  const login = useCallback(async (identity, password, remember = true) => {
    const result = await loginWithCredentials(identity, password, remember);
    if (result.ok) {
      setUser(result.user);
      setAdminUsers([]);
      if (result.user?.role === 'admin' || result.user?.role?.toLowerCase() === 'sub-admin') {
        refreshUsers();
      }
    }
    return result;
  }, [refreshUsers]);

  const loginWithQr = useCallback(async value => {
    const result = await loginWithQrCode(value);
    if (result.ok) {
      setUser(result.user);
      setAdminUsers([]);
      if (result.user?.role === 'admin' || result.user?.role?.toLowerCase() === 'sub-admin') {
        refreshUsers();
      }
    }
    return result;
  }, [refreshUsers]);

  const signup = useCallback(async account => {
    const result = await registerEmployee(account);
    if (result.ok) {
      setUser(result.user);
      setAdminUsers([]);
      if (result.user?.role === 'admin' || result.user?.role?.toLowerCase() === 'sub-admin') {
        refreshUsers();
      }
    }
    return result;
  }, [refreshUsers]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const approveEmployee = useCallback(async userId => {
    try {
      const response = await approveAdminUser(userId);
      if (response?.success) {
        await refreshUsers();
        return { ok: true, message: response.message };
      }
      return { ok: false, message: response?.message || 'Unable to approve user.' };
    } catch {
      return { ok: false, message: 'Unable to approve user.' };
    }
  }, [refreshUsers]);

  const rejectEmployee = useCallback(async userId => {
    try {
      const response = await rejectAdminUser(userId);
      if (response?.success) {
        await refreshUsers();
        return { ok: true, message: response.message };
      }
      return { ok: false, message: response?.message || 'Unable to reject user.' };
    } catch {
      return { ok: false, message: 'Unable to reject user.' };
    }
  }, [refreshUsers]);

  const deactivateEmployee = useCallback(async userId => {
    try {
      const response = await deactivateAdminUser(userId);
      if (response?.success) {
        await refreshUsers();
        return { ok: true, message: response.message };
      }
      return { ok: false, message: response?.message || 'Unable to deactivate user.' };
    } catch {
      return { ok: false, message: 'Unable to deactivate user.' };
    }
  }, [refreshUsers]);

  const activateEmployee = useCallback(async userId => {
    try {
      const response = await activateAdminUser(userId);
      if (response?.success) {
        await refreshUsers();
        return { ok: true, message: response.message || 'User enabled.' };
      }
      return { ok: false, message: response?.message || 'Unable to enable user.' };
    } catch {
      return { ok: false, message: 'Unable to enable user.' };
    }
  }, [refreshUsers]);

  const updateEmployeeRole = useCallback(async (userId, nextRole) => {
    try {
      const response = await updateAdminUserRole(userId, nextRole);
      if (response?.success) {
        signalRoleRefresh();
        await refreshUsers();
        return { ok: true, message: response.message };
      }
      return { ok: false, message: response?.message || 'Unable to update user role.' };
    } catch {
      return { ok: false, message: 'Unable to update user role.' };
    }
  }, [refreshUsers, signalRoleRefresh]);

  const updateProfile = useCallback(async profile => {
    const result = await updateCurrentUserProfile(profile);
    if (result.ok) {
      setUser(result.user);
      setUsers(current => (
        current.map(account => (
          account.id === result.user.id || account.email?.toLowerCase() === result.user.email?.toLowerCase()
            ? { ...account, ...result.user }
            : account
        ))
      ));
      setAdminUsers([]);
    }
    return result;
  }, []);

  const updatePassword = useCallback((currentPassword, newPassword, confirmPassword) => {
    const result = updateCurrentUserPassword(currentPassword, newPassword, confirmPassword);
    if (result.ok) {
      setUsers(getPublicUsers());
      setAdminUsers([]);
      setUser(syncCurrentSession());
    }
    return result;
  }, []);

  const forceEmployeePasswordReset = useCallback(async userId => {
    try {
      const response = await forceAdminUser(userId);
      if (response?.success) {
        await refreshUsers();
        return { ok: true, message: response.message };
      }
      return { ok: false, message: response?.message || 'Unable to force account.' };
    } catch {
      return { ok: false, message: 'Unable to force account.' };
    }
  }, [refreshUsers]);

  const unforceEmployee = useCallback(async userId => {
    try {
      const response = await unforceAdminUser(userId);
      if (response?.success) {
        await refreshUsers();
        return { ok: true, message: response.message };
      }
      return { ok: false, message: response?.message || 'Unable to restore account.' };
    } catch {
      return { ok: false, message: 'Unable to restore account.' };
    }
  }, [refreshUsers]);

  const updateSettings = useCallback(async settings => {
    const result = await updateCurrentUserSettings(settings);
    if (result.ok) {
      setUser(result.user);
      setAdminUsers([]);
    }
    return result;
  }, []);

  const value = useMemo(() => ({
    user,
    users,
    adminUsers,
    adminUsersLoading,
    pendingUsers: users.filter(account => account.status === 'pending' && !isElevatedRole(account.role)),
    rejectedRequests: users.filter(account => account.status === 'rejected' && !isElevatedRole(account.role)),
    isAuthenticated: Boolean(user),
    isApproved: user?.status === 'approved' || user?.status === 'active',
    isAdmin: user?.role === 'admin',
    isSubAdmin: user?.role?.toLowerCase() === 'sub-admin',
    login,
    loginWithQr,
    signup,
    logout,
    approveEmployee,
    rejectEmployee,
    deactivateEmployee,
    activateEmployee,
    forceEmployeePasswordReset,
    unforceEmployee,
    updateEmployeeRole,
    updateProfile,
    updateSettings,
    updatePassword,
    refreshUsers,
    getPendingUsers
  }), [adminUsers, adminUsersLoading, approveEmployee, activateEmployee, deactivateEmployee, forceEmployeePasswordReset, login, loginWithQr, logout, refreshUsers, rejectEmployee, signup, unforceEmployee, updateEmployeeRole, updatePassword, updateProfile, updateSettings, user, users]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
