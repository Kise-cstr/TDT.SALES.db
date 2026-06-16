import { motion } from 'framer-motion';
import { EnterpriseChart, EnterpriseFilters } from '../components/analytics/EnterpriseWidgets';
import { termsData } from '../data/enterpriseAnalytics';
import '../styles/dashboard.css';
import '../styles/enterprise.css';

export default function RepData() {
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.28, ease: 'easeOut' }
    }
  };

  return (
    <>
        <motion.div
          className="dashboard-header"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <h1 className="dashboard-title">Terms Analytics</h1>
          <p className="dashboard-subtitle">
            Terms distribution, sales per terms, most used terms, and GK per terms
          </p>
        </motion.div>

        <EnterpriseFilters />
        <section className="enterprise-grid enterprise-grid-two">
          <EnterpriseChart title="Terms Distribution" subtitle="Usage count for FT, REP, 1DLM, 1Aga, 1Mrky, and 1Mldy" data={termsData} keys={['count']} />
          <EnterpriseChart title="Sales per Terms" subtitle="Gross sales grouped by terms" data={termsData} keys={['sales']} />
          <EnterpriseChart title="Most Used Terms" subtitle="Highest transaction count by terms" type="pie" data={termsData.map(item => ({ name: item.label, value: item.count }))} />
          <EnterpriseChart title="GK per Terms" subtitle="Gross kita contribution per terms" data={termsData} keys={['gk']} />
        </section>
    </>
  );
}
