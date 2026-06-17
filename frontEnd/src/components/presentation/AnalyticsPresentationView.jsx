import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import PresentationHeader from './PresentationHeader';
import PresentationMetrics from './PresentationMetrics';
import {
  panelVariant,
  PresentationPanelHeader,
  PresentationTooltip,
  usePresentationCycle
} from './presentationShared';
import {
  analyticsDailySales,
  analyticsMonthlySales,
  analyticsPresentationHeatmap,
  analyticsPresentationKpi,
  analyticsPresentationLeadSources,
  analyticsPresentationMetrics,
  analyticsPresentationProducts
} from '../../data/presentationData';
import { filterLiveDashboardData, getLiveDashboardData, subscribeLiveData } from '../../data/liveDataService';
import { readDashboardFilters, subscribeDashboardFilters } from '../../utils/dashboardFilters';
import { presentationDateRanges, presentationTitles } from '../../utils/presentationVariant';
import '../../styles/presentation-palette.css';

const sourceColors = ['#D16002', '#CC5500', '#ff9f43', '#f8bd6b', '#8a5f4f', '#5f5f5f'];
const toNumber = value => Number(value) || 0;
const compactCurrency = value => {
  const amount = toNumber(value);
  if (amount >= 1000000) return `PHP ${(amount / 1000000).toFixed(amount >= 100000000 ? 0 : 1)}M`;
  if (amount >= 1000) return `PHP ${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1)}K`;
  return `PHP ${Math.round(amount).toLocaleString()}`;
};

const formatTons = value => `${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;

const buildLiveAnalytics = liveData => {
  const hasSalesRows = Array.isArray(liveData?.rawRows) && liveData.rawRows.length > 0;
  const hasProductRows = Array.isArray(liveData?.productRows) && liveData.productRows.length > 0;
  if (!hasSalesRows && !hasProductRows) return null;
  const sales = toNumber(liveData.totals?.sales);
  const gk = toNumber(liveData.totals?.fob ?? liveData.totals?.gk);
  const leads = toNumber(liveData.totals?.rows);
  const closed = hasSalesRows ? liveData.rawRows.filter(row => toNumber(row.grossSales || row.sales) > 0).length : 0;
  const topSource = liveData.sourceData?.[0];
  const salesSeries = (liveData.salesPerformance || []).map(row => ({ label: row.label, sales: row.sales, target: row.target || 0 }));
  const productTotal = (liveData.productData || []).reduce((sum, item) => sum + toNumber(item.revenue || item.tons || item.quantity), 0) || 1;
  const totalTons = toNumber(
    liveData.totals?.totalTonsKPI
    ?? liveData.totals?.allBranchTons
    ?? liveData.totals?.tons
  );

  return {
    metrics: [
      { label: 'Gross Sales', value: compactCurrency(sales), detail: `${leads} uploaded rows` },
      { label: 'GK Value', value: compactCurrency(gk), detail: `${sales ? Math.round((gk / sales) * 1000) / 10 : 0}% of GS` },
      { label: 'Leads', value: leads.toLocaleString(), detail: 'From SO Date-filtered data' },
      { label: 'Closed Deals', value: closed.toLocaleString(), detail: `${leads ? Math.round((closed / leads) * 100) : 0}% conversion` },
      { label: 'Total Tons', value: formatTons(totalTons), detail: 'Verified product tonnage' },
      { label: 'Top Source', value: topSource?.label || 'N/A', detail: `${topSource?.leads || topSource?.count || 0} leads` }
    ],
    dailySales: salesSeries,
    monthlySales: salesSeries,
    leadSources: (liveData.sourceData || []).slice(0, 6).map((source, index) => ({
      name: source.label,
      value: source.leads || source.count || 0,
      color: sourceColors[index % sourceColors.length]
    })),
    products: (liveData.productData || []).map((product, index) => {
      const value = toNumber(product.revenue || product.tons || product.quantity);
      return {
        name: product.label,
        value: Math.round((value / productTotal) * 1000) / 10,
        color: sourceColors[index % sourceColors.length]
      };
    }),
    kpi: [
      { label: 'GS', actual: sales, target: sales, completion: sales ? 100 : 0 },
      { label: 'GK', actual: gk, target: gk, completion: gk ? 100 : 0 },
      { label: 'Leads', actual: leads, target: leads, completion: leads ? 100 : 0 },
      { label: 'Closed', actual: closed, target: leads, completion: leads ? Math.round((closed / leads) * 1000) / 10 : 0 }
    ],
    heatmap: analyticsPresentationHeatmap
  };
};

export default function AnalyticsPresentationView({ onExit }) {
  const { cycleIndex, refreshCount } = usePresentationCycle(6);
  const [liveData, setLiveData] = useState(() => getLiveDashboardData());
  const [filters, setFilters] = useState(() => readDashboardFilters());
  const [isProductChartReady, setIsProductChartReady] = useState(false);
  const filteredLiveData = useMemo(() => filterLiveDashboardData(liveData, filters), [filters, liveData]);
  const liveAnalytics = useMemo(() => buildLiveAnalytics(filteredLiveData), [filteredLiveData]);
  const refreshLabel = useMemo(
    () => `Analytics refresh ${refreshCount + 1} · live data`,
    [refreshCount]
  );

  const metrics = liveAnalytics?.metrics || analyticsPresentationMetrics;
  const dailySales = liveAnalytics?.dailySales?.length ? liveAnalytics.dailySales : analyticsDailySales;
  const monthlySales = liveAnalytics?.monthlySales?.length ? liveAnalytics.monthlySales : analyticsMonthlySales;
  const leadSources = liveAnalytics?.leadSources?.length ? liveAnalytics.leadSources : analyticsPresentationLeadSources;
  const products = liveAnalytics?.products?.length ? liveAnalytics.products : analyticsPresentationProducts;
  const kpi = liveAnalytics?.kpi?.length ? liveAnalytics.kpi : analyticsPresentationKpi;
  const heatmap = liveAnalytics?.heatmap || analyticsPresentationHeatmap;

  useEffect(() => subscribeLiveData(setLiveData), []);
  useEffect(() => subscribeDashboardFilters(setFilters), []);
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        setIsProductChartReady(true);
        window.dispatchEvent(new Event('resize'));
      }, 180);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <motion.div
      className="presentation-shell presentation-shell-analytics"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <PresentationHeader
        title={presentationTitles.analytics}
        dateRange={presentationDateRanges.analytics}
        onExit={onExit}
        refreshLabel={refreshLabel}
      />
      <PresentationMetrics metrics={metrics} />

      <motion.main
        className="presentation-analytics-grid presentation-grid-analytics"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
        }}
      >
        <motion.section className={`presentation-panel presentation-analytics-daily ${cycleIndex === 0 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Sales Overview" subtitle="Daily revenue movement" />
          <div className="presentation-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySales} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(95,95,95,0.28)" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<PresentationTooltip />} />
                <Area type="monotone" dataKey="sales" name="Sales" fill="#D16002" fillOpacity={0.16} stroke="#ff9f43" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-analytics-monthly ${cycleIndex === 1 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Monthly Sales" subtitle="Actual sales vs operating target" />
          <div className="presentation-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySales} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(95,95,95,0.28)" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<PresentationTooltip />} />
                <Line type="monotone" dataKey="sales" name="Sales" stroke="#D16002" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="target" name="Target" stroke="#CC5500" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-analytics-sources ${cycleIndex === 2 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Lead Sources" subtitle="Top channels by lead volume" />
          <div className="presentation-source-list">
            {leadSources.map(source => (
              <div className="presentation-source-row" key={source.name}>
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.value} leads</span>
                </div>
                <div className="presentation-source-meter">
                  <span style={{ width: `${Math.min(100, source.value / 1.8)}%`, background: source.color }} />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-analytics-products ${cycleIndex === 3 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Product Mix" subtitle="Contribution share by product" />
          <div className="presentation-chart-fill">
            {isProductChartReady && products.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={320}>
              <PieChart>
                <Pie data={products} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="74%" paddingAngle={3}>
                  {products.map(product => (
                    <Cell key={product.name} fill={product.color} />
                  ))}
                </Pie>
                <Tooltip content={<PresentationTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <div className="products-donut-placeholder" aria-hidden="true" />
            )}
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-analytics-kpi ${cycleIndex === 4 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="KPI Progress" subtitle="Completion against targets" />
          <div className="presentation-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpi} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(95,95,95,0.28)" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<PresentationTooltip />} />
                <Bar dataKey="completion" name="Completion %" fill="#D16002" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-analytics-heatmap ${cycleIndex === 5 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Weekly Intensity" subtitle="Sales activity heatmap by day" />
          <div className="presentation-heatmap-list">
            {heatmap.map(day => (
              <div className="presentation-heatmap-row" key={day.day}>
                <span>{day.day}</span>
                <div className="presentation-heatmap-meter">
                  <span style={{ width: `${day.level}%` }} />
                </div>
                <strong>{day.level}%</strong>
              </div>
            ))}
          </div>
        </motion.section>
      </motion.main>
    </motion.div>
  );
}
