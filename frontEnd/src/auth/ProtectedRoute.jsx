import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';
import ApprovalPendingPage from './ApprovalPendingPage';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isApproved } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isApproved) {
    return <ApprovalPendingPage />;
  }

  return children;
}
