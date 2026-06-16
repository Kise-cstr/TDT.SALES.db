import { motion } from 'framer-motion';
import { Minimize2, Radio } from 'lucide-react';
import logo from '../../assets/logos/tdt_logo.png';
import { enterpriseFilterOptions } from '../../data/enterprisePresentationData';

export default function EnterprisePresentationHeader({ onExit, refreshLabel = 'CSV Upload Data', filters, onFiltersChange, branches = enterpriseFilterOptions.branches, showFilters = true }) {
  const update = key => event => {
    const next = { ...filters, [key]: event.target.value };
    if (key === 'period' && (event.target.value === 'Yearly' || event.target.value === 'YTD')) {
      next.month = 'All Months';
    }
    onFiltersChange?.(next);
  };

  return (
    <>
      <motion.header
        className="enterprise-present-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div className="enterprise-present-header-left">
          <img src={logo} alt="TDT Powersteel" className="enterprise-present-logo" />
          <div>
            <p className="enterprise-present-eyebrow">TDT Powersteel</p>
            <h1>TDT Powersteel Dashboard</h1>
          </div>
        </div>

        <div className="enterprise-present-mode">
          <Radio size={16} />
          <strong>Live Present</strong>
          <small>{refreshLabel}</small>
        </div>

        <div className="enterprise-present-header-right">
          <span className="enterprise-present-clock">Reporting Period: {filters.month === 'All Months' ? 'Jan - Jun' : filters.month} {filters.year}</span>
          <button className="enterprise-present-exit" type="button" onClick={onExit}>
            <Minimize2 size={15} />
            Exit Present
          </button>
        </div>
      </motion.header>

      {showFilters ? (
        <motion.section className="enterprise-present-filterbar" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <label>
            <span>Period</span>
            <select value={filters.period} onChange={update('period')}>
              {enterpriseFilterOptions.periods.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Year</span>
            <select value={filters.year} onChange={update('year')}>
              {enterpriseFilterOptions.years.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Month</span>
            <select value={filters.month} onChange={update('month')} disabled={filters.period === 'Yearly' || filters.period === 'YTD'}>
              {enterpriseFilterOptions.months.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Branch</span>
            <select value={filters.branch} onChange={update('branch')}>
              {branches.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => onFiltersChange?.({ period: 'Monthly', year: '2026', month: 'All Months', branch: 'all' })}>
            Reset Filters
          </button>
        </motion.section>
      ) : null}
    </>
  );
}
