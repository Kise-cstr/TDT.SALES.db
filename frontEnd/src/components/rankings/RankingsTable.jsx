import { AnimatePresence, motion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import RankingRow from './RankingRow';

export default function RankingsTable({
  reps,
  sortKey,
  sortDirection,
  onSort
}) {
  const columns = [
    ['rank', 'Rank #'],
    ['name', 'Employee Name'],
    ['branch', 'Branch'],
    ['convertedLeads', 'Deals Converted'],
    ['totalGkValue', 'Total GK'],
    ['conversionRate', 'Target Attainment'],
    ['statusKey', 'Performance']
  ];
  const shouldLoop = reps.length > 6;
  const loopRows = shouldLoop ? [...reps, ...reps] : reps;

  return (
    <section className="rankings-table-shell">
      <div className="rankings-table-header">
        <div>
          <p>Competition Board</p>
          <h2>Full Sales Rankings</h2>
        </div>
      </div>

      <div className="rankings-table-scroll">
        <table className="rankings-table">
          <colgroup>
            <col className="rank-col" />
            <col className="employee-col" />
            <col className="branch-col" />
            <col className="converted-col" />
            <col className="gk-col" />
            <col className="conversion-col" />
            <col className="badge-col" />
          </colgroup>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}>
                  <button type="button" onClick={() => onSort(key)}>
                    {label}
                    {sortKey === key && (
                      <span className={`sort-direction-icon sort-direction-${sortDirection}`}>
                        {sortDirection === 'asc' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <AnimatePresence>
            <tbody className={shouldLoop ? 'rankings-auto-scroll' : undefined}>
              {loopRows.map((rep, index) => (
                <RankingRow
                  rep={rep}
                  index={index % reps.length}
                  key={`${rep.id}-${index}`}
                  duplicate={index >= reps.length}
                />
              ))}
            </tbody>
          </AnimatePresence>
        </table>
      </div>

      {reps.length === 0 && (
        <motion.div
          className="rankings-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          No representatives match the current filters.
        </motion.div>
      )}

    </section>
  );
}
