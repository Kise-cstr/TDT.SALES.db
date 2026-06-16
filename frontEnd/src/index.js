import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { applyDashboardTheme, readDashboardTheme } from './utils/dashboardTheme';

import './index.css';

applyDashboardTheme(readDashboardTheme());

ReactDOM.createRoot(
  document.getElementById('root')
).render(

  <React.StrictMode>

    <App />

  </React.StrictMode>

);
