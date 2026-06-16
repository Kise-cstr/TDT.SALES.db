import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, FileSpreadsheet, Maximize2, Trophy, X } from 'lucide-react';
import logo from '../../assets/logos/tdt_logo.png';
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

const headerTimelineOptions = timelineOptions;
const dateRangeOptions = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
  'Custom Range'
];
const dayMs = 86400000;
const dateRangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric'
});

const focusMotion = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } }
};

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCompactCurrency = value => {
  const amount = toNumber(value);
  if (amount >= 1000000000) return `PHP ${(amount / 1000000000).toFixed(amount >= 10000000000 ? 0 : 1)}B`;
  if (amount >= 1000000) return `PHP ${(amount / 1000000).toFixed(amount >= 100000000 ? 0 : 1)}M`;
  if (amount >= 1000) return `PHP ${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1)}K`;
  return `PHP ${Math.round(amount).toLocaleString()}`;
};

const formatShare = value => {
  const share = toNumber(value);
  return Number.isInteger(share) ? String(share) : share.toFixed(1);
};

const normalizeDateRangeLabel = value => {
  const label = String(value || 'All Time').trim();
  const lower = label.toLowerCase();
  if (lower === 'current month') return 'This Month';
  if (lower === 'last 3 months') return 'Last 30 Days';
  if (lower === 'last 6 months') return 'This Quarter';
  if (lower === 'year to date') return 'This Year';
  if (lower === 'custom date range') return 'Custom Range';
  if (lower === 'all time' || !label) return 'All Time';
  return label;
};

const toDateInputValue = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const formatRangeDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateRangeFormatter.format(date);
};

const getPresetRangeWindow = (preset, bounds = {}) => {
  const anchorDate = parseDateInputValue(bounds.anchorDate) || parseDateInputValue(bounds.latestDate) || parseDateInputValue(bounds.earliestDate) || new Date();
  const endDate = parseDateInputValue(bounds.latestDate) || anchorDate;
  const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  const normalized = normalizeDateRangeLabel(preset);

  if (normalized === 'Today') {
    return { startDate: toDateInputValue(startOfDay(endDate)), endDate: toDateInputValue(endOfDay(endDate)) };
  }
  if (normalized === 'Yesterday') {
    const yesterday = addDays(endDate, -1);
    return { startDate: toDateInputValue(startOfDay(yesterday)), endDate: toDateInputValue(endOfDay(yesterday)) };
  }
  if (normalized === 'Last 7 Days') {
    return { startDate: toDateInputValue(startOfDay(addDays(endDate, -6))), endDate: toDateInputValue(endOfDay(endDate)) };
  }
  if (normalized === 'Last 30 Days') {
    return { startDate: toDateInputValue(startOfDay(addDays(endDate, -29))), endDate: toDateInputValue(endOfDay(endDate)) };
  }
  if (normalized === 'This Month') {
    return {
      startDate: toDateInputValue(new Date(endDate.getFullYear(), endDate.getMonth(), 1)),
      endDate: toDateInputValue(endOfDay(endDate))
    };
  }
  return { startDate: '', endDate: '' };
};

const getSuggestedPeriodForRange = (range, startDate, endDate) => {
  const normalized = normalizeDateRangeLabel(range);
  if (normalized === 'Today' || normalized === 'Yesterday') return 'Daily';
  if (normalized === 'Last 7 Days') return 'Weekly';
  if (normalized === 'Last 30 Days' || normalized === 'This Month' || normalized === 'Last Month') return 'Monthly';
  if (normalized === 'This Quarter') return 'Quarterly';
  if (normalized === 'This Year') return 'Yearly';
  if (normalized === 'Custom Range' && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const days = Math.max(1, Math.round((end - start) / dayMs) + 1);
      if (days <= 1) return 'Daily';
      if (days <= 7) return 'Weekly';
      if (days <= 31) return 'Monthly';
      if (days <= 92) return 'Quarterly';
      return 'Yearly';
    }
  }
  return 'Monthly';
};

const getRangeDisplayText = filters => {
  const range = normalizeDateRangeLabel(filters?.range);
  if (range === 'Custom Range' && filters?.startDate && filters?.endDate) {
    return `${formatRangeDate(filters.startDate)} - ${formatRangeDate(filters.endDate)}`;
  }
  if (range === 'All Time') return '';
  return range;
};

const parseDateInputValue = value => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfMonth = date => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const isSameDay = (left, right) => (
  !!left && !!right
  && left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

const isBeforeDay = (left, right) => {
  if (!left || !right) return false;
  const leftTime = new Date(left.getFullYear(), left.getMonth(), left.getDate()).getTime();
  const rightTime = new Date(right.getFullYear(), right.getMonth(), right.getDate()).getTime();
  return leftTime < rightTime;
};

const formatMonthTitle = date => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric'
}).format(date);

const buildMonthCalendar = (monthDate, startDate, endDate) => {
  const firstDay = startOfMonth(monthDate);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const today = new Date();
  const rangeStart = parseDateInputValue(startDate);
  const rangeEnd = parseDateInputValue(endDate);
  const rangeLow = rangeStart && rangeEnd && isBeforeDay(rangeEnd, rangeStart) ? rangeEnd : rangeStart;
  const rangeHigh = rangeStart && rangeEnd && isBeforeDay(rangeEnd, rangeStart) ? rangeStart : rangeEnd;
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const inRange = rangeLow && rangeHigh && date >= new Date(rangeLow.getFullYear(), rangeLow.getMonth(), rangeLow.getDate()) && date <= new Date(rangeHigh.getFullYear(), rangeHigh.getMonth(), rangeHigh.getDate());
    cells.push({
      date,
      label: day,
      isToday: isSameDay(date, today),
      isSelectedStart: isSameDay(date, rangeLow),
      isSelectedEnd: isSameDay(date, rangeHigh),
      isInRange: inRange
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
};

const getDateBoundsFromRows = rows => {
  const dates = (Array.isArray(rows) ? rows : [])
    .map(row => parseDateInputValue(row?.date || row?.transactionDate || row?.salesDate))
    .filter(Boolean)
    .sort((left, right) => left - right);
  if (!dates.length) return { earliest: null, latest: null };
  return {
    earliest: dates[0],
    latest: dates[dates.length - 1]
  };
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

function CardHeader({ title, subtitle, action, className = '', onTitleClick }) {
  return (
    <div className={`dashboard-card-header ${className}`.trim()}>
      <h2>
        {onTitleClick ? (
          <button
            type="button"
            className="dashboard-card-title-toggle"
            onClick={event => {
              event.stopPropagation();
              onTitleClick(event);
            }}
          >
            {title}
          </button>
        ) : title}
      </h2>
      {action || (subtitle ? <p>{subtitle}</p> : null)}
    </div>
  );
}

function Header({ filters, onFilterChange, calendarAnchorDate, calendarStartDate, calendarEndDate }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(normalizeDateRangeLabel(filters.range));
  const [draftStartDate, setDraftStartDate] = useState(filters.startDate || '');
  const [draftEndDate, setDraftEndDate] = useState(filters.endDate || '');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initialDate = parseDateInputValue(filters.startDate)
      || parseDateInputValue(filters.endDate)
      || calendarAnchorDate
      || new Date();
    return startOfMonth(initialDate);
  });
  const datePickerRef = useRef(null);

  useEffect(() => {
    const clock = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!isDatePickerOpen) return undefined;

    setDraftRange(normalizeDateRangeLabel(filters.range));
    const fallbackStart = calendarStartDate ? toDateInputValue(calendarStartDate) : '';
    const fallbackEnd = calendarEndDate ? toDateInputValue(calendarEndDate) : '';
    setDraftStartDate(filters.startDate || fallbackStart);
    setDraftEndDate(filters.endDate || fallbackEnd);
    const initialDate = parseDateInputValue(filters.startDate)
      || parseDateInputValue(filters.endDate)
      || calendarAnchorDate
      || calendarStartDate
      || new Date();
    setCalendarMonth(startOfMonth(initialDate));

    const handlePointerDown = event => {
      if (!datePickerRef.current?.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    };

    const handleKeyDown = event => {
      if (event.key === 'Escape') setIsDatePickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [calendarAnchorDate, calendarEndDate, calendarStartDate, filters.endDate, filters.range, filters.startDate, isDatePickerOpen]);

  const applyDateRange = () => {
    const nextRange = normalizeDateRangeLabel(draftRange);
    let startDate = '';
    let endDate = '';

    if (nextRange === 'Custom Range') {
      startDate = draftStartDate;
      endDate = draftEndDate;
      if (!startDate || !endDate) return;
    } else {
      const window = getPresetRangeWindow(nextRange, {
        anchorDate: calendarAnchorDate,
        earliestDate: calendarStartDate,
        latestDate: calendarEndDate
      });
      startDate = window.startDate;
      endDate = window.endDate;
    }

    onFilterChange({
      range: nextRange,
      startDate,
      endDate,
      period: getSuggestedPeriodForRange(nextRange, startDate, endDate)
    });
    setIsDatePickerOpen(false);
  };

  const handlePresetClick = preset => {
    const nextRange = normalizeDateRangeLabel(preset);
    if (nextRange === 'Custom Range') {
      setDraftRange(nextRange);
      return;
    }
    const window = getPresetRangeWindow(nextRange, {
      anchorDate: calendarAnchorDate,
      earliestDate: calendarStartDate,
      latestDate: calendarEndDate
    });
    setDraftRange(nextRange);
    setDraftStartDate(window.startDate);
    setDraftEndDate(window.endDate);
    const initialDate = parseDateInputValue(window.startDate) || new Date();
    setCalendarMonth(startOfMonth(initialDate));
  };

  const handleCalendarDayClick = day => {
    if (!day) return;
    const selectedValue = toDateInputValue(day.date);
    if (!draftStartDate || (draftStartDate && draftEndDate)) {
      setDraftRange('Custom Range');
      setDraftStartDate(selectedValue);
      setDraftEndDate('');
      return;
    }

    const start = parseDateInputValue(draftStartDate);
    if (start && isBeforeDay(day.date, start)) {
      setDraftStartDate(selectedValue);
      setDraftEndDate(toDateInputValue(start));
      setDraftRange('Custom Range');
      return;
    }

    setDraftRange('Custom Range');
    setDraftEndDate(selectedValue);
  };

  const monthWeeks = buildMonthCalendar(calendarMonth, draftStartDate, draftEndDate);
  const liveTime = currentTime.toLocaleTimeString();
  const rangeSummary = getRangeDisplayText(filters);
  const isApplyDisabled = draftRange === 'Custom Range' && (!draftStartDate || !draftEndDate);
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
        <div className="presentation-header-control presentation-date-control" ref={datePickerRef}>
          <span>Period</span>
          <div className="presentation-date-control-row">
            <button
              type="button"
              className="presentation-date-trigger"
              onClick={() => setIsDatePickerOpen(current => !current)}
              aria-label="Open date range picker"
            >
              <Calendar size={20} strokeWidth={2.6} />
            </button>
            {rangeSummary ? (
              <span className="presentation-date-range" title={rangeSummary}>{rangeSummary}</span>
            ) : null}
          </div>
          <AnimatePresence>
            {isDatePickerOpen && (
              <motion.div
                className="presentation-date-popover"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <div className="presentation-date-popover-shell">
                  <div className="presentation-date-popover-presets" role="list" aria-label="Date range presets">
                    {dateRangeOptions.map(option => (
                      <button
                        key={option}
                        type="button"
                        className={`presentation-date-preset${draftRange === option ? ' is-active' : ''}`}
                        onClick={() => handlePresetClick(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <div className="presentation-date-calendar">
                    <div className="presentation-date-calendar-header">
                      <span>{formatMonthTitle(calendarMonth)}</span>
                      <div className="presentation-date-calendar-nav">
                        <button type="button" onClick={() => setCalendarMonth(month => addMonths(month, -1))} aria-label="Previous month">
                          <ChevronLeft size={16} />
                        </button>
                        <button type="button" onClick={() => setCalendarMonth(month => addMonths(month, 1))} aria-label="Next month">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="presentation-date-calendar-weekdays" aria-hidden="true">
                      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <span key={day}>{day}</span>)}
                    </div>
                    <div className="presentation-date-calendar-grid" role="grid" aria-label="Calendar days">
                      {monthWeeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => {
                        if (!day) {
                          return <span key={`empty-${weekIndex}-${dayIndex}`} className="presentation-date-calendar-cell is-empty" />;
                        }

                        const classes = [
                          'presentation-date-calendar-cell',
                          day.isToday ? 'is-today' : '',
                          day.isInRange ? 'is-in-range' : '',
                          day.isSelectedStart ? 'is-range-start' : '',
                          day.isSelectedEnd ? 'is-range-end' : ''
                        ].filter(Boolean).join(' ');

                        return (
                          <button
                            key={day.date.toISOString()}
                            type="button"
                            className={classes}
                            onClick={() => handleCalendarDayClick(day)}
                          >
                            {day.label}
                          </button>
                        );
                      }))}
                    </div>
                  </div>
                </div>
                <div className="presentation-date-popover-custom">
                  <label>
                    <span>Start Date</span>
                    <input
                      type="date"
                      value={draftStartDate}
                      onChange={event => {
                        setDraftRange('Custom Range');
                        setDraftStartDate(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    <span>End Date</span>
                    <input
                      type="date"
                      value={draftEndDate}
                      onChange={event => {
                        setDraftRange('Custom Range');
                        setDraftEndDate(event.target.value);
                      }}
                    />
                  </label>
                </div>
                <div className="presentation-date-popover-actions">
                  <button type="button" className="presentation-date-secondary" onClick={() => setIsDatePickerOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="presentation-date-primary" onClick={applyDateRange} disabled={isApplyDisabled}>
                    Apply
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
      <CardHeader title="Top 10 Companies" subtitle="Amount, sales performance, and payment terms" />
      <PresentationTooltip tooltip={tooltip} />
      <div className="company-table-shell">
        <AutoScrollList
          className="company-table-list"
          items={data}
          duration={38}
          renderItem={(company, index, isDuplicate) => {
            const name = company.companyName || company.name || 'Unassigned';
            const performance = company.salesPerformance || 'Retention';
            const term = company.paymentTerm || 'Unspecified';
            const photo = company.companyPhoto;
            return (
              <article
                key={`${name}-${isDuplicate ? 'loop' : 'row'}-${index}`}
                className={`${activeCompany === index ? 'is-active' : ''}${hasActiveCompany && activeCompany !== index ? ' is-muted' : ''}`.trim()}
                onMouseMove={event => {
                  setActiveCompany(index);
                  setTooltip({
                    ...getLocalPointer(event),
                    title: name,
                    lines: [
                      `Amount: ${company.amount}`,
                      `Sales Performance: ${performance}`,
                      `Terms: ${term}`
                    ]
                  });
                }}
                onMouseLeave={() => {
                  setActiveCompany(null);
                  setTooltip(null);
                }}
              >
                <div className="company-row-left">
                  <span className="company-rank">{company.rank || index + 1}</span>
                  <span className="company-photo" title={name}>
                    {photo ? <img src={photo} alt="" /> : name.slice(0, 1)}
                  </span>
                  <strong title={name}>{name}</strong>
                </div>
                <div className="company-row-right">
                  <span className="company-amount">{company.amount}</span>
                  <span className={`company-status is-${String(performance).toLowerCase().replace(/\s+/g, '-')}`}>{performance}</span>
                  <span className="company-term">{term}</span>
                </div>
              </article>
            );
          }}
        />
      </div>
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

const termsModeCopy = {
  label: 'TERMS',
  totalLabel: 'TOTAL TERMS',
  centerMetricLabel: 'TERMS',
  valueLabel: value => formatCompactCurrency(value),
  centerValueLabel: value => Math.round(value).toLocaleString()
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

const buildVisiblePresentationTerms = source => (
  (Array.isArray(source) ? source : [])
    .map(term => ({
      ...term,
      name: term.name || term.label || 'Term',
      label: term.label || term.name || 'Term',
      amount: toNumber(term.rawValue ?? term.amount ?? term.totalSalesAmount ?? term.value),
      totalLabel: formatCompactCurrency(term.rawValue ?? term.amount ?? term.totalSalesAmount ?? term.value),
      color: term.color || '#D16002'
    }))
    .filter(term => term.amount > 0)
    .sort((a, b) => {
      const amountDelta = b.amount - a.amount;
      if (amountDelta) return amountDelta;
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
);

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

function Products({
  data,
  termsData,
  totals,
  validation,
  enlarged = false,
  viewMode,
  onViewModeChange,
  productMode,
  onProductModeChange
}) {
  const [isChartReady, setIsChartReady] = useState(false);
  const activeMode = productModeCopy[productMode] ? productMode : 'quantity';
  const isTermsMode = viewMode === 'terms';
  const activeCopy = isTermsMode ? termsModeCopy : productModeCopy[activeMode];
  const chartData = useMemo(() => {
    const rows = isTermsMode
      ? buildVisiblePresentationTerms(termsData)
          .map(term => ({
            ...term,
            rawValue: term.amount,
            totalLabel: term.totalLabel,
            amountLabel: term.totalLabel
          }))
      : buildVisiblePresentationProducts(data)
          .map(product => ({
            ...product,
            rawValue: toNumber(product[activeMode]),
            totalLabel: productModeCopy[activeMode].valueLabel(product[activeMode]),
            displayValue: productModeCopy[activeMode].valueLabel(product[activeMode]),
            amountLabel: formatCompactCurrency(product.revenue ?? product.sales)
          }))
      .filter(item => item.rawValue > 0);
    const denominator = rows.reduce((sum, row) => sum + toNumber(row.rawValue), 0) || 1;
    return rows.map(item => ({
      ...item,
      value: Math.round((toNumber(item.rawValue) / denominator) * 1000) / 10,
      color: item.color || (isTermsMode ? '#D16002' : (isOthersProduct(item) ? '#6f6f6f' : '#D16002'))
    }));
  }, [activeMode, data, isTermsMode, termsData]);
  const isValid = isTermsMode || (validation?.valid !== false && validateProductPieRows(data, chartData, activeMode));
  const [activeProduct, setActiveProduct] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const productRefs = useRef({});
  const productListRef = useRef(null);
  const donutRef = useRef(null);
  const fallbackSize = enlarged ? 380 : 270;
  const observedSize = useResizeObserverSize(donutRef, fallbackSize);
  const total = isTermsMode
    ? chartData.reduce((sum, term) => sum + toNumber(term.count), 0)
    : toNumber(totals?.[activeMode] || chartData.reduce((sum, product) => sum + product.rawValue, 0));
  const centerValueLabel = activeCopy.centerValueLabel(total);
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
    count: isTermsMode ? (product.count || 0) : toNumber(product[activeMode] ?? product.quantity),
    displayValue: isTermsMode ? (product.count || 0) : productModeCopy[activeMode].valueLabel(product[activeMode]),
    amountLabel: product.amountLabel || product.totalLabel
  }));
  let offset = 0;
  const hasActiveProduct = Boolean(activeProduct);

  useEffect(() => {
    productListRef.current?.scrollTo?.({ top: 0 });
    setActiveProduct(null);
    setTooltip(null);
  }, [activeMode, viewMode]);

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

  useEffect(() => {
    setActiveProduct(null);
    setTooltip(null);
    productListRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [viewMode]);

  return (
    <motion.article className={`dashboard-card products-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion}>
      <CardHeader
        title={isTermsMode ? 'Terms' : 'Products'}
        onTitleClick={() => onViewModeChange?.(current => (current === 'products' ? 'terms' : 'products'))}
        subtitle={isTermsMode ? 'Payment terms share' : 'Product sales share'}
        action={(
          isTermsMode ? null : (
            <div className="products-card-action">
              <p>Product sales share</p>
              <button
                type="button"
                className={`product-mode-switch is-${activeMode}`}
                onClick={event => {
                  event.stopPropagation();
                  onProductModeChange?.(current => productModes[(productModes.indexOf(current) + 1) % productModes.length] || 'quantity');
                }}
                aria-label="Switch products chart mode"
              >
                <span>{productModeCopy[activeMode].label}</span>
              </button>
            </div>
          )
        )}
      />
      <div className="products-layout" onMouseLeave={clearProductHover}>
        <PresentationTooltip tooltip={tooltip} />
        <div className="donut-container" ref={donutRef}>
          {isChartReady && chartData.length ? (
          <svg
            className="products-donut-svg"
            viewBox={`0 0 ${size} ${size}`}
            aria-label={isTermsMode ? 'Terms share donut chart' : 'Product sales share donut chart'}
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
                      lines: isTermsMode
                        ? [`Count: ${product.count || 0}`, `Amount: ${product.amountLabel}`]
                          : [`Total ${activeCopy.centerMetricLabel.toLowerCase()}: ${product.displayValue}`, `Amount: ${formatCompactCurrency(product.revenue ?? product.sales)}`]
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
            <small>{activeCopy.centerMetricLabel}</small>
          </div>
        </div>

        <div
          className={`product-pie-list${isTermsMode ? ' is-terms' : ' is-products'}`}
          ref={productListRef}
          role="list"
          aria-label={isTermsMode ? 'Terms pie contents' : 'Product pie contents'}
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
                      lines: isTermsMode
                        ? [`Count: ${item.count || 0}`, `Amount: ${item.amountLabel}`]
                      : [`Total ${activeCopy.centerMetricLabel.toLowerCase()}: ${item.displayValue}`, `Amount: ${item.amountLabel}`]
                    });
                }}
                onFocus={() => setActiveProduct(item.name)}
                onBlur={() => setActiveProduct(null)}
                tabIndex="0"
                role="listitem"
                >
                  <i style={{ background: item.color }} />
                  <strong title={item.name}>{item.name}</strong>
                <b>{item.displayValue || item.count}</b>
                  <span>{item.amountLabel}</span>
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
  const chartData = [...(data.length ? data : [])].sort((a, b) => {
    const delta = toNumber(b.count) - toNumber(a.count);
    if (delta) return delta;
    return String(a.displayLabel || a.label || '').localeCompare(String(b.displayLabel || b.label || ''));
  });
  const [activeCounter, setActiveCounter] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const hasActiveCounter = activeCounter !== null;
  const width = enlarged ? 720 : 600;
  const height = enlarged ? 360 : 286;
  const padding = { top: 16, right: 18, bottom: 42, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const barGap = chartData.length > 1 ? 54 : 0;
  const barWidth = Math.max(78, (plotWidth - barGap * (chartData.length - 1)) / Math.max(1, chartData.length));
  const axisTicks = [0, 35, 70, 105, 140];
  const yMax = axisTicks[axisTicks.length - 1];

  return (
    <motion.article className={`dashboard-card counter-card${enlarged ? ' is-enlarged' : ''}`} variants={panelMotion}>
      <CardHeader title="Sales Performance" subtitle="Acquisition, retention, and revival" />
      <div className="chart-container counter-bar-chart" onMouseLeave={() => { setActiveCounter(null); setTooltip(null); }}>
        <PresentationTooltip tooltip={tooltip} />
        <svg
          className="sales-performance-graph"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Sales performance bar graph"
          preserveAspectRatio="xMidYMid meet"
        >
          {axisTicks.map(tick => {
            const y = padding.top + plotHeight - ((tick / yMax) * plotHeight);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="4 5"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#475569"
                  fontSize={12}
                  fontWeight="800"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {chartData.map((counter, index) => {
            const value = toNumber(counter.count);
            const ratio = Math.max(value / yMax, 0);
            const label = counter.displayLabel || counter.label;
            const x = padding.left + index * (barWidth + barGap);
            const barHeight = Math.max(14, plotHeight * ratio);
            const y = padding.top + (plotHeight - barHeight);
            const isActive = activeCounter === index;
            const isMuted = hasActiveCounter && activeCounter !== index;
            const centerX = x + barWidth / 2;
            const labelY = height - 12;
            const labelFill = '#1f2937';

            return (
              <g
                key={counter.rawLabel || counter.label}
                className={`sales-performance-bar${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                onMouseMove={event => {
                  setActiveCounter(index);
                  setTooltip({
                    ...getLocalPointer(event),
                    title: label,
                    lines: [`Total: ${value.toLocaleString()}`, `Share: ${formatShare(counter.percentage)}%`]
                  });
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="12"
                  fill={counter.color}
                  opacity={isMuted ? 0.42 : 1}
                  style={isActive ? { filter: 'drop-shadow(0 0 10px rgba(255,159,67,0.28))' } : undefined}
                />
                <text
                  x={centerX}
                  y={labelY}
                  textAnchor="middle"
                  fill={labelFill}
                  fontSize={12}
                  fontWeight="900"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="0.4"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
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
  const [productsViewMode, setProductsViewMode] = useState('products');
  const [productsMetricMode, setProductsMetricMode] = useState('quantity');
  const calendarDateBounds = useMemo(
    () => getDateBoundsFromRows(analytics.liveData?.rawRows || []),
    [analytics.liveData?.rawRows]
  );

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
    if (key && typeof key === 'object') {
      writeDashboardFilters(key);
      return;
    }
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
      <Header
        filters={filters}
        onFilterChange={updateFilter}
        calendarAnchorDate={calendarDateBounds.earliest || calendarDateBounds.latest || new Date()}
        calendarStartDate={calendarDateBounds.earliest}
        calendarEndDate={calendarDateBounds.latest}
      />
      <StatsGrid data={presentationData.kpis} onFocus={setFocusedPanel} />

      <section className="middle-grid">
        <FocusShell title="Sales Performance" onFocus={setFocusedPanel}>
          {enlarged => (
            <Counter data={presentationData.counters} enlarged={enlarged} />
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
              termsData={presentationData.terms}
              totals={presentationData.productTotals}
              validation={presentationData.productValidation}
              enlarged={enlarged}
              viewMode={productsViewMode}
              onViewModeChange={setProductsViewMode}
              productMode={productsMetricMode}
              onProductModeChange={setProductsMetricMode}
            />
          )}
        </FocusShell>
        <FocusShell title="Sales Rep Rankings" onFocus={setFocusedPanel}>
          {enlarged => <Rankings data={presentationData.reps} enlarged={enlarged} />}
        </FocusShell>
      </section>
      <FocusModal panel={focusedPanel} onClose={() => setFocusedPanel(null)} />
    </motion.main>
  );
}
