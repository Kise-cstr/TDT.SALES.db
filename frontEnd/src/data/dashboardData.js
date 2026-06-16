import { baseSalesReps } from './salesRepData';

export const metricCards = [
  { metric: 'sales', title: 'Total Gross Sales', value: 'PHP 2.1M', trend: 'up', trendValue: '+8.2%', icon: 'dollar' },
  { metric: 'gk', title: 'Total GK', value: 'PHP 418K', trend: 'up', trendValue: '+6.9%', icon: 'chart' },
  { metric: 'tons', title: 'Total Tons', value: '152.3 TONS', trend: 'up', trendValue: 'steel volume', icon: 'target' },
  { metric: 'leads', title: 'Total Leads Gathered', value: '1,248', trend: 'up', trendValue: '+12.5%', icon: 'users' },
  { metric: 'deals', title: 'Closed Deals', value: '324', trend: 'down', trendValue: '-3.1%', icon: 'target' },
  { metric: 'conversion', title: 'Target Attainment', value: '25.9%', trend: 'up', trendValue: '+2.4%', icon: 'chart' },
  { metric: 'active-reps', title: 'Active Sales Reps', value: '18', trend: 'up', trendValue: '+2', icon: 'users' },
  { metric: 'avg-rep', title: 'Average Sales per Rep', value: 'PHP 117K', trend: 'up', trendValue: '+5.1%', icon: 'dollar' },
  { metric: 'growth', title: 'Monthly Sales Growth %', value: '8.2%', trend: 'up', trendValue: '+1.8%', icon: 'chart' },
  { metric: 'clients', title: 'Total Clients', value: '486', trend: 'up', trendValue: '+34', icon: 'users' },
  { metric: 'top-rep', title: 'Top Performing Rep', value: baseSalesReps[0]?.name || 'Unassigned', trend: 'up', trendValue: '94%', icon: 'target' }
];

export const monthlySalesPerformance = [
  { month: 'Jan', sales: 4000, target: 3500 },
  { month: 'Feb', sales: 6200, target: 5500 },
  { month: 'Mar', sales: 5100, target: 4800 },
  { month: 'Apr', sales: 7900, target: 7000 },
  { month: 'May', sales: 6800, target: 6500 },
  { month: 'Jun', sales: 8500, target: 8000 }
];

export const sourceDistribution = [
  { name: 'Facebook Ads', value: 400, percentage: 40 },
  { name: 'Walk In', value: 300, percentage: 30 },
  { name: 'Referral', value: 200, percentage: 20 },
  { name: 'Website', value: 100, percentage: 10 }
];

export const sourceDistributionColors = ['#f97316', '#fb923c', '#c65f1a', '#8a5f4f', '#f8bd6b', '#a3a3a3'];

export const representativeSummary = [
  { id: 1, name: baseSalesReps[0]?.name || 'Unassigned', sales: 'PHP 210,000', deals: 14 },
  { id: 2, name: baseSalesReps[1]?.name || 'Unassigned', sales: 'PHP 180,000', deals: 11 },
  { id: 3, name: baseSalesReps[2]?.name || 'Unassigned', sales: 'PHP 150,000', deals: 9 }
];
