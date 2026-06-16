import { cloneElement, memo, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import StatusBadge from '../common/StatusBadge';
import { baseSalesReps } from '../../data/salesRepData';
import { getPerformanceState, resolveSalesRepPhoto } from '../../utils/salesRepUtils';
import '../../styles/tables.css';

function RepTable({ summary = [] }) {
  const { users } = useAuth();
  const workforceByName = useMemo(
    () => new Map(users.map(user => [user.name?.toLowerCase(), user])),
    [users]
  );
  const performanceByName = useMemo(
    () => new Map(baseSalesReps.map(rep => [rep.name.toLowerCase(), getPerformanceState(rep.performance)])),
    []
  );
  const rows = useMemo(
    () => summary.map(rep => {
      const profile = workforceByName.get(rep.name.toLowerCase());
      const initials = rep.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
      const avatar = profile?.avatar || resolveSalesRepPhoto(rep);

      return (
      <tr key={rep.id}>
        <td>
          <div className="rep-identity-cell">
            <span className="rep-avatar">
              {avatar ? <img src={avatar} alt="" /> : initials}
            </span>
            <span>
              <strong>{profile?.name || rep.name}</strong>
              <small>{profile?.position || 'Sales Representative'}</small>
            </span>
          </div>
        </td>
        <td>{rep.sales}</td>
        <td>{rep.deals}</td>
        <td>
          <StatusBadge status={performanceByName.get(rep.name.toLowerCase()) || 'average'} type="performance" />
        </td>
      </tr>
      );
    }),
    [performanceByName, workforceByName, summary]
  );
  const loopRows = rows.length > 3
    ? [...rows, ...rows].map((row, index) => cloneElement(row, { key: `rep-row-${index}` }))
    : rows;

  return (
    <div className="table-card">
      <h2 className="table-title">Sales Representatives</h2>
      <div className="rep-table-scroll">
        <table className="rep-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Sales</th>
              <th>Deals</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody className={rows.length > 3 ? 'rep-auto-scroll' : undefined}>{loopRows}</tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(RepTable);
