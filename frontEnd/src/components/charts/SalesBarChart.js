import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import '../../styles/charts.css';
import { dailySalesTrend, monthlyGrossSalesTrend, weeklySalesTrend } from '../../data/enterpriseAnalytics';
import SalesComparisonChart, { SalesComparisonLegend } from './SalesComparisonChart';

const metricConfig = {
  all: { title: 'Sales Comparison', showGs: true, showGk: true },
  sales: { title: 'Gross Sales Comparison', showGs: true, showGk: false },
  gk: { title: 'GK Comparison', showGs: false, showGk: true },
  leads: { title: 'Sales Comparison', showGs: true, showGk: true },
  reps: { title: 'Sales Comparison', showGs: true, showGk: true }
};

const fallbackDataByPeriod = {
  Daily: dailySalesTrend.map((item, index) => ({
    label: item.label,
    sales: item.sales,
    gk: Math.round(item.sales * 0.18),
    target: Math.round(item.sales * 1.08),
    leads: 24 + index * 3,
    reps: 4 + (index % 2)
  })),
  Weekly: weeklySalesTrend.map((item, index) => ({
    label: item.label,
    sales: item.sales,
    gk: Math.round(item.sales * 0.19),
    target: Math.round(item.sales * 1.07),
    leads: 120 + index * 18,
    reps: 6 + (index % 3)
  })),
  Monthly: monthlyGrossSalesTrend
};

function SalesBarChart({ data: uploadedData, metric = 'all', period = 'Monthly' }) {
  const data = useMemo(
    () => (uploadedData?.length ? uploadedData : (fallbackDataByPeriod[period] || monthlyGrossSalesTrend)).map((item, index) => ({
      leads: 180 + (index * 14),
      reps: 5 + (index % 3),
      ...item
    })),
    [period, uploadedData]
  );
  const activeMetric = metricConfig[metric] || metricConfig.all;
  const chartData = useMemo(
    () => data.map(row => ({
      month: row.label,
      gross: Math.round(((Number(row.sales) || 0) / 1000000) * 10) / 10,
      gk: Math.round(((Number(row.gk) || 0) / 1000000) * 10) / 10
    })),
    [data]
  );

  return (
    <motion.div
      className="chart-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{ willChange: 'opacity, transform' }}
    >
      <div className="chart-glass-inner" />
      <div className="chart-header">
        <h2 className="chart-title">{activeMetric.title}</h2>
        <SalesComparisonLegend showGk={activeMetric.showGk} showGs={activeMetric.showGs} />
      </div>
      <div className="chart-viewport chart-viewport-wide">
        <SalesComparisonChart data={chartData} metric={metric} wideLayout />
      </div>
    </motion.div>
  );
}

export default memo(SalesBarChart);
