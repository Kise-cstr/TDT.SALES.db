import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import '../../styles/charts.css';
import { termsData as staticTermsData } from '../../data/enterpriseAnalytics';

const CustomTooltip = memo(function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const datum = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{datum.name}</p>
      <p style={{ color: payload[0].color }}>
        {`Terms: ${datum.value} (${datum.percentage}%)`}
      </p>
    </div>
  );
});

const renderActiveShape = props => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;

  return (
    <g aria-label={`${payload.name} active segment`}>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="var(--chart-card-bg)"
        strokeWidth={2}
      />
    </g>
  );
};

function SourcePieChart({ sourceData }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const data = useMemo(() => {
    const source = sourceData?.length ? sourceData : staticTermsData;
    const readValue = item => Number(item.count ?? item.value ?? 0);
    const total = source.reduce((sum, item) => sum + readValue(item), 0);
    return source.map(item => {
      const value = readValue(item);
      return {
        name: item.label || item.name,
        value,
        percentage: total ? Math.round((value / total) * 1000) / 10 : 0
      };
    });
  }, [sourceData]);
  const colors = useMemo(() => [
    'var(--chart-primary)',
    'var(--chart-primary-soft)',
    'var(--chart-primary-strong)',
    'var(--chart-earth)',
    'var(--chart-secondary)',
    'var(--chart-metal)',
    'var(--chart-earth-soft)',
    'var(--chart-secondary-soft)',
    'var(--chart-primary-deep)',
    'var(--chart-muted)'
  ], []);
  const tooltip = useMemo(() => <CustomTooltip />, []);
  const totalSources = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  return (
    <motion.div
      className="chart-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{ willChange: 'opacity, transform' }}
    >
      <div className="chart-glass-inner" />
      <div className="chart-header terms-share-header">
        <div>
          <h2 className="chart-title">Terms</h2>
          <p className="chart-subtitle">Terms distribution from uploaded TERMS values</p>
        </div>
      </div>
      <div className="terms-share-layout">
        <div className="terms-donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="var(--chart-card-bg)"
                strokeWidth={2}
                fill="var(--chart-primary)"
                dataKey="value"
                activeIndex={activeIndex ?? undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                animationBegin={120}
                animationDuration={360}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    className={`terms-donut-segment${activeIndex === index ? ' is-active' : ''}${activeIndex !== null && activeIndex !== index ? ' is-muted' : ''}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="terms-donut-total">
            <strong>{totalSources.toLocaleString()}</strong>
            <span>Total</span>
            <small>Terms</small>
          </div>
        </div>
        <div className="terms-share-list">
          {data.map((term, index) => (
            <div
              className={`terms-share-row${activeIndex === index ? ' is-active' : ''}${activeIndex !== null && activeIndex !== index ? ' is-muted' : ''}`}
              key={term.name}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span className="terms-share-swatch" style={{ background: colors[index % colors.length] }} />
              <strong>{term.name}</strong>
              <em>{term.percentage}%</em>
              <small>{term.value}</small>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default memo(SourcePieChart);
