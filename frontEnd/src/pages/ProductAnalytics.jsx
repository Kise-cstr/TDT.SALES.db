import { motion } from 'framer-motion';
import { EnterpriseChart, EnterpriseFilters, EnterpriseTable } from '../components/analytics/EnterpriseWidgets';
import { monthlyGrossSalesTrend, productBreakdownRows, productData } from '../data/enterpriseAnalytics';
import '../styles/dashboard.css';
import '../styles/enterprise.css';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } }
};

export default function ProductAnalytics() {
  return (
    <>
      <motion.div className="dashboard-header" variants={itemVariants} initial="hidden" animate="visible">
        <h1 className="dashboard-title">Product Analytics</h1>
        <p className="dashboard-subtitle">Product sales, revenue breakdown, quantity sold, GK analysis, and contribution mix</p>
      </motion.div>
      <EnterpriseFilters />
      <section className="enterprise-grid enterprise-grid-two">
        <EnterpriseChart title="Top Selling Products" subtitle="Ranked by revenue and market pull" data={productData} keys={['revenue']} />
        <EnterpriseChart title="Product Revenue Breakdown" subtitle="Revenue contribution by product line" type="pie" data={productData.map(product => ({ name: product.label, value: product.contribution }))} />
        <EnterpriseChart title="Product Quantity Sold" subtitle="Movement by item quantity" data={productData} keys={['quantity']} />
        <EnterpriseChart title="Product GK Analysis" subtitle="Gross kita per product family" data={productData} keys={['gk']} />
        <EnterpriseChart title="Product Contribution %" subtitle="Contribution share across top SKUs" data={productData} keys={['contribution']} />
        <EnterpriseChart title="Most Profitable Products" subtitle="GK and revenue side-by-side" data={productData} keys={['revenue', 'gk']} />
        <EnterpriseChart title="Product Sales Trend" subtitle="Monthly revenue and GK movement" type="line" data={monthlyGrossSalesTrend} keys={['sales', 'gk']} />
      </section>
      <EnterpriseTable
        title="Product Breakdown Table"
        columns={['Product', 'Quantity', 'Revenue', 'GK']}
        rows={productBreakdownRows}
      />
    </>
  );
}
