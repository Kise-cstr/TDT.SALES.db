const {
  clearNotifications,
  deleteNotification,
  getNotificationsPage,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  publishSystemAnnouncement,
} = require('../services/notificationService');

const getNotifications = async (req, res) => {
  try {
    const data = await getNotificationsPage({
      userId: req.user.id,
      filter: req.query.filter || 'all',
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getNotificationCount = async (req, res) => {
  try {
    const unreadCount = await getUnreadCount(req.user.id);
    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const readNotification = async (req, res) => {
  try {
    const notification = await markNotificationRead(req.user.id, Number(req.params.id) || req.params.id);
    res.json({
      success: true,
      message: notification ? 'Notification marked as read.' : 'Notification not found.',
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const readAllNotifications = async (req, res) => {
  try {
    const data = await markAllNotificationsRead(req.user.id);
    res.json({
      success: true,
      message: 'All notifications marked as read.',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const removeNotification = async (req, res) => {
  try {
    const data = await deleteNotification(req.user.id, Number(req.params.id) || req.params.id);
    res.json({
      success: true,
      message: 'Notification deleted.',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const removeAllNotifications = async (req, res) => {
  try {
    const data = await clearNotifications(req.user.id);
    res.json({
      success: true,
      message: 'Notifications cleared.',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const publishAnnouncement = async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Announcement message is required.',
      });
    }

    const title = String(req.body?.title || 'System Announcement').trim() || 'System Announcement';
    const data = await publishSystemAnnouncement({
      title,
      message,
      actor: req.user,
    });

    res.status(201).json({
      success: true,
      message: 'Announcement published.',
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNotificationCount,
  getNotifications,
  publishAnnouncement,
  readAllNotifications,
  readNotification,
  removeAllNotifications,
  removeNotification,
};
