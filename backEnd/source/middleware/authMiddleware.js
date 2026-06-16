const jwt = require('jsonwebtoken');

const prisma = require('../config/db');
const { getActiveSessionId } = require('../services/sessionService');

const protect = async (req, res, next) => {
  try {

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {

      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      req.user = await prisma.user.findUnique({
        where: {
          id: decoded.id,
        },
      });

      if (!req.user || !['approved', 'active'].includes(req.user.status) || req.user.forced) {
        return res.status(401).json({
          success: false,
          message: 'Account is not authorized',
        });
      }

      const activeSessionId = await getActiveSessionId(req.user.id);

      if (!decoded.sessionId || activeSessionId !== decoded.sessionId) {
        return res.status(401).json({
          success: false,
          message: 'This account is already signed in from another session',
        });
      }

      req.sessionId = decoded.sessionId;

      next();

    } else {

      res.status(401).json({
        success: false,
        message: 'Not authorized',
      });

    }

  } catch (error) {

    res.status(401).json({
      success: false,
      message: 'Token failed',
    });

  }
};

const adminOnly = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin only',
    });
  }

};

const adminOrSubAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'sub-admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin or Sub-Admin only',
    });
  }

};

module.exports = {
  protect,
  adminOnly,
  adminOrSubAdmin,
};
