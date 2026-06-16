const express = require('express');

const notificationController = require('../controllers/notificationController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getNotificationCount);
router.patch('/:id/read', notificationController.readNotification);
router.patch('/read-all', notificationController.readAllNotifications);
router.delete('/:id', notificationController.removeNotification);
router.delete('/', notificationController.removeAllNotifications);
router.post('/announcements', adminOnly, notificationController.publishAnnouncement);

module.exports = router;
