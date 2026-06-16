import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileSpreadsheet, Maximize2, Trophy, X } from 'lucide-react';
import logo from '../../assets/logos/tdt_logo.png';
import SalesComparisonChart from '../charts/SalesComparisonChart';
import { useDashboardAnalytics, validatePresentationSync } from '../../data/dashboardAnalytics';
import {
  metricOptions,
  timelineOptions,
  writeDashboardFilters
} from '../../utils/dashboardFilters';
import '../../styles/enterprise.css';
import '../../styles/presentation-palette.css';

const panelMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } }
};

const headerPeriodOptions = ['Monthly', 'Weekly', 'Daily'];
const headerTimelineOptions = timelineOptions;

const focusMotion = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } }
};

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatShare = value => {
  const share = toNumber(value);
  return Number.isInteger(share) ? String(share) : share.toFixed(1);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const useResizeObserverSize = (ref, fallback = 270) => {
  const [size, setSize] = useState({ width: fallback, height: fallback });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const updateSize = entry => {
      const rect = entry?.contentRect || node.getBoundingClientRect();
      const width = Math.max(1, rect.width || fallback);
      const height = Math.max(1, rect.height || fallback);
      setSize(current => (
        Math.abs(current.width - width) > 1 || Math.abs(current.height - height) > 1
          ? { width, height }
          : current
      ));
    };

    const observer = new ResizeObserver(entries => updateSize(entries[0]));
    observer.observe(node);
    updateSize();

    return () => observer.disconnect();
  }, [fallback, ref]);

  return size;
};

const getLocalPointer = event => {
  const target = event.currentTarget;
  const container = target.closest?.('.chart-container, .products-layout, .product-pie-list, .company-list, .counter-bar-chart, .rankings-list, .dashboard-card')
    || target.ownerSVGElement?.closest?.('.chart-container')
    || target;
  const bounds = container.getBoundingClientRect();
  return {
    x: clamp(event.clientX - bounds.left + 16, 12, Math.max(12, bounds.width - 260)),
    y: clamp(event.clientY - bounds.top + 16, 12, Math.max(12, bounds.height - 132))
  };
};

function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`dashboard-card-header ${className}`.trim()}>
      <h2>{title}</h2>
      {action || (subtitle ? <p>{subtitle}</p> : null)}
    </div>
  );
}

function Header({ filters, onFilterChange }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const isTimelineActive = filters.timeline && filters.timeline !== 'Disable';

  useEffect(() => {
    const clock = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(clock);
  }, []);

  const liveTime = currentTime.toLocaleTimeString();
  return (
    <header className="presentation-header present-header">
      <div className="presentation-brand">
        <img src={logo} alt="TDT Powersteel" />
        <div>
          <h1>TDT POWERSTEEL DASHBOARD</h1>
        </div>
      </div>

      <div className="presentation-mode-label">
        <FileSpreadsheet size={22} />
        <strong>PRESENT MODE</strong>
        <small>CSV UPLOAD DATA</small>
      </div>

      <div className="presentation-actions">
        <label className={`presentation-header-control${isTimelineActive ? ' is-disabled' : ''}`}>
          <span>Period</span>
          <select
            value={filters.period}
            onChange={event => onFilterChange('period', event.target.value)}
            disabled={isTimelineActive}
            aria-disabled={isTimelineActive}
          >
            {headerPeriodOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="presentation-header-control">
          <span>Timeline</span>
          <select value={filters.timeline || 'Disable'} onChange={event => onFilterChange('timeline', event.target.value)}>
            {headerTimelineOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="presentation-header-control">
          <span>Metrics</span>
          <select value={filters.metric} onChange={event => onFilterChange('metric', event.target.value)}>
            {metricOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="presentation-live-clock" aria-live="polite">
          <strong>{liveTime}</strong>
        </div>
      </div>
    </header>
  );
}

function AutoScrollList({ className, items, renderItem, duration = 36 }) {
  const shouldScroll = items.length > 4;
  const visibleItems = shouldScroll ? [...items, ...items] : items;

  return (
    <div className={`${className} auto-scroll-list${shouldScroll ? ' is-scrollable' : ''}`}>
      <div className="auto-scroll-track" style={{ '--scroll-duration': `${duration}s` }}>
        {visibleItems.map((item, index) => renderItem(item, index, shouldScroll && index >= items.length))}
      </div>
    </div>
  );
}

function PresentationTooltip({ tooltip }) {
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

function FocusShell({ title, children, onFocus }) {
  const open = () => onFocus({ title, render: enlarged => children(enlarged) });

  return (
    <div className="presentation-focus-shell" onClick={open}>
      <button
        className="presentation-enlarge-btn"
        type="button"
        onClick={event => {
          event.stopPropagation();
          open();
        }}
        aria-label={`Enlarge ${title}`}
      >
        <Maximize2 size={15} />
      </button>
      {children(false)}
    </div>
  );
}

function FocusModal({ panel, onClose }) {
  useEffect(() => {
    if (!panel) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('presentation-focus-open');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('presentation-focus-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, panel]);

  if (!panel) return null;

  return (
    <motion.div className="presentation-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.section className="presentation-focus-modal" variants={focusMotion} initial="hidden" animate="visible" onMouseDown={event => event.stopPropagation()}>
        <header>
          <strong>{panel.title}</strong>
          <button type="button" onClick={onClose} aria-label="Close enlarged presentation chart">
            <X size={22} />
          </button>
        </header>
        <div className="presentation-focus-modal-body">
          {panel.render(true)}
        </div>
      </motion.section>
    </motion.div>
  );
}

function StatsGrid({ data, onFocus }) {
  return (
    <section className="stats-grid">
      <AnimatePresence mode="popLayout" initial={false}>
        {data.map((kpi, index) => (
          <motion.div
            className="stats-grid-item"
            key={kpi.label}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.38, ease: 'easeInOut' }}
          >
            <FocusShell
              title={kpi.label}
              onFocus={onFocus}
            >
              {enlarged => (
                <motion.article className={`stat-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion} custom={index} whileHover={{ scale: enlarged ? 1 : 1.02, y: enlarged ? 0 : -3 }}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                  <small>{kpi.note}</small>
                </motion.article>
              )}
            </FocusShell>
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}

function Companies({ data, enlarged = false }) {
  const [activeCompany, setActiveCompany] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const hasActiveCompany = activeCompany !== null;

  return (
    <motion.article className={`dashboard-card companies-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion}>
      <CardHeader title="Top 10 Companies" subtitle="Company total purchases" />
      <PresentationTooltip tooltip={tooltip} />
      <AutoScrollList
        className="company-list"
        items={data}
        duration={38}
        renderItem={(company, index, isDuplicate) => (
          <article
            key={`${company.name}-${isDuplicate ? 'loop' : 'row'}-${index}`}
            className={`${activeCompany === index ? 'is-active' : ''}${hasActiveCompany && activeCompany !== index ? ' is-muted' : ''}`.trim()}
            onMouseMove={event => {
              setActiveCompany(index);
              setTooltip({
                ...getLocalPointer(event),
                title: company.name,
                lines: [`Total: ${company.amount}`, `Share: ${formatShare(company.progress)}%`, `Sales Rep: ${company.salesRep || 'Unassigned'}`]
              });
            }}
            onMouseLeave={() => {
              setActiveCompany(null);
              setTooltip(null);
            }}
          >
            <div>
              <span className="company-rank">{company.rank || index + 1}</span>
              <span className="company-rep-avatar" title={company.salesRep || 'Unassigned'}>
                {company.repAvatar ? <img src={company.repAvatar} alt="" /> : (company.salesRep || company.name || '?').slice(0, 1)}
              </span>
              <strong>{company.name}</strong>
              <span>{company.amount}</span>
            </div>
            <i><b style={{ width: `${company.progress}%`, background: company.color }} /></i>
          </article>
        )}
      />
    </motion.article>
  );
}

const productModeCopy = {
  quantity: {
    label: 'QUANTITY',
    totalLabel: 'TOTAL PRODUCTS',
    centerMetricLabel: 'PRODUCTS',
    valueLabel: value => Math.round(value).toLocaleString(),
    centerValueLabel: value => Math.round(value).toLocaleString()
  },
  tons: {
    label: 'TONS',
    totalLabel: 'TOTAL TONS',
    centerMetricLabel: 'TONS',
    valueLabel: value => `${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TONS`,
    centerValueLabel: value => toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
};

const productModes = ['quantity', 'tons'];
const isOthersProduct = product => String(product?.name || product?.label || '').trim().toUpperCase() === 'OTHERS';

const buildVisiblePresentationProducts = source => {
  const sourceRows = Array.isArray(source) ? source : [];
  const existingOthers = sourceRows
    .filter(isOthersProduct)
    .reduce((summary, product) => ({
      ...summary,
      quantity: summary.quantity + toNumber(product.quantity),
      tons: summary.tons + toNumber(product.tons),
      sales: summary.sales + toNumber(product.sales),
      revenue: summary.revenue + toNumber(product.revenue || product.sales),
      gk: summary.gk + toNumber(product.gk),
      color: product.color || summary.color
    }), {
      label: 'OTHERS',
      name: 'OTHERS',
      quantity: 0,
      tons: 0,
      sales: 0,
      revenue: 0,
      gk: 0,
      color: '#6f6f6f'
    });
  const rows = sourceRows
    .filter(product => !isOthersProduct(product))
    .map(product => ({
      ...product,
      name: product.name || product.label || 'Product',
      label: product.label || product.name || 'Product',
      quantity: toNumber(product.quantity),
      tons: toNumber(product.tons),
      sales: toNumber(product.sales),
      revenue: toNumber(product.revenue || product.sales),
      gk: toNumber(product.gk)
    }))
    .sort((a, b) => b.quantity - a.quantity);
  const topProducts = rows.slice(0, 5);
  const otherProducts = rows.slice(5);

  if (!otherProducts.length) {
    return existingOthers.quantity || existingOthers.tons
      ? [...topProducts, existingOthers]
      : topProducts;
  }

  const others = otherProducts.reduce((summary, product) => ({
    ...summary,
    quantity: summary.quantity + product.quantity,
    tons: summary.tons + product.tons,
    sales: summary.sales + product.sales,
    revenue: summary.revenue + product.revenue,
    gk: summary.gk + product.gk
  }), existingOthers);

  return [...topProducts, others];
};

const validateProductPieRows = (sourceRows, chartRows, mode) => {
  const sourceSignature = buildVisiblePresentationProducts(sourceRows)
    .filter(product => toNumber(product[mode]) > 0)
    .map(product => `${product.name}:${toNumber(product[mode])}`)
    .join('|');
  const chartSignature = chartRows
    .map(product => `${product.name}:${toNumber(product.rawValue)}`)
    .join('|');
  const valid = sourceSignature === chartSignature;
  if (!valid) {
    console.error('[product-pie-validation] Presentation Products pie does not match Product Breakdown source.', {
      mode,
      productBreakdown: sourceSignature,
      pie: chartSignature
    });
  }
  return valid;
};

function Products({ data, totals, validation, enlarged = false }) {
  const [productMode, setProductMode] = useState('quantity');
  const [isChartReady, setIsChartReady] = useState(false);
  const activeMode = productModeCopy[productMode] ? productMode : 'quantity';
  const chartData = useMemo(() => {
    const rows = buildVisiblePresentationProducts(data)
      .map(product => ({
        ...product,
        rawValue: toNumber(product[activeMode]),
        totalLabel: productModeCopy[activeMode].valueLabel(product[activeMode])
      }))
      .filter(product => product.rawValue > 0);
    const denominator = rows.reduce((sum, row) => sum + toNumber(row.rawValue), 0) || 1;
    return rows.map(product => ({
      ...product,
      value: Math.round((toNumber(product.rawValue) / denominator) * 1000) / 10,
      color: product.color || (isOthersProduct(product) ? '#6f6f6f' : '#D16002')
    }));
  }, [activeMode, data]);
  const isValid = validation?.valid !== false && validateProductPieRows(data, chartData, activeMode);
  const [activeProduct, setActiveProduct] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const productRefs = useRef({});
  const productListRef = useRef(null);
  const donutRef = useRef(null);
  const fallbackSize = enlarged ? 380 : 270;
  const observedSize = useResizeObserverSize(donutRef, fallbackSize);
  const total = toNumber(totals?.[activeMode] || chartData.reduce((sum, product) => sum + product.rawValue, 0));
  const centerValueLabel = productModeCopy[activeMode].centerValueLabel(total);
  const measuredSize = Math.min(observedSize.width, observedSize.height) * 0.9;
  const size = Math.round(clamp(measuredSize || fallbackSize, 120, measuredSize || fallbackSize));
  const center = size / 2;
  const radius = size * 0.37;
  const strokeWidth = radius * 0.424;
  const innerRadius = radius - strokeWidth / 2;
  const centerCircleRadius = Math.max(24, innerRadius - 3);
  const centerDiameter = centerCircleRadius * 2;
  const centerValueFontSize = Math.round(clamp(centerDiameter / Math.max(4.4, centerValueLabel.length * 0.6), 12, centerDiameter * 0.26));
  const centerMetaFontSize = Math.round(clamp(centerDiameter * 0.12, 7, 12));
  const circumference = 2 * Math.PI * radius;
  const totalVisibleValue = chartData.reduce((sum, product) => sum + toNumber(product.rawValue), 0) || 1;
  const minimumVisibleShare = chartData.length > 1 ? 0.025 : 1;
  const visibleShares = chartData.map(product => Math.max(toNumber(product.rawValue) / totalVisibleValue, minimumVisibleShare));
  const totalShare = visibleShares.reduce((sum, share) => sum + share, 0) || 1;
  const pieGraphContents = chartData.map(product => ({
    name: product.name,
    color: product.color,
    percentage: product.value,
    value: product.totalLabel
  }));
  let offset = 0;
  const hasActiveProduct = Boolean(activeProduct);

  useEffect(() => {
    productListRef.current?.scrollTo?.({ top: 0 });
  }, [activeMode]);

  const clearProductHover = () => {
    setActiveProduct(null);
    setTooltip(null);
    productListRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        setIsChartReady(true);
        window.dispatchEvent(new Event('resize'));
      }, 180);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (isValid) return;
    console.error('[product-pie-validation] Products pie source mismatch.', validation?.invalidProducts || []);
  }, [isValid, validation]);

  return (
    <motion.article className={`dashboard-card products-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion}>
      <CardHeader
        title="Products"
        action={(
          <div className="products-card-action">
            <p>Product sales share</p>
            <button
              type="button"
              className={`product-mode-switch is-${activeMode}`}
              onClick={event => {
                event.stopPropagation();
                setProductMode(current => productModes[(productModes.indexOf(current) + 1) % productModes.length] || 'quantity');
              }}
              aria-label="Switch products chart mode"
            >
              <span>{productModeCopy[activeMode].label}</span>
            </button>
          </div>
        )}
      />
      <div className="products-layout" onMouseLeave={clearProductHover}>
        <PresentationTooltip tooltip={tooltip} />
        <div className="donut-container" ref={donutRef}>
          {isChartReady && chartData.length ? (
          <svg
            className="products-donut-svg"
            viewBox={`0 0 ${size} ${size}`}
            aria-label="Product sales share donut chart"
            style={{ width: size, height: size }}
          >
              <defs>
                <filter id="productsInnerShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#000000" floodOpacity="0.75" />
                </filter>
                <filter id="productsSliceGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ff9f43" floodOpacity="0.62" />
                </filter>
              </defs>
              <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(95,95,95,0.28)" strokeWidth={strokeWidth} />
              {chartData.map((product, index) => {
                const share = visibleShares[index] / totalShare;
                const dash = Math.max(0.01, share * circumference - 5);
                const segmentOffset = offset;
                const isActive = activeProduct === product.name;
                const isMuted = hasActiveProduct && !isActive;
                offset += share * circumference;
                return (
                  <g
                    key={product.name}
                    className={`product-donut-segment${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                    transform={`rotate(-90 ${center} ${center}) translate(${center} ${center}) scale(${isActive ? 1.035 : 1}) translate(${-center} ${-center})`}
                    onMouseMove={event => {
                      setActiveProduct(product.name);
                      setTooltip({
                        ...getLocalPointer(event),
                        title: product.name,
                        lines: [`Share: ${formatShare(product.value)}%`, `Total: ${product.totalLabel}`]
                      });
                    }}
                    onFocus={() => setActiveProduct(product.name)}
                    onBlur={() => setActiveProduct(null)}
                    tabIndex="0"
                    role="listitem"
                    aria-label={`${product.name} ${product.value}%`}
                  >
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={isMuted ? '#5f5f5f' : product.color}
                      strokeWidth={isActive ? strokeWidth + 3 : strokeWidth}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-segmentOffset}
                      strokeLinecap="butt"
                      filter={isActive ? 'url(#productsSliceGlow)' : undefined}
                    />
                  </g>
                );
              })}
              <circle cx={center} cy={center} r={centerCircleRadius} fill="#111111" filter="url(#productsInnerShadow)" />
          </svg>
          ) : (
            <div className="products-donut-placeholder" aria-hidden="true" />
          )}
          <div
            className="donut-center-label"
            style={{
              '--donut-center-size': `${Math.round(centerDiameter)}px`,
              '--donut-value-font-size': `${centerValueFontSize}px`,
              '--donut-meta-font-size': `${centerMetaFontSize}px`
            }}
          >
            <strong>{centerValueLabel}</strong>
            <span>Total</span>
            <small>{productModeCopy[activeMode].centerMetricLabel}</small>
          </div>
        </div>

        <div
          className="product-pie-list"
          ref={productListRef}
          role="list"
          aria-label="Product pie contents"
          onWheel={event => event.stopPropagation()}
          onScroll={event => event.stopPropagation()}
        >
          {pieGraphContents.map(item => {
            const isActive = activeProduct === item.name;
            const isMuted = hasActiveProduct && !isActive;
            return (
              <article
                key={item.name}
                ref={node => {
                  if (node) productRefs.current[item.name] = node;
                }}
                className={`${isActive ? 'is-active' : ''}${isMuted ? ' is-muted' : ''}`.trim()}
                onMouseMove={event => {
                  setActiveProduct(item.name);
                  setTooltip({
                    ...getLocalPointer(event),
                    title: item.name,
                    lines: [`Share: ${formatShare(item.percentage)}%`, `Total: ${item.value}`]
                  });
                }}
                onFocus={() => setActiveProduct(item.name)}
                onBlur={() => setActiveProduct(null)}
                tabIndex="0"
                role="listitem"
              >
                <i style={{ background: item.color }} />
                <strong title={item.name}>{item.name}</strong>
                <b>{item.percentage % 1 === 0 ? item.percentage : item.percentage.toFixed(1)}%</b>
                <span>{item.value}</span>
              </article>
            );
          })}
          {!pieGraphContents.length && (
            <article className="product-pie-list-empty">
              <strong>No product data</strong>
              <span>Upload product CSV data</span>
            </article>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function Counter({ data, enlarged = false }) {
  const chartData = data.length ? data : [];
  const [activeCounter, setActiveCounter] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const maxCount = Math.max(1, ...chartData.map(counter => toNumber(counter.count)));
  const hasActiveCounter = activeCounter !== null;

  return (
    <motion.article className={`dashboard-card counter-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion}>
      <CardHeader title="Sales Performance" subtitle="Closed deals, retention, and acquisition" />
      <div className="counter-bar-chart" role="list" aria-label="Counter type bar chart" onMouseLeave={() => { setActiveCounter(null); setTooltip(null); }}>
        <PresentationTooltip tooltip={tooltip} />
        {chartData.map((counter, index) => {
          const counterValue = counter.count.toLocaleString();
          const counterShare = `${formatShare(counter.percentage)}%`;
          return (
            <article
              className={`counter-bar-row${activeCounter === index ? ' is-active' : ''}${hasActiveCounter && activeCounter !== index ? ' is-muted' : ''}`}
              key={counter.rawLabel || counter.label}
              role="listitem"
              style={{ '--counter-color': counter.color, '--counter-share': `${(toNumber(counter.count) / maxCount) * 100}%` }}
              onMouseMove={event => {
                setActiveCounter(index);
                setTooltip({
                  ...getLocalPointer(event),
                  title: counter.label,
                  lines: [`Total: ${counterValue}`, `Share: ${counterShare}`]
                });
              }}
            >
              <div className="counter-bar-meta">
                <strong>{String(counter.label || '').toUpperCase()}</strong>
                <b>{counterValue}</b>
                <span>{counterShare}</span>
              </div>
              <div className="counter-bar-track" aria-hidden="true">
                <i />
              </div>
            </article>
          );
        })}
      </div>
    </motion.article>
  );
}

function Rankings({ data, enlarged = false }) {
  const [activeRep, setActiveRep] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const hasActiveRep = activeRep !== null;

  return (
    <motion.article className={`dashboard-card rankings-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion}>
      <CardHeader title="Sales Rep Rankings" subtitle="All sales reps by revenue" />
      <PresentationTooltip tooltip={tooltip} />
      <AutoScrollList
        className="rankings-list"
        items={data}
        duration={40}
        renderItem={(rep, index, isDuplicate) => (
          <article
            key={`${rep.rank}-${rep.name}-${isDuplicate ? 'loop' : 'row'}-${index}`}
            className={`${activeRep === index ? 'is-active' : ''}${hasActiveRep && activeRep !== index ? ' is-muted' : ''}`.trim()}
            data-rank={rep.rank <= 3 ? rep.rank : undefined}
            onMouseMove={event => {
              setActiveRep(index);
              setTooltip({
                ...getLocalPointer(event),
                title: rep.name,
                lines: [`Rank: ${rep.rank}`, `Revenue: ${rep.revenue}`, rep.deals]
              });
            }}
            onMouseLeave={() => {
              setActiveRep(null);
              setTooltip(null);
            }}
          >
            <span>{rep.rank === 1 ? <Trophy size={16} strokeWidth={2.6} /> : rep.rank}</span>
            <strong>{rep.name}</strong>
            <b>{rep.revenue}</b>
            <small>{rep.deals}</small>
          </article>
        )}
      />
    </motion.article>
  );
}

export default function DashboardPresentationView() {
  const analytics = useDashboardAnalytics();
  const { filters, presentationData } = analytics;
  const isTimelineActive = filters.timeline && filters.timeline !== 'Disable';
  const [focusedPanel, setFocusedPanel] = useState(null);

  useEffect(() => {
    const updatePresentationScale = () => {
      const width = window.innerWidth || 1600;
      const height = window.innerHeight || 900;
      const shouldScale = width > 900 && (width < 1400 || height < 820);
      const scale = shouldScale ? Math.min(width / 1600, height / 900, 1) : 1;
      document.documentElement.style.setProperty('--presentation-dashboard-scale', String(scale));
    };

    updatePresentationScale();
    window.addEventListener('resize', updatePresentationScale);

    return () => {
      window.removeEventListener('resize', updatePresentationScale);
      document.documentElement.style.removeProperty('--presentation-dashboard-scale');
    };
  }, []);

  useEffect(() => {
    validatePresentationSync(analytics);
  }, [analytics]);

  const updateFilter = (key, value) => {
    writeDashboardFilters({ [key]: value });
  };

  return (
    <motion.main
      className={`presentation-dashboard dashboard-content${isTimelineActive ? ' is-timeline-active' : ''}`}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } }
      }}
    >
      <Header filters={filters} onFilterChange={updateFilter} />
      <StatsGrid data={presentationData.kpis} onFocus={setFocusedPanel} />

      <section className="middle-grid">
        <FocusShell title="Sales Comparison" onFocus={setFocusedPanel}>
          {enlarged => (
            <SalesComparisonChart
              data={presentationData.salesComparison}
              metric={filters.metric}
              enlarged={enlarged}
              withCard
              CardHeaderComponent={CardHeader}
              panelMotion={panelMotion}
            />
          )}
        </FocusShell>
        <FocusShell title="Top 10 Companies" onFocus={setFocusedPanel}>
          {enlarged => <Companies data={presentationData.companies} enlarged={enlarged} />}
        </FocusShell>
      </section>

      <section className="bottom-grid">
        <FocusShell title="Products" onFocus={setFocusedPanel}>
          {enlarged => (
            <Products
              data={presentationData.products}
              totals={presentationData.productTotals}
              validation={presentationData.productValidation}
              enlarged={enlarged}
            />
          )}
        </FocusShell>
        <FocusShell title="Sales Performance" onFocus={setFocusedPanel}>
          {enlarged => <Counter data={presentationData.counters} enlarged={enlarged} />}
        </FocusShell>
        <FocusShell title="Sales Rep Rankings" onFocus={setFocusedPanel}>
          {enlarged => <Rankings data={presentationData.reps} enlarged={enlarged} />}
        </FocusShell>
      </section>
      <FocusModal panel={focusedPanel} onClose={() => setFocusedPanel(null)} />
    </motion.main>
  );
}
