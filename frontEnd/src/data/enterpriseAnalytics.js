import { baseSalesReps } from './salesRepData';

export const filterOptions = {
  periods: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'],
  ranges: ['Current Month', 'Last 3 Months', 'Last 6 Months', 'Year to Date', 'All Time', 'Custom Date Range'],
  years: ['All Years', '2026', '2025', '2024'],
  months: [
    'All Months',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ],
  branches: [
    { id: 'all', label: 'All Branches' },
    { id: 'batangas', label: 'Batangas' },
    { id: 'legazpi', label: 'Legazpi' },
    { id: 'north-luzon', label: 'North Luzon' },
    { id: 'south-luzon', label: 'South Luzon' }
  ]
};

export const monthlyGrossSalesTrend = [
  { label: 'Jan', sales: 1450000, gk: 278000, target: 1320000 },
  { label: 'Feb', sales: 1620000, gk: 304000, target: 1500000 },
  { label: 'Mar', sales: 1860000, gk: 355000, target: 1700000 },
  { label: 'Apr', sales: 2040000, gk: 392000, target: 1900000 },
  { label: 'May', sales: 2100000, gk: 418000, target: 2000000 },
  { label: 'Jun', sales: 2260000, gk: 446000, target: 2150000 }
];

export const dailySalesTrend = [
  { label: 'Mon', sales: 310000 },
  { label: 'Tue', sales: 385000 },
  { label: 'Wed', sales: 342000 },
  { label: 'Thu', sales: 428000 },
  { label: 'Fri', sales: 476000 },
  { label: 'Sat', sales: 298000 }
];

export const weeklySalesTrend = [
  { label: 'W1', sales: 820000, conversion: 22 },
  { label: 'W2', sales: 980000, conversion: 25 },
  { label: 'W3', sales: 1120000, conversion: 27 },
  { label: 'W4', sales: 1180000, conversion: 29 }
];

export const salesByRep = [
  { label: baseSalesReps[0]?.name || 'Unassigned', sales: 426000, leads: 172, deals: 48, gk: 22 },
  { label: baseSalesReps[1]?.name || 'Unassigned', sales: 398000, leads: 158, deals: 42, gk: 20 },
  { label: baseSalesReps[2]?.name || 'Unassigned', sales: 346000, leads: 141, deals: 36, gk: 18 },
  { label: baseSalesReps[3]?.name || 'Unassigned', sales: 312000, leads: 125, deals: 31, gk: 17 },
  { label: baseSalesReps[4]?.name || 'Unassigned', sales: 288000, leads: 118, deals: 28, gk: 16 }
];

export const branchSales = [
  { label: 'Caloocan', sales: 720000 },
  { label: 'Meycauayan', sales: 610000 },
  { label: 'Cebu', sales: 438000 },
  { label: 'Davao', sales: 352000 },
  { label: 'Laguna', sales: 284000 }
];

export const branchData = [
  { label: 'Caloocan', count: 128, sales: 720000, gk: 138000 },
  { label: 'Meycauayan', count: 104, sales: 610000, gk: 116000 },
  { label: 'Cebu', count: 82, sales: 438000, gk: 83000 },
  { label: 'Davao', count: 67, sales: 352000, gk: 69000 },
  { label: 'Laguna', count: 54, sales: 284000, gk: 52000 }
];

export const clientTypeSales = [
  { name: 'Contractor', value: 38 },
  { name: 'Dealer', value: 24 },
  { name: 'Corporate', value: 19 },
  { name: 'Walk-in', value: 12 },
  { name: 'Government', value: 7 }
];

export const leadSourceData = [
  { label: 'BCI', leads: 96, conversion: 22, deals: 21 },
  { label: 'COLLATS', leads: 84, conversion: 18, deals: 15 },
  { label: 'DPWH', leads: 63, conversion: 26, deals: 16 },
  { label: 'EMAIL', leads: 118, conversion: 20, deals: 24 },
  { label: 'FACEBOOK GROUP', leads: 144, conversion: 17, deals: 25 },
  { label: 'FACEBOOK PAGE', leads: 156, conversion: 21, deals: 33 },
  { label: 'GOOGLE/INTERNET', leads: 172, conversion: 29, deals: 50 },
  { label: 'PR LEADS', leads: 71, conversion: 24, deals: 17 },
  { label: 'ROVING', leads: 139, conversion: 19, deals: 26 },
  { label: 'VIBER', leads: 112, conversion: 23, deals: 26 },
  { label: 'WEBSITE/LIVECHAT', leads: 93, conversion: 31, deals: 29 }
];

export const termsData = [
  { label: 'FT', count: 88, sales: 680000, gk: 126000 },
  { label: 'REP', count: 71, sales: 512000, gk: 94000 },
  { label: '1DLM', count: 46, sales: 404000, gk: 79000 },
  { label: '1Aga', count: 38, sales: 328000, gk: 64000 },
  { label: '1Mrky', count: 32, sales: 286000, gk: 53000 },
  { label: '1Mldy', count: 27, sales: 244000, gk: 47000 }
];

export const productData = [
  { label: 'BI/GI Sheets', quantity: 1240, revenue: 512000, gk: 98000, contribution: 24 },
  { label: 'Rectangular Tube', quantity: 980, revenue: 448000, gk: 86000, contribution: 21 },
  { label: 'AngBar', quantity: 760, revenue: 336000, gk: 62000, contribution: 16 },
  { label: 'Purlins', quantity: 640, revenue: 304000, gk: 58000, contribution: 14 },
  { label: 'Flat Bar', quantity: 520, revenue: 226000, gk: 41000, contribution: 11 },
  { label: 'GIW (Galvanized Iron Wire)', quantity: 410, revenue: 192000, gk: 39000, contribution: 9 }
];

export const kpiProgressData = [
  { label: 'Gross Sales', actual: 2100000, target: 2500000, completion: 84 },
  { label: 'GK', actual: 418000, target: 500000, completion: 83.6 },
  { label: 'Leads', actual: 1248, target: 1400, completion: 89.1 },
  { label: 'Closed Deals', actual: 324, target: 380, completion: 85.2 }
];

export const salesHeatmap = [
  { day: 'Mon', level: 72 },
  { day: 'Tue', level: 84 },
  { day: 'Wed', level: 76 },
  { day: 'Thu', level: 91 },
  { day: 'Fri', level: 96 },
  { day: 'Sat', level: 58 },
  { day: 'Sun', level: 34 }
];

export const recentSalesRows = [
  ['2026-05-01', 'Northline Builders', baseSalesReps[0]?.name || 'Unassigned', 'FT', 'PHP 148,000', 'PHP 28,400'],
  ['2026-05-03', 'RJC Construction', baseSalesReps[1]?.name || 'Unassigned', 'REP', 'PHP 126,500', 'PHP 22,700'],
  ['2026-05-05', 'MetroFab Supply', baseSalesReps[2]?.name || 'Unassigned', '1DLM', 'PHP 97,200', 'PHP 18,900'],
  ['2026-05-08', 'Cebu Steelworks', baseSalesReps[3]?.name || 'Unassigned', '1Aga', 'PHP 84,600', 'PHP 15,800'],
  ['2026-05-10', 'DPWH Project Desk', baseSalesReps[4]?.name || 'Unassigned', 'FT', 'PHP 171,000', 'PHP 32,600']
];

export const repPerformanceRows = salesByRep.map(rep => [
  rep.label,
  rep.leads,
  rep.deals,
  `PHP ${rep.sales.toLocaleString()}`,
  `${Math.round((rep.deals / 300) * 100)}%`,
  `${rep.gk}%`
]);

export const productBreakdownRows = productData.map(product => [
  product.label,
  product.quantity.toLocaleString(),
  `PHP ${product.revenue.toLocaleString()}`,
  `PHP ${product.gk.toLocaleString()}`
]);
