import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileSpreadsheet, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/upload.css';

import logo from '../assets/logos/tdt_logo.png';
import { markSalesDataImported } from '../utils/importStatus';
import { activateLiveDashboardData, saveDashboardBatchData } from '../data/liveDataService';
import { getDashboardUploadById, getDashboardUploads, importDashboardCsv, importDashboardFiles } from '../api/dashboardApi';
import { useAuth } from '../auth/AuthContext';
import {
  createUploadSignature,
  formatUploadDateTime,
  getActiveUploadId,
  readUploadHistory,
  saveUploadHistoryItem,
  setActiveUploadId
} from '../utils/uploadHistory';

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.54,
      staggerChildren: 0.16
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: 'easeOut' }
  }
};

const uploadOptions = [
  {
    id: 'csv',
    title: 'File Upload',
    description: 'Upload separate SO and SP CSV files with required column validation',
    Icon: FileSpreadsheet,
    actionTitle: 'CSV Upload'
  }
];
const salesOrderTemplate = ['date', 'class', 'rep', 'num', 'name', 'fob', 'salesmangk', 'weight', 'terms', 'counter', 'source', 'amount', 'memo'];
const salesProductTemplate = ['qty', 'amount', 'ofsales', 'avgprice', 'cogs', 'avgcogs', 'grossmargin', 'grossmargin'];

const normalizeHeader = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '');

const parseDelimitedRows = text => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => String(value || '').trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(value => String(value || '').trim())) rows.push(row);
  return rows;
};

const compactHeaders = row => row.map(normalizeHeader).filter(Boolean);

const hasRequiredHeaders = (headers, template) => {
  const availableCounts = headers.reduce((counts, header) => {
    counts.set(header, (counts.get(header) || 0) + 1);
    return counts;
  }, new Map());
  return template.every(header => {
    const count = availableCounts.get(header) || 0;
    if (!count) return false;
    availableCounts.set(header, count - 1);
    return true;
  });
};

const hasTemplate = (rows, template) => rows.some(row => {
  const headers = compactHeaders(row);
  return hasRequiredHeaders(headers, template);
});

const validateCsvTemplate = (text, target) => {
  const rows = parseDelimitedRows(text);
  const template = target === 'sales' ? salesOrderTemplate : salesProductTemplate;
  const label = target === 'sales' ? 'Sales Order (SO)' : 'Sales Product (SP)';
  if (!rows.length) return { status: 'invalid', message: `${label} CSV is empty.` };
  if (!hasTemplate(rows, template)) {
    return { status: 'invalid', message: `${label} missing required columns.` };
  }
  return { status: 'valid', message: `${label} required columns found.` };
};

export default function Upload({ onComplete, embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isRequiredImport = Boolean(location.state?.requiredImport);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({ sales: null, products: null });
  const [fileValidation, setFileValidation] = useState({ sales: null, products: null });
  const [recentUploads, setRecentUploads] = useState(() => readUploadHistory(user));
  const [activeUploadId, setActiveUploadState] = useState(() => getActiveUploadId(user));
  const [showRecentUploads, setShowRecentUploads] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [draggingTarget, setDraggingTarget] = useState(null);

  const hasCsvFiles = Boolean(selectedFiles.sales || selectedFiles.products);
  const hasValidCsvFiles = fileValidation.sales?.status === 'valid' && fileValidation.products?.status === 'valid';

  const saveRecentUpload = useCallback(upload => {
    const nextUploads = saveUploadHistoryItem(upload, user);
    setRecentUploads(nextUploads);
    setActiveUploadState(getActiveUploadId(user));
  }, [user]);

  const loadRecentUpload = useCallback(async upload => {
    try {
      setUploadError('');
      let liveData = upload?.liveData;
      const uploadId = upload?.batchId || upload?.id;
      if (uploadId && !liveData) {
        const response = await getDashboardUploadById(uploadId);
        const batch = response?.data?.batch || response?.batch;
        liveData = batch ? saveDashboardBatchData(batch, { sourceType: upload.sourceType || upload.datasetType || 'upload-history' }) : liveData;
      }
      if (!liveData) {
        setUploadError('This upload is no longer available for your account.');
        return;
      }
      activateLiveDashboardData(liveData, { sourceType: upload.sourceType || upload.datasetType || 'upload-history' });
      setActiveUploadId(upload.id, user);
      setActiveUploadState(String(upload.id));
      setShowRecentUploads(false);
      window.setTimeout(() => onComplete?.(), 120);
    } catch (error) {
      setUploadError(error.response?.data?.message || 'Unable to open this upload.');
    }
  }, [onComplete, user]);

  const handleUploadSelect = useCallback(option => {
    setSelectedOption(option);
    setSelectedFiles({ sales: null, products: null });
    setFileValidation({ sales: null, products: null });
    setDraggingTarget(null);
  }, []);

  const readFile = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });

  const readFileBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const acceptFile = useCallback(async (target, file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      setSelectedFiles(current => ({ ...current, [target]: file }));
      setFileValidation(current => ({
        ...current,
        [target]: { status: 'invalid', message: 'Only CSV files are accepted for SO/SP template validation.' }
      }));
      return;
    }
    const text = await readFile(file);
    setSelectedFiles(current => ({ ...current, [target]: file }));
    setFileValidation(current => ({ ...current, [target]: validateCsvTemplate(text, target) }));
  }, []);

  const handleDragOver = useCallback(target => event => {
    event.preventDefault();
    setDraggingTarget(target);
  }, []);

  const handleDragLeave = useCallback(event => {
    event.preventDefault();
    setDraggingTarget(null);
  }, []);

  const handleDrop = useCallback(target => event => {
    event.preventDefault();
    setDraggingTarget(null);
    acceptFile(target, event.dataTransfer.files?.[0]);
  }, [acceptFile]);

  const fileStatusClass = target => {
    const status = fileValidation[target]?.status;
    return status === 'valid' ? 'is-valid' : status === 'invalid' ? 'is-invalid' : '';
  };

  const handleImport = useCallback(async () => {
    setUploadError('');
    if (!hasCsvFiles || !hasValidCsvFiles) return;

    try {
      const hasSpreadsheetFiles = [selectedFiles.sales, selectedFiles.products]
        .filter(Boolean)
        .some(file => file.name.toLowerCase().endsWith('.xlsx'));
      if (hasSpreadsheetFiles) {
      const [salesBase64, productBase64] = await Promise.all([
        selectedFiles.sales ? readFileBase64(selectedFiles.sales) : Promise.resolve(''),
        selectedFiles.products ? readFileBase64(selectedFiles.products) : Promise.resolve('')
      ]);
      const response = await importDashboardFiles({
        uploadedBy: user?.name || user?.email || 'Current user',
        datasetType: 'XLSX',
        signature: createUploadSignature(selectedFiles.sales?.name, selectedFiles.products?.name, salesBase64, productBase64),
        salesFile: selectedFiles.sales ? { name: selectedFiles.sales.name, base64: salesBase64 } : null,
        productFile: selectedFiles.products ? { name: selectedFiles.products.name, base64: productBase64 } : null
      });
      const batch = response?.data?.batch || response?.data?.data?.batch;
      const liveData = batch ? saveDashboardBatchData(batch, { sourceType: 'xlsx' }) : null;
      markSalesDataImported('xlsx');
      saveRecentUpload({
        name: [selectedFiles.sales?.name, selectedFiles.products?.name].filter(Boolean).join(' + '),
        source: selectedFiles.sales && selectedFiles.products ? 'Sales + Products' : selectedFiles.sales ? 'Sales Info' : 'Product Sales',
        datasetType: 'XLSX',
        status: 'Ready',
        uploadedBy: user?.name || user?.email || 'Current user',
        signature: createUploadSignature(selectedFiles.sales?.name, selectedFiles.products?.name, salesBase64, productBase64),
        batchId: batch?.id,
        liveData,
        sourceType: 'xlsx'
      });
      setSelectedOption(null);
      window.dispatchEvent(new Event('tdt_notifications_sync'));
      window.setTimeout(() => onComplete?.(), 250);
      return;
      }
      const [salesCsvText, productCsvText] = await Promise.all([
        selectedFiles.sales ? readFile(selectedFiles.sales) : Promise.resolve(''),
        selectedFiles.products ? readFile(selectedFiles.products) : Promise.resolve('')
      ]);
      const response = await importDashboardCsv({
        fileName: selectedFiles.sales?.name || '',
        productFileName: selectedFiles.products?.name || '',
        uploadedBy: user?.name || user?.email || 'Current user',
        datasetType: 'CSV',
        signature: createUploadSignature(selectedFiles.sales?.name, selectedFiles.products?.name, salesCsvText, productCsvText),
        salesCsvText,
        productCsvText
      });
      const batch = response?.data?.batch || response?.data?.data?.batch;
      if (!batch) {
        throw new Error('Upload did not return a PostgreSQL batch record.');
      }
      const liveData = saveDashboardBatchData(batch, { sourceType: 'csv' });
      saveRecentUpload({
        name: [selectedFiles.sales?.name, selectedFiles.products?.name].filter(Boolean).join(' + '),
        source: selectedFiles.sales && selectedFiles.products ? 'Sales + Products' : selectedFiles.sales ? 'Sales Info' : 'Product Sales',
        datasetType: 'CSV',
        status: 'Ready',
        uploadedBy: user?.name || user?.email || 'Current user',
        signature: createUploadSignature(selectedFiles.sales?.name, selectedFiles.products?.name, salesCsvText, productCsvText),
        batchId: batch.id,
        liveData,
        sourceType: 'csv'
      });
      markSalesDataImported('csv');
      setSelectedOption(null);
      window.dispatchEvent(new Event('tdt_notifications_sync'));
      window.setTimeout(() => onComplete?.(), 250);
    } catch (error) {
      setUploadError(error.response?.data?.message || 'Upload failed. Please try again.');
    }
  }, [hasCsvFiles, hasValidCsvFiles, onComplete, saveRecentUpload, selectedFiles, user]);

  useEffect(() => {
    const syncUploads = () => {
      setRecentUploads(readUploadHistory(user));
      setActiveUploadState(getActiveUploadId(user));
    };
    window.addEventListener('storage', syncUploads);
    window.addEventListener('tdt-upload-history-updated', syncUploads);
    return () => {
      window.removeEventListener('storage', syncUploads);
      window.removeEventListener('tdt-upload-history-updated', syncUploads);
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const loadDatabaseUploads = async () => {
      try {
        const response = await getDashboardUploads();
        const uploads = response?.data || [];
        if (!cancelled && Array.isArray(uploads)) {
          setRecentUploads(uploads.map(upload => ({
            ...upload,
            batchId: upload.id,
            source: upload.salesRows && upload.productRows ? 'Sales + Products' : upload.salesRows ? 'Sales Info' : upload.productRows ? 'Product Sales' : upload.datasetType,
            sourceType: upload.datasetType,
          })));
        }
      } catch {
        if (!cancelled) setRecentUploads(readUploadHistory(user));
      }
    };
    loadDatabaseUploads();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <motion.div
      className={embedded ? 'upload-portal upload-portal-embedded' : 'upload-portal'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28 }}
    >
      <div className="upload-steel-bg" />
      <div className="upload-dark-overlay" />
      <div className="upload-vignette" />
      <div className="orange-glow" />

      <motion.div className={`upload-content ${isRequiredImport ? 'upload-content-required' : ''}`} variants={containerVariants} initial="hidden" animate="visible">
        {!isRequiredImport && (
          <motion.div className="upload-header-row" variants={itemVariants}>
            <motion.button
              className="upload-back-btn back-button"
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </motion.button>
            <motion.button
              className="upload-back-btn upload-recent-button"
              type="button"
              variants={itemVariants}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRecentUploads(true)}
            >
              <FileSpreadsheet size={16} />
              <span>Recent Upload</span>
            </motion.button>
          </motion.div>
        )}
        {showRecentUploads && (
          <motion.div
            className="upload-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <motion.div
              className="upload-action-panel upload-recent-modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <button className="upload-action-close" type="button" onClick={() => setShowRecentUploads(false)} aria-label="Close recent uploads">
                <X size={16} />
              </button>
              <div className="upload-recent-title">
                <FileSpreadsheet size={14} />
                <span>Recent Upload Files</span>
                <small>Your Personal Recent Uploads</small>
              </div>
              <div className="upload-recent-list">
                {uploadError && <div className="upload-recent-empty">{uploadError}</div>}
                {recentUploads.length ? recentUploads.map(upload => (
                  <button className={`upload-recent-item ${String(upload.id) === activeUploadId ? 'is-active' : ''}`} key={upload.id} type="button" onClick={() => loadRecentUpload(upload)}>
                    <FileSpreadsheet size={14} />
                    <span className="upload-recent-name">{upload.name}</span>
                    <span className="upload-recent-meta">{upload.source || upload.datasetType}</span>
                    <span className="upload-recent-meta">{formatUploadDateTime(upload.uploadedAt)}</span>
                  </button>
                )) : (
                  <div className="upload-recent-empty">No recent uploads</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        <motion.div className="upload-logo-section upload-header" variants={itemVariants}>
          <motion.img
            src={logo}
            alt="TDT Powersteel Logo"
            className="upload-logo"
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'tween', duration: 0.22 }}
          />
          <motion.h1 className="upload-title" variants={itemVariants}>
            Key Integrated Tracking & Analytics
          </motion.h1>
          <motion.p className="upload-tagline" variants={itemVariants}>
            Key Integrated Tracking &amp; Analytics
          </motion.p>
        </motion.div>
        <motion.div className="upload-options upload-grid" variants={itemVariants}>
          {uploadOptions.map(({ id, title, description, Icon }) => (
            <motion.button
              key={id}
              className={`upload-card ${selectedOption === id ? 'selected' : ''}`}
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleUploadSelect(id)}
              type="button"
            >
              <span className="upload-card-icon">
                <Icon size={38} />
              </span>
              <h3 className="upload-card-title">
                <span>{title}</span>
              </h3>
              <p className="upload-card-description">{description}</p>
              <span className="upload-card-cta">
                <span>Open</span>
                <ArrowRight size={15} />
              </span>
            </motion.button>
          ))}
        </motion.div>

        {selectedOption && (
          <motion.div
            className="upload-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <motion.div
              className="upload-action-panel"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <button className="upload-action-close" type="button" onClick={() => setSelectedOption(null)} aria-label="Close upload option">
                <X size={16} />
              </button>
              <div>
                <span className="upload-action-kicker">File upload</span>
                <h2>SO/SP CSV Upload</h2>
                <p>Select the Sales Order and Sales Product CSV exports. Each file must include the required columns.</p>
              </div>

              <div className="upload-dual-files">
                <label
                  className={`upload-action-field upload-file-field upload-drop-zone ${draggingTarget === 'sales' ? 'is-dragging' : ''} ${selectedFiles.sales ? 'has-file' : ''} ${fileStatusClass('sales')}`}
                  onDragOver={handleDragOver('sales')}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop('sales')}
                >
                  <span>Sales Order CSV (SO)</span>
                  <strong>{selectedFiles.sales?.name || 'Drop SALES INFO file here'}</strong>
                  <small>{fileValidation.sales?.message || 'Required: Date, Class, Rep, Num, Name, FOB, Salesman GK, Weight, Terms, Counter, Source, Amount, Memo'}</small>
                  <input type="file" accept=".csv,text/csv" onChange={event => acceptFile('sales', event.target.files?.[0])} />
                </label>
                <label
                  className={`upload-action-field upload-file-field upload-drop-zone ${draggingTarget === 'products' ? 'is-dragging' : ''} ${selectedFiles.products ? 'has-file' : ''} ${fileStatusClass('products')}`}
                  onDragOver={handleDragOver('products')}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop('products')}
                >
                  <span>Sales Product CSV (SP)</span>
                  <strong>{selectedFiles.products?.name || 'Drop PRODUCT SALES file here'}</strong>
                  <small>{fileValidation.products?.message || 'Required: Qty, Amount, % of Sales, Avg Price, COGS, Avg COGS, Gross Margin, Gross Margin %'}</small>
                  <input type="file" accept=".csv,text/csv" onChange={event => acceptFile('products', event.target.files?.[0])} />
                </label>
              </div>

              {uploadError && <p className="upload-live-note">{uploadError}</p>}

              <button
                className={`upload-action-primary connect-btn ${!hasValidCsvFiles ? 'is-disabled' : ''}`}
                type="button"
                onClick={handleImport}
              >
                Import Data
                <ArrowRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
