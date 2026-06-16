import { motion } from 'framer-motion';
import { EnterpriseChart, EnterpriseFilters } from '../components/analytics/EnterpriseWidgets';
import { leadSourceData, monthlyGrossSalesTrend } from '../data/enterpriseAnalytics';
import '../styles/dashboard.css';
import '../styles/enterprise.css';

export default function LeadSources() {
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
          <h1 className="dashboard-title">Lead Sources</h1>
          <p className="dashboard-subtitle">
            Analyze and manage your lead sources and conversion rates
          </p>
        </motion.div>

        <EnterpriseFilters />
        <section className="enterprise-grid enterprise-grid-two">
          <EnterpriseChart title="Lead Source Distribution" subtitle="Lead mix across all active source channels" data={leadSourceData} keys={['leads']} />
          <EnterpriseChart title="Leads per Source" subtitle="Volume by source channel" data={leadSourceData} keys={['leads']} />
          <EnterpriseChart title="Lead Conversion per Source" subtitle="Conversion rate by source" data={leadSourceData} keys={['conversion']} />
          <EnterpriseChart title="Monthly Lead Trend" subtitle="Lead activity overlay against sales month" type="line" data={monthlyGrossSalesTrend.map(item => ({ label: item.label, leads: Math.round(item.sales / 12500) }))} keys={['leads']} />
          <EnterpriseChart title="Top Lead Source" subtitle="Best converting source channels" data={[...leadSourceData].sort((a, b) => b.conversion - a.conversion).slice(0, 5)} keys={['conversion']} />
          <EnterpriseChart title="Closed Deals per Source" subtitle="Closed won outcomes by lead source" data={leadSourceData} keys={['deals']} />
        </section>
    </>
  );
}
