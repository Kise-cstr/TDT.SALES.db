import { BrowserRouter } from 'react-router-dom';

import './styles/globals.css';
import './styles/animations.css';
import './styles/background.css';
import './styles/auth.css';
import './styles/theme.css';

import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './notifications/NotificationContext';
import AppRoutes from './routes/AppRoutes';
import ThemeTransitionLayer from './components/common/ThemeTransitionLayer';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
        <ThemeTransitionLayer />
      </AuthProvider>
    </BrowserRouter>
  );
}
