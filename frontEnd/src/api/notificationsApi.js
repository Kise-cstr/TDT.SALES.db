import apiClient from './apiClient';

export const getNotifications = ({ filter = 'all', page = 1, limit = 10 } = {}) => (
  apiClient.get('/notifications', { params: { filter, page, limit } })
);

export const getUnreadNotificationCount = () => (
  apiClient.get('/notifications/unread-count')
);

export const markNotificationAsRead = id => (
  apiClient.patch(`/notifications/${id}/read`)
);

export const markAllNotificationsAsRead = () => (
  apiClient.patch('/notifications/read-all')
);

export const deleteNotification = id => (
  apiClient.delete(`/notifications/${id}`)
);

export const clearNotifications = () => (
  apiClient.delete('/notifications')
);

export const publishSystemAnnouncement = payload => (
  apiClient.post('/notifications/announcements', payload)
);
