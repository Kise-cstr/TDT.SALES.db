import {
  dailySalesTrend,
  kpiProgressData,
  leadSourceData,
  monthlyGrossSalesTrend,
  productData,
  salesByRep,
  salesHeatmap
} from './enterpriseAnalytics';
import { baseSalesReps } from './salesRepData';

const sourceColors = ['#D16002', '#CC5500', '#ff9f43', '#f8bd6b', '#8a5f4f', '#5f5f5f'];

export const presentationMetrics = [
  { label: 'Target Achievement', value: '94%', detail: 'Pacing above forecast' },
  { label: 'Number of Transactions', value: '324', detail: '' },
  { label: 'Total Gross Sales', value: 'PHP 2.1M', detail: '+8.2% growth' },
  { label: 'GK Value', value: 'PHP 680K', detail: 'High-value pipeline' },
  { label: 'Number of Clients', value: '486', detail: 'Unique company names' }
];

export const presentationSalesTrend = [
  { month: 'Jan', leads: 180, sales: 4.0, target: 3.5 },
  { month: 'Feb', leads: 230, sales: 6.2, target: 5.5 },
  { month: 'Mar', leads: 212, sales: 5.1, target: 4.8 },
  { month: 'Apr', leads: 286, sales: 7.9, target: 7.0 },
  { month: 'May', leads: 264, sales: 6.8, target: 6.5 },
  { month: 'Jun', leads: 312, sales: 8.5, target: 8.0 }
];

export const presentationSourceData = [
  { name: 'Facebook Ads', value: 400, color: '#D16002' },
  { name: 'Walk In', value: 300, color: '#CC5500' },
  { name: 'Referral', value: 200, color: '#ff9f43' },
  { name: 'Website', value: 100, color: '#5f5f5f' }
];

export const presentationRepData = [
  { name: baseSalesReps[0]?.name || 'Unassigned', sales: 'PHP 210K', deals: 14, rank: 1 },
  { name: baseSalesReps[1]?.name || 'Unassigned', sales: 'PHP 180K', deals: 11, rank: 2 },
  { name: baseSalesReps[2]?.name || 'Unassigned', sales: 'PHP 150K', deals: 9, rank: 3 },
  { name: baseSalesReps[3]?.name || 'Unassigned', sales: 'PHP 132K', deals: 8, rank: 4 }
];

export const analyticsPresentationMetrics = [
  { label: 'Gross Sales', value: 'PHP 2.1M', detail: '84% of target' },
  { label: 'GK Value', value: 'PHP 418K', detail: '83.6% completion' },
  { label: 'Leads', value: '1,248', detail: '89.1% of target' },
  { label: 'Closed Deals', value: '324', detail: '85.2% completion' },
  { label: 'Conversion', value: '26%', detail: '+2.4% lift' },
  { label: 'Top Source', value: 'Google', detail: '172 leads' }
];

export const analyticsPresentationLeadSources = leadSourceData.slice(0, 6).map((source, index) => ({
  name: source.label,
  value: source.leads,
  color: sourceColors[index % sourceColors.length]
}));

export const analyticsPresentationProducts = productData.map((product, index) => ({
  name: product.label,
  value: product.contribution,
  color: sourceColors[index % sourceColors.length]
}));

export const analyticsPresentationKpi = kpiProgressData.map(item => ({
  label: item.label,
  actual: item.actual,
  target: item.target,
  completion: item.completion
}));

export const analyticsPresentationHeatmap = salesHeatmap.map(day => ({
  day: day.day,
  level: day.level
}));

export const analyticsDailySales = dailySalesTrend;
export const analyticsMonthlySales = monthlyGrossSalesTrend;

export const salesTeamPresentationMetrics = [
  { label: 'Number of Clients', value: '486', detail: 'Unique company names' },
  { label: 'Top Performer', value: baseSalesReps[0]?.name || 'Unassigned', detail: '98% performance' },
  { label: 'Deals Converted', value: '452', detail: 'Selected period' },
  { label: 'Converted', value: '452', detail: 'Completed sales orders' },
  { label: 'Gross Sales', value: 'PHP 1.18M', detail: 'Top 8 reps' },
  { label: 'Elite Reps', value: '4', detail: '90%+ performance' }
];

export const salesTeamPresentationTopReps = [...baseSalesReps]
  .sort((a, b) => b.performance - a.performance)
  .slice(0, 3)
  .map((rep, index) => ({
    rank: index + 1,
    name: rep.name,
    department: rep.department,
    performance: `${rep.performance}%`,
    leads: rep.leadsGathered,
    converted: rep.convertedLeads,
    sales: `PHP ${Math.round(rep.grossSalesValue / 1000)}K`
  }));

export const salesTeamPresentationRankings = salesByRep.map((rep, index) => ({
  rank: index + 1,
  name: rep.label,
  sales: `PHP ${Math.round(rep.sales / 1000)}K`,
  deals: rep.deals,
  leads: rep.leads,
  gk: `${rep.gk}%`
}));

export const salesTeamPresentationActivity = salesByRep.map(rep => ({
  label: rep.label.split(' ')[0],
  leads: rep.leads,
  deals: rep.deals,
  sales: Math.round(rep.sales / 1000)
}));
