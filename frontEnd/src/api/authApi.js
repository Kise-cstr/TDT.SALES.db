import apiClient from './apiClient';

export const register = (data) => {
  return apiClient.post('/auth/register', data);
};

export const login = (email, password) => {
  return apiClient.post('/auth/login', { email, password });
};

export const scanLogin = (token, scanType = 'qr') => {
  return apiClient.post('/auth/scan-login', { token, scanType });
};

export const verifyForgotPasswordIdentity = (data) => {
  return apiClient.post('/auth/recovery/verify', data);
};

export const resetForgotPassword = (data) => {
  return apiClient.post('/auth/recovery/reset', data);
};

export const generateScanToken = () => {
  return apiClient.post('/auth/scan-token');
};

export const logout = () => {
  return apiClient.post('/auth/logout');
};

export const getCurrentUser = () => {
  return apiClient.get('/auth/me');
};

export const updateProfile = (profile) => {
  return apiClient.put('/auth/profile', profile);
};

export const updateSettings = (settings) => {
  return apiClient.put('/auth/settings', settings);
};
