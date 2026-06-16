import { Suspense, lazy, memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import '../styles/dashboard.css';

import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import InteractiveMetricCard from '../components/cards/InteractiveMetricCard';
import { EnterpriseChart, EnterpriseTable } from '../components/analytics/EnterpriseWidgets';
import { useDashboardAnalytics } from '../data/dashboardAnalytics';

const SalesBarChart = lazy(() => import('../components/charts/SalesBarChart'));
const SourcePieChart = lazy(() => import('../components/charts/SourcePieChart'));
const SalesRep = lazy(() => import('./SalesRep'));
const PresentationMode = lazy(() => import('./PresentationMode'));
const AdminPanel = lazy(() => import('./admin/AdminPanel'));
const ManageUploads = lazy(() => import('./admin/ManageUploads'));
const PendingApprovals = lazy(() => import('./admin/PendingApprovals'));
const UserManagement = lazy(() => import('./admin/UserManagement'));
const Profile = lazy(() => import('./Profile'));
const Settings = lazy(() => import('./Settings'));

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.12, when: 'beforeChildren' }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut' }
  }
};

function LoadingSkeleton() {
  return <div className="loading-skeleton" />;
}

const formatCurrency = value => `PHP ${Math.round(Number(value) || 0).toLocaleString()}`;
const metricCopy = {
  all: { label: 'All Metrics' },
  sales: { label: 'Gross Sales' },
  gk: { label: 'GK Value' },
  leads: { label: 'Leads' },
  reps: { label: 'Sales Reps' }
};
const productMetricOptions = [
  { key: 'quantity', label: 'Quantity' },
  { key: 'tons', label: 'Tons' },
  { key: 'sales', label: 'Sales' }
];

const wrapRepName = name => {
  const parts = String(name || 'Unassigned').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return [parts.join(' ')];
  const midpoint = Math.ceil(parts.length / 2);
  return [
    parts.slice(0, midpoint).join(' '),
    parts.slice(midpoint).join(' ')
  ];
};

function RepNameTick({ x, y, payload }) {
  const lines = wrapRepName(payload?.value);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-8}
        y={0}
        textAnchor="end"
        fill="var(--chart-axis-text-strong)"
        fontSize={11}
        fontWeight={850}
      >
        {lines.map((line, index) => (
          <tspan key={line} x={-8} dy={index === 0 ? (lines.length > 1 ? -5 : 4) : 13}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function MetricSet({ cards, duplicate = false }) {
  return (
    <div className="metric-set" aria-hidden={duplicate ? 'true' : undefined}>
      {cards.map(card => (
        <div key={`${duplicate ? 'loop' : 'primary'}-${card.metric}`} className="metric-loop-item">
          <InteractiveMetricCard {...card} />
        </div>
      ))}
    </div>
  );
}

const formatCompactNumber = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});

const formatProductValue = (value, mode) => {
  if (mode === 'sales') return formatCurrency(value);
  if (mode === 'tons') return `${formatCompactNumber(value, value >= 10 ? 1 : 2)} T`;
  return formatCompactNumber(value);
};

function ProductBreakdownGraph({ data }) {
  const [mode, setMode] = useState('quantity');
  const products = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return source
      .map(product => {
        const quantity = Number(product.quantity || product.value || 0);
        const tons = Number(product.tons || product.weight || 0);
        const sales = Number(product.revenue || product.amount || product.sales || 0);
        return {
          label: product.label || product.name || 'Product',
          quantity,
          tons,
          sales
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
  }, [data]);
  const maxValue = Math.max(...products.map(product => product[mode]), 1);

  return (
    <motion.section className="product-breakdown-section" variants={itemVariants} initial="hidden" animate="visible">
      <div className="product-breakdown-header">
        <h2>Product Breakdown</h2>
        <div className="product-metric-toggle" role="tablist" aria-label="Product metric">
          <span className={`product-toggle-indicator product-toggle-indicator-${mode}`} />
          {productMetricOptions.map(option => (
            <button
              key={option.key}
              type="button"
              className={mode === option.key ? 'is-active' : ''}
              onClick={() => setMode(option.key)}
              role="tab"
              aria-selected={mode === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
        <i />
      </div>
      <motion.div className="product-breakdown-grid" layout>
        {products.map(product => {
          const value = product[mode];
          const width = Math.max(1, (value / maxValue) * 100);
          return (
            <motion.article
              className="product-breakdown-card"
              key={`${mode}-${product.label}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              title={`${product.label}: ${formatProductValue(value, mode)}`}
            >
              <strong>{product.label}</strong>
              <span>{formatProductValue(value, mode)}</span>
              <em>
                <motion.b
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
              </em>
            </motion.article>
          );
        })}
      </motion.div>
    </motion.section>
  );
}


function TopRepsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="top-reps-tooltip">
      <strong>{label}</strong>
      <span>total GK: {formatCurrency(payload[0].value)}</span>
    </div>
  );
}

function SalesRepRankingGraph({ reps }) {
  const topReps = useMemo(
    () => (Array.isArray(reps) ? reps : [])
      .map(rep => ({
        label: rep.label || rep.name || 'Unassigned',
        gk: Number(rep.salesmanGk || rep.gk || rep.finalGk || 0),
        sales: Number(rep.sales || 0)
      }))
      .map(rep => ({ ...rep, totalGk: rep.gk || rep.sales }))
      .sort((a, b) => b.totalGk - a.totalGk)
      .slice(0, 8),
    [reps]
  );
  const chartHeight = Math.max(330, topReps.length * 46 + 92);

  return (
    <motion.section className="top-reps-section" variants={itemVariants} initial="hidden" animate="visible">
      <div className="top-reps-header">
        <div>
          <h2>Top Reps</h2>
          <p>Top performers by total GK</p>
        </div>
      </div>
      <div className="top-reps-chart" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topReps} layout="vertical" margin={{ top: 18, right: 36, left: 18, bottom: 26 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="var(--chart-grid)" />
            <XAxis type="number" tick={{ fill: 'var(--chart-axis-text)', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={152} tick={<RepNameTick />} axisLine={false} tickLine={false} interval={0} />
            <Tooltip
              cursor={{ fill: 'var(--chart-hover-fill)' }}
              content={<TopRepsTooltip />}
              wrapperStyle={{ zIndex: 20, pointerEvents: 'none' }}
              allowEscapeViewBox={{ x: false, y: true }}
            />
            <Bar dataKey="totalGk" fill="var(--chart-primary-strong)" radius={[0, 8, 8, 0]} animationDuration={850} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}

const MainDashboard = memo(function MainDashboard() {
  const analytics = useDashboardAnalytics();
  const { filters } = analytics;
  const cards = analytics.cards;
  const activeMetric = metricCopy[filters.metric] ? filters.metric : 'all';
  const salesPerformance = analytics.salesPerformance;
  const activeCounterData = analytics.counterData;
  const activeSourceData = analytics.termsData;
  const activeRecentSalesRows = analytics.recentSalesRows;
  const activeRepPerformanceRows = analytics.repPerformanceRows;
  const activeProductData = analytics.productData;
  const activeRepData = analytics.salesByRep;

  return (
    <div className="main-dashboard">
      <motion.div className="metric-wrapper kpi-grid-wrapper dashboard-grid" variants={containerVariants} initial="hidden" animate="visible">
        <div className="metric-track">
          <MetricSet cards={cards} />
          <MetricSet cards={cards} duplicate />
        </div>
      </motion.div>

      <motion.div className="charts-grid chart-grid charts-grid-main" variants={containerVariants} initial="hidden" animate="visible">
        <motion.div variants={itemVariants}>
          <Suspense fallback={<LoadingSkeleton />}>
            <SalesBarChart data={salesPerformance} metric={activeMetric} period={filters.period} />
          </Suspense>
        </motion.div>
      </motion.div>

      <section className="enterprise-grid enterprise-grid-two">
        <EnterpriseChart
          title="Sales Performance"
          subtitle="Closed deals, retention, and acquisition"
          data={activeCounterData}
          keys={['count']}
        />
        <Suspense fallback={<LoadingSkeleton />}>
          <SourcePieChart sourceData={activeSourceData} />
        </Suspense>
      </section>

      <section className="dashboard-rep-ranking-layout">
        <SalesRepRankingGraph reps={activeRepData} />
      </section>

      <ProductBreakdownGraph data={activeProductData} />

      <section className="enterprise-grid dashboard-table-stack">
        <EnterpriseTable
          title="Recent Sales Table"
          columns={['Date', 'Client Name', 'Sales Rep', 'Terms', 'Gross Sales', 'GK']}
          rows={activeRecentSalesRows}
        />
        <EnterpriseTable
          title="Rep Performance Table"
          columns={['Sales Rep', 'Leads', 'Closed Deals', 'Gross Sales', 'Target Attainment', 'GK %']}
          rows={activeRepPerformanceRows}
        />
      </section>
    </div>
  );
});

const routeLoading = <div className="route-loading" />;

export default function Dashboard({ onLogout }) {
  const { pathname } = useLocation();

  const routeContent = useMemo(() => ({
    '/dashboard': <MainDashboard />,
    '/presentation': <Suspense fallback={routeLoading}><PresentationMode /></Suspense>,
    '/sales-team': <Suspense fallback={routeLoading}><SalesRep /></Suspense>,
    '/sales-reps': <Suspense fallback={routeLoading}><SalesRep /></Suspense>,
    '/rankings': <Suspense fallback={routeLoading}><SalesRep /></Suspense>,
    '/performance-board': <MainDashboard />,
    '/profile': <Suspense fallback={routeLoading}><Profile /></Suspense>,
    '/admin': <Suspense fallback={routeLoading}><AdminPanel /></Suspense>,
    '/admin/uploads': <Suspense fallback={routeLoading}><ManageUploads /></Suspense>,
    '/admin/pending-approvals': <Suspense fallback={routeLoading}><PendingApprovals /></Suspense>,
    '/admin/user-management': <Suspense fallback={routeLoading}><UserManagement /></Suspense>,
    '/admin/users': <Suspense fallback={routeLoading}><UserManagement /></Suspense>,
    '/settings': <Suspense fallback={routeLoading}><Settings /></Suspense>
  }), []);

  return (
    <DashboardLayout onLogout={onLogout}>
      {routeContent[pathname] || <MainDashboard />}
    </DashboardLayout>
  );
}
