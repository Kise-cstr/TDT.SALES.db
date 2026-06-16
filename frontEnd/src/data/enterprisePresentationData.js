import { baseSalesReps } from './salesRepData';
import { filterOptions } from './enterpriseAnalytics';

export const enterpriseFilterOptions = filterOptions;

export const enterpriseKpiSummary = [
  { label: 'Total Records', value: '787' },
  { label: 'Companies', value: '486' },
  { label: 'Sales Value', value: 'PHP 259M' }
];

export const enterpriseTotalSalesDisplay = 'PHP 259M';

export const enterpriseMonthlyTrend = [
  { month: 'Jan', sales: 50, gk: 4.1 },
  { month: 'Feb', sales: 54, gk: 5.2 },
  { month: 'Mar', sales: 76, gk: 5.7 },
  { month: 'Apr', sales: 56, gk: 5.7 },
  { month: 'May', sales: 23, gk: 2.9 }
];

export const enterpriseGsGkTrend = enterpriseMonthlyTrend;

export const enterpriseCompanies = [
  { id: 1, company: 'AR NICHOLE EDWARD C. AMORIN', value: 77000 },
  { id: 2, company: 'HAE YONG INC.', value: 76000 },
  { id: 3, company: 'GRAND APEX CONSTRUCTION INC', value: 73000 },
  { id: 4, company: 'JLFP CONSTRUCTION SERVICES', value: 72000 }
];

export const enterpriseLiveCompany = {
  name: 'ARR CONSTRUCTION',
  salesRep: baseSalesReps[0]?.name || 'Unassigned',
  clientType: 'Contractor',
  value: 'PHP 14,800,000',
  salesTerms: 'FT'
};

export const enterpriseItemsSummary = [
  { name: 'DRBS', value: 52.9, amount: 176000000, color: '#D16002' },
  { name: 'WIDE FLANGE', value: 17.8, amount: 59000000, color: '#CC5500' },
  { name: 'SHEET PILE', value: 16.9, amount: 56000000, color: '#ff9f43' },
  { name: 'ANGLE BARS', value: 5.2, amount: 17000000, color: '#8a5f4f' },
  { name: 'CHANNEL BAR', value: 4, amount: 13000000, color: '#f8bd6b' },
  { name: 'GI/BI PIPES', value: 3.2, amount: 11000000, color: '#5f5f5f' }
];

export const enterpriseLeaderboard = [
  { rank: 4, rep: baseSalesReps[0]?.name || 'Unassigned', records: 60, value: 32000000 },
  { rank: 5, rep: baseSalesReps[1]?.name || 'Unassigned', records: 89, value: 23000000 },
  { rank: 6, rep: baseSalesReps[2]?.name || 'Unassigned', records: 101, value: 14000000 },
  { rank: 7, rep: baseSalesReps[3]?.name || 'Unassigned', records: 66, value: 14000000 }
];

const funnelColors = ['#D16002', '#CC5500', '#9a5f2e', '#8a5f4f', '#f8bd6b', '#5f5f5f'];

export const enterpriseTermsFunnel = [
  { name: 'Online-Cash', value: 295, share: 39, fill: funnelColors[0], width: 100 },
  { name: '30 days PDC', value: 136, share: 18, fill: funnelColors[1], width: 92 },
  { name: 'Online Check', value: 84, share: 11.1, fill: funnelColors[2], width: 84 },
  { name: '45 days PDC', value: 66, share: 8.7, fill: funnelColors[3], width: 76 },
  { name: '60 days PDC', value: 60, share: 7.9, fill: funnelColors[4], width: 68 }
];

export const enterpriseTermsFromUpload = enterpriseTermsFunnel;

export function formatEnterpriseCurrency(value) {
  if (value >= 1000000) {
    return `PHP ${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `PHP ${Math.round(value / 1000)}K`;
  }

  return `PHP ${value.toLocaleString()}`;
}

export function formatCompactNumber(value) {
  return value.toLocaleString();
}
