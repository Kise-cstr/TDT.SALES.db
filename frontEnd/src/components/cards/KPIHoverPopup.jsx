import { memo } from 'react';
import { FiArrowDownRight, FiArrowUpRight } from 'react-icons/fi';
import { GoDotFill } from 'react-icons/go';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

const orange = '#f97316';
const actualSalesColor = '#c65f1a';
const targetSalesColor = '#8a5f4f';
const amber = '#f8bd6b';
const muted = 'rgba(255,255,255,0.62)';
const smallAxisTick = { fill: muted, fontSize: 10 };
const verticalAxisTick = { fill: 'rgba(255,255,255,0.72)', fontSize: 10 };
const lineMargin = { top: 8, right: 6, left: -28, bottom: 0 };
const barMargin = { top: 8, right: 4, left: -24, bottom: 0 };
const areaMargin = { top: 6, right: 8, left: 0, bottom: 6 };
const tooltipElement = <PopupTooltip />;

const kpiInsights = {
  leads: {
    eyebrow: 'Weekly lead growth',
    title: 'Lead Momentum',
    trend: '+12.5%',
    trendDirection: 'up',
    meta: [
      { label: 'Conversion', value: '28.4%' },
      { label: 'New this week', value: '312' }
    ],
    data: [
      { label: 'Mon', leads: 128, conversion: 21 },
      { label: 'Tue', leads: 148, conversion: 23 },
      { label: 'Wed', leads: 132, conversion: 24 },
      { label: 'Thu', leads: 176, conversion: 27 },
      { label: 'Fri', leads: 208, conversion: 29 },
      { label: 'Sat', leads: 226, conversion: 31 },
      { label: 'Sun', leads: 230, conversion: 32 }
    ],
    type: 'line'
  },
  sales: {
    eyebrow: 'Monthly revenue comparison',
    title: 'Revenue Velocity',
    trend: '+8.2%',
    trendDirection: 'up',
    meta: [
      { label: 'Current', value: 'PHP 2.1M' },
      { label: 'Previous', value: 'PHP 1.94M' }
    ],
    data: [
      { label: 'Jan', revenue: 1.45, target: 1.3 },
      { label: 'Feb', revenue: 1.62, target: 1.5 },
      { label: 'Mar', revenue: 1.86, target: 1.7 },
      { label: 'Apr', revenue: 2.04, target: 1.9 },
      { label: 'May', revenue: 2.1, target: 2.0 }
    ],
    type: 'bar'
  },
  reps: {
    eyebrow: 'Team performance graph',
    title: 'Rep Leaderboard',
    trend: '+2 active',
    trendDirection: 'up',
    meta: [
      { label: 'Active reps', value: '18' },
      { label: 'Team index', value: '91%' }
    ],
    data: [
      { label: 'Ana', score: 94 },
      { label: 'Migz', score: 88 },
      { label: 'Carlo', score: 82 },
      { label: 'Bea', score: 76 }
    ],
    type: 'area'
  },
  deals: {
    eyebrow: 'Conversion breakdown',
    title: 'Closing Health',
    trend: '-3.1%',
    trendDirection: 'down',
    meta: [
      { label: 'Successful', value: '324' },
      { label: 'Lost', value: '83' }
    ],
    data: [
      { name: 'Closed', value: 324 },
      { name: 'Lost', value: 83 }
    ],
    type: 'donut',
    closingRate: '79.6%'
  }
};

function PopupTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="kpi-popup-tooltip">
      <p>{label || payload[0].name}</p>
      <strong>{payload[0].value}</strong>
    </div>
  );
}

function TrendBadge({ direction, value }) {
  const Icon = direction === 'down' ? FiArrowDownRight : FiArrowUpRight;

  return (
    <span className={`kpi-popup-trend ${direction === 'down' ? 'is-down' : 'is-up'}`}>
      <Icon size={14} />
      {value}
    </span>
  );
}

function KPIChart({ insight }) {
  if (insight.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={insight.data} margin={lineMargin}>
          <defs>
            <linearGradient id="leadLineGlow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={orange} />
              <stop offset="100%" stopColor={amber} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={smallAxisTick} axisLine={false} tickLine={false} />
          <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip content={tooltipElement} cursor={{ stroke: 'rgba(255,177,90,0.12)' }} />
          <Line
            type="monotone"
            dataKey="leads"
            stroke="url(#leadLineGlow)"
            strokeWidth={3}
            dot={{ r: 3, fill: orange, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: amber, stroke: orange }}
            animationDuration={280}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (insight.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={insight.data} margin={barMargin}>
          <defs>
            <linearGradient id="salesBarGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={actualSalesColor} />
              <stop offset="100%" stopColor={actualSalesColor} stopOpacity={0.78} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={smallAxisTick} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={tooltipElement} cursor={{ fill: 'rgba(209,96,2,0.06)' }} />
          <Bar dataKey="target" fill={targetSalesColor} opacity={0.62} radius={[5, 5, 0, 0]} animationDuration={240} />
          <Bar dataKey="revenue" fill="url(#salesBarGlow)" radius={[5, 5, 0, 0]} animationDuration={280} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (insight.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={insight.data} layout="vertical" margin={areaMargin}>
          <defs>
            <linearGradient id="repAreaGlow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(255,177,90,0.10)" />
              <stop offset="100%" stopColor="rgba(255,179,71,0.9)" />
            </linearGradient>
          </defs>
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="label"
            tick={verticalAxisTick}
            width={38}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={tooltipElement} cursor={{ fill: 'rgba(255,177,90,0.06)' }} />
          <Area
            dataKey="score"
            type="monotone"
            fill="url(#repAreaGlow)"
            stroke={orange}
            strokeWidth={2}
            animationDuration={280}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="kpi-donut-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={insight.data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={5}
            animationDuration={300}
          >
            <Cell fill={orange} />
            <Cell fill="rgba(255,255,255,0.16)" />
          </Pie>
          <Tooltip content={tooltipElement} />
        </PieChart>
      </ResponsiveContainer>
      <div className="kpi-donut-center">
        <strong>{insight.closingRate}</strong>
        <span>Closing rate</span>
      </div>
    </div>
  );
}

function KPIHoverPopup({ metric }) {
  const insight = kpiInsights[metric] || kpiInsights.leads;

  return (
    <div className="kpi-popup-content">
      <div className="kpi-popup-sheen"></div>
      <div className="kpi-popup-header">
        <div>
          <span className="kpi-popup-eyebrow">
            <GoDotFill size={10} />
            {insight.eyebrow}
          </span>
          <h4>{insight.title}</h4>
        </div>
        <TrendBadge direction={insight.trendDirection} value={insight.trend} />
      </div>

      <div className="popup-chart">
        <KPIChart insight={insight} />
      </div>

      <div className="kpi-popup-meta">
        {insight.meta.map((item) => (
          <div className="kpi-popup-stat" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(KPIHoverPopup);
