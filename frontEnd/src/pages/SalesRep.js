import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import TopThree from '../components/rankings/TopThree';
import RankingsTable from '../components/rankings/RankingsTable';
import { baseSalesReps } from '../data/salesRepData';
import { filterLiveDashboardData, getLiveDashboardData, getPeriodScopedRows, subscribeLiveData } from '../data/liveDataService';
import { readDashboardFilters, subscribeDashboardFilters } from '../utils/dashboardFilters';
import { enrichReps } from '../utils/salesRepUtils';
import '../styles/dashboard.css';
import '../styles/rankings.css';

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const repKey = value => String(value || 'Unassigned').trim().toLowerCase();

const canonicalBranchByRep = new Map([
  ['marky cabajar', 'Manila']
]);

const resolveRepBranch = (name, branch) => (
  canonicalBranchByRep.get(repKey(name)) || branch || 'Unassigned Branch'
);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const daysInMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const getActivePeriod = filters => (
  filters.timeline && filters.timeline !== 'Disable'
    ? filters.timeline
    : filters.period || 'Monthly'
);

const getQuotaDays = (rows = [], filters = {}) => {
  const datedRows = rows
    .map(record => new Date(record.date))
    .filter(date => !Number.isNaN(date.getTime()));
  const period = getActivePeriod(filters);

  if (period === 'Daily') return 1;
  if (period === 'Weekly') return 7;
  if (filters.range === 'Custom Date Range' && filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      return Math.max(1, Math.floor((startOfDay(end) - startOfDay(start)) / 86400000) + 1);
    }
  }
  if (!datedRows.length) return period === 'Monthly' ? 30 : 1;
  if (period === 'Monthly') return daysInMonth(datedRows.reduce((max, date) => (date > max ? date : max), datedRows[0]));

  const oldest = datedRows.reduce((min, date) => (date < min ? date : min), datedRows[0]);
  const latest = datedRows.reduce((max, date) => (date > max ? date : max), datedRows[0]);
  return Math.max(1, Math.floor((startOfDay(latest) - startOfDay(oldest)) / 86400000) + 1);
};

const getRepRankingValue = (rep, mode = 'all', quotaDays = 1) => {
  if (mode === 'conversionRate') return (toNumber(rep.convertedLeads) / Math.max(1, quotaDays * 10)) * 100;
  if (mode === 'grossKita') return toNumber(rep.totalGkValue);
  return toNumber(rep.grossSalesValue);
};

const buildPreviousPeriodRows = (sourceRows = [], currentRows = [], filters = {}) => {
  const datedCurrentRows = currentRows
    .map(record => ({ record, date: new Date(record.date) }))
    .filter(item => !Number.isNaN(item.date.getTime()));
  if (!datedCurrentRows.length) return [];

  const latest = datedCurrentRows.reduce((max, item) => (item.date > max ? item.date : max), datedCurrentRows[0].date);
  const period = filters.timeline && filters.timeline !== 'Disable'
    ? filters.timeline
    : filters.period || 'Monthly';
  let start;
  let end;

  if (period === 'Daily') {
    start = addDays(startOfDay(latest), -1);
    end = addDays(startOfDay(latest), 0);
  } else if (period === 'Weekly') {
    const currentStart = addDays(startOfDay(latest), -6);
    start = addDays(currentStart, -7);
    end = currentStart;
  } else {
    const currentMonthStart = new Date(latest.getFullYear(), latest.getMonth(), 1);
    start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1);
    end = currentMonthStart;
  }

  return sourceRows.filter(record => {
    const date = new Date(record.date);
    return !Number.isNaN(date.getTime()) && date >= start && date < end;
  });
};

const buildLiveRepRows = (rows = [], previousRankByName = new Map(), roster = []) => {
  const avatarLookup = new Map();
  baseSalesReps.forEach(rep => {
    if (rep.name) avatarLookup.set(rep.name.toLowerCase(), rep.avatar);
    if (rep.code) avatarLookup.set(rep.code.toLowerCase(), rep.avatar);
  });
  const groups = new Map();
  rows.forEach(record => {
    const name = record.salesRep || record.repName || record.repCode || 'Unassigned';
    const key = repKey(name);
    const branch = resolveRepBranch(name, record.branch);
    const current = groups.get(key) || {
      id: `live-${key}`,
      name,
      position: 'Sales Representative',
      accountStatus: 'approved',
      avatar: avatarLookup.get(key),
      branch,
      leadsGathered: 0,
      convertedLeads: 0,
      grossSalesValue: 0,
      totalGkValue: 0,
      previousRank: previousRankByName.get(key)
    };

    current.leadsGathered += 1;
    current.convertedLeads += 1;
    current.grossSalesValue += toNumber(record.grossSales || record.sales);
    current.totalGkValue += toNumber(record.salesmanGk || record.gk || record.finalGk);
    current.branch = resolveRepBranch(current.name, current.branch === 'Unassigned Branch' ? branch : current.branch);
    groups.set(key, current);
  });

  const rosterSource = (Array.isArray(roster) && roster.length ? roster : baseSalesReps).map((rep, index) => ({
    id: rep.id || `roster-${index}`,
    name: rep.name,
    position: rep.position || 'Sales Representative',
    accountStatus: rep.accountStatus || 'approved',
    avatar: rep.avatar || avatarLookup.get(repKey(rep.name)),
    branch: resolveRepBranch(rep.name, rep.branch || rep.department),
    leadsGathered: 0,
    convertedLeads: 0,
    grossSalesValue: 0,
    totalGkValue: 0,
    previousRank: previousRankByName.get(repKey(rep.name)) ?? rep.previousRank ?? null
  }));

  const rosterKeys = new Set(rosterSource.map(rep => repKey(rep.name)));
  const liveEntries = Array.from(groups.values()).map(rep => ({
    ...rep,
    previousRank: previousRankByName.get(repKey(rep.name)) ?? rep.previousRank ?? null
  }));
  const extraLiveEntries = liveEntries.filter(rep => !rosterKeys.has(repKey(rep.name)));

  return [
    ...rosterSource.map(rep => ({
      ...rep,
      ...(groups.get(repKey(rep.name)) || {}),
      name: rep.name,
      branch: resolveRepBranch(rep.name, (groups.get(repKey(rep.name)) || {}).branch || rep.branch),
      avatar: (groups.get(repKey(rep.name)) || {}).avatar || rep.avatar
    })),
    ...extraLiveEntries
  ];
};

const buildPreviousRankMap = (rows = [], rankingMode = 'all', quotaDays = 1) => {
  const previousReps = buildLiveRepRows(rows);
  return new Map(
    previousReps
      .sort((a, b) => {
        const rankingDelta = getRepRankingValue(b, rankingMode, quotaDays) - getRepRankingValue(a, rankingMode, quotaDays);
        if (rankingDelta) return rankingDelta;
        const gkDelta = toNumber(b.totalGkValue) - toNumber(a.totalGkValue);
        if (gkDelta) return gkDelta;
        const salesDelta = toNumber(b.grossSalesValue) - toNumber(a.grossSalesValue);
        if (salesDelta) return salesDelta;
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .map((rep, index) => [repKey(rep.name), index + 1])
  );
};

export default function SalesRep() {
  const [reps] = useState(baseSalesReps);
  const [liveData, setLiveData] = useState(() => getLiveDashboardData());
  const [dashboardFilters, setDashboardFilters] = useState(() => readDashboardFilters());
  const [query, setQuery] = useState('');
  const [rankingMode, setRankingMode] = useState('synced');
  const [sortKey, setSortKey] = useState('rank');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => subscribeLiveData(setLiveData), []);
  useEffect(() => subscribeDashboardFilters(setDashboardFilters), []);

  const filteredRows = useMemo(() => {
    const filteredData = filterLiveDashboardData(liveData, dashboardFilters);
    const rows = Array.isArray(filteredData?.rawRows) ? filteredData.rawRows : [];
    return rows.filter(record => record.date);
  }, [dashboardFilters, liveData]);

  const periodRows = useMemo(() => (
    getPeriodScopedRows(filteredRows, dashboardFilters)
  ), [dashboardFilters, filteredRows]);

  const syncedRankingMode = 'grossKita';
  const activeRankingMode = rankingMode === 'synced' ? syncedRankingMode : rankingMode;
  const rankingOptions = [
    ['synced', 'Top Reps GK Ranking'],
    ['all', 'GS Ranking'],
    ['conversionRate', 'Target Attainment']
  ];

  const previousRows = useMemo(() => (
    buildPreviousPeriodRows(filteredRows, periodRows, dashboardFilters)
  ), [dashboardFilters, filteredRows, periodRows]);

  const previousQuotaDays = useMemo(() => (
    getQuotaDays(previousRows, dashboardFilters)
  ), [dashboardFilters, previousRows]);

  const previousRankByName = useMemo(() => (
    buildPreviousRankMap(previousRows, activeRankingMode, previousQuotaDays)
  ), [activeRankingMode, previousQuotaDays, previousRows]);

  const liveReps = useMemo(() => (
    buildLiveRepRows(periodRows, previousRankByName, reps)
  ), [periodRows, previousRankByName, reps]);

  const quotaDays = useMemo(() => (
    getQuotaDays(periodRows, dashboardFilters)
  ), [dashboardFilters, periodRows]);

  const workforceReps = useMemo(() => liveReps, [liveReps]);

  const rankedReps = useMemo(() => enrichReps(workforceReps, activeRankingMode, quotaDays), [activeRankingMode, quotaDays, workforceReps]);

  const filteredReps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rankedReps.filter(rep => {
      const matchesQuery = !normalizedQuery || rep.name.toLowerCase().includes(normalizedQuery);
      return matchesQuery;
    });
  }, [query, rankedReps]);

  const sortedReps = useMemo(() => {
    return [...filteredReps].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'string') {
        return aValue.localeCompare(bValue) * direction;
      }

      return (aValue - bValue) * direction;
    });
  }, [filteredReps, sortDirection, sortKey]);

  const topThree = rankedReps.slice(0, 3);

  const handleSort = key => {
    if (key === sortKey) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'rank' || key === 'name' || key === 'branch' ? 'asc' : 'desc');
  };

  return (
    <div className="rankings-page">
      <TopThree reps={topThree} />

      <motion.div
        className="rankings-toolbar"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
      >
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search employee..."
        />
        <select value={rankingMode} onChange={event => setRankingMode(event.target.value)}>
          {rankingOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </motion.div>

      <RankingsTable
        reps={sortedReps}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
}
