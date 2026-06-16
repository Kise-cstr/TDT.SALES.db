const express = require('express');

const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', authController.register);

router.post('/login', authController.login);

router.post('/recovery/verify', authController.verifyForgotPasswordIdentity);

router.post('/recovery/reset', authController.resetForgotPassword);

router.post('/scan-login', authController.scanLogin);

router.get('/me', protect, authController.me);

router.post('/scan-token', protect, authController.generateScanAccess);

router.post('/logout', protect, authController.logout);

router.put('/profile', protect, authController.updateProfile);

router.put('/settings', protect, authController.updateSettings);

module.exports = router;
