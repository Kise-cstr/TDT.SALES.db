export const getStatus = performance => {
  if (performance >= 100) return { status: 'High', statusKey: 'excellent' };
  if (performance >= 80) return { status: 'Good', statusKey: 'good' };
  if (performance >= 60) return { status: 'Average', statusKey: 'average' };
  return { status: 'Low', statusKey: 'low' };
};

export const getPerformanceState = performance => getStatus(Number(performance) || 0).statusKey;

export const formatCurrency = value => {
  const amount = Number(value) || 0;
  return `PHP ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const formatMetricValue = (value, mode = 'all') => {
  const amount = Number(value) || 0;
  if (mode === 'conversionRate') return `${Math.round(amount)}%`;
  return formatCurrency(amount);
};

const salesRepPhotoFiles = [
  { code: '1MRKY', name: 'Marky Cabajar', file: '1MRKY=MARKY CABAJAR.jpg' },
  { code: '1MLDY', name: 'Melody Santos', file: '1EMA=EMMALYN MOLOBOCO.jpg' },
  { code: '1KND', name: 'Karen Dy', file: '1KND=KAREN DY.jpg' },
  { code: '1EMA', name: 'Emmalyn Moloboco', file: '1MLDY=MELODY SANTOS.jpg' },
  { code: '1DLM', name: 'Dan Loren Mendoza', file: '1DLM=DAN LOREN MENDOZA.jpg' },
  { code: '1DEN', name: 'Dennis Espinar', file: '1DEN=DENNIS ESPINAR.jpg' },
  { code: '1DAN', name: 'Deniel Justine Habana', file: '1DAN=DENIEL JUSTINE HABANA.jpg' },
  { code: '1AGA', name: 'Michael Angelo Blancia', file: '1AGA=MICHAEL ANGELO BLANCIA.jpg' }
];

const salesRepPhotoAliases = new Map([
  ['Daniel Justine Habana', 'Deniel Justine Habana'],
  ['Dan Loren Mendoza', 'Dan Loren Mendoza'],
  ['Emmalyn Moloboco', 'Emmalyn Moloboco']
]);

const normalizeRepPhotoKey = value => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');

const getPublicAssetPath = file => {
  const basePath = process.env.PUBLIC_URL || '';
  return `${basePath}/sales-rep-photos/${encodeURIComponent(file)}`;
};

const defaultSalesRepPhoto = getPublicAssetPath('default-avatar.svg');

const salesRepPhotoByKey = salesRepPhotoFiles.reduce((lookup, photo) => {
  const url = getPublicAssetPath(photo.file);
  lookup.set(normalizeRepPhotoKey(photo.code), url);
  lookup.set(normalizeRepPhotoKey(photo.name), url);
  return lookup;
}, new Map());

salesRepPhotoAliases.forEach((targetName, alias) => {
  const targetUrl = salesRepPhotoByKey.get(normalizeRepPhotoKey(targetName));
  if (targetUrl) salesRepPhotoByKey.set(normalizeRepPhotoKey(alias), targetUrl);
});

export const resolveSalesRepPhoto = rep => {
  const candidates = typeof rep === 'string'
    ? [rep]
    : [rep?.repCode, rep?.code, rep?.salesRep, rep?.repName, rep?.name, rep?.label];

  for (const candidate of candidates) {
    const photo = salesRepPhotoByKey.get(normalizeRepPhotoKey(candidate));
    if (photo) return photo;
  }

  return defaultSalesRepPhoto;
};

const getRankingValue = (rep, mode = 'all', quota = 1) => {
  if (mode === 'conversionRate') return ((Number(rep.convertedLeads) || 0) / quota) * 100;
  if (mode === 'grossKita') return Number(rep.totalGkValue) || 0;
  return Number(rep.grossSalesValue) || 0;
};

const getMovementPerformance = movement => {
  if (movement > 0) return { status: 'Positive', statusKey: 'positive' };
  if (movement < 0) return { status: 'Negative', statusKey: 'negative' };
  return { status: 'Neutral', statusKey: 'neutral' };
};

const getConversionRatePerformance = conversionRate => {
  if (conversionRate >= 100) return { status: 'Positive', statusKey: 'positive' };
  if (conversionRate >= 50) return { status: 'Neutral', statusKey: 'neutral' };
  return { status: 'Negative', statusKey: 'negative' };
};

export const enrichReps = (reps, rankingMode = 'all', quotaDays = 1) => {
  const quota = Math.max(1, Number(quotaDays) || 1) * 10;

  return [...reps]
    .sort((a, b) => {
      const rankingDelta = getRankingValue(b, rankingMode, quota) - getRankingValue(a, rankingMode, quota);
      if (rankingDelta) return rankingDelta;

      const gkDelta = (Number(b.totalGkValue) || 0) - (Number(a.totalGkValue) || 0);
      if (gkDelta) return gkDelta;

      const salesDelta = (Number(b.grossSalesValue) || 0) - (Number(a.grossSalesValue) || 0);
      if (salesDelta) return salesDelta;

      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map((rep, index) => {
      const rank = index + 1;
      const previousRank = Number(rep.previousRank) || rank;
      const movement = previousRank - rank;
      const conversionRate = Math.round(((Number(rep.convertedLeads) || 0) / quota) * 100);
      const rankingValue = getRankingValue(rep, rankingMode, quota);
      const movementPerformance = rankingMode === 'conversionRate'
        ? getConversionRatePerformance(conversionRate)
        : getMovementPerformance(movement);

      return {
        ...rep,
        ...movementPerformance,
        avatar: resolveSalesRepPhoto(rep) || rep.avatar,
        branch: rep.branch || rep.department || 'Unassigned Branch',
        rank,
        previousRank,
        movement,
        conversionRate,
        performanceLabel: movementPerformance.status,
        rankingValue,
        totalGk: formatCurrency(rep.totalGkValue),
        displayMetric: formatMetricValue(rankingValue, rankingMode)
      };
    });
};
