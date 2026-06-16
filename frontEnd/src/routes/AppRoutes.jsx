import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import AdminRoute from '../auth/AdminRoute';
import AdminOrSubAdminRoute from '../auth/AdminOrSubAdminRoute';
import ApprovalPendingPage from '../auth/ApprovalPendingPage';
import ProtectedRoute from '../auth/ProtectedRoute';
import { useAuth } from '../auth/AuthContext';
import Background from '../components/layout/Background';
import IntroPopup from '../components/common/IntroPopup';
import LoadingScreen from '../components/common/LoadingScreen';
import { getDashboardSettings, resolveDashboardLandingPage } from '../utils/settingsService';

const Login = lazy(() => import('../pages/Login'));
const Signup = lazy(() => import('../pages/Signup'));
const Upload = lazy(() => import('../pages/Upload'));
const Dashboard = lazy(() => import('../pages/Dashboard'));

const pageVariants = {
  initial: { opacity: 0, y: 8, scale: 0.998 },
  in: { opacity: 1, y: 0, scale: 1 },
  out: { opacity: 0, y: -4, scale: 0.997 }
};

const pageTransition = {
  type: 'tween',
  ease: [0.22, 1, 0.36, 1],
  duration: 0.14
};

function IntroRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate('/loading', { replace: true }), 2400);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return <IntroPopup />;
}

function LoadingRoute({ nextPath = '/login' }) {
  const navigate = useNavigate();

  const handleLoadingComplete = useCallback(() => {
    console.log('[KITA Loader] navigation trigger:', nextPath);
    navigate(nextPath, { replace: true });
  }, [navigate, nextPath]);

  return <LoadingScreen onComplete={handleLoadingComplete} />;
}

function RouteShell({ children }) {
  return (
    <motion.div
      className="screen-wrapper"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

export default function AppRoutes() {
  const { isAuthenticated, isApproved, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fallback = useMemo(() => <div className="screen-fallback" />, []);
  const wasAuthenticated = useRef(isAuthenticated);
  const [isRouteLoading, setIsRouteLoading] = useState(() => location.pathname !== '/loading');

  const authenticatedLanding = useMemo(
    () => resolveDashboardLandingPage({ user, settings: getDashboardSettings() }),
    [user]
  );
  const loadingNextPath = useMemo(() => {
    if (!isAuthenticated) return '/login';
    return isApproved ? authenticatedLanding : '/approval-pending';
  }, [authenticatedLanding, isApproved, isAuthenticated]);

  useEffect(() => {
    if (location.pathname === '/loading') {
      setIsRouteLoading(false);
      return undefined;
    }

    return undefined;
  }, [location.pathname]);

  useEffect(() => {
    if (!wasAuthenticated.current && isAuthenticated && isApproved) {
      setIsRouteLoading(true);
      console.log('[KITA Loader] loading state enabled after approved authentication.');
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, isApproved]);

  useEffect(() => {
    if (!isAuthenticated || !isApproved) return undefined;
    if (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/approval-pending') {
      console.log('[KITA Loader] authenticated landing navigation trigger:', authenticatedLanding);
      navigate(authenticatedLanding, { replace: true });
    }
    return undefined;
  }, [authenticatedLanding, isApproved, isAuthenticated, location.pathname, navigate]);

  const handleUploadComplete = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <>
      <Background />
      <div className="app-stage">
        <Suspense fallback={fallback}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/loading" replace />} />
              <Route path="/intro" element={<RouteShell><IntroRoute /></RouteShell>} />
              <Route path="/loading" element={<RouteShell><LoadingRoute nextPath={loadingNextPath} /></RouteShell>} />
              <Route
                path="/login"
                element={
                  isAuthenticated ? (
                    <Navigate to={isApproved ? authenticatedLanding : '/approval-pending'} replace />
                  ) : (
                    <RouteShell><Login /></RouteShell>
                  )
                }
              />
              <Route
                path="/signup"
                element={
                  isAuthenticated ? (
                    <Navigate to={isApproved ? authenticatedLanding : '/approval-pending'} replace />
                  ) : (
                    <RouteShell><Signup /></RouteShell>
                  )
                }
              />
              <Route
                path="/approval-pending"
                element={
                  isAuthenticated && !isApproved ? (
                    <RouteShell><ApprovalPendingPage /></RouteShell>
                  ) : (
                    <Navigate to={isAuthenticated ? authenticatedLanding : '/login'} replace />
                  )
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <RouteShell><Upload onComplete={handleUploadComplete} /></RouteShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-uploads"
                element={<Navigate to={String(user?.role || '').toLowerCase() === 'admin' ? '/admin/uploads' : '/upload'} replace />}
              />
              <Route path="/user-management" element={<Navigate to="/admin/users" replace />} />
              <Route path="/admin/user-management" element={<AdminOrSubAdminRoute><Dashboard onLogout={handleLogout} /></AdminOrSubAdminRoute>} />
              <Route path="/present" element={<Navigate to="/presentation" replace />} />
              <Route
                path="/admin/users"
                element={
                  <AdminOrSubAdminRoute>
                    <Dashboard onLogout={handleLogout} />
                  </AdminOrSubAdminRoute>
                }
              />
              {['/dashboard', '/presentation', '/sales-team', '/sales-reps', '/rankings', '/performance-board', '/profile', '/settings'].map(path => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <ProtectedRoute>
                      <Dashboard onLogout={handleLogout} />
                    </ProtectedRoute>
                  }
                />
              ))}
              {['/admin', '/admin/uploads', '/admin/pending-approvals'].map(path => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <AdminRoute>
                      <Dashboard onLogout={handleLogout} />
                    </AdminRoute>
                  }
                />
              ))}
              <Route path="*" element={<Navigate to="/intro" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      <AnimatePresence>
        {isRouteLoading && location.pathname !== '/loading' && (
          <LoadingScreen
            key="route-initialization-loader"
            mode="route"
            onComplete={() => {
              console.log('[KITA Loader] dashboard render trigger: route overlay complete.');
              setIsRouteLoading(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
