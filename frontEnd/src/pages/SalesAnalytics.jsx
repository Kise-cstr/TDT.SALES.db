import { motion } from 'framer-motion';
import {
  EnterpriseChart,
  EnterpriseFilters,
  EnterpriseTable,
  HeatmapCard
} from '../components/analytics/EnterpriseWidgets';
import {
  branchSales,
  clientTypeSales,
  dailySalesTrend,
  recentSalesRows,
  repPerformanceRows,
  salesByRep,
  salesHeatmap,
  termsData,
  weeklySalesTrend
} from '../data/enterpriseAnalytics';
import '../styles/dashboard.css';
import '../styles/enterprise.css';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } }
};

export default function SalesAnalytics() {
  return (
    <>
      <motion.div className="dashboard-header" variants={itemVariants} initial="hidden" animate="visible">
        <h1 className="dashboard-title">Sales Analytics</h1>
        <p className="dashboard-subtitle">Rep performance, conversion rates, terms breakdown, and branch revenue intelligence</p>
      </motion.div>
      <EnterpriseFilters />
      <section className="enterprise-grid enterprise-grid-two">
        <EnterpriseChart title="Daily Sales Trend" subtitle="Day-by-day revenue movement" type="area" data={dailySalesTrend} keys={['sales']} />
        <EnterpriseChart title="Weekly Sales Trend" subtitle="Sales velocity and conversion momentum" type="line" data={weeklySalesTrend} keys={['sales', 'conversion']} />
        <EnterpriseChart title="Sales by Sales Rep" subtitle="Gross sales by active representative" data={salesByRep} keys={['sales']} />
        <EnterpriseChart title="Top 10 Sales Reps" subtitle="Leaderboard by revenue contribution" data={salesByRep} keys={['sales', 'deals']} />
        <EnterpriseChart title="Sales per Branch" subtitle="Branch-level sales distribution" data={branchSales} keys={['sales']} />
        <EnterpriseChart title="Sales per Client Type" subtitle="Revenue mix by customer segment" type="pie" data={clientTypeSales} />
        <EnterpriseChart title="Terms Distribution" subtitle="Most used terms and transaction count" data={termsData} keys={['count']} />
        <EnterpriseChart title="Sales per Terms / GK per Terms" subtitle="Terms-linked revenue and GK visibility" data={termsData} keys={['sales', 'gk']} />
        <HeatmapCard data={salesHeatmap} />
      </section>
      <section className="enterprise-grid enterprise-grid-two">
        <EnterpriseTable
          title="Recent Sales Table"
          columns={['Date', 'Client Name', 'Sales Rep', 'Terms', 'Gross Sales', 'GK']}
          rows={recentSalesRows}
        />
        <EnterpriseTable
          title="Rep Performance Table"
          columns={['Sales Rep', 'Leads', 'Closed Deals', 'Gross Sales', 'Target Attainment', 'GK %']}
          rows={repPerformanceRows}
        />
      </section>
    </>
  );
}
