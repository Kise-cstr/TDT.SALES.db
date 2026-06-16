import { memo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiDatabase, FiFileText } from 'react-icons/fi';

import { getDashboardUploadById, getDashboardUploads } from '../../api/dashboardApi';
import { activateLiveDashboardData, saveDashboardBatchData } from '../../data/liveDataService';
import {
  formatUploadDateTime,
  getActiveUploadId,
  pruneExpiredUploads,
  readUploadHistory,
  setActiveUploadId,
  uploadRetentionDays
} from '../../utils/uploadHistory';
import { useAuth } from '../../auth/AuthContext';
import '../../styles/admin.css';

function ManageUploads() {
  const { user } = useAuth();
  const [uploads, setUploads] = useState([]);
  const [activeUploadId, setActiveUploadState] = useState(() => getActiveUploadId(user));
  const [loadError, setLoadError] = useState('');

  const syncUploads = useCallback(async () => {
    try {
      const response = await getDashboardUploads();
      if (response?.success && Array.isArray(response.data)) {
        setUploads(pruneExpiredUploads(response.data));
        return;
      }
    } catch {
      setUploads(readUploadHistory());
    }
  }, []);

  const loadUpload = useCallback(async upload => {
    try {
      setLoadError('');
      let liveData = upload?.liveData;
      if (upload?.id && !liveData) {
        const response = await getDashboardUploadById(upload.id);
        const batch = response?.data?.batch || response?.batch;
        liveData = batch ? saveDashboardBatchData(batch, { sourceType: upload.sourceType || upload.datasetType || 'managed-upload' }) : liveData;
      }
      if (!liveData) {
        setLoadError('This upload is no longer available.');
        return;
      }
      activateLiveDashboardData(liveData, { sourceType: upload.sourceType || upload.datasetType || 'managed-upload' });
      setActiveUploadId(upload.id, user);
      setActiveUploadState(String(upload.id));
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Unable to open this upload.');
    }
  }, [user]);

  useEffect(() => {
    const syncLocalState = () => {
      syncUploads();
      setActiveUploadState(getActiveUploadId(user));
    };
    syncLocalState();
    window.addEventListener('storage', syncLocalState);
    window.addEventListener('tdt-upload-history-updated', syncLocalState);
    return () => {
      window.removeEventListener('storage', syncLocalState);
      window.removeEventListener('tdt-upload-history-updated', syncLocalState);
    };
  }, [syncUploads, user]);

  return (
    <motion.section
      className="admin-panel-section admin-uploads-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <div className="admin-section-header admin-management-topbar">
        <div>
          <small className="admin-breadcrumbs">Admin / Manage Uploads</small>
          <span>Global Dataset Governance</span>
          <h1>Manage Uploads</h1>
        </div>
        <strong>{uploads.length} datasets · auto-delete after {uploadRetentionDays} days</strong>
      </div>

      <div className="admin-upload-list">
        {loadError && (
          <div className="admin-empty-state">
            <strong>{loadError}</strong>
          </div>
        )}
        {uploads.length ? uploads.map(upload => {
          const isActive = String(upload.id) === activeUploadId;
          const canLoad = Boolean(upload.liveData || upload.id);
          return (
            <article className={`admin-upload-row ${isActive ? 'is-active' : ''}`} key={upload.id}>
              <div className="admin-upload-icon">
                {isActive ? <FiCheckCircle /> : <FiFileText />}
              </div>
              <div className="admin-upload-main">
                <strong>{upload.name || upload.fileName}</strong>
                <span>{formatUploadDateTime(upload.uploadedAt || upload.createdAt)}</span>
              </div>
              <span>{upload.uploaderName || upload.uploadedBy || upload.uploaderEmail || 'Unknown user'}</span>
              <span>{upload.datasetType || upload.source || 'Dataset'}</span>
              <span className={`admin-upload-status ${canLoad ? 'is-ready' : 'is-muted'}`}>{upload.status || (canLoad ? 'Ready' : 'Connected')}</span>
              <button type="button" disabled={!canLoad} onClick={() => loadUpload(upload)}>
                <FiDatabase />
                {isActive ? 'Active' : 'Open'}
              </button>
            </article>
          );
        }) : (
          <div className="admin-empty-state">
            <strong>No upload history yet</strong>
            <span>Imported CSV/XLSX datasets will appear here after upload.</span>
          </div>
        )}
      </div>
    </motion.section>
  );
}

export default memo(ManageUploads);
