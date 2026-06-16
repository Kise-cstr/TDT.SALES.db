const express = require('express');

const router = express.Router();

const {
  createLead,
  getMyLeads,
} = require('../controllers/leadController');

const {
  protect,
} = require('../middleware/authMiddleware');

router.post(
  '/',
  protect,
  createLead
);

router.get(
  '/my-leads',
  protect,
  getMyLeads
);

module.exports = router;