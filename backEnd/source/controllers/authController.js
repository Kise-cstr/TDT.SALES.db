const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');
const { waitForDatabaseReady } = require('../config/databaseBootstrap');
const {
  ensureAccountAccessColumns,
  generateAccountAccessToken,
  validateAccountAccessToken,
} = require('../services/accountAccessTokenService');
const {
  ensurePasswordRecoveryColumns,
  ensureRecoveryAttemptLogTable,
  getRecoveryUserByEmail,
  logRecoveryAttempt,
  recordPasswordFailure,
  recordRecoveryFailure,
  resetPasswordFailureCounters,
  resetRecoveryFailureCounters,
} = require('../services/passwordRecoveryService');
const {
  attachLifecycleFields,
  deleteExpiredForcedAccounts,
  updateUserPreferences,
} = require('../services/accountLifecycleService');
const {
  clearActiveSession,
  setActiveSession,
} = require('../services/sessionService');
const {
  publishNewUserRequestNotification,
  cleanupNotificationsForUser,
} = require('../services/notificationService');

const ensureAuthDatabaseReady = async () => {
  try {
    await waitForDatabaseReady(45000);
    return true;
  } catch (error) {
    throw Object.assign(new Error('Database is still starting. Please retry in a moment.'), {
      status: 503,
      reason: 'database_bootstrap_pending',
      cause: error,
    });
  }
};

const DEFAULT_ADMIN_EMAIL = 'admin@tdtpowersteel.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const PASSWORD_MIN_LENGTH = 6;
const RECOVERY_PHRASE_MIN_LENGTH = 8;
const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatName = value => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .split(' ')
  .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : '')
  .join(' ');

const sanitizeUser = user => {
  if (!user) return null;
  const {
    password,
    recoveryPhraseHash,
    passwordFailedAttempts,
    recoveryFailedAttempts,
    recoveryLockedUntil,
    recoveryLastAttemptAt,
    qrCodeToken,
    barcodeToken,
    notifications,
    ...safeUser
  } = user;
  return {
    ...safeUser,
    name: `${safeUser.firstName || ''} ${safeUser.lastName || ''}`.trim(),
    position: safeUser.position || (safeUser.role === 'admin' ? 'Administrator' : 'Sales Representative'),
    department: safeUser.department || (safeUser.role === 'admin' ? 'Executive Operations' : 'Sales Department'),
  };
};

const startExclusiveSession = async user => {
  const sessionId = crypto.randomUUID();
  const activeSessionAt = new Date();
  await setActiveSession(user.id, sessionId, activeSessionAt);
  await cleanupNotificationsForUser(user.id);
  const nextUser = await prisma.user.findUnique({ where: { id: user.id } });

  return {
    user: nextUser || user,
    token: generateToken(user.id, sessionId),
  };
};

const ensureDefaultAdmin = async () => {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
  });

  if (existingAdmin) return attachLifecycleFields(existingAdmin);

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  return attachLifecycleFields(await prisma.user.create({
    data: {
      firstName: 'System',
      lastName: 'Administrator',
      email: DEFAULT_ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      status: 'approved',
    },
  }));
};

const rejectUnavailableAccount = user => {
  if (user.status === 'pending') {
    return {
      status: 403,
      body: {
        success: false,
        status: 'pending',
        message: 'Waiting for admin approval',
      },
    };
  }
  if (user.status === 'pending_deletion' || user.forced) {
    return {
      status: 403,
      body: {
        success: false,
        status: 'pending_deletion',
        message: 'Account is pending deletion',
      },
    };
  }
  if (user.status === 'rejected') {
    return {
      status: 403,
      body: {
        success: false,
        status: 'rejected',
        message: 'Account rejected',
      },
    };
  }
  if (!['approved', 'active'].includes(user.status)) {
    return {
      status: 403,
      body: {
        success: false,
        status: user.status,
        message: 'Account is not active',
      },
    };
  }
  return null;
};

const register = async (req, res) => {
  try {
    await ensureAuthDatabaseReady();
    await ensurePasswordRecoveryColumns();
    await ensureRecoveryAttemptLogTable();

    const {
      firstName,
      lastName,
      email,
      password,
      recoveryPhrase,
    } = req.body;

    const normalizedFirstName = formatName(firstName);
    const normalizedLastName = formatName(lastName);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRecoveryPhrase = String(recoveryPhrase || '').trim();

    if (!NAME_PATTERN.test(normalizedFirstName) || !NAME_PATTERN.test(normalizedLastName)) {
      return res.status(400).json({
        success: false,
        message: 'Only letters and spaces are allowed.',
      });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address.',
      });
    }

    if (String(password || '').length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      });
    }

    if (normalizedRecoveryPhrase.length < RECOVERY_PHRASE_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Account Recovery Phrase must be at least ${RECOVERY_PHRASE_MIN_LENGTH} characters.`,
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    const normalizedFirstNameKey = normalizedFirstName.trim().toLowerCase();
    const normalizedLastNameKey = normalizedLastName.trim().toLowerCase();
    const existingNameRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "User"
      WHERE LOWER(TRIM("firstName")) = ${normalizedFirstNameKey}
        AND LOWER(TRIM("lastName")) = ${normalizedLastNameKey}
      LIMIT 1
    `;
    const existingName = existingNameRows[0];

    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'This name already has an account.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedRecoveryPhrase = await bcrypt.hash(normalizedRecoveryPhrase, 10);

    const user = await prisma.user.create({
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'employee',
        status: 'pending',
        position: 'Sales Representative',
        department: 'Sales Department',
      },
    });

    await prisma.$executeRaw`
      UPDATE "User"
      SET "recoveryPhraseHash" = ${hashedRecoveryPhrase}
      WHERE "id" = ${user.id}
    `;

    await publishNewUserRequestNotification(user);

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created',
      token,
      user: sanitizeUser(await attachLifecycleFields(user)),
    });

  } catch (error) {

    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });

  }
};

const login = async (req, res) => {
  try {
    await ensureAuthDatabaseReady();
    await deleteExpiredForcedAccounts();
    await ensurePasswordRecoveryColumns();

    const { email, password } = req.body;
    const identity = String(email || '').trim();
    const normalizedEmail = identity.toLowerCase();

    if (normalizedEmail === DEFAULT_ADMIN_EMAIL) {
      await ensureDefaultAdmin();
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { firstName: { equals: identity } },
          { lastName: { equals: identity } },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      const attempts = await recordPasswordFailure(user.id);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        attemptsRemaining: Math.max(0, 4 - attempts),
        passwordRecoveryRequired: attempts >= 4,
        action: attempts >= 4 ? 'forgot-password' : undefined,
      });
    }

    await resetPasswordFailureCounters(user.id);

    const unavailable = rejectUnavailableAccount(user);
    if (unavailable) return res.status(unavailable.status).json(unavailable.body);

    const session = await startExclusiveSession(user);

    res.json({
      success: true,
      token: session.token,
      user: sanitizeUser(await attachLifecycleFields(session.user)),
    });

  } catch (error) {

    res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });

  }
};

const verifyForgotPasswordIdentity = async (req, res) => {
  try {
    await ensureAuthDatabaseReady();
    await ensurePasswordRecoveryColumns();
    await ensureRecoveryAttemptLogTable();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const recoveryPhrase = String(req.body?.recoveryPhrase || '');

    const user = await getRecoveryUserByEmail(email);
    if (!user) {
      await logRecoveryAttempt({
        email,
        phase: 'verify',
        status: 'invalid',
        reason: 'email_not_found',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery credentials.',
      });
    }

    if (user.recoveryLockedUntil && new Date(user.recoveryLockedUntil).getTime() > Date.now()) {
      await logRecoveryAttempt({
        userId: user.id,
        email,
        phase: 'verify',
        status: 'locked',
        reason: 'recovery_locked',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      return res.status(423).json({
        success: false,
        locked: true,
        message: 'Recovery is temporarily locked. Please try again later.',
      });
    }

    const match = await bcrypt.compare(recoveryPhrase, user.recoveryPhraseHash || '');
    if (!match) {
      const { recoveryFailedAttempts, recoveryLockedUntil } = await recordRecoveryFailure(user.id);
      await logRecoveryAttempt({
        userId: user.id,
        email,
        phase: 'verify',
        status: 'invalid',
        reason: 'recovery_phrase_mismatch',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      return res.status(recoveryLockedUntil ? 423 : 400).json({
        success: false,
        locked: Boolean(recoveryLockedUntil),
        message: recoveryLockedUntil
          ? 'Recovery is temporarily locked. Please try again later.'
          : 'Invalid recovery credentials.',
        attemptsRemaining: Math.max(0, 5 - recoveryFailedAttempts),
      });
    }

    await resetRecoveryFailureCounters(user.id);
    await logRecoveryAttempt({
      userId: user.id,
      email,
      phase: 'verify',
      status: 'success',
      reason: 'identity_verified',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    return res.json({
      success: true,
      message: 'Identity verified.',
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const resetForgotPassword = async (req, res) => {
  try {
    await ensureAuthDatabaseReady();
    await ensurePasswordRecoveryColumns();
    await ensureRecoveryAttemptLogTable();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const recoveryPhrase = String(req.body?.recoveryPhrase || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    const user = await getRecoveryUserByEmail(email);
    if (!user) {
      await logRecoveryAttempt({
        email,
        phase: 'reset',
        status: 'invalid',
        reason: 'email_not_found',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid recovery credentials.',
      });
    }

    if (user.recoveryLockedUntil && new Date(user.recoveryLockedUntil).getTime() > Date.now()) {
      await logRecoveryAttempt({
        userId: user.id,
        email,
        phase: 'reset',
        status: 'locked',
        reason: 'recovery_locked',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      return res.status(423).json({
        success: false,
        locked: true,
        message: 'Recovery is temporarily locked. Please try again later.',
      });
    }

    const match = await bcrypt.compare(recoveryPhrase, user.recoveryPhraseHash || '');
    if (!match) {
      const { recoveryFailedAttempts, recoveryLockedUntil } = await recordRecoveryFailure(user.id);
      await logRecoveryAttempt({
        userId: user.id,
        email,
        phase: 'reset',
        status: 'invalid',
        reason: 'recovery_phrase_mismatch',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      return res.status(recoveryLockedUntil ? 423 : 400).json({
        success: false,
        locked: Boolean(recoveryLockedUntil),
        message: recoveryLockedUntil
          ? 'Recovery is temporarily locked. Please try again later.'
          : 'Invalid recovery credentials.',
        attemptsRemaining: Math.max(0, 5 - recoveryFailedAttempts),
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.$executeRaw`
      UPDATE "User"
      SET "password" = ${hashedPassword},
          "passwordFailedAttempts" = 0,
          "recoveryFailedAttempts" = 0,
          "recoveryLockedUntil" = NULL,
          "recoveryLastAttemptAt" = NULL
      WHERE "id" = ${user.id}
    `;
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

    await logRecoveryAttempt({
      userId: user.id,
      email,
      phase: 'reset',
      status: 'success',
      reason: 'password_reset',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    return res.json({
      success: true,
      message: 'Password Updated Successfully',
      user: sanitizeUser(await attachLifecycleFields(updatedUser)),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const generateScanAccess = async (req, res) => {
  try {
    await ensureAuthDatabaseReady();
    const data = await generateAccountAccessToken(req.user);
    res.json({
      success: true,
      message: 'Account-bound QR token generated.',
      data,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Unable to generate QR token.',
    });
  }
};

const scanLogin = async (req, res) => {
  try {
    await ensureAuthDatabaseReady();
    await deleteExpiredForcedAccounts();
    await ensureAccountAccessColumns();

    const scanToken = req.body?.token || req.body?.qrCodeToken || req.body?.barcodeToken;
    const account = await validateAccountAccessToken(scanToken, {
      scanType: req.body?.scanType || 'qr',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    const user = await prisma.user.findUnique({ where: { id: account.id } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Account does not exist.' });
    }

    const unavailable = rejectUnavailableAccount(user);
    if (unavailable) return res.status(unavailable.status).json(unavailable.body);

    const session = await startExclusiveSession(user);
    res.json({
      success: true,
      token: session.token,
      user: sanitizeUser(await attachLifecycleFields(session.user)),
    });
  } catch (error) {
    res.status(error.status || 401).json({
      success: false,
      message: error.message || 'QR login failed.',
    });
  }
};

const me = async (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(await attachLifecycleFields(req.user)),
  });
};

const logout = async (req, res) => {
  try {
    await clearActiveSession(req.user.id, req.sessionId);

    res.json({
      success: true,
      message: 'Logged out',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const firstName = formatName(req.body?.firstName || req.user.firstName);
    const lastName = formatName(req.body?.lastName || req.user.lastName);

    if (!NAME_PATTERN.test(firstName) || !NAME_PATTERN.test(lastName)) {
      return res.status(400).json({
        success: false,
        message: 'Only letters and spaces are allowed.',
      });
    }

    const firstNameKey = firstName.trim().toLowerCase();
    const lastNameKey = lastName.trim().toLowerCase();
    const existingNameRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "User"
      WHERE LOWER(TRIM("firstName")) = ${firstNameKey}
        AND LOWER(TRIM("lastName")) = ${lastNameKey}
        AND "id" <> ${req.user.id}
      LIMIT 1
    `;
    const existingName = existingNameRows[0];

    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'This name already has an account.',
      });
    }

    const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar : req.user.avatar;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName,
        lastName,
        position: String(req.body?.position || '').trim() || req.user.position || 'Sales Representative',
        department: String(req.body?.department || '').trim() || req.user.department || 'Sales Department',
        avatar,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated.',
      user: sanitizeUser(await attachLifecycleFields(user)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const user = await updateUserPreferences(req.user.id, req.body || {});
    res.json({
      success: true,
      message: 'Settings updated',
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  verifyForgotPasswordIdentity,
  resetForgotPassword,
  logout,
  generateScanAccess,
  scanLogin,
  me,
  updateProfile,
  updateSettings,
};
