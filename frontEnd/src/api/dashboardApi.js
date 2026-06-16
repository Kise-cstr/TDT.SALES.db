import apiClient from './apiClient';

export const getDashboardAnalytics = () => {
  return apiClient.get('/dashboard/analytics');
};

export const getTimelineSalesComparison = (params = {}) => {
  return apiClient.get('/dashboard/timeline-sales', { params });
};

export const getLatestDashboardImport = () => {
  return apiClient.get('/dashboard/latest');
};

export const getDashboardUploads = () => {
  return apiClient.get('/dashboard/uploads');
};

export const getDashboardUploadById = (uploadId) => {
  return apiClient.get(`/dashboard/uploads/${uploadId}`);
};

export const importDashboardData = (data) => {
  return apiClient.post('/dashboard/import', data);
};

export const importDashboardCsv = (data) => {
  return apiClient.post('/dashboard/import-csv', data);
};

export const importDashboardFiles = (data) => {
  return apiClient.post('/dashboard/import-files', data);
};

export const syncGoogleSheetsData = (data) => {
  return apiClient.post('/dashboard/sync-google', data);
};

export const getSalesIntelligenceAnalytics = (params = {}) => {
  return apiClient.get('/dashboard/intelligence/analytics', { params });
};

export const importSalesIntelligenceCsv = (files) => {
  const formData = new FormData();
  Array.from(files || []).forEach(file => {
    formData.append('files', file);
  });
  return apiClient.post('/dashboard/intelligence/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
