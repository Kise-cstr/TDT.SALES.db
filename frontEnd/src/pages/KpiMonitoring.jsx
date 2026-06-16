import { motion } from 'framer-motion';
import { EnterpriseChart, EnterpriseFilters, EnterpriseTable } from '../components/analytics/EnterpriseWidgets';
import { kpiProgressData, repPerformanceRows, salesByRep } from '../data/enterpriseAnalytics';
import '../styles/dashboard.css';
import '../styles/enterprise.css';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } }
};

const remainingTargetRows = kpiProgressData.map(item => [
  item.label,
  typeof item.target === 'number' ? item.target.toLocaleString() : item.target,
  typeof item.actual === 'number' ? item.actual.toLocaleString() : item.actual,
  `${item.completion}%`,
  (item.target - item.actual).toLocaleString()
]);

export default function KpiMonitoring() {
  return (
    <>
      <motion.div className="dashboard-header" variants={itemVariants} initial="hidden" animate="visible">
        <h1 className="dashboard-title">KPI Monitoring</h1>
        <p className="dashboard-subtitle">Target vs actual, team ranking, rep ranking, monthly progress, and remaining target</p>
      </motion.div>
      <EnterpriseFilters />
      <section className="enterprise-grid enterprise-grid-two">
        <EnterpriseChart title="KPI Target vs Actual" subtitle="Actual output compared with operating targets" data={kpiProgressData} keys={['actual', 'target']} />
        <EnterpriseChart title="KPI Completion %" subtitle="Completion status by KPI category" data={kpiProgressData} keys={['completion']} />
        <EnterpriseChart title="Team Ranking" subtitle="Team revenue position by contribution" data={salesByRep} keys={['sales']} />
        <EnterpriseChart title="Rep Ranking" subtitle="Lead-to-close performance by rep" data={salesByRep} keys={['leads', 'deals']} />
        <EnterpriseChart title="Monthly KPI Progress" subtitle="Completion progression by KPI" type="line" data={kpiProgressData} keys={['completion']} />
        <EnterpriseChart title="Remaining Target Needed" subtitle="Gap to monthly goal" data={remainingTargetRows.map(row => ({ label: row[0], remaining: Number(String(row[4]).replace(/,/g, '')) }))} keys={['remaining']} />
      </section>
      <EnterpriseTable
        title="KPI Remaining Target Table"
        columns={['KPI', 'Target', 'Actual', 'Completion %', 'Remaining Target Needed']}
        rows={remainingTargetRows}
      />
      <EnterpriseTable
        title="Rep Performance Table"
        columns={['Sales Rep', 'Leads', 'Closed Deals', 'Gross Sales', 'Target Attainment', 'GK %']}
        rows={repPerformanceRows}
      />
    </>
  );
}
