import { motion } from 'framer-motion';
import { FileSpreadsheet, Minimize2, Radio } from 'lucide-react';
import logo from '../../assets/logos/tdt_logo.png';
import { metricOptions } from '../../utils/dashboardFilters';

const headerPeriodOptions = ['Monthly', 'Weekly', 'Daily'];
const headerTimelineOptions = ['Weekly', 'Monthly', 'Yearly'];

export default function PresentationHeader({ dateRange, filters, onFilterChange, onExit, refreshLabel = 'CSV upload', isLive = false }) {
  return (
    <motion.header
      className="presentation-header"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="presentation-brand">
        <img src={logo} alt="TDT Powersteel" className="presentation-logo" />
        <div>
          <p className="presentation-company">TDT Powersteel</p>
          <h1>TDT POWERSTEEL DASHBOARD</h1>
        </div>
      </div>

      <div className={`presentation-live ${isLive ? 'is-live' : 'is-csv'}`}>
        <span className="presentation-live-dot">
          {isLive ? <Radio size={14} /> : <FileSpreadsheet size={14} />}
        </span>
        <span>{isLive ? 'LIVE PRESENT' : 'PRESENT MODE'}</span>
        <small>{refreshLabel}</small>
      </div>

      <div className="presentation-header-right">
        {filters && onFilterChange && (
          <>
            <label className="presentation-header-control">
              <span>Period</span>
              <select value={filters.period} onChange={event => onFilterChange('period', event.target.value)}>
                {headerPeriodOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="presentation-header-control">
              <span>Timeline</span>
              <select value={filters.timeline || 'Monthly'} onChange={event => onFilterChange('timeline', event.target.value)}>
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
          </>
        )}
        <span className="presentation-date-range">{dateRange}</span>
        <button className="presentation-exit-btn" type="button" onClick={onExit}>
          <Minimize2 size={16} />
          Exit Present
        </button>
      </div>
    </motion.header>
  );
}
