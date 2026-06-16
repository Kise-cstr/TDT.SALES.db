import { memo, useId, useState } from 'react';
import { motion } from 'framer-motion';
import '../../styles/charts.css';

const defaultPanelMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } }
};

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeChartRows = data => (Array.isArray(data) ? data : []).map(item => ({
  ...item,
  month: item.month || item.label || '',
  gross: toNumber(item.gross ?? item.sales),
  gk: toNumber(item.gk)
}));

const getLocalPointer = event => {
  const target = event.currentTarget;
  const container = target.closest?.('.chart-container, .sales-comparison-chart, .dashboard-card, .chart-card')
    || target.ownerSVGElement?.closest?.('.chart-container, .sales-comparison-chart')
    || target;
  const bounds = container.getBoundingClientRect();
  return {
    x: clamp(event.clientX - bounds.left + 16, 12, Math.max(12, bounds.width - 260)),
    y: clamp(event.clientY - bounds.top + 16, 12, Math.max(12, bounds.height - 132))
  };
};

function SmartTooltip({ tooltip }) {
  if (!tooltip) return null;
  return (
    <motion.div
      className="presentation-smart-tooltip"
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <strong>{tooltip.title}</strong>
      {tooltip.lines.map(line => <span key={line}>{line}</span>)}
    </motion.div>
  );
}

export function SalesComparisonLegend({ showGk, showGs }) {
  return (
    <div className="sales-comparison-legend" aria-label="Sales comparison legend">
      {showGk && (
        <span className="sales-comparison-legend-item">
          <i className="sales-comparison-legend-icon is-gk" />
          <b>GK Value</b>
        </span>
      )}
      {showGs && (
        <span className="sales-comparison-legend-item">
          <i className="sales-comparison-legend-icon is-gross" />
          <b>Gross Sales</b>
        </span>
      )}
    </div>
  );
}

function SalesComparisonChartBody({ data, metric = 'all', enlarged = false }) {
  const chartData = normalizeChartRows(data);
  const [activeIndex, setActiveIndex] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const rawId = useId();
  const chartId = rawId.replace(/:/g, '');
  const showGs = metric !== 'gk';
  const showGk = metric !== 'sales';
  const grossMax = Math.max(0, ...chartData.map(item => toNumber(item.gross)));
  const gkMax = Math.max(0, ...chartData.map(item => toNumber(item.gk)));
  const buildAxis = value => {
    const padded = Math.max(value * 1.18, 0.01);
    const steps = [0.01, 0.1, 0.5, 1, 2, 5, 10, 20, 50, 100];
    const step = steps.find(candidate => padded / candidate <= 10) || 100;
    const max = Math.max(step, Math.ceil(padded / step) * step);
    const count = Math.round(max / step);
    return {
      max,
      step,
      ticks: Array.from({ length: count + 1 }, (_, index) => step * index)
    };
  };
  const grossAxis = buildAxis(grossMax);
  const gkAxis = buildAxis(gkMax);
  const primaryAxis = metric === 'gk' ? gkAxis : grossAxis;
  const width = enlarged ? 1480 : 1260;
  const height = enlarged ? 540 : 365;
  const margin = {
    top: enlarged ? 28 : 12,
    right: showGk ? (enlarged ? 64 : 46) : 24,
    bottom: enlarged ? 46 : 30,
    left: showGs ? (enlarged ? 66 : 50) : 32
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = index => (
    chartData.length <= 1
      ? margin.left + plotWidth / 2
      : margin.left + (plotWidth / (chartData.length - 1)) * index
  );
  const chartClipId = `salesComparisonPlotClip${chartId}${enlarged ? 'Enlarged' : ''}`;
  const glowId = `presentationChartGlow${chartId}`;
  const clampChartY = value => clamp(value, margin.top, margin.top + plotHeight);
  const denseChartStep = Math.max(1, Math.ceil(chartData.length / (enlarged ? 18 : 12)));
  const shouldShowDensePoint = index => (
    chartData.length <= (enlarged ? 22 : 14) ||
    index === 0 ||
    index === chartData.length - 1 ||
    index % denseChartStep === 0
  );
  const yForGs = value => clampChartY(margin.top + plotHeight - (toNumber(value) / grossAxis.max) * plotHeight);
  const yForGk = value => clampChartY(margin.top + plotHeight - (toNumber(value) / gkAxis.max) * plotHeight);
  const formatAxisValue = value => {
    if (value <= 0) return '0';
    if (value < 1) return `${Math.round(value * 1000)}K`;
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}M`;
  };
  const formatValueLabel = value => {
    if (value <= 0) return 'PHP 0';
    if (value < 1) return `PHP ${Math.round(value * 1000)}K`;
    return `PHP ${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  };
  const baseY = margin.top + plotHeight;
  const linePoints = chartData.map((item, index) => ({
    x: xFor(index),
    y: yForGs(item.gross),
    value: toNumber(item.gross)
  }));
  const linePath = linePoints.reduce((path, point, index, points) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
  const lineLabelPositions = linePoints.map((point, index) => {
    const gkTop = showGk ? yForGk(chartData[index].gk) : baseY;
    const tooCloseToBar = showGk && Math.abs(point.y - gkTop) < 34;
    return {
      x: point.x,
      y: Math.max(margin.top + 16, point.y - (tooCloseToBar ? 30 : 14))
    };
  });
  const gridStops = showGs && showGk
    ? Array.from({ length: 6 }, (_, index) => index / 5)
    : primaryAxis.ticks.map(tick => tick / primaryAxis.max);
  const gkLinePoints = chartData.map((item, index) => ({
    x: xFor(index),
    y: yForGk(item.gk),
    value: toNumber(item.gk)
  }));
  const gkLinePath = gkLinePoints.reduce((path, point, index, points) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
  const gkLabelPositions = gkLinePoints.map((point, index) => {
    const gsPoint = linePoints[index];
    const tooCloseToGs = showGs && Math.abs(point.y - gsPoint.y) < 34;
    return {
      x: point.x,
      y: Math.min(baseY - 10, point.y + (tooCloseToGs ? 32 : 22))
    };
  });

  return (
    <div className="chart-container sales-comparison-chart" onMouseLeave={() => { setActiveIndex(null); setTooltip(null); }}>
      <SmartTooltip tooltip={tooltip} />
      <svg className="sales-comparison-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales comparison chart with GK and gross sales lines">
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ff9f43" floodOpacity="0.42" />
          </filter>
          <clipPath id={chartClipId}>
            <rect x={margin.left - 8} y={margin.top - 8} width={plotWidth + 16} height={plotHeight + 16} />
          </clipPath>
        </defs>

        {gridStops.map(stop => {
          const y = margin.top + plotHeight - stop * plotHeight;
          const grossTick = grossAxis.max * stop;
          const gkTick = gkAxis.max * stop;
          return (
            <g key={stop}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="rgba(255,255,255,0.09)" strokeDasharray="4 5" />
              {showGs && (
                <text x={margin.left - 12} y={y + 4} textAnchor="end" fill="#aeb6c1" fontSize={enlarged ? 15 : 13} fontWeight="850">{formatAxisValue(grossTick)}</text>
              )}
              {showGk && (
                <text x={width - margin.right + 12} y={y + 4} textAnchor="start" fill="#ff9f43" fontSize={enlarged ? 14 : 12} fontWeight="850">{formatAxisValue(gkTick)}</text>
              )}
            </g>
          );
        })}

        <line x1={margin.left} x2={width - margin.right} y1={baseY} y2={baseY} stroke="rgba(255,255,255,0.12)" />

        {showGk && gkLinePath && <path className="sales-comparison-line is-gk" d={gkLinePath} fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} clipPath={`url(#${chartClipId})`} />}

        {showGk && gkLinePoints.map((point, index) => (
          <g
            key={`gk-${point.x}-${point.value}`}
            className={activeIndex !== null && activeIndex !== index ? 'presentation-point-muted' : ''}
            onMouseMove={event => {
              event.stopPropagation();
              setActiveIndex(index);
              setTooltip({
                ...getLocalPointer(event),
                title: chartData[index].month,
                lines: [`GK: ${formatValueLabel(point.value)}`, `GS: ${formatValueLabel(linePoints[index]?.value || 0)}`]
              });
            }}
          >
            {shouldShowDensePoint(index) && (
              <circle className="sales-comparison-point is-gk" cx={point.x} cy={point.y} r={activeIndex === index ? 8 : 6} fill="#f97316" stroke="#fed7aa" strokeWidth="2" filter={`url(#${glowId})`} clipPath={`url(#${chartClipId})`} />
            )}
            {!shouldShowDensePoint(index) && (
              <circle cx={point.x} cy={point.y} r="8" fill="transparent" stroke="transparent" />
            )}
            {activeIndex === index && (
              <text x={gkLabelPositions[index].x} y={gkLabelPositions[index].y} textAnchor="middle" fill="#ff9f43" fontSize={enlarged ? 14 : 12} fontWeight="900">
                {formatValueLabel(point.value)}
              </text>
            )}
            {shouldShowDensePoint(index) && (
              <text x={point.x} y={height - (enlarged ? 19 : 13)} textAnchor="middle" fill="#aeb6c1" fontSize={enlarged ? 15 : 13} fontWeight="850">{chartData[index].month}</text>
            )}
          </g>
        ))}

        {!showGk && chartData.map((item, index) => (
          shouldShowDensePoint(index) ? (
            <text key={`label-${item.month}-${index}`} x={xFor(index)} y={height - (enlarged ? 19 : 13)} textAnchor="middle" fill="#aeb6c1" fontSize={enlarged ? 15 : 13} fontWeight="850">{item.month}</text>
          ) : null
        ))}

        {showGs && linePath && <path className="sales-comparison-line is-gross" d={linePath} fill="none" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} clipPath={`url(#${chartClipId})`} />}

        {showGs && linePoints.map((point, index) => (
          <g
            key={`${point.x}-${point.value}`}
            className={activeIndex !== null && activeIndex !== index ? 'presentation-point-muted' : ''}
            onMouseMove={event => {
              event.stopPropagation();
              setActiveIndex(index);
              setTooltip({
                ...getLocalPointer(event),
                title: chartData[index].month,
                lines: [`GS: ${formatValueLabel(point.value)}`, `GK: ${formatValueLabel(gkLinePoints[index]?.value || 0)}`]
              });
            }}
          >
            {shouldShowDensePoint(index) && (
              <circle className="sales-comparison-point is-gross" cx={point.x} cy={point.y} r={activeIndex === index ? 8 : 6} fill="#9ca3af" stroke="#e5e7eb" strokeWidth="2" filter={`url(#${glowId})`} clipPath={`url(#${chartClipId})`} />
            )}
            {!shouldShowDensePoint(index) && (
              <circle cx={point.x} cy={point.y} r="8" fill="transparent" stroke="transparent" />
            )}
            {activeIndex === index && (
              <text x={lineLabelPositions[index].x} y={lineLabelPositions[index].y} textAnchor="middle" fill="#f8bd6b" fontSize={enlarged ? 14 : 12} fontWeight="900">
                {formatValueLabel(point.value)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function DefaultCardHeader({ title, action }) {
  return (
    <div className="dashboard-card-header sales-comparison-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

function SalesComparisonChart({
  data,
  metric = 'all',
  enlarged = false,
  withCard = false,
  className = '',
  CardHeaderComponent = DefaultCardHeader,
  panelMotion = defaultPanelMotion
}) {
  const showGs = metric !== 'gk';
  const showGk = metric !== 'sales';
  const title = metric === 'gk' ? 'GK Comparison' : metric === 'sales' ? 'Gross Sales Comparison' : 'Sales Comparison';
  const chart = <SalesComparisonChartBody data={data} metric={metric} enlarged={enlarged} />;

  if (!withCard) return chart;

  return (
    <motion.article className={`dashboard-card sales-card${enlarged ? ' is-enlarged' : ''}${className ? ` ${className}` : ''}`} variants={panelMotion}>
      <CardHeaderComponent
        className="sales-comparison-header"
        title={title}
        action={<SalesComparisonLegend showGk={showGk} showGs={showGs} />}
      />
      {chart}
    </motion.article>
  );
}

export default memo(SalesComparisonChart);
