const prisma = require('../config/db');
const {
  attachLifecycleFields,
  attachLifecycleFieldsToUsers,
  deleteExpiredForcedAccounts,
  forceUserForDeletion,
  unforceUserForDeletion,
} = require('../services/accountLifecycleService');
const { attachSessionFieldsToUsers } = require('../services/sessionService');
const {
  publishAccountStatusNotification,
} = require('../services/notificationService');

const sanitizeUser = user => {
  if (!user) return null;
  const { password, notifications, ...safeUser } = user;
  return {
    ...safeUser,
    name: `${safeUser.firstName || ''} ${safeUser.lastName || ''}`.trim(),
    position: safeUser.position || (safeUser.role === 'admin' ? 'Administrator' : 'Sales Representative'),
    department: safeUser.department || (safeUser.role === 'admin' ? 'Executive Operations' : 'Sales Department'),
    requestedAt: safeUser.createdAt,
  };
};

const publicSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  position: true,
  department: true,
  avatar: true,
  createdAt: true,
};

const findTargetUser = userId => prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, role: true },
});

const getVisibleAccountWhere = req => {
  const requesterRole = String(req.user?.role || '').toLowerCase();
  if (requesterRole === 'sub-admin') {
    return {
      role: {
        in: ['sales', 'employee'],
      },
    };
  }

  return {};
};

const ensureCanManageAccount = async (req, userId) => {
  const targetUser = await findTargetUser(userId);
  if (!targetUser) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const requesterRole = String(req.user?.role || '').toLowerCase();
  const targetRole = String(targetUser.role || '').toLowerCase();

  if (targetRole === 'admin') {
    const error = new Error('Admin accounts cannot be managed by this action.');
    error.status = 403;
    throw error;
  }

  if (requesterRole === 'sub-admin' && !['sales', 'employee'].includes(targetRole)) {
    const error = new Error('Sub-admins can only manage employee accounts.');
    error.status = 403;
    throw error;
  }

  return targetUser;
};

const ensureAdminRequester = req => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    const error = new Error('Admin only');
    error.status = 403;
    throw error;
  }
};

const ensureAdminOrSubAdminRequester = req => {
  const requesterRole = String(req.user?.role || '').toLowerCase();
  if (requesterRole !== 'admin' && requesterRole !== 'sub-admin') {
    const error = new Error('Admin or Sub-Admin only');
    error.status = 403;
    throw error;
  }
};

const getUsers = async (req, res) => {
  try {
    await deleteExpiredForcedAccounts();
    const users = await prisma.user.findMany({
      where: getVisibleAccountWhere(req),
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    });
    const usersWithSessions = await attachSessionFieldsToUsers(users);
    const usersWithLifecycle = await attachLifecycleFieldsToUsers(usersWithSessions);

    res.json({
      success: true,
      data: usersWithLifecycle.map(sanitizeUser),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: 'pending',
        ...getVisibleAccountWhere(req),
      },
      select: publicSelect,
    });
    const usersWithSessions = await attachSessionFieldsToUsers(users);
    const usersWithLifecycle = await attachLifecycleFieldsToUsers(usersWithSessions);

    res.json({
      success: true,
      data: usersWithLifecycle.map(sanitizeUser),
    });

  } catch (error) {

    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });

  }
};

const approveUser = async (req, res) => {
  try {

    const userId = Number(req.params.id);
    await ensureCanManageAccount(req, userId);

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: 'approved',
      },
    });

    await publishAccountStatusNotification({ user, status: 'approved', actor: req.user });

    res.json({
      success: true,
      message: 'User approved',
      user: sanitizeUser(await attachLifecycleFields(user)),
    });

  } catch (error) {

    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });

  }
};

const rejectUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    await ensureCanManageAccount(req, userId);

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: 'rejected',
      },
    });

    await publishAccountStatusNotification({ user, status: 'rejected', actor: req.user });

    res.json({
      success: true,
      message: 'User rejected',
      user: sanitizeUser(await attachLifecycleFields(user)),
    });

  } catch (error) {

    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });

  }
};

const deactivateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    await ensureCanManageAccount(req, userId);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: 'inactive' },
    });

    await publishAccountStatusNotification({ user, status: 'inactive', actor: req.user });

    res.json({
      success: true,
      message: 'User deactivated',
      user: sanitizeUser(await attachLifecycleFields(user)),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const activateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    await ensureCanManageAccount(req, userId);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        forced: false,
        forcedAt: null,
        scheduledDeletionAt: null,
        deletionCancelledAt: null,
      },
    });

    await publishAccountStatusNotification({ user, status: 'active', actor: req.user });

    res.json({
      success: true,
      message: 'User enabled',
      user: sanitizeUser(await attachLifecycleFields(user)),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    ensureAdminRequester(req);

    const userId = Number(req.params.id);
    const requestedRole = String(req.body.role || '').toLowerCase();
    const role = requestedRole === 'sub-admin' ? 'sub-admin' : 'sales';

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin role cannot be changed',
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    res.json({
      success: true,
      message: role === 'sub-admin' ? 'User promoted to Sub-Admin' : 'User role updated',
      user: sanitizeUser(await attachLifecycleFields(user)),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const forceUser = async (req, res) => {
  try {
    ensureAdminOrSubAdminRequester(req);
    const userId = Number(req.params.id);
    await ensureCanManageAccount(req, userId);

    const user = await forceUserForDeletion(userId);
    await publishAccountStatusNotification({ user, status: 'pending_deletion', actor: req.user });
    res.json({
      success: true,
      message: 'Account forced for deletion review.',
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const unforceUser = async (req, res) => {
  try {
    ensureAdminOrSubAdminRequester(req);
    const userId = Number(req.params.id);
    await ensureCanManageAccount(req, userId);

    const user = await unforceUserForDeletion(userId);
    await publishAccountStatusNotification({ user, status: 'active', actor: req.user });
    res.json({
      success: true,
      message: 'Account restored.',
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getUsers,
  getPendingUsers,
  approveUser,
  rejectUser,
  deactivateUser,
  activateUser,
  updateUserRole,
  forceUser,
  unforceUser,
};  
