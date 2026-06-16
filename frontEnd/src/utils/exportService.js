const filenameStamp = () => {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
};

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

const escapeXml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const collectTableRows = () => {
  const rows = Array.from(document.querySelectorAll('.rep-table tr'));

  return rows
    .map(row => Array.from(row.children).map(cell => escapeCsv(cell.textContent.trim())).join(','))
    .join('\n');
};

const collectMetrics = () => {
  return Array.from(document.querySelectorAll('.metric-card')).map(card => ({
    title: card.querySelector('.metric-title')?.textContent.trim() || 'Metric',
    value: card.querySelector('.metric-value')?.textContent.trim() || '',
    trend: card.querySelector('.metric-trend')?.textContent.trim() || ''
  }));
};

const buildAnalyticsReport = () => {
  const metrics = collectMetrics();
  const tableCsv = collectTableRows();
  const lines = [
    'TDT Powersteel Dashboard Report',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    'Executive Metrics',
    ...metrics.map(metric => `- ${metric.title}: ${metric.value}${metric.trend ? ` (${metric.trend})` : ''}`),
    '',
    'Employee Rankings',
    tableCsv || 'No table data available.'
  ];

  return lines.join('\n');
};

const exportAsCsv = () => {
  const tableCsv = collectTableRows();
  const fallback = [
    ['Report', 'Value'],
    ...collectMetrics().map(metric => [metric.title, metric.value])
  ].map(row => row.map(escapeCsv).join(',')).join('\n');

  downloadBlob(
    tableCsv || fallback,
    `tdt-powersteel-dashboard-data-${filenameStamp()}.csv`,
    'text/csv;charset=utf-8'
  );
};

const exportAnalyticsReport = () => {
  downloadBlob(
    buildAnalyticsReport(),
    `tdt-powersteel-dashboard-report-${filenameStamp()}.txt`,
    'text/plain;charset=utf-8'
  );
};

const exportAsPdf = () => {
  window.print();
};

const exportAsPng = async () => {
  const dashboard = document.querySelector('.dashboard-content');
  const width = Math.max(dashboard?.scrollWidth || window.innerWidth, 900);
  const height = Math.max(dashboard?.scrollHeight || window.innerHeight, 600);
  const title = document.querySelector('.dashboard-title')?.textContent || 'TDT Powersteel Dashboard';
  const metrics = collectMetrics();

  const metricMarkup = metrics.map((metric, index) => {
    const x = 44 + (index % 4) * 210;
    const y = 120 + Math.floor(index / 4) * 104;

    return `
      <g transform="translate(${x}, ${y})">
        <rect width="184" height="76" rx="12" fill="#080808" fill-opacity="0.82" stroke="#ff7a00" stroke-opacity="0.45" />
        <text x="16" y="28" fill="#a8a8a8" font-size="12" font-family="Arial">${escapeXml(metric.title)}</text>
        <text x="16" y="58" fill="#ff8a1f" font-size="24" font-weight="700" font-family="Arial">${escapeXml(metric.value)}</text>
      </g>
    `;
  }).join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#050505" />
          <stop offset="100%" stop-color="#16100a" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <circle cx="${width * 0.78}" cy="${height * 0.18}" r="260" fill="#ff7a00" fill-opacity="0.12" />
      <text x="44" y="68" fill="#ff8a1f" font-size="34" font-weight="800" font-family="Arial">${escapeXml(title)}</text>
      <text x="44" y="94" fill="#d6d6d6" font-size="14" font-family="Arial">Executive analytics snapshot</text>
      ${metricMarkup}
      <rect x="44" y="248" width="${Math.max(width - 88, 500)}" height="260" rx="14" fill="#080808" fill-opacity="0.78" stroke="#ff7a00" stroke-opacity="0.35" />
      <text x="68" y="296" fill="#ff8a1f" font-size="22" font-weight="700" font-family="Arial">Charts and analytics exported from dashboard</text>
      <text x="68" y="332" fill="#d6d6d6" font-size="15" font-family="Arial">Use PDF export for a full browser-rendered dashboard view.</text>
    </svg>
  `;

  const image = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = svgUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `tdt-powersteel-dashboard-snapshot-${filenameStamp()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportDashboard = async option => {
  await new Promise(resolve => setTimeout(resolve, 450));

  switch (option) {
    case 'pdf':
      exportAsPdf();
      break;
    case 'png':
      await exportAsPng();
      break;
    case 'csv':
      exportAsCsv();
      break;
    case 'report':
      exportAnalyticsReport();
      break;
    default:
      break;
  }
};
