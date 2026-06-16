import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiLoader, FiRefreshCw, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { useAuth } from './AuthContext';

export default function ApprovalPendingPage({ onReturnToLogin }) {
  const navigate = useNavigate();
  const { user, isApproved, logout, refreshUsers } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState(user?.status || 'pending');

  useEffect(() => {
    setApprovalStatus(user?.status || 'pending');
  }, [user?.status]);

  const handleRefreshStatus = () => {
    const result = refreshUsers();
    const nextStatus = result.user?.status || 'pending';
    setApprovalStatus(nextStatus);

    if (isApproved || nextStatus === 'approved') {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleReturnToLogin = () => {
    logout();
    onReturnToLogin?.();
    navigate('/login', { replace: true });
  };

  return (
    <div className="auth-page-wrapper approval-page-wrapper">
      <div className="auth-steel-bg" />
      <div className="auth-vignette" />
      <div className="auth-ambient-glow" />
      <motion.div
        className="approval-modal-shell"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28 }}
      >
        <motion.section
          className="approval-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <button className="approval-close-btn" type="button" onClick={handleReturnToLogin} aria-label="Close approval waiting card">
            <FiX size={18} />
          </button>

          <motion.div
            className="approval-icon-wrap"
            animate={{ rotate: 360, boxShadow: ['0 0 28px rgba(255,122,0,0.22)', '0 0 44px rgba(255,122,0,0.42)', '0 0 28px rgba(255,122,0,0.22)'] }}
            transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, boxShadow: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
          >
            <FiLoader size={42} />
          </motion.div>

          <div className="approval-copy">
            <h2>Waiting...</h2>
            <p className="approval-message-title">Waiting for admin approval...</p>
            <p>
              Please wait while your request is being reviewed by the administrators.
              Approval is required before you can continue accessing all features of the system.
            </p>
            {approvalStatus === 'pending' && <span className="approval-status-chip">Status: Pending Review</span>}
          </div>

          <div className="approval-actions">
            <button className="approval-action-btn approval-action-secondary" type="button" onClick={handleRefreshStatus}>
              <FiRefreshCw size={16} />
              Refresh Status
            </button>
            <button className="approval-action-btn approval-action-primary" type="button" onClick={handleReturnToLogin}>
              Return to Login
            </button>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
