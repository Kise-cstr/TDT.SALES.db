const express = require('express');

const {
  getDashboardAnalytics,
  getTimelineSalesComparison,
  getDashboardUploadById,
  getDashboardUploads,
  getLatestDashboardImport,
  importDashboardCsv,
  importDashboardData,
  importDashboardFiles,
  syncGoogleSheetsData,
} = require('../controllers/dashboardController');
const {
  getSalesIntelligenceAnalytics,
  importSalesIntelligenceCsv,
  upload,
} = require('../controllers/salesIntelligenceController');
const {
  processSalesDataFiles,
  processTonsFiles,
  uploadSalesDataFiles,
} = require('../controllers/dataProcessingController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/import', adminOnly, importDashboardData);
router.post('/import-csv', importDashboardCsv);
router.post('/import-files', importDashboardFiles);
router.get('/analytics', getDashboardAnalytics);
router.get('/timeline-sales', getTimelineSalesComparison);
router.get('/latest', getLatestDashboardImport);
router.get('/uploads', getDashboardUploads);
router.get('/uploads/:id', getDashboardUploadById);
router.post('/sync-google', adminOnly, syncGoogleSheetsData);
router.post('/intelligence/upload', adminOnly, upload.array('files', 2), importSalesIntelligenceCsv);
router.get('/intelligence/analytics', getSalesIntelligenceAnalytics);
router.post('/process-sales-data', adminOnly, uploadSalesDataFiles.array('files', 2), processSalesDataFiles);
router.post('/process-tons', adminOnly, uploadSalesDataFiles.array('files', 4), processTonsFiles);

module.exports = router;
