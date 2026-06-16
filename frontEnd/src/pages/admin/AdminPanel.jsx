import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiArrowRight, FiDatabase, FiShield, FiUploadCloud, FiUserCheck, FiUsers, FiUserX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import PendingApprovals from './PendingApprovals';
import '../../styles/admin.css';

const AdminMetricCard = memo(function AdminMetricCard({ label, value, detail, Icon, tone }) {
  const isLoading = value === null || value === undefined;
  return (
    <article className={`admin-stat-card admin-stat-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{isLoading ? 'Loading...' : value}</strong>
        <small>{detail}</small>
      </div>
      <Icon />
    </article>
  );
});

const AdminActionCard = memo(function AdminActionCard({ label, detail, buttonLabel, Icon, onClick }) {
  return (
    <button className="admin-tool-card admin-tool-card-button admin-action-card" type="button" onClick={onClick}>
      <Icon />
      <div className="admin-tool-card-copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <span className="admin-tool-card-cta">
        {buttonLabel}
        <FiArrowRight aria-hidden="true" />
      </span>
    </button>
  );
});

function AdminPanel() {
  const navigate = useNavigate();
  const { users, pendingUsers, rejectedRequests, adminUsersLoading } = useAuth();

  const normalizeRole = role => {
    const normalized = String(role || '').toLowerCase();
    return normalized === 'admin' || normalized === 'sub-admin' ? normalized : 'employee';
  };

  const stats = useMemo(() => {
    const employeeUsers = users.filter(user => normalizeRole(user.role) === 'employee');
    const approvedEmployees = employeeUsers.filter(user => user.status === 'approved').length;
    const activeUsers = employeeUsers.filter(user => ['approved', 'active'].includes(String(user.status || '').toLowerCase())).length;
    const totalEmployees = employeeUsers.length;
    const adminUsers = users.filter(user => normalizeRole(user.role) === 'admin').length;
    return { approvedEmployees, activeUsers, totalEmployees, adminUsers };
  }, [users]);

  const metrics = useMemo(
    () => [
      { label: 'Pending Requests', value: adminUsersLoading && !users.length ? null : pendingUsers.length, detail: 'awaiting admin review', Icon: FiUserX, tone: 'amber' },
      { label: 'Approved Employees', value: adminUsersLoading && !users.length ? null : stats.approvedEmployees, detail: 'dashboard-ready accounts', Icon: FiUserCheck, tone: 'green' },
      { label: 'Rejected Requests', value: adminUsersLoading && !users.length ? null : rejectedRequests.length, detail: 'denied access requests', Icon: FiUserX, tone: 'red' },
      { label: 'Active Users', value: adminUsersLoading && !users.length ? null : stats.activeUsers, detail: 'approved platform users', Icon: FiUsers, tone: 'orange' }
    ],
    [adminUsersLoading, pendingUsers.length, rejectedRequests.length, stats.activeUsers, stats.approvedEmployees, users.length]
  );

  return (
    <motion.div
      className="admin-panel-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <section className="admin-hero">
        <div>
          <small className="admin-breadcrumbs">Dashboard / Admin</small>
          <span>Administrator Workspace</span>
          <h1>Admin Management</h1>
          <p>Control employee access, approval queues, upload governance, rankings, and analytics permissions.</p>
        </div>
        <div className="admin-hero-badge admin-badge">
          <FiShield />
          <strong>Admin only</strong>
        </div>
      </section>

      <section className="admin-metrics-grid">
        {metrics.map(({ label, value, detail, Icon, tone }) => (
          <AdminMetricCard key={label} label={label} value={value} detail={detail} Icon={Icon} tone={tone} />
        ))}
      </section>

      <section className="admin-command-grid">
        <div className="admin-tools-grid">
          <AdminActionCard
            label="Manage Uploads"
            detail="Review imported files and load dashboard datasets."
            buttonLabel="Go to Manage Uploads"
            Icon={FiUploadCloud}
            onClick={() => navigate('/admin/uploads')}
          />
          <AdminActionCard
            label="User Management"
            detail="Manage users, roles, permissions, and access levels."
            buttonLabel="Go to User Management"
            Icon={FiDatabase}
            onClick={() => navigate('/admin/user-management')}
          />
        </div>
      </section>

      <PendingApprovals />
    </motion.div>
  );
}

export default memo(AdminPanel);
