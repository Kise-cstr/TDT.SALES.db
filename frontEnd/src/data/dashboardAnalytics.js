import { useEffect, useMemo, useState } from 'react';
import { metricCards } from './dashboardData';
import { productData, recentSalesRows, repPerformanceRows } from './enterpriseAnalytics';
import { filterLiveDashboardData, getLiveDashboardData, getPeriodScopedRows, subscribeLiveData } from './liveDataService';
import { getSalesRepNameFromCode } from './salesRepCatalog';
import { getTimelineSalesComparison } from '../api/dashboardApi';
import { readDashboardFilters, subscribeDashboardFilters } from '../utils/dashboardFilters';
import { normalizeProductName } from './productCatalog';
import { resolveSalesRepPhoto } from '../utils/salesRepUtils';

const counterBuckets = ['Acquisition', 'Retention', 'Revival'];
const counterDisplayLabels = {
  Acquisition: 'Acquisition',
  Retention: 'Retention',
  Revival: 'Revival'
};
const productColors = ['#D16002', '#CC5500', '#ff9f43', '#9a674f', '#f8bd6b', '#5f5f5f', '#e07715', '#b84b00', '#ffc46e', '#7d7f82'];
const counterColors = {
  Acquisition: '#D16002',
  Retention: '#CC5500',
  Revival: '#ff9f43'
};
const validProductNames = new Set([
  'DRBS',
  'CHANNEL BAR',
  'ANGLE BAR',
  'FLAT BAR',
  'GI/BI PIPES',
  'RECTANGULAR TUBE',
  'SHEET PILE',
  'SQUARE TUBE',
  'WIDE FLANGE',
  'MS PLATE',
  'PLAIN ROUND BAR',
  'WELDING ROD',
  'SQUARE BAR',
  'STAINLESS SHEET',
  'COLD ROLLED SHAFTING'
]);

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateInputValue = value => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatCurrency = value => `PHP ${Math.round(toNumber(value)).toLocaleString()}`;

const formatCompactCurrency = value => {
  const amount = toNumber(value);
  if (amount >= 1000000000) return `PHP ${(amount / 1000000000).toFixed(amount >= 10000000000 ? 0 : 1)}B`;
  if (amount >= 1000000) return `PHP ${(amount / 1000000).toFixed(amount >= 100000000 ? 0 : 1)}M`;
  if (amount >= 1000) return `PHP ${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1)}K`;
  return formatCurrency(amount);
};

const formatTons = value => {
  const tons = toNumber(value);
  return `${tons.toLocaleString(undefined, { minimumFractionDigits: tons && tons < 10 ? 1 : 0, maximumFractionDigits: 1 })} TONS`;
};

const normalizeCounter = value => {
  const label = String(value || '').trim();
  const key = label.toLowerCase();
  if (key.includes('revival') || key === 'r' || key === 'rev') return 'Revival';
  if (key.includes('first') || key === 'ft' || key === 'f/t') return 'Acquisition';
  if (!key || key === 'n' || key === 'new' || key === 'n/n' || key === 'new (n)' || key === 'new (n/n)' || key === '---' || key === 'no counter' || key === 'blank' || key === '-') return 'Retention';
  return 'Retention';
};

const rowRepLabel = row => String(
  getSalesRepNameFromCode(row?.repCode) || row?.salesRep || row?.repName || row?.repCode || 'Unassigned'
).trim() || 'Unassigned';
const repKey = value => String(value || 'Unassigned').trim().toUpperCase();
const companyKey = value => String(value || '').trim().toUpperCase();
const normalizePaymentTerm = value => {
  const raw = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const key = raw.toLowerCase();
  if (!key) return 'Unspecified';
  if (key.includes('online') && key.includes('cash')) return 'Online Cash';
  if (key === 'cash' || (key.includes('cash') && !key.includes('online'))) return 'Cash';
  return raw.split(' ').map(word => {
    const lowered = word.toLowerCase();
    if (/^\d+$/.test(word)) return word;
    if (['pdc', 'ft', 'gk', 'gs', 'p.o.'].includes(lowered)) return lowered.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

const normalizeCompanyPerformance = value => {
  const label = String(value || '').trim().toLowerCase();
  if (!label) return 'Retention';
  if (label.includes('revival') || label === 'r' || label === 'rev') return 'Revival';
  if (label.includes('first') || label === 'ft' || label === 'f/t' || label.includes('new')) return 'Acquisition';
  return 'Retention';
};

export const getActiveDealRows = (rows = [], filters = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  return getPeriodScopedRows(sourceRows.filter(record => record.date), filters);
};

export const buildDealCountByRep = (rows = []) => {
  const counts = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const key = repKey(rowRepLabel(row));
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
};

const buildPresentationCounterData = rows => {
  const totals = new Map(counterBuckets.map(label => [label, { count: 0, sales: 0, gk: 0, reps: new Set(), companies: new Set() }]));

  (Array.isArray(rows) ? rows : []).forEach(row => {
    const label = normalizeCounter(row.counter);
    const current = totals.get(label) || { count: 0, sales: 0, gk: 0, reps: new Set(), companies: new Set() };
    const companyKey = String(row.clientName || row.companyName || row.name || '').trim().toUpperCase();
    current.count += 1;
    current.sales += toNumber(row.grossSales || row.sales);
    current.gk += toNumber(row.salesmanGk || row.gk || row.finalGk);
    current.reps.add(rowRepLabel(row).toUpperCase());
    if (companyKey) current.companies.add(companyKey);
    totals.set(label, current);
  });

  return counterBuckets.map(label => {
    const bucket = totals.get(label);
    return {
      label,
      displayLabel: counterDisplayLabels[label] || label,
      count: bucket.companies.size,
      sales: Math.round(bucket.sales || 0),
      gk: Math.round(bucket.gk || 0),
      reps: bucket.reps.size || 0
    };
  });
};

const getSelectedPeriod = (filters = {}) => (
  filters.timeline && filters.timeline !== 'Disable'
    ? filters.timeline
    : filters.period || 'Monthly'
);

const buildMetricCards = liveData => {
  if (!liveData?.rawRows?.length) {
    return metricCards;
  }
  const topRep = liveData.salesByRep?.[0];
  const cards = [
    { metric: 'sales', title: 'Total Gross Sales', value: formatCurrency(liveData.totals?.sales), trend: 'up', trendValue: 'CSV', icon: 'dollar' },
    { metric: 'gk', title: 'Total GK', value: formatCurrency(liveData.totals?.gk), trend: 'up', trendValue: 'CSV', icon: 'chart' },
    { metric: 'leads', title: 'Total Leads Gathered', value: String(liveData.totals?.rows || 0), trend: 'up', trendValue: 'rows', icon: 'users' },
    { metric: 'clients', title: 'Number of Clients', value: String(liveData.totals?.companies || 0), trend: 'up', trendValue: 'unique company names', icon: 'users' },
    { metric: 'top-rep', title: 'Top Performing Rep', value: topRep?.label || 'N/A', trend: 'up', trendValue: topRep ? formatCurrency(topRep.sales) : 'PHP 0', icon: 'target' }
  ];
  return [
    cards[0],
    cards[1],
    { metric: 'tons', title: 'Total Tons', value: formatTons(liveData.totals?.tons), trend: 'up', trendValue: 'steel volume', icon: 'target' },
    ...cards.slice(2)
  ];
};

const displayProductName = product => {
  const label = product.label || product.name || '';
  return validProductNames.has(label) ? label : normalizeProductName(label);
};

const buildProcessedProductBreakdownData = products => {
  const totals = new Map();
  const invalidProducts = [];

  (Array.isArray(products) ? products : []).forEach(product => {
    const label = displayProductName(product);
    if (!validProductNames.has(label)) {
      invalidProducts.push(product.label || product.name || 'Unknown product');
      return;
    }

    const current = totals.get(label) || { label, name: label, quantity: 0, tons: 0, sales: 0, revenue: 0, gk: 0 };
    current.quantity += toNumber(product.quantity || product.value);
    current.tons += toNumber(product.tons || product.weight);
    current.sales += toNumber(product.revenue || product.amount || product.sales);
    current.revenue = current.sales;
    current.gk += toNumber(product.gk);
    totals.set(label, current);
  });

  const rows = Array.from(totals.values()).sort((a, b) => b.quantity - a.quantity);
  const coloredRows = rows.map((product, index) => ({
    ...product,
    color: productColors[index % productColors.length]
  }));

  return {
    rows: coloredRows,
    invalidProducts,
    totals: {
      quantity: rows.reduce((sum, product) => sum + product.quantity, 0),
      tons: rows.reduce((sum, product) => sum + product.tons, 0),
      sales: rows.reduce((sum, product) => sum + product.sales, 0)
    },
    valid: invalidProducts.length === 0
  };
};

const buildPresentationProducts = products => {
  const rows = Array.isArray(products) ? products : [];
  const sortedRows = rows
    .filter(product => String(product.name || product.label || '').trim().toUpperCase() !== 'OTHERS')
    .map(product => ({
      ...product,
      label: product.label || product.name || 'Product',
      name: product.name || product.label || 'Product',
      quantity: toNumber(product.quantity),
      tons: toNumber(product.tons),
      sales: toNumber(product.sales),
      revenue: toNumber(product.revenue || product.sales),
      gk: toNumber(product.gk)
    }))
    .sort((a, b) => b.quantity - a.quantity);
  const topProducts = sortedRows.slice(0, 5);
  const otherProducts = sortedRows.slice(5);

  if (!otherProducts.length) return topProducts;

  const others = otherProducts.reduce((summary, product) => ({
    ...summary,
    quantity: summary.quantity + product.quantity,
    tons: summary.tons + product.tons,
    sales: summary.sales + product.sales,
    revenue: summary.revenue + product.revenue,
    gk: summary.gk + product.gk
  }), {
    label: 'OTHERS',
    name: 'OTHERS',
    quantity: 0,
    tons: 0,
    sales: 0,
    revenue: 0,
    gk: 0
  });

  return [...topProducts, others].map((product, index) => ({
    ...product,
    color: productColors[index % productColors.length]
  }));
};

const buildPresentationTerms = rows => {
  const totals = new Map();

  (Array.isArray(rows) ? rows : []).forEach(row => {
    const label = normalizePaymentTerm(row.terms);
    const key = label.toUpperCase();
    const current = totals.get(key) || {
      label,
      name: label,
      amount: 0,
      count: 0
    };

    current.amount += toNumber(row.grossSales || row.sales);
    current.count += 1;
    totals.set(key, current);
  });

  const totalAmount = Array.from(totals.values()).reduce((sum, term) => sum + term.amount, 0) || 1;

  return Array.from(totals.values())
    .filter(term => term.amount > 0 || term.count > 0)
    .sort((a, b) => {
      const amountDelta = b.amount - a.amount;
      if (amountDelta) return amountDelta;
      return String(a.label || '').localeCompare(String(b.label || ''));
    })
    .map((term, index) => ({
      ...term,
      name: term.label,
      rawValue: term.amount,
      totalLabel: formatCompactCurrency(term.amount),
      percentage: Math.round((term.amount / totalAmount) * 1000) / 10,
      color: productColors[index % productColors.length]
    }));
};

const buildCompanyRankingData = liveData => {
  const rows = Array.isArray(liveData?.rawRows) ? liveData.rawRows : [];
  const companies = new Map();

  rows.forEach(row => {
    const label = String(row.clientName || row.companyName || row.name || '').trim();
    if (!label) return;
    const key = companyKey(label);
    const repLabel = rowRepLabel(row);
    const rowValue = toNumber(row.grossSales || row.sales);
    const rowDate = row.date ? new Date(row.date) : null;
    const current = companies.get(key) || {
      label,
      name: label,
      value: 0,
      repTotals: new Map(),
      performanceTotals: new Map(),
      paymentTotals: new Map(),
      latestDate: null,
      latestPerformance: 'Retention',
      latestPayment: 'Unspecified'
    };
    current.value += rowValue;
    current.repTotals.set(repLabel, (current.repTotals.get(repLabel) || 0) + rowValue);
    const performance = normalizeCompanyPerformance(row.counter);
    const paymentTerm = normalizePaymentTerm(row.terms);
    current.performanceTotals.set(performance, (current.performanceTotals.get(performance) || 0) + 1);
    current.paymentTotals.set(paymentTerm, (current.paymentTotals.get(paymentTerm) || 0) + 1);
    if (rowDate && !Number.isNaN(rowDate.getTime()) && (!current.latestDate || rowDate > current.latestDate)) {
      current.latestDate = rowDate;
      current.latestPerformance = performance;
      current.latestPayment = paymentTerm;
    }
    companies.set(key, current);
  });

  return Array.from(companies.values())
    .map(company => {
      const [topRep = 'Unassigned'] = Array.from(company.repTotals.entries())
        .sort((a, b) => b[1] - a[1])[0] || [];
      const pickDominant = (map, fallback) => {
        const entries = Array.from(map.entries());
        if (!entries.length) return fallback;
        const [winner] = entries.sort((a, b) => {
          const delta = b[1] - a[1];
          if (delta) return delta;
          return String(a[0]).localeCompare(String(b[0]));
        })[0] || [];
        return winner || fallback;
      };
      const dominantPerformance = pickDominant(company.performanceTotals, company.latestPerformance || 'Retention');
      const dominantPayment = pickDominant(company.paymentTotals, company.latestPayment || 'Unspecified');
      return {
        label: company.label,
        name: company.name,
        companyName: company.label,
        totalSalesAmount: Math.round(company.value * 100) / 100,
        salesPerformance: dominantPerformance,
        paymentTerm: dominantPayment,
        companyPhoto: resolveSalesRepPhoto(topRep),
        salesRep: topRep
      };
    })
    .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount)
    .slice(0, 10);
};

const getRepRankingMetric = (rep, metric = 'all') => {
  if (metric === 'sales') return toNumber(rep.sales);
  return toNumber(rep.gk);
};

const buildMetricSortedReps = (reps = [], metric = 'all') => (
  (Array.isArray(reps) ? reps : [])
    .map(rep => ({
      ...rep,
      sales: toNumber(rep.sales),
      gk: toNumber(rep.gk),
      deals: toNumber(rep.deals),
      leads: toNumber(rep.leads)
    }))
    .sort((a, b) => {
      const metricDelta = getRepRankingMetric(b, metric) - getRepRankingMetric(a, metric);
      if (metricDelta) return metricDelta;
      const gkDelta = toNumber(b.gk) - toNumber(a.gk);
      if (gkDelta) return gkDelta;
      const salesDelta = toNumber(b.sales) - toNumber(a.sales);
      if (salesDelta) return salesDelta;
      return String(a.label || '').localeCompare(String(b.label || ''));
    })
);

const buildRepRows = (rows = []) => {
  const groups = new Map();

  (Array.isArray(rows) ? rows : []).forEach(row => {
    const label = rowRepLabel(row);
    const key = repKey(label);
    const current = groups.get(key) || {
      label,
      sales: 0,
      gk: 0,
      deals: 0,
      leads: 0,
      companies: new Set()
    };

    current.sales += toNumber(row.grossSales || row.sales);
    current.gk += toNumber(row.salesmanGk || row.gk || row.finalGk);
    current.deals += 1;
    current.leads += 1;
    const companyName = String(row.clientName || row.companyName || row.name || '').trim().toUpperCase();
    if (companyName) current.companies.add(companyName);
    groups.set(key, current);
  });

  return Array.from(groups.values()).map(rep => ({
    ...rep,
    deals: rep.companies?.size || rep.deals,
    companies: rep.companies?.size || 0
  }));
};

const buildRepRoster = (allRows = [], activeRows = []) => {
  const roster = new Map();
  const activeRowsByName = new Map(
    buildRepRows(activeRows).map(rep => [repKey(rep.label), rep])
  );

  [...(Array.isArray(allRows) ? allRows : []), ...(Array.isArray(activeRows) ? activeRows : [])].forEach(row => {
    const label = rowRepLabel(row);
    const key = repKey(label);
    if (!key || key === 'UNASSIGNED' || roster.has(key)) return;
    const active = activeRowsByName.get(key) || {};
    roster.set(key, {
      label,
      name: label,
      sales: Number(active.sales) || 0,
      gk: Number(active.gk) || 0,
      leads: Number(active.leads) || 0,
      deals: Number(active.deals) || 0
    });
  });

  return Array.from(roster.values());
};

const buildPresentationCounters = counters => {
  const total = counters.reduce((sum, counter) => sum + toNumber(counter.count), 0);
  return counters.map(counter => ({
    ...counter,
    label: counter.displayLabel || counterDisplayLabels[counter.label] || counter.label,
    rawLabel: counter.label,
    percentage: total ? Math.round((toNumber(counter.count) / total) * 1000) / 10 : 0,
    color: counterColors[counter.label] || '#8b6453'
  }));
};

const buildPresentationData = analytics => {
  const liveData = analytics.filteredLiveData;
  const rawRows = Array.isArray(liveData?.rawRows) ? liveData.rawRows : [];
  const activeDealRows = getActiveDealRows(rawRows, analytics.filters);
  const dealsClosed = activeDealRows.length;
  const periodTotals = activeDealRows.reduce((totals, row) => ({
    sales: totals.sales + toNumber(row.grossSales || row.sales),
    gk: totals.gk + toNumber(row.salesmanGk || row.gk || row.finalGk)
  }), { sales: 0, gk: 0 });
  const useTimelineComparison = analytics.filters?.timeline !== 'Disable' && analytics.timelineSalesComparison?.length;
  const salesComparisonSource = useTimelineComparison ? analytics.timelineSalesComparison : analytics.salesPerformance;
  const salesComparison = (salesComparisonSource || []).map(row => ({
    month: row.label,
    gross: Math.round((toNumber(row.sales) / 1000000) * 10) / 10,
    gk: Math.round((toNumber(row.gk) / 1000000) * 10) / 10,
    leads: toNumber(row.leads),
    reps: toNumber(row.reps)
  }));
  const companies = (analytics.companies || []).map((row, index) => ({
    rank: index + 1,
    companyName: row.companyName || row.label || row.name || 'Unassigned',
    amount: formatCompactCurrency(row.totalSalesAmount ?? row.value),
    totalSalesAmount: toNumber(row.totalSalesAmount ?? row.value),
    salesPerformance: row.salesPerformance || 'Retention',
    paymentTerm: row.paymentTerm || 'Unspecified',
    companyPhoto: row.companyPhoto || resolveSalesRepPhoto(row.salesRep),
    salesRep: row.salesRep || 'Unassigned',
    color: productColors[index % productColors.length]
  }));
  const counters = buildPresentationCounters(buildPresentationCounterData(activeDealRows));
  const presentationProducts = buildPresentationProducts(analytics.processedProductBreakdownData.rows);
  const presentationTerms = buildPresentationTerms(activeDealRows);
  const sharedProductTotals = {
    ...analytics.processedProductBreakdownData.totals,
    tons: toNumber(liveData.totals?.tons),
    quantity: toNumber(liveData.totals?.inventoryQuantity ?? analytics.processedProductBreakdownData.totals.quantity)
  };
  const isFullCalendarMonthRange = (() => {
    const start = parseDateInputValue(analytics.filters?.startDate);
    const end = parseDateInputValue(analytics.filters?.endDate);
    if (!start || !end) return false;

    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === 1 &&
      end.getDate() === monthEnd.getDate() &&
      monthStart.getTime() === new Date(start.getFullYear(), start.getMonth(), 1).getTime()
    );
  })();
  const repMetric = analytics.filters?.metric === 'sales' ? 'sales' : 'gk';
  const reps = buildRepRoster(analytics.liveData?.rawRows || rawRows, activeDealRows)
    .map(rep => ({
      ...rep,
      fullName: rep.label
    }));
  const rankedReps = buildMetricSortedReps(reps, repMetric).map((rep, index) => ({
    rank: index + 1,
    name: rep.fullName || rep.label || 'Unassigned',
    revenue: formatCompactCurrency(repMetric === 'sales' ? rep.sales : rep.gk),
    rawSales: toNumber(rep.sales),
    rawGk: toNumber(rep.gk),
    deals: `${toNumber(rep.deals)} client${toNumber(rep.deals) === 1 ? '' : 's'}`
  }));

  const kpis = [
      ...(isFullCalendarMonthRange ? [{ label: 'Total Tons', value: formatTons(sharedProductTotals.tons), note: 'Total steel tonnage' }] : []),
      { label: 'Number of Transactions', value: String(dealsClosed), note: '' },
      { label: 'Total Gross Sales', value: formatCompactCurrency(periodTotals.sales), note: `${activeDealRows.length} period rows` },
      { label: 'GK Value', value: formatCompactCurrency(periodTotals.gk), note: 'From uploaded GK columns' },
      { label: 'Number of Clients', value: String(liveData.totals?.companies || 0), note: 'Unique company names' }
  ];

  return {
    kpis,
    salesComparison,
    companies,
    products: presentationProducts,
    terms: presentationTerms,
    counters,
    reps: rankedReps,
    productTotals: sharedProductTotals,
    productValidation: {
      valid: analytics.processedProductBreakdownData.valid,
      invalidProducts: analytics.processedProductBreakdownData.invalidProducts
    },
    validation: {
      totals: liveData.totals || {},
      salesRows: salesComparison.map(row => ({ label: row.month, gross: row.gross, gk: row.gk })),
      productRows: presentationProducts.map(product => ({
        name: product.name,
        quantity: product.quantity,
        tons: product.tons,
        sales: product.sales
      })),
      counterRows: counters.map(counter => ({ label: counter.label, count: counter.count, percentage: counter.percentage })),
      repRows: rankedReps.map(rep => ({ name: rep.name, sales: rep.rawSales, gk: rep.rawGk }))
    }
  };
};

export function buildDashboardAnalytics(liveData = getLiveDashboardData(), filters = readDashboardFilters(), timelineSalesComparison = []) {
  const hasLiveRows = Boolean(liveData?.rawRows?.length);
  const hasProductRows = Boolean(liveData?.productRows?.length);
  const filteredLiveData = hasLiveRows || hasProductRows ? filterLiveDashboardData(liveData, filters) : liveData;
  const selectedPeriod = getSelectedPeriod(filters);
  const useUploadedData = Boolean(filteredLiveData?.rawRows?.length || filteredLiveData?.productRows?.length);
  const activeProductData = useUploadedData && filteredLiveData.productData?.length ? filteredLiveData.productData : productData;
  const processedProductBreakdownData = buildProcessedProductBreakdownData(activeProductData);
  if (!processedProductBreakdownData.valid) {
    console.error('[product-breakdown-validation] Invalid products excluded from Product Breakdown source.', processedProductBreakdownData.invalidProducts);
  }

  const analytics = {
    filters,
    liveData,
    filteredLiveData,
    hasLiveRows,
    hasProductRows,
    useUploadedData,
    cards: buildMetricCards(filteredLiveData, selectedPeriod),
    salesPerformance: hasLiveRows ? filteredLiveData.salesPerformance : undefined,
    counterData: buildPresentationCounters(buildPresentationCounterData(getActiveDealRows(filteredLiveData?.rawRows || [], filters))),
    sourceData: hasLiveRows ? filteredLiveData.sourceData : undefined,
    termsData: hasLiveRows ? filteredLiveData.termsData : undefined,
    recentSalesRows: hasLiveRows ? filteredLiveData.recentSalesRows : recentSalesRows,
    repPerformanceRows: hasLiveRows ? filteredLiveData.repPerformanceRows : repPerformanceRows,
    productData: processedProductBreakdownData.rows,
    processedProductBreakdownData,
    timelineSalesComparison,
    salesByRep: buildMetricSortedReps(buildRepRoster(liveData.rawRows || [], getActiveDealRows(liveData.rawRows || [], filters)), filters.metric),
    companies: hasLiveRows ? buildCompanyRankingData(filteredLiveData) : []
  };

  analytics.presentationData = buildPresentationData(analytics);
  return analytics;
}

export function validatePresentationSync(analytics) {
  const dashboardTotals = analytics?.filteredLiveData?.totals || {};
  const presentationTotals = analytics?.presentationData?.validation?.totals || {};
  const dashboardProducts = (analytics?.processedProductBreakdownData?.rows || [])
    .map(product => `${product.name}:${toNumber(product.quantity)}:${toNumber(product.tons)}:${toNumber(product.sales)}`);
  const presentationProductValues = (analytics?.presentationData?.validation?.productRows || [])
    .map(product => `${product.name}:${toNumber(product.quantity)}:${toNumber(product.tons)}:${toNumber(product.sales)}`);
  const dashboardSalesSource = analytics?.filters?.timeline !== 'Disable' && analytics?.timelineSalesComparison?.length
    ? analytics.timelineSalesComparison
    : analytics?.salesPerformance;
  const dashboardSalesRows = (dashboardSalesSource || []).map(row => `${row.label}:${Math.round((toNumber(row.sales) / 1000000) * 10) / 10}:${Math.round((toNumber(row.gk) / 1000000) * 10) / 10}`);
  const presentationSalesRows = (analytics?.presentationData?.validation?.salesRows || []).map(row => `${row.label}:${toNumber(row.gross)}:${toNumber(row.gk)}`);
  const dashboardReps = (analytics?.salesByRep || []).slice(0, 10).map(rep => `${rep.label}:${toNumber(rep.sales)}:${toNumber(rep.gk)}`);
  const presentationReps = (analytics?.presentationData?.validation?.repRows || []).map(rep => `${rep.name}:${toNumber(rep.sales)}:${toNumber(rep.gk)}`);
  const mismatches = [];

  ['rows', 'sales', 'gk', 'tons', 'companies', 'reps'].forEach(key => {
    if (Math.abs(toNumber(dashboardTotals[key]) - toNumber(presentationTotals[key])) > 0.01) {
      mismatches.push({ dataset: 'totals', key, dashboard: dashboardTotals[key], presentation: presentationTotals[key] });
    }
  });

  if (dashboardProducts.join('|') !== presentationProductValues.join('|')) {
    mismatches.push({ dataset: 'products', dashboard: dashboardProducts, presentation: presentationProductValues });
  }
  if (dashboardSalesRows.join('|') !== presentationSalesRows.join('|')) {
    mismatches.push({ dataset: 'sales chart', dashboard: dashboardSalesRows, presentation: presentationSalesRows });
  }
  if (dashboardReps.join('|') !== presentationReps.join('|')) {
    mismatches.push({ dataset: 'sales reps', dashboard: dashboardReps, presentation: presentationReps });
  }

  if (mismatches.length) {
    console.warn('[presentation-sync] Dashboard and presentation data mismatch detected. Forcing render from dashboard analytics source.', mismatches);
  }

  return { valid: mismatches.length === 0, mismatches };
}

export function useDashboardAnalytics() {
  const [liveData, setLiveData] = useState(() => getLiveDashboardData());
  const [filters, setFilters] = useState(() => readDashboardFilters());
  const [timelineSalesComparison, setTimelineSalesComparison] = useState([]);

  useEffect(() => subscribeLiveData(setLiveData), []);
  useEffect(() => subscribeDashboardFilters(setFilters), []);
  useEffect(() => {
    if (filters.timeline === 'Disable') {
      setTimelineSalesComparison([]);
      return undefined;
    }

    let cancelled = false;
    getTimelineSalesComparison({ granularity: filters.timeline })
      .then(response => {
        if (!cancelled) setTimelineSalesComparison(response?.data?.rows || []);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('[timeline-sales] Failed to load timeline comparison data.', error);
          setTimelineSalesComparison([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters.timeline]);

  return useMemo(
    () => buildDashboardAnalytics(liveData, filters, timelineSalesComparison),
    [filters, liveData, timelineSalesComparison]
  );
}
