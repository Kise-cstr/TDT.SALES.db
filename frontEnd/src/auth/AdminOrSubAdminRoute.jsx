import { Navigate } from 'react-router-dom';

import { useAuth } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';

export default function AdminOrSubAdminRoute({ children }) {
  const { isAdmin, isSubAdmin } = useAuth();

  return (
    <ProtectedRoute>
      {isAdmin || isSubAdmin ? children : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
}
