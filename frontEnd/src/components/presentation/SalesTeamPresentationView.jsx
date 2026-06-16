import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  salesTeamPresentationActivity,
  salesTeamPresentationMetrics,
  salesTeamPresentationRankings,
  salesTeamPresentationTopReps
} from '../../data/presentationData';
import { presentationDateRanges, presentationTitles } from '../../utils/presentationVariant';
import { filterLiveDashboardData, getLiveDashboardData, getPeriodScopedRows, subscribeLiveData } from '../../data/liveDataService';
import { readDashboardFilters, subscribeDashboardFilters, writeDashboardFilters } from '../../utils/dashboardFilters';
import '../../styles/presentation-palette.css';

const rankLabels = ['1st', '2nd', '3rd'];

const formatCompactCurrency = value => {
  const amount = Number(value) || 0;
  if (amount >= 1000000) return `PHP ${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}M`;
  if (amount >= 1000) return `PHP ${Math.round(amount / 1000)}K`;
  return `PHP ${Math.round(amount).toLocaleString()}`;
};

const buildPeriodSalesByRep = (rows = []) => {
  const groups = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const label = String(row.salesRep || row.repName || row.repCode || 'Unassigned').trim() || 'Unassigned';
    const key = label.toUpperCase();
    const current = groups.get(key) || { label, sales: 0, gk: 0, deals: 0 };
    current.sales += Number(row.grossSales || row.sales || 0);
    current.gk += Number(row.salesmanGk || row.gk || row.finalGk || 0);
    current.deals += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values());
};

const buildTeamPresentationData = (liveData, metric = 'all', filters = {}) => {
  const periodRows = getPeriodScopedRows(Array.isArray(liveData?.rawRows) ? liveData.rawRows : [], filters);
  const periodReps = buildPeriodSalesByRep(periodRows);
  const liveReps = periodReps.length ? periodReps : Array.isArray(liveData?.salesByRep) ? liveData.salesByRep : [];
  if (!liveReps.length) {
    return {
      metrics: salesTeamPresentationMetrics,
      topReps: salesTeamPresentationTopReps,
      rankings: salesTeamPresentationRankings,
      activity: salesTeamPresentationActivity
    };
  }

  const sortKey = metric === 'sales' ? 'sales' : 'gk';
  const ranked = [...liveReps].sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));
  const totalSales = ranked.reduce((sum, rep) => sum + (Number(rep.sales) || 0), 0);
  const totalGk = ranked.reduce((sum, rep) => sum + (Number(rep.gk) || 0), 0);
  const totalDeals = ranked.reduce((sum, rep) => sum + (Number(rep.deals) || 0), 0);
  const topRep = ranked[0];

  return {
    metrics: [
      { label: 'Active Reps', value: String(ranked.length), detail: 'From selected period' },
      { label: 'Top Performer', value: topRep?.label || 'N/A', detail: metric === 'sales' ? formatCompactCurrency(topRep?.sales) : formatCompactCurrency(topRep?.gk) },
      { label: 'Deals Converted', value: totalDeals.toLocaleString(), detail: 'Selected period' },
      { label: 'Converted', value: totalDeals.toLocaleString(), detail: 'Completed sales orders' },
      { label: 'Gross Sales', value: formatCompactCurrency(totalSales), detail: 'Selected period' },
      { label: 'GK Value', value: formatCompactCurrency(totalGk), detail: 'Selected period' }
    ],
    topReps: ranked.slice(0, 3).map((rep, index) => ({
      rank: index + 1,
      name: rep.label || 'Unassigned',
      department: 'Sales',
      performance: rep.sales ? `${Math.round((Number(rep.gk || 0) / Number(rep.sales || 1)) * 100)}%` : '0%',
      converted: Number(rep.deals || 0),
      sales: metric === 'sales' ? formatCompactCurrency(rep.sales) : formatCompactCurrency(rep.gk)
    })),
    rankings: ranked.map((rep, index) => ({
      rank: index + 1,
      name: rep.label || 'Unassigned',
      sales: metric === 'sales' ? formatCompactCurrency(rep.sales) : formatCompactCurrency(rep.gk),
      deals: Number(rep.deals || 0),
      gk: formatCompactCurrency(rep.gk)
    })),
    activity: ranked.slice(0, 8).map(rep => ({
      label: String(rep.label || 'Rep').split(' ')[0],
      deals: Number(rep.deals || 0),
      sales: Math.round(Number(rep.sales || 0) / 1000),
      gkValue: Math.round(Number(rep.gk || 0) / 1000)
    }))
  };
};

export default function SalesTeamPresentationView({ onExit }) {
  const { cycleIndex, refreshCount } = usePresentationCycle(4);
  const [liveData, setLiveData] = useState(() => getLiveDashboardData());
  const [filters, setFilters] = useState(() => readDashboardFilters());
  const filteredLiveData = useMemo(() => filterLiveDashboardData(liveData, filters), [filters, liveData]);
  const teamData = useMemo(() => buildTeamPresentationData(filteredLiveData, filters.metric, filters), [filteredLiveData, filters]);
  const refreshLabel = useMemo(
    () => `Team refresh ${refreshCount + 1} · live rankings`,
    [refreshCount]
  );
  const salesOutputKey = filters.metric === 'sales' ? 'sales' : 'gkValue';

  useEffect(() => subscribeLiveData(setLiveData), []);
  useEffect(() => subscribeDashboardFilters(setFilters), []);

  const updateFilter = (key, value) => {
    setFilters(writeDashboardFilters({ [key]: value }));
  };

  return (
    <motion.div
      className="presentation-shell presentation-shell-sales-team"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <PresentationHeader
        title={presentationTitles['sales-team']}
        dateRange={presentationDateRanges['sales-team']}
        filters={filters}
        onFilterChange={updateFilter}
        onExit={onExit}
        refreshLabel={refreshLabel}
      />
      <PresentationMetrics metrics={teamData.metrics} />

      <motion.main
        className="presentation-analytics-grid presentation-grid-sales-team"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
        }}
      >
        <motion.section className={`presentation-panel presentation-team-podium ${cycleIndex === 0 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Top Performers" subtitle="Current period leaders" />
          <div className="presentation-podium-grid">
            {teamData.topReps.map(rep => (
              <article className={`presentation-podium-card presentation-podium-${rep.rank}`} key={rep.name}>
                <span className="presentation-podium-rank">{rankLabels[rep.rank - 1]}</span>
                <h3>{rep.name}</h3>
                <p>{rep.department}</p>
                <strong>{rep.sales}</strong>
                <div className="presentation-podium-stats">
                  <span>{rep.performance}</span>
                  <small>{rep.converted} deals converted</small>
                </div>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-ranking-panel ${cycleIndex === 1 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Team Rankings" subtitle="Revenue and deal performance" />
          <div className="presentation-ranking-table presentation-ranking-table-wide">
            {teamData.rankings.map(rep => (
              <div className="presentation-ranking-row" key={rep.name}>
                <span>{rep.rank}</span>
                <strong>{rep.name}</strong>
                <em>{rep.sales}</em>
                <small>{rep.deals} deals converted</small>
                <small>{rep.gk} GK</small>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-team-activity ${cycleIndex === 2 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title="Rep Activity" subtitle="Closed deals by representative" />
          <div className="presentation-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamData.activity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(95,95,95,0.28)" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<PresentationTooltip />} />
                <Bar dataKey="deals" name="Deals" fill="#D16002" radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section className={`presentation-panel presentation-team-sales ${cycleIndex === 3 ? 'presentation-panel-live' : ''}`} variants={panelVariant}>
          <PresentationPanelHeader title={filters.metric === 'sales' ? 'Sales Output' : 'GK Output'} subtitle={filters.metric === 'sales' ? 'Gross sales by top representatives (PHP K)' : 'GK value by top representatives (PHP K)'} />
          <div className="presentation-chart-fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamData.activity} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(95,95,95,0.28)" horizontal={false} />
                <XAxis type="number" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<PresentationTooltip />} />
                <Bar dataKey={salesOutputKey} name={filters.metric === 'sales' ? 'Sales (K)' : 'GK (K)'} fill="#CC5500" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </motion.main>
    </motion.div>
  );
}
