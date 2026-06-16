import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  kpiProgressData,
  monthlyGrossSalesTrend,
  productBreakdownRows,
  productData,
  repPerformanceRows,
  salesByRep
} from '../data/enterpriseAnalytics';
import {
  filterLiveDashboardData,
  getLiveDashboardData,
  subscribeLiveData
} from '../data/liveDataService';
import {
  readDashboardFilters,
  subscribeDashboardFilters
} from '../utils/dashboardFilters';
import '../styles/dashboard.css';
import '../styles/enterprise.css';

const orange = '#f97316';
const amber = '#ffb15a';
const muted = 'rgba(214, 220, 226, 0.58)';
const chartColors = ['#f97316', '#fb923c', '#d96a1f', '#9a5a2e', '#737373', '#ffc46d', '#4b5563'];
const pageMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
};

const currency = value => `PHP ${Math.round(Number(value) || 0).toLocaleString()}`;
const compactCurrency = value => {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1000000) return `PHP ${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
  if (Math.abs(number) >= 1000) return `PHP ${(number / 1000).toFixed(0)}K`;
  return currency(number);
};
const shortLabel = value => String(value || '').replace(/^Total\s+/i, '').replace(/\(([^)]*)\)/, '$1').replace(/,+/g, '').trim();

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <strong>{label || payload[0].name}</strong>
      {payload.map(item => (
        <span key={item.dataKey || item.name}>
          {item.name || item.dataKey}: {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
        </span>
      ))}
    </div>
  );
}

function AnalyticsCard({ title, subtitle, children, className = '' }) {
  return (
    <motion.article className={`analytics-card ${className}`} variants={pageMotion} initial="hidden" animate="visible">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="analytics-card-body">{children}</div>
    </motion.article>
  );
}

function AnalyticsTable({ title, subtitle, columns, rows }) {
  return (
    <AnalyticsCard title={title} subtitle={subtitle} className="analytics-table-card">
      <div className="analytics-table-scroll">
        <table>
          <thead>
            <tr>{columns.map(column => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => <td key={`${title}-${rowIndex}-${cellIndex}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnalyticsCard>
  );
}

export default function Analytics() {
  const [liveData, setLiveData] = useState(() => getLiveDashboardData());
  const [filters, setFilters] = useState(() => readDashboardFilters());

  useEffect(() => subscribeLiveData(setLiveData), []);
  useEffect(() => subscribeDashboardFilters(setFilters), []);

  const filteredLiveData = useMemo(() => filterLiveDashboardData(liveData, filters), [filters, liveData]);
  const hasLiveRows = Boolean(liveData?.rawRows?.length || liveData?.productRows?.length);
  const activeData = hasLiveRows ? filteredLiveData : {};

  const monthlySales = useMemo(() => {
    const rows = activeData.salesPerformance?.length ? activeData.salesPerformance : monthlyGrossSalesTrend;
    return rows.map(row => ({
      label: shortLabel(row.label),
      sales: Number(row.sales || 0),
      gk: Number(row.gk || 0),
      target: Number(row.target || 0)
    }));
  }, [activeData.salesPerformance]);

  const products = useMemo(() => {
    const rows = activeData.productData?.length ? activeData.productData : productData;
    return rows.map(row => ({
      label: shortLabel(row.label || row.name),
      quantity: Number(row.quantity || 0),
      tons: Number(row.tons || 0),
      revenue: Number(row.revenue || row.amount || row.value || 0),
      gk: Number(row.gk || 0),
      contribution: Number(row.contribution || 0)
    })).sort((a, b) => b.revenue - a.revenue);
  }, [activeData.productData]);

  const reps = useMemo(() => {
    const rows = activeData.salesByRep?.length ? activeData.salesByRep : salesByRep;
    const sortKey = filters.metric === 'gk'
      ? 'gk'
      : filters.metric === 'leads'
        ? 'leads'
        : filters.metric === 'reps'
          ? 'deals'
          : 'sales';
    return rows.map(row => ({
      label: shortLabel(row.label),
      sales: Number(row.sales || 0),
      leads: Number(row.leads || 0),
      deals: Number(row.deals || 0),
      gk: Number(row.gk || 0)
    })).sort((a, b) => b[sortKey] - a[sortKey]);
  }, [activeData.salesByRep, filters.metric]);

  const teamRows = useMemo(() => (
    activeData.repPerformanceRows?.length ? activeData.repPerformanceRows : repPerformanceRows
  ), [activeData.repPerformanceRows]);

  const productRows = useMemo(() => (
    products.length
      ? products.map(product => [
        product.label,
        product.quantity.toLocaleString(),
        currency(product.revenue),
        currency(product.gk)
      ])
      : productBreakdownRows
  ), [products]);

  const repPerformance = reps.slice(0, 10).map(rep => ({
    label: rep.label,
    leads: rep.leads,
    deals: rep.deals
  }));
  const productMix = products.slice(0, 8).map(product => ({
    name: product.label,
    value: product.revenue || product.quantity || product.tons
  }));
  const progressData = hasLiveRows
    ? [
      { label: 'Gross Sales', completion: 100, actual: activeData.totals?.sales || 0 },
      { label: 'GK', completion: activeData.totals?.sales ? Math.round(((activeData.totals?.gk || 0) / activeData.totals.sales) * 100) : 0, actual: activeData.totals?.gk || 0 },
      { label: 'Leads', completion: activeData.totals?.rows || 0, actual: activeData.totals?.rows || 0 },
      { label: 'Closed Deals', completion: reps.reduce((sum, rep) => sum + rep.deals, 0), actual: reps.reduce((sum, rep) => sum + rep.deals, 0) }
    ]
    : kpiProgressData;

  return (
    <main className="analytics-dashboard">
      <motion.div className="analytics-page-title" variants={pageMotion} initial="hidden" animate="visible">
        <div>
          <h1>Analytics</h1>
          <p>Filtered sales, product, and team performance from uploaded data</p>
        </div>
      </motion.div>

      <section className="analytics-table-grid">
        <AnalyticsTable
          title="Team Activity"
          subtitle="Sales rep conversion and GK performance"
          columns={['Sales Rep', 'Leads', 'Closed Deals', 'Gross Sales', 'Target Attainment', 'GK %']}
          rows={teamRows}
        />
        <AnalyticsTable
          title="Product Summary"
          subtitle="Revenue, quantity, and GK by detected product"
          columns={['Product', 'Quantity', 'Revenue', 'GK']}
          rows={productRows}
        />
      </section>

      <section className="analytics-chart-grid">
        <AnalyticsCard title="Monthly Sales" subtitle="Sales, target, and GK from uploaded data">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlySales} margin={{ top: 14, right: 18, left: 4, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="label" tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={58} tickFormatter={compactCurrency} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Legend wrapperStyle={{ color: '#d6dce2', fontSize: 11 }} />
              <Line type="monotone" dataKey="sales" name="Gross Sales" stroke={orange} strokeWidth={3} dot={{ r: 4 }} animationDuration={650} />
              <Line type="monotone" dataKey="gk" name="GK" stroke={amber} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={650} />
              <Bar dataKey="target" name="Target" fill="rgba(255,255,255,0.16)" radius={[5, 5, 0, 0]} maxBarSize={42} />
            </ComposedChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        <AnalyticsCard title="Products" subtitle="Filtered top product revenue">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={products.slice(0, 10)} margin={{ top: 14, right: 14, left: 4, bottom: 38 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="label" interval={0} angle={-12} textAnchor="end" height={54} tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} tickFormatter={compactCurrency} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="url(#analyticsOrangeBars)" radius={[7, 7, 0, 0]} maxBarSize={74} animationDuration={600} />
              <defs>
                <linearGradient id="analyticsOrangeBars" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        <AnalyticsCard title="Product Mix" subtitle="Revenue share by product">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={productMix} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="78%" paddingAngle={2} stroke="#dedede" strokeWidth={1.5} animationDuration={650}>
                {productMix.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip content={<AnalyticsTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        <AnalyticsCard title="Team Rankings" subtitle="Sales by representative from uploaded data">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reps.slice(0, 10)} margin={{ top: 14, right: 12, left: 4, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="label" interval={0} angle={-18} textAnchor="end" height={62} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={58} tickFormatter={compactCurrency} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Bar dataKey="sales" name="Sales" fill="#c65f1a" radius={[7, 7, 0, 0]} maxBarSize={58} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        <AnalyticsCard title="Rep Performance" subtitle="Leads and closed deals by rep">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={repPerformance} margin={{ top: 14, right: 12, left: 2, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="label" interval={0} angle={-18} textAnchor="end" height={62} tick={{ fill: muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Legend wrapperStyle={{ color: '#d6dce2', fontSize: 11 }} />
              <Bar dataKey="leads" name="Leads" fill={orange} radius={[6, 6, 0, 0]} maxBarSize={30} animationDuration={600} />
              <Bar dataKey="deals" name="Closed Deals" fill="#a3a3a3" radius={[6, 6, 0, 0]} maxBarSize={30} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        <AnalyticsCard title="KPI Progress" subtitle="Completion by category from uploaded data">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={progressData} margin={{ top: 14, right: 14, left: 2, bottom: 18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="label" tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Bar dataKey="completion" name="Completion" fill={orange} radius={[7, 7, 0, 0]} maxBarSize={86} animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      </section>
    </main>
  );
}
