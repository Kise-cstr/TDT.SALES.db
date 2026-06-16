const prisma = require('../config/db');

const userLifecycleColumns = [
  ['animationSpeed', "TEXT NOT NULL DEFAULT 'Balanced'"],
  ['sessionTimeout', 'INTEGER NOT NULL DEFAULT 15'],
  ['preferences', "JSONB NOT NULL DEFAULT '{}'::jsonb"],
  ['notifications', "JSONB NOT NULL DEFAULT '[]'::jsonb"],
  ['forced', 'BOOLEAN NOT NULL DEFAULT false'],
  ['forcedAt', 'TIMESTAMP(3)'],
  ['scheduledDeletionAt', 'TIMESTAMP(3)'],
  ['deletionCancelledAt', 'TIMESTAMP(3)'],
];

let columnsReady = false;
let lifecycleJobStarted = false;

const ensureUserLifecycleColumns = async () => {
  if (columnsReady) return;
  for (const [name, type] of userLifecycleColumns) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "${name}" ${type}`);
    } catch (error) {
      if (!/duplicate column name|already exists/i.test(String(error.message || ''))) throw error;
    }
  }
  columnsReady = true;
};

const addWorkingDays = (startDate, workingDays, holidays = []) => {
  const holidayKeys = new Set(holidays.map(date => new Date(date).toISOString().slice(0, 10)));
  const date = new Date(startDate);
  let remaining = workingDays;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    const key = date.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidayKeys.has(key)) remaining -= 1;
  }

  return date;
};

const dashboardPeriods = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
const landingPagePaths = ['/dashboard', '/sales-team', '/presentation', '/upload', '/admin/users', '/admin/uploads', '/admin'];
const autoRefreshOptions = ['Off', '1 Minute', '5 Minutes', '15 Minutes'];
const sessionTimeoutOptions = ['15 Minutes', '30 Minutes', '1 Hour'];

const normalizePreferences = preferences => {
  const source = preferences && typeof preferences === 'object' ? preferences : {};
  const dashboard = source.dashboard && typeof source.dashboard === 'object' ? source.dashboard : {};
  const notifications = source.notifications && typeof source.notifications === 'object' ? source.notifications : {};
  const security = source.security && typeof source.security === 'object' ? source.security : {};

  const next = {
    dashboard: {
      defaultLandingPage: landingPagePaths.includes(dashboard.defaultLandingPage || source.defaultLandingPage)
        ? dashboard.defaultLandingPage || source.defaultLandingPage
        : '/dashboard',
      defaultDashboardPeriod: dashboardPeriods.includes(dashboard.defaultDashboardPeriod || source.defaultDashboardPeriod || source.period)
        ? dashboard.defaultDashboardPeriod || source.defaultDashboardPeriod || source.period
        : 'Monthly',
      autoRefreshData: autoRefreshOptions.includes(dashboard.autoRefreshData || source.autoRefreshData)
        ? dashboard.autoRefreshData || source.autoRefreshData
        : 'Off',
      rememberLastOpenedPage: typeof dashboard.rememberLastOpenedPage === 'boolean'
        ? dashboard.rememberLastOpenedPage
        : typeof source.rememberLastOpenedPage === 'boolean'
          ? source.rememberLastOpenedPage
          : true,
      autoCollapseSidePanel: typeof dashboard.autoCollapseSidePanel === 'boolean'
        ? dashboard.autoCollapseSidePanel
        : typeof source.autoCollapseSidePanel === 'boolean'
          ? source.autoCollapseSidePanel
          : false
    },
    notifications: {
      enableNotifications: typeof notifications.enableNotifications === 'boolean'
        ? notifications.enableNotifications
        : typeof source.enableNotifications === 'boolean'
          ? source.enableNotifications
          : true,
      notifyOnNewUserRequests: typeof notifications.notifyOnNewUserRequests === 'boolean'
        ? notifications.notifyOnNewUserRequests
        : typeof source.notifyOnNewUserRequests === 'boolean'
          ? source.notifyOnNewUserRequests
          : true,
      notifyOnNewUploads: typeof notifications.notifyOnNewUploads === 'boolean'
        ? notifications.notifyOnNewUploads
        : typeof source.notifyOnNewUploads === 'boolean'
          ? source.notifyOnNewUploads
          : false
    },
    security: {
      sessionTimeout: sessionTimeoutOptions.includes(security.sessionTimeout || source.sessionTimeout)
        ? security.sessionTimeout || source.sessionTimeout
        : '30 Minutes',
      autoLogoutOnInactivity: typeof security.autoLogoutOnInactivity === 'boolean'
        ? security.autoLogoutOnInactivity
        : typeof source.autoLogoutOnInactivity === 'boolean'
          ? source.autoLogoutOnInactivity
          : true
    }
  };

  return next;
};

const resolveSessionTimeoutMinutes = preferences => {
  const timeout = preferences?.security?.sessionTimeout;
  if (timeout === '15 Minutes') return 15;
  if (timeout === '1 Hour') return 60;
  return 30;
};

const attachLifecycleFields = async user => {
  if (!user?.id) return user;
  await ensureUserLifecycleColumns();
  const rows = await prisma.$queryRaw`
    SELECT "animationSpeed", "sessionTimeout", "preferences", "notifications", "forced", "forcedAt", "scheduledDeletionAt", "deletionCancelledAt"
    FROM "User"
    WHERE "id" = ${user.id}
    LIMIT 1
  `;
  const row = rows[0] || {};
  return {
    ...user,
    ...row,
    preferences: normalizePreferences(row.preferences || user.preferences),
    notifications: Array.isArray(row.notifications) ? row.notifications : []
  };
};

const attachLifecycleFieldsToUsers = async users => Promise.all((users || []).map(attachLifecycleFields));

const updateUserPreferences = async (userId, preferences = {}) => {
  await ensureUserLifecycleColumns();
  const normalizedPreferences = normalizePreferences(preferences);
  const sessionTimeout = resolveSessionTimeoutMinutes(normalizedPreferences);

  await prisma.$executeRaw`
    UPDATE "User"
    SET "animationSpeed" = 'Balanced',
        "sessionTimeout" = ${sessionTimeout},
        "preferences" = ${JSON.stringify(normalizedPreferences)}::jsonb
    WHERE "id" = ${userId}
  `;

  return attachLifecycleFields(await prisma.user.findUnique({ where: { id: userId } }));
};

const forceUserForDeletion = async userId => {
  await ensureUserLifecycleColumns();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.role === 'admin') throw new Error('Admin accounts cannot be forced for deletion');

  const forcedAt = new Date();
  const scheduledDeletionAt = addWorkingDays(forcedAt, 15);
  await prisma.$executeRaw`
    UPDATE "User"
    SET "forced" = true,
        "forcedAt" = ${forcedAt},
        "scheduledDeletionAt" = ${scheduledDeletionAt},
        "deletionCancelledAt" = NULL,
        "status" = 'pending_deletion'
    WHERE "id" = ${userId}
      AND "role" != 'admin'
  `;

  return attachLifecycleFields(await prisma.user.findUnique({ where: { id: userId } }));
};

const unforceUserForDeletion = async userId => {
  await ensureUserLifecycleColumns();
  await prisma.$executeRaw`
    UPDATE "User"
    SET "forced" = false,
        "forcedAt" = NULL,
        "scheduledDeletionAt" = NULL,
        "deletionCancelledAt" = ${new Date()},
        "status" = 'active'
    WHERE "id" = ${userId}
      AND "role" != 'admin'
  `;

  return attachLifecycleFields(await prisma.user.findUnique({ where: { id: userId } }));
};

const deleteExpiredForcedAccounts = async () => {
  await ensureUserLifecycleColumns();
  const rows = await prisma.$queryRaw`
    SELECT "id"
    FROM "User"
    WHERE "role" != 'admin'
      AND "forced" = true
      AND "status" = 'pending_deletion'
      AND "scheduledDeletionAt" IS NOT NULL
      AND "scheduledDeletionAt" <= ${new Date()}
  `;
  const ids = rows.map(row => row.id);
  if (!ids.length) return 0;
  await prisma.user.deleteMany({ where: { id: { in: ids }, role: { not: 'admin' } } });
  return ids.length;
};

const startAccountLifecycleJob = () => {
  if (lifecycleJobStarted) return;
  lifecycleJobStarted = true;
  ensureUserLifecycleColumns()
    .then(deleteExpiredForcedAccounts)
    .catch(error => console.error('Account lifecycle check failed:', error.message));
  setInterval(() => {
    deleteExpiredForcedAccounts().catch(error => console.error('Account lifecycle check failed:', error.message));
  }, 60 * 60 * 1000);
};

module.exports = {
  addWorkingDays,
  attachLifecycleFields,
  attachLifecycleFieldsToUsers,
  deleteExpiredForcedAccounts,
  ensureUserLifecycleColumns,
  forceUserForDeletion,
  startAccountLifecycleJob,
  unforceUserForDeletion,
  updateUserPreferences,
};
