import axios from 'axios';

const getApiBaseUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_BASE_URL;

  if (
    configuredUrl &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    configuredUrl.includes('localhost')
  ) {
    return '/api';
  }

  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port &&
    window.location.port !== '5000'
  ) {
    return 'http://localhost:5000/api';
  }

  return configuredUrl || '/api';
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const requestUrl = error.config?.url || '';
    const hadToken = Boolean(localStorage.getItem('authToken') || sessionStorage.getItem('authToken'));
    const isLoginRequest = requestUrl.includes('/auth/login');
    const isOnAuthPage = ['/login', '/signup', '/intro', '/loading'].includes(window.location.pathname);

    if (error.response?.status === 401 && hadToken && !isLoginRequest && !isOnAuthPage) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('tdt_auth_session');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('tdt_auth_session');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
