import apiClient from './apiClient';

export const getAdminUsers = () => {
  return apiClient.get('/admin/users');
};

export const getAdminPendingUsers = () => {
  return apiClient.get('/admin/pending-users');
};

export const approveAdminUser = (userId) => {
  return apiClient.put(`/admin/approve/${userId}`);
};

export const rejectAdminUser = (userId) => {
  return apiClient.put(`/admin/reject/${userId}`);
};

export const deactivateAdminUser = (userId) => {
  return apiClient.put(`/admin/deactivate/${userId}`);
};

export const activateAdminUser = (userId) => {
  return apiClient.put(`/admin/activate/${userId}`);
};

export const forceAdminUser = (userId) => {
  return apiClient.put(`/admin/force/${userId}`);
};

export const unforceAdminUser = (userId) => {
  return apiClient.put(`/admin/unforce/${userId}`);
};

export const updateAdminUserRole = (userId, role) => {
  return apiClient.put(`/admin/role/${userId}`, { role });
};
