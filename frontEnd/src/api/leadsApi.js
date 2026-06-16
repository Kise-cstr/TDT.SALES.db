import apiClient from './apiClient';

export const createLead = (data) => {
  return apiClient.post('/leads', data);
};

export const getMyLeads = () => {
  return apiClient.get('/leads/my-leads');
};
