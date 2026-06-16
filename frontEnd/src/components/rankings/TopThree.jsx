import { motion } from 'framer-motion';
import { Award, Crown, Medal } from 'lucide-react';
import RankBadge from './RankBadge';
import StatusBadge from '../common/StatusBadge';

const rankIcons = {
  1: Crown,
  2: Award,
  3: Medal
};

export default function TopThree({ reps }) {
  return (
    <motion.section
      className="top-three-section"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
      }}
    >
      {reps.map(rep => {
        const Icon = rankIcons[rep.rank] || Award;

        return (
          <motion.article
            className={`top-rep-card top-rep-${rep.rank}`}
            key={rep.id}
            layout
            variants={{
              hidden: { opacity: 0, y: 16, scale: 0.98 },
              visible: { opacity: 1, y: 0, scale: 1 }
            }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            whileHover={{ y: -4 }}
          >
            <div className="top-rep-rank-line">
              <RankBadge rank={rep.rank} movement={rep.movement} />
              <Icon size={24} />
            </div>

            <div className="top-rep-main">
              <span className="top-rep-avatar">{rep.avatar ? <img src={rep.avatar} alt="" /> : rep.name.slice(0, 1)}</span>
              <span>{rep.position || 'Sales Representative'} / {rep.branch || 'Unassigned Branch'}</span>
              <h2>{rep.name}</h2>
              <strong>{rep.displayMetric || rep.totalGk}</strong>
              <StatusBadge status={rep.statusKey} type="performance" />
            </div>

            <div className="top-rep-stats">
              <div>
                <small>Deals Converted</small>
                <b>{rep.convertedLeads}</b>
              </div>
              <div>
                <small>Performance</small>
                <b>{rep.performanceLabel || rep.status}</b>
              </div>
            </div>
          </motion.article>
        );
      })}
    </motion.section>
  );
}
