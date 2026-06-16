import { motion } from 'framer-motion';
import RankBadge from './RankBadge';
import StatusBadge from '../common/StatusBadge';

export default function RankingRow({ rep, index, duplicate = false }) {
  const initials = rep.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.tr
      className={rep.rank <= 3 ? 'ranking-row ranking-row-featured' : 'ranking-row'}
      aria-hidden={duplicate ? 'true' : undefined}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.025 }}
      whileHover={{ scale: 1.005 }}
    >
      <td className="ranking-cell-rank" data-label="Rank">
        <RankBadge rank={rep.rank} movement={rep.movement} />
      </td>
      <td className="ranking-cell-name" data-label="Employee Name">
        <div className="ranking-employee-cell">
          <span className="ranking-avatar">{rep.avatar ? <img src={rep.avatar} alt="" /> : initials}</span>
          <span>
            <strong className="ranking-name">{rep.name}</strong>
            <small>{rep.position || 'Sales Representative'}</small>
          </span>
        </div>
      </td>
      <td className="ranking-cell-center" data-label="Branch">{rep.branch || 'Unassigned Branch'}</td>
      <td className="ranking-cell-center ranking-cell-number" data-label="Deals Converted">{rep.convertedLeads.toLocaleString()}</td>
      <td className="ranking-cell-right ranking-cell-number ranking-cell-gk" data-label="Total GK">{rep.totalGk}</td>
      <td className="ranking-cell-center ranking-cell-number" data-label="Target Attainment">{rep.conversionRate}%</td>
      <td className="ranking-cell-badge" data-label="Performance">
        <StatusBadge status={rep.statusKey} type="performance" />
      </td>
    </motion.tr>
  );
}
