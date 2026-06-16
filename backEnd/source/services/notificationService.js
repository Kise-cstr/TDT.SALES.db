const crypto = require('crypto');
const prisma = require('../config/db');
const { ensureUserLifecycleColumns } = require('./accountLifecycleService');

const MAX_NOTIFICATIONS_PER_USER = 50;
const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ROLE_ADMIN = 'admin';
const ROLE_SUB_ADMIN = 'sub-admin';

const notificationFilters = new Set(['all', 'unread', 'uploads', 'user_requests', 'account_activities']);

const notificationCategoryByType = {
  new_upload: 'uploads',
  new_user_request: 'user_requests',
  account_approved: 'account_activities',
  account_disabled: 'account_activities',
  system_announcement: 'account_activities',
};

const typeCopy = {
  new_upload: {
    title: 'New Upload Received',
    category: 'uploads',
  },
  new_user_request: {
    title: 'New Account Request',
    category: 'user_requests',
  },
  account_approved: {
    title: 'Account Approved',
    category: 'account_activities',
  },
  account_disabled: {
    title: 'Account Disabled',
    category: 'account_activities',
  },
  system_announcement: {
    title: 'System Announcement',
    category: 'account_activities',
  },
};

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toIso = value => {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeNotificationFiles = value => {
  if (Array.isArray(value)) {
    return value.map(file => String(file || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\s*\+\s*/g)
      .map(file => String(file || '').trim())
      .filter(Boolean);
  }

  return [];
};

const getFullName = user => `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Unknown user';

const normalizeNotification = notification => {
  if (!isPlainObject(notification)) return null;
  const createdAt = toIso(notification.createdAt);
  const readAt = notification.readAt ? toIso(notification.readAt) : null;
  const type = String(notification.type || 'system_announcement');
  const category = notificationCategoryByType[type] || notification.category || 'account_activities';
  const files = normalizeNotificationFiles(
    notification.meta?.files || notification.meta?.fileNames || notification.fileNames || notification.fileName
  );

  return {
    id: String(notification.id || crypto.randomUUID()),
    type,
    category,
    title: String(notification.title || typeCopy[type]?.title || 'Notification'),
    message: String(notification.message || ''),
    createdAt,
    readAt,
    read: Boolean(readAt || notification.read),
    targetUserId: notification.targetUserId ?? null,
    sourceUserId: notification.sourceUserId ?? null,
    sourceName: String(notification.sourceName || ''),
    fileName: notification.fileName ? String(notification.fileName) : null,
    files,
    meta: isPlainObject(notification.meta) ? notification.meta : {},
  };
};

const normalizeNotificationList = notifications => {
  const now = Date.now();
  return (Array.isArray(notifications) ? notifications : [])
    .map(normalizeNotification)
    .filter(Boolean)
    .filter(notification => now - new Date(notification.createdAt).getTime() <= NOTIFICATION_TTL_MS)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const trimNotificationList = notifications => {
  const next = [...notifications];
  while (next.length > MAX_NOTIFICATIONS_PER_USER) {
    const oldestUnreadIndex = [...next].reverse().findIndex(item => !item.readAt);
    if (oldestUnreadIndex === -1) {
      next.pop();
      continue;
    }

    const removeIndex = next.length - 1 - oldestUnreadIndex;
    next.splice(removeIndex, 1);
  }
  return next;
};

const persistUserNotifications = async (userId, notifications) => {
  await ensureUserLifecycleColumns();
  const normalized = trimNotificationList(normalizeNotificationList(notifications));
  await prisma.user.update({
    where: { id: userId },
    data: { notifications: normalized },
  });
  return normalized;
};

const loadUserNotifications = async userId => {
  await ensureUserLifecycleColumns();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifications: true },
  });
  const normalized = normalizeNotificationList(user?.notifications);
  if ((Array.isArray(user?.notifications) ? user.notifications.length : 0) !== normalized.length) {
    await prisma.user.update({
      where: { id: userId },
      data: { notifications: normalized },
    });
  }
  return normalized;
};

const fetchRecipients = async ({ roles = [], userIds = [] } = {}) => {
  await ensureUserLifecycleColumns();
  const where = {};
  if (roles.length) {
    where.role = { in: roles };
  }
  if (userIds.length) {
    where.id = { in: userIds };
  }
  const users = await prisma.user.findMany({
    where,
    select: { id: true },
  });
  return users.map(user => user.id);
};

const createNotificationForRecipients = async (recipientIds, payload) => {
  if (!Array.isArray(recipientIds) || !recipientIds.length) return [];
  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, notifications: true },
  });

  const results = [];
  for (const recipient of recipients) {
    const current = normalizeNotificationList(recipient.notifications);
    const nextNotification = normalizeNotification({
      ...payload,
      id: crypto.randomUUID(),
      createdAt: payload.createdAt || new Date().toISOString(),
      readAt: null,
      read: false,
    });
    const nextList = trimNotificationList([nextNotification, ...current]);
    await prisma.user.update({
      where: { id: recipient.id },
      data: { notifications: nextList },
    });
    results.push(nextNotification);
  }
  return results;
};

const publishNotification = async ({ recipientIds = [], type, title, message, category, meta = {}, sourceUserId = null, sourceName = '', fileName = null, targetUserId = null }) => {
  const payload = {
    type,
    title: title || typeCopy[type]?.title || 'Notification',
    message,
    category: category || notificationCategoryByType[type] || 'account_activities',
    meta,
    sourceUserId,
    sourceName,
    fileName,
    targetUserId,
  };

  return createNotificationForRecipients(recipientIds, payload);
};

const getAdminAndSubAdminRecipients = async () => fetchRecipients({ roles: [ROLE_ADMIN, ROLE_SUB_ADMIN] });
const getAdminRecipients = async () => fetchRecipients({ roles: [ROLE_ADMIN] });
const getAllUserRecipients = async () => fetchRecipients({});

const publishNewUserRequestNotification = async user => {
  const recipients = await getAdminAndSubAdminRecipients();
  return publishNotification({
    recipientIds: recipients,
    type: 'new_user_request',
    title: 'New Account Request',
    message: `${getFullName(user)} submitted an account request`,
    meta: {
      applicantName: getFullName(user),
      applicantEmail: user?.email || '',
    },
    sourceUserId: user?.id || null,
    sourceName: getFullName(user),
  });
};

const publishUploadNotification = async ({
  uploadedByUser,
  fileName,
  fileNames,
  uploadedAt = new Date(),
  uploaderName = ''
}) => {
  const recipients = await getAdminRecipients();
  const files = normalizeNotificationFiles(fileNames && fileNames.length ? fileNames : fileName);
  const summary = files.length > 1 ? `${files.length} files` : (files[0] || 'a file');
  const uploader = uploaderName || getFullName(uploadedByUser);
  return publishNotification({
    recipientIds: recipients,
    type: 'new_upload',
    title: 'New Upload Received',
    message: files.length === 1
      ? `${uploader} uploaded: ${summary}`
      : `${uploader} uploaded ${summary}`,
    meta: {
      fileName: files.join(' + ') || String(fileName || ''),
      fileNames: files,
      files,
      fileCount: files.length,
      uploadedAt: toIso(uploadedAt),
      uploaderName: uploader,
      uploaderEmail: uploadedByUser?.email || '',
      uploaderUserId: uploadedByUser?.id || null,
    },
    fileName: files.join(' + ') || fileName || null,
    sourceUserId: uploadedByUser?.id || null,
    sourceName: uploader,
  });
};

const publishAccountStatusNotification = async ({ user, status, actor }) => {
  const recipients = await fetchRecipients({ userIds: [user?.id] });
  const privilegedRecipients = await getAdminAndSubAdminRecipients();
  const recipientIds = Array.from(new Set([...recipients, ...privilegedRecipients]));
  const isDisabled = ['inactive', 'rejected', 'pending_deletion'].includes(String(status || '').toLowerCase());
  const type = isDisabled ? 'account_disabled' : 'account_approved';
  const title = isDisabled ? 'Account Disabled' : 'Account Approved';
  const message = isDisabled
    ? `${getFullName(user)}'s account has been disabled`
    : `${getFullName(user)}'s account has been approved`;

  return publishNotification({
    recipientIds,
    type,
    title,
    message,
    meta: {
      accountStatus: status,
      targetName: getFullName(user),
      targetEmail: user?.email || '',
      actorName: actor ? getFullName(actor) : '',
    },
    sourceUserId: actor?.id || null,
    sourceName: actor ? getFullName(actor) : '',
    targetUserId: user?.id || null,
  });
};

const publishSystemAnnouncement = async ({ message, title = 'System Announcement', actor }) => {
  const recipients = await getAllUserRecipients();
  return publishNotification({
    recipientIds: recipients,
    type: 'system_announcement',
    title,
    message,
    meta: {
      actorName: actor ? getFullName(actor) : '',
    },
    sourceUserId: actor?.id || null,
    sourceName: actor ? getFullName(actor) : '',
  });
};

const applyNotificationFilter = (notifications, filter = 'all') => {
  const normalizedFilter = String(filter || 'all').toLowerCase();
  if (!notificationFilters.has(normalizedFilter)) return notifications;
  if (normalizedFilter === 'all') return notifications;
  if (normalizedFilter === 'unread') return notifications.filter(notification => !notification.readAt);
  if (normalizedFilter === 'uploads') return notifications.filter(notification => notification.category === 'uploads');
  if (normalizedFilter === 'user_requests') return notifications.filter(notification => notification.category === 'user_requests');
  return notifications.filter(notification => notification.category === 'account_activities');
};

const getNotificationsPage = async ({ userId, filter = 'all', page = 1, limit = 10 }) => {
  const notifications = await loadUserNotifications(userId);
  const filtered = applyNotificationFilter(notifications, filter);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const start = (safePage - 1) * safeLimit;
  const items = filtered.slice(start, start + safeLimit);

  return {
    items,
    total: filtered.length,
    unreadCount: notifications.filter(notification => !notification.readAt).length,
    hasMore: start + safeLimit < filtered.length,
    page: safePage,
    limit: safeLimit,
  };
};

const getUnreadCount = async userId => {
  const notifications = await loadUserNotifications(userId);
  return notifications.filter(notification => !notification.readAt).length;
};

const markNotificationRead = async (userId, notificationId) => {
  const notifications = await loadUserNotifications(userId);
  const nextNotifications = notifications.map(notification => (
    notification.id === notificationId
      ? { ...notification, readAt: notification.readAt || new Date().toISOString(), read: true }
      : notification
  ));
  await persistUserNotifications(userId, nextNotifications);
  return nextNotifications.find(notification => notification.id === notificationId) || null;
};

const markAllNotificationsRead = async userId => {
  const notifications = await loadUserNotifications(userId);
  const nextNotifications = notifications.map(notification => (
    notification.readAt
      ? notification
      : { ...notification, readAt: new Date().toISOString(), read: true }
  ));
  await persistUserNotifications(userId, nextNotifications);
  return nextNotifications;
};

const deleteNotification = async (userId, notificationId) => {
  const notifications = await loadUserNotifications(userId);
  const nextNotifications = notifications.filter(notification => notification.id !== notificationId);
  await persistUserNotifications(userId, nextNotifications);
  return nextNotifications;
};

const clearNotifications = async userId => {
  await persistUserNotifications(userId, []);
  return [];
};

const cleanupNotificationsForUser = async userId => {
  const notifications = await loadUserNotifications(userId);
  return persistUserNotifications(userId, notifications);
};

module.exports = {
  clearNotifications,
  cleanupNotificationsForUser,
  createNotificationForRecipients,
  deleteNotification,
  getNotificationsPage,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  publishAccountStatusNotification,
  publishNewUserRequestNotification,
  publishNotification,
  publishSystemAnnouncement,
  publishUploadNotification,
};
