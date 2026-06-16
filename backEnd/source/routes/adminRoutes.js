const express = require('express');

const router = express.Router();
const { protect, adminOrSubAdmin } = require('../middleware/authMiddleware');

const {
  getUsers,
  getPendingUsers,
  approveUser,
  activateUser,
  deactivateUser,
  rejectUser,
  forceUser,
  unforceUser,
  updateUserRole,
} = require('../controllers/adminController');

router.use(protect, adminOrSubAdmin);

router.get('/users', getUsers);

router.get('/pending-users', getPendingUsers);

router.put('/approve/:id', approveUser);

router.put('/reject/:id', rejectUser);

router.put('/deactivate/:id', deactivateUser);

router.put('/activate/:id', activateUser);

router.put('/role/:id', updateUserRole);

router.put('/force/:id', forceUser);

router.put('/unforce/:id', unforceUser);

module.exports = router;
