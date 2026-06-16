import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
import { filterOptions } from '../../data/enterpriseAnalytics';
import '../../styles/enterprise.css';

const orange = 'var(--chart-primary)';
const actualSalesColor = 'var(--chart-primary-strong)';
const targetSalesColor = 'var(--chart-target)';
const amber = 'var(--chart-secondary-soft)';
const green = 'var(--chart-muted-strong)';
const muted = 'var(--chart-axis-text)';
const chartMargin = { top: 14, right: 18, left: -8, bottom: 4 };
const axisTick = { fill: muted, fontSize: 11 };
const pieColors = [
  'var(--chart-primary)',
  'var(--chart-secondary-soft)',
  'var(--chart-primary-strong)',
  'var(--chart-earth)',
  'var(--chart-muted-strong)',
  'var(--chart-brown)'
];
const barColorByKey = {
  actual: actualSalesColor,
  sales: actualSalesColor,
  revenue: actualSalesColor,
  target: targetSalesColor
};
const initialFilters = {
  period: 'Monthly',
  range: 'All Time',
  year: 'All Years',
  month: 'All Months',
  branch: 'all'
};

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="enterprise-tooltip">
      <strong>{label || payload[0].name}</strong>
      {payload.map(item => (
        <span key={item.dataKey || item.name}>
          {item.name || item.dataKey}: {item.payload?.displayValue || (typeof item.value === 'number' ? item.value.toLocaleString() : item.value)}
        </span>
      ))}
    </div>
  );
}

function ChartHeader({ title, subtitle }) {
  return (
    <div className="enterprise-card-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

export const EnterpriseFilters = memo(function EnterpriseFilters({ value, onChange, branches = filterOptions.branches }) {
  const [localFilters, setLocalFilters] = useState(initialFilters);
  const filters = value || localFilters;
  const monthDisabled = filters.period === 'Yearly' || filters.period === 'YTD';

  const update = key => event => {
    const value = event.target.value;
    const updater = current => {
      const next = { ...current, [key]: value };
      if (key === 'period' && (value === 'Yearly' || value === 'YTD')) {
        next.month = 'All Months';
      }
      return next;
    };
    if (onChange) {
      onChange(updater(filters));
    } else {
      setLocalFilters(updater);
    }
  };

  const resetFilters = () => {
    if (onChange) onChange(initialFilters);
    else setLocalFilters(initialFilters);
  };

  return (
    <motion.section
      className="enterprise-filters filter-bar filters-wrapper filters-panel filters-container filters-grid"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <label className="select-wrapper filter-group">
        <span className="filter-label">Period</span>
        <select className="filter-select" value={filters.period} onChange={update('period')}>
          {filterOptions.periods.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="select-wrapper filter-group">
        <span className="filter-label">Year</span>
        <select className="filter-select" value={filters.year} onChange={update('year')}>
          {filterOptions.years.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="select-wrapper filter-group">
        <span className="filter-label">Range</span>
        <select className="filter-select" value={filters.range} onChange={update('range')}>
          {filterOptions.ranges.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="select-wrapper filter-group">
        <span className="filter-label">Month</span>
        <select
          className="filter-select"
          value={filters.month}
          onChange={update('month')}
          disabled={monthDisabled}
        >
          {filterOptions.months.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <button className="filter-reset reset-filter-button reset-button" type="button" onClick={resetFilters}>
        Reset Filters
      </button>
    </motion.section>
  );
});

export const EnterpriseChart = memo(function EnterpriseChart({ title, subtitle, type = 'bar', data = [], keys = ['sales'], height = 280 }) {
  const chartData = Array.isArray(data) ? data : [];
  const chartKeys = Array.isArray(keys) && keys.length ? keys : ['sales'];
  const tooltip = useMemo(() => <TooltipBox />, []);

  return (
    <motion.article
      className="enterprise-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="enterprise-card-glow" />
      <ChartHeader title={title} subtitle={subtitle} />
      <div className="enterprise-chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' ? (
            <LineChart data={chartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={tooltip} cursor={{ stroke: 'var(--chart-cursor-stroke)' }} />
              {chartKeys.map((key, index) => (
                <Line key={key} type="monotone" dataKey={key} name={key} stroke={index ? amber : orange} strokeWidth={3} dot={{ r: 3 }} animationDuration={360} />
              ))}
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={chartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={tooltip} cursor={{ stroke: 'var(--chart-cursor-stroke)' }} />
              <Area type="monotone" dataKey={chartKeys[0]} stroke={orange} fill="var(--chart-area-fill)" strokeWidth={3} animationDuration={360} />
            </AreaChart>
          ) : type === 'pie' ? (
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={3} animationDuration={360}>
                {chartData.map((entry, index) => <Cell key={entry.name || index} fill={pieColors[index % pieColors.length]} />)}
              </Pie>
              <Tooltip content={tooltip} />
            </PieChart>
          ) : (
            <BarChart data={chartData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} angle={chartData.length > 7 ? -18 : 0} textAnchor={chartData.length > 7 ? 'end' : 'middle'} height={chartData.length > 7 ? 56 : 32} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={tooltip} cursor={{ fill: 'var(--chart-hover-fill)' }} />
              {chartKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  fill={barColorByKey[key] || (index === 1 ? green : index === 2 ? amber : orange)}
                  opacity={key === 'target' ? 0.68 : 0.9}
                  radius={[5, 5, 0, 0]}
                  animationDuration={320}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.article>
  );
});

export const HeatmapCard = memo(function HeatmapCard({ data = [] }) {
  const heatmapData = Array.isArray(data) ? data : [];

  return (
    <motion.article className="enterprise-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="enterprise-card-glow" />
      <ChartHeader title="Sales Heatmap by Day" subtitle="High-activity days glow brighter for quick scanning" />
      <div className="enterprise-heatmap">
        {heatmapData.map(item => (
          <div key={item.day} className="enterprise-heatmap-cell" style={{ '--heat': item.level / 100 }}>
            <strong>{item.day}</strong>
            <span>{item.level}%</span>
          </div>
        ))}
      </div>
    </motion.article>
  );
});

export const EnterpriseTable = memo(function EnterpriseTable({ title, columns = [], rows = [] }) {
  const tableColumns = Array.isArray(columns) ? columns : [];
  const tableRows = Array.isArray(rows) ? rows : [];
  const loopRows = tableRows.length ? tableRows : [];
  const shouldLoop = loopRows.length > 4;
  const rowSet = shouldLoop ? [...loopRows, ...loopRows] : loopRows;
  const scrollDuration = `${Math.max(14, loopRows.length * 3.5)}s`;
  const tableKey = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return (
    <motion.article className={`enterprise-table-card enterprise-table-card-${tableKey}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="enterprise-card-header">
        <h2>{title}</h2>
      </div>
      <div className="enterprise-table-shell">
        <table className="enterprise-table enterprise-table-head-table">
          <colgroup>
            {tableColumns.map(column => <col key={column} />)}
          </colgroup>
          <thead>
            <tr>{tableColumns.map(column => <th key={column}>{column}</th>)}</tr>
          </thead>
        </table>
        <div className="enterprise-table-loop-window">
          <table
            className={`enterprise-table enterprise-table-loop${shouldLoop ? ' is-looping' : ''}`}
            style={{ '--table-scroll-duration': scrollDuration }}
          >
            <colgroup>
              {tableColumns.map(column => <col key={column} />)}
            </colgroup>
            <tbody>
              {rowSet.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}-${shouldLoop && rowIndex >= loopRows.length ? 'loop' : 'primary'}`}>
                  {(Array.isArray(row) ? row : []).map((cell, cellIndex) => <td key={`${title}-${rowIndex}-${cellIndex}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.article>
  );
});
