import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiMoreVertical, FiRefreshCcw, FiSearch, FiShield, FiSlash, FiUserPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { baseSalesReps } from '../../data/salesRepData';
import { getPerformanceState } from '../../utils/salesRepUtils';
import '../../styles/admin.css';

const pageSize = 8;

const roles = ['Admin', 'Sub-Admin', 'Employee'];

const roleLabels = {
  admin: 'Admin',
  'sub-admin': 'Sub-Admin',
  employee: 'Employee'
};

const normalizeRole = role => {
  const normalized = (role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'sub-admin' ? normalized : 'employee';
};

const UserRow = memo(function UserRow({
  employee,
  performance,
  isAdminUser,
  isSubAdminUser,
  onApprove,
  onDeactivate,
  onActivate,
  onForceReset,
  onUnforce,
  onChangeRole,
  onReject
}) {
  const rowRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState('right');
  const [menuStyle, setMenuStyle] = useState({});
  const isDarkTheme = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'dark';
  const approve = useCallback(() => onApprove(employee.id), [employee.id, onApprove]);
  const deactivate = useCallback(() => onDeactivate(employee.id), [employee.id, onDeactivate]);
  const activate = useCallback(() => onActivate(employee.id), [employee.id, onActivate]);
  const forceReset = useCallback(() => onForceReset(employee.id), [employee.id, onForceReset]);
  const unforce = useCallback(() => onUnforce(employee.id), [employee.id, onUnforce]);
  const reject = useCallback(() => onReject(employee.id), [employee.id, onReject]);
  const toggleRole = useCallback(() => {
    const nextRole = employee.role?.toLowerCase() === 'sub-admin' ? 'employee' : 'sub-admin';
    onChangeRole(employee.id, nextRole);
    setMenuOpen(false);
  }, [employee.id, employee.role, onChangeRole]);

  const isForced = Boolean(employee.forced) || employee.status === 'pending_deletion';
  const isDisabled = employee.status === 'inactive';
  const isApprovalOnlyAccount = employee.status === 'pending';
  const targetIsAdmin = normalizeRole(employee.role) === 'admin';
  const canManageAccount = !targetIsAdmin;
  const canApprove = canManageAccount && employee.status !== 'approved' && (isAdminUser || isSubAdminUser);
  const canToggleStatus = canManageAccount && (isAdminUser || isSubAdminUser);
  const canForceAccount = canManageAccount && (isAdminUser || isSubAdminUser);
  const canToggleRole = isAdminUser && employee.role?.toLowerCase() !== 'admin';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = event => {
      if (!rowRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen, isDarkTheme]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const updateMenuPosition = () => {
      const anchorRect = triggerRef.current?.getBoundingClientRect();
      if (!anchorRect) return;

      const popoverWidth = popoverRef.current?.offsetWidth || 190;
      const desiredLeft = isDarkTheme
        ? anchorRect.left - popoverWidth - 18
        : anchorRect.right + 18;
      const maxLeft = window.innerWidth - popoverWidth - 18;
      const minLeft = 18;

      setMenuStyle({
        top: `${anchorRect.top + anchorRect.height / 2}px`,
        left: `${Math.min(Math.max(desiredLeft, minLeft), maxLeft)}px`
      });
      setMenuPosition(isDarkTheme ? 'left' : 'right');
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen, isDarkTheme]);

  return (
    <tr className="admin-user-grid-row">
      <td data-label="Avatar Name" className="admin-user-identity-cell">
        <span className="admin-avatar-cell avatar-image">{employee.avatar ? <img src={employee.avatar} alt="" /> : <FiShield />}</span>
        <strong>{employee.name}</strong>
      </td>
      <td data-label="Role" className="role-cell"><span className="position-text">{roleLabels[normalizeRole(employee.role)]}</span></td>
      <td data-label="Department" className="department-cell"><span className="department-text">{employee.department || 'Sales Department'}</span></td>
      <td data-label="Email" className="email-cell"><span className="email-text">{employee.email}</span></td>
      <td data-label="Performance" className="performance-cell"><StatusBadge status={performance} type="performance" className="performance-badge" /></td>
      <td data-label="Status" className="status-cell"><StatusBadge status={employee.status} type="approval" className="status-badge" /></td>
      <td data-label="Actions" className="actions-cell">
        <div className="admin-actions-menu" ref={rowRef}>
          <button
            type="button"
            className="admin-actions-menu-trigger"
            ref={triggerRef}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuPosition(isDarkTheme ? 'left' : 'right');
              setMenuOpen(current => !current);
            }}
          >
            <FiMoreVertical aria-hidden="true" />
            <span className="sr-only">Open user actions</span>
          </button>

          {menuOpen && (
            <div className={`admin-actions-menu-popover ${menuPosition}`} role="menu" ref={popoverRef} style={isDarkTheme ? undefined : menuStyle}>
              {isApprovalOnlyAccount ? (
                <>
                  {canApprove && (
                    <button type="button" className="admin-actions-menu-item" onClick={() => { approve(); setMenuOpen(false); }}>
                      <FiCheck aria-hidden="true" />
                      Approve
                    </button>
                  )}
                  <button type="button" className="admin-actions-menu-item" onClick={() => { reject(); setMenuOpen(false); }}>
                    <FiSlash aria-hidden="true" />
                    Disapprove
                  </button>
                </>
              ) : (
                <>
                  {canApprove && (
                    <button type="button" className="admin-actions-menu-item" onClick={() => { approve(); setMenuOpen(false); }}>
                      <FiCheck aria-hidden="true" />
                      Approve
                    </button>
                  )}
                  {canToggleStatus && (
                    <button type="button" className="admin-actions-menu-item" onClick={() => { (isDisabled ? activate : deactivate)(); setMenuOpen(false); }}>
                      <FiSlash aria-hidden="true" />
                      {isDisabled ? 'Enable' : 'Disable'}
                    </button>
                  )}
                  {canForceAccount && (
                    <button type="button" className="admin-actions-menu-item" onClick={() => { (isForced ? unforce : forceReset)(); setMenuOpen(false); }}>
                      <FiRefreshCcw aria-hidden="true" />
                      {isForced ? 'Unforce' : 'Force'}
                    </button>
                  )}
                  {canToggleRole && (
                    <button type="button" className="admin-actions-menu-item" onClick={toggleRole}>
                      <FiUserPlus aria-hidden="true" />
                      {employee.role?.toLowerCase() === 'sub-admin' ? 'Remove Sub-Admin' : 'Make Sub-Admin'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

function UserManagement() {
  const navigate = useNavigate();
  const {
    adminUsers,
    approveEmployee,
    rejectEmployee,
    deactivateEmployee,
    activateEmployee,
    forceEmployeePasswordReset,
    unforceEmployee,
    isAdmin,
    isSubAdmin,
    updateEmployeeRole
  } = useAuth();
  const [isGoogleSheetsConnected, setIsGoogleSheetsConnected] = useState(
    () => localStorage.getItem('tdt_google_sheets_connected') === 'true'
  );
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');

  const employees = useMemo(() => adminUsers, [adminUsers]);
  const performanceByName = useMemo(
    () => new Map(baseSalesReps.map(rep => [rep.name.toLowerCase(), getPerformanceState(rep.performance)])),
    []
  );
  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees.filter(employee => {
      const matchesQuery = !normalizedQuery || `${employee.name} ${employee.email}`.toLowerCase().includes(normalizedQuery);
      const matchesRole = role === 'all' || normalizeRole(employee.role) === role;
      const matchesStatus = status === 'all' || employee.status === status;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [employees, query, role, status]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const visibleEmployees = useMemo(
    () => filteredEmployees.slice((page - 1) * pageSize, page * pageSize),
    [filteredEmployees, page]
  );

  const updateFilter = useCallback(setter => event => {
    setter(event.target.value);
    setPage(1);
  }, []);
  const previousPage = useCallback(() => setPage(current => Math.max(1, current - 1)), []);
  const nextPage = useCallback(() => setPage(current => Math.min(totalPages, current + 1)), [totalPages]);
  const handleForceReset = useCallback(async userId => {
    const result = await forceEmployeePasswordReset(userId);
    setNotice(result.message);
  }, [forceEmployeePasswordReset]);

  const handleUnforce = useCallback(async userId => {
    const result = await unforceEmployee(userId);
    setNotice(result.message);
  }, [unforceEmployee]);

  const handleActivate = useCallback(async userId => {
    const result = await activateEmployee(userId);
    setNotice(result.message);
  }, [activateEmployee]);

  const handleRoleChange = useCallback(async (userId, nextRole) => {
    const result = await updateEmployeeRole(userId, nextRole);
    if (!result.ok) {
      setNotice('Unable to update user role.');
    }
  }, [updateEmployeeRole]);

  const handleDisconnectLive = useCallback(() => {
    localStorage.removeItem('tdt_google_sheets_connected');
    setIsGoogleSheetsConnected(false);
    window.dispatchEvent(new Event('tdt-google-sheets-status'));
    navigate('/upload');
  }, [navigate]);

  useEffect(() => {
    const syncStatus = () => {
      setIsGoogleSheetsConnected(localStorage.getItem('tdt_google_sheets_connected') === 'true');
    };

    window.addEventListener('storage', syncStatus);
    window.addEventListener('tdt-google-sheets-status', syncStatus);
    return () => {
      window.removeEventListener('storage', syncStatus);
      window.removeEventListener('tdt-google-sheets-status', syncStatus);
    };
  }, []);

  return (
    <motion.section
      className="admin-panel-section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <div className="admin-section-header admin-management-topbar">
        <div>
          <small className="admin-breadcrumbs">Admin / Employee Directory</small>
          <span>Account Governance</span>
          <h1>User Management</h1>
        </div>
        <div className="admin-topbar-actions">
          <label className="admin-search admin-search-wide">
            <FiSearch />
            <input value={query} onChange={updateFilter(setQuery)} placeholder="Search employee or email" />
          </label>
        </div>
      </div>

      <div className="admin-filter-bar">
        <div className="admin-filter-bar-filters">
              <select value={role} onChange={updateFilter(setRole)}>
            <option value="all">All Roles</option>
            {roles.map(roleName => (
              <option key={roleName} value={roleName.toLowerCase()}>{roleName}</option>
            ))}
          </select>
          <select value={status} onChange={updateFilter(setStatus)}>
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="pending_deletion">Pending Deletion</option>
            <option value="rejected">Rejected</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {isGoogleSheetsConnected && (
          <div className="admin-filter-bar-sync">
            <button
              type="button"
              className="admin-live-indicator"
              onClick={handleDisconnectLive}
              aria-label="Google Sheets live sync active. Click to disconnect."
              title="Disconnect live sync"
            >
              <span className="admin-live-dot" aria-hidden="true" />
              Live
            </button>
          </div>
        )}
      </div>

      {notice && <div className="admin-password-notice">{notice}</div>}

      <div className="admin-table-shell table-wrapper">
        <table className="admin-table admin-user-management-table user-table">
          <thead>
            <tr>
              <th>Avatar Name</th>
              <th className="role-column">Role</th>
              <th className="department-column">Department</th>
              <th className="email-column">Email</th>
              <th className="performance-status-column" colSpan="2">Performance Status</th>
              <th className="actions-column" aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map(employee => (
              <UserRow
                key={employee.id}
                employee={employee}
                performance={performanceByName.get(employee.name?.toLowerCase()) || getPerformanceState(employee.status === 'approved' ? 76 : 48)}
                isAdminUser={isAdmin}
                isSubAdminUser={isSubAdmin}
                onApprove={approveEmployee}
                onReject={rejectEmployee}
                onDeactivate={deactivateEmployee}
                onActivate={handleActivate}
                onForceReset={handleForceReset}
                onUnforce={handleUnforce}
                onChangeRole={handleRoleChange}
              />
            ))}
          </tbody>
        </table>
        {!visibleEmployees.length && (
          <div className="admin-empty-state">
            <strong>No employee accounts found</strong>
            <span>Adjust filters or wait for new employee signup requests.</span>
          </div>
        )}
      </div>

      <div className="admin-pagination">
        <button type="button" disabled={page === 1} onClick={previousPage}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page === totalPages} onClick={nextPage}>Next</button>
      </div>
    </motion.section>
  );
}

export default memo(UserManagement);
