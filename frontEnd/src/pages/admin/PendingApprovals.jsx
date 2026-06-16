import { memo, useCallback, useMemo, useState } from 'react';
import { FiCheckCircle, FiSearch, FiXCircle } from 'react-icons/fi';

import { useAuth } from '../../auth/AuthContext';
import '../../styles/admin.css';

const formatRequestDate = value => {
  if (!value) return 'Today';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
};

const pageSize = 8;

const PendingApprovalRow = memo(function PendingApprovalRow({ employee, onApprove, onReject }) {
  const approve = useCallback(() => onApprove(employee.id), [employee.id, onApprove]);
  const reject = useCallback(() => onReject(employee.id), [employee.id, onReject]);

  return (
    <tr>
      <td>
        <span className="admin-avatar-cell">{employee.avatar ? <img src={employee.avatar} alt="" /> : employee.name?.slice(0, 1) || 'E'}</span>
      </td>
      <td>
        <strong>{employee.name}</strong>
        <small>{employee.id}</small>
      </td>
      <td>{employee.department}</td>
      <td>{employee.email}</td>
      <td>{formatRequestDate(employee.requestedAt)}</td>
      <td>
        <div className="admin-table-actions">
          <button type="button" className="admin-action-approve" onClick={approve}>
            <FiCheckCircle />
            Approve
          </button>
          <button type="button" className="admin-action-reject" onClick={reject}>
            <FiXCircle />
            Disapprove
          </button>
        </div>
      </td>
    </tr>
  );
});

function PendingApprovals() {
  const { pendingUsers, approveEmployee, rejectEmployee } = useAuth();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return pendingUsers;

    return pendingUsers.filter(employee => (
      `${employee.name} ${employee.email} ${employee.department}`.toLowerCase().includes(normalizedQuery)
    ));
  }, [pendingUsers, query]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = useMemo(
    () => filteredUsers.slice((page - 1) * pageSize, page * pageSize),
    [filteredUsers, page]
  );
  const updateQuery = useCallback(event => {
    setQuery(event.target.value);
    setPage(1);
  }, []);
  const previousPage = useCallback(() => setPage(current => Math.max(1, current - 1)), []);
  const nextPage = useCallback(() => setPage(current => Math.min(totalPages, current + 1)), [totalPages]);

  return (
    <section className="admin-panel-section">
      <div className="admin-section-header">
        <div>
          <small className="admin-breadcrumbs">Admin / Access Control</small>
          <span>Employee Access Queue</span>
          <h1>Pending Approvals</h1>
        </div>
        <div className="admin-topbar-actions">
          <label className="admin-search">
            <FiSearch />
            <input value={query} onChange={updateQuery} placeholder="Search pending employees" />
          </label>
          <strong>{filteredUsers.length} pending</strong>
        </div>
      </div>

      <div className="admin-table-shell">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Email</th>
              <th>Date Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map(employee => (
              <PendingApprovalRow
                key={employee.id}
                employee={employee}
                onApprove={approveEmployee}
                onReject={rejectEmployee}
              />
            ))}
            {!visibleUsers.length && (
              <tr>
                <td colSpan="6">
                  <div className="admin-empty-state">
                    <strong>No pending approvals</strong>
                    <span>New employee signup requests will appear here.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <button type="button" disabled={page === 1} onClick={previousPage}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page === totalPages} onClick={nextPage}>Next</button>
      </div>
    </section>
  );
}

export default memo(PendingApprovals);
