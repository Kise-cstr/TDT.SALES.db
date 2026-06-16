export const RECENT_UPLOADS_KEY = 'tdt_recent_uploads';
export const ACTIVE_UPLOAD_KEY = 'tdt_active_upload_id';
export const maxRecentUploads = 12;
export const uploadRetentionDays = 15;

const normalize = value => String(value ?? '').trim();
const normalizeKey = value => normalize(value).toLowerCase();
const retentionWindowMs = uploadRetentionDays * 24 * 60 * 60 * 1000;

export const getUploadOwnerKey = user => (
  user?.id ? `id:${user.id}` : user?.email ? `email:${normalizeKey(user.email)}` : 'guest'
);

export const getUploadOwnerName = user => (
  user?.name ||
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
  user?.email ||
  'Current user'
);

const isOwnedBy = (upload, user) => {
  const ownerKey = getUploadOwnerKey(user);
  if (ownerKey === 'guest') return !upload.ownerKey && !upload.uploaderUserId && !upload.uploaderEmail;
  if (upload.ownerKey) return upload.ownerKey === ownerKey;
  if (user?.id && String(upload.uploaderUserId || upload.userId || '') === String(user.id)) return true;
  if (user?.email && normalizeKey(upload.uploaderEmail || upload.uploadedByEmail) === normalizeKey(user.email)) return true;
  return false;
};

const getUploadTime = upload => {
  const date = new Date(upload?.uploadedAt || upload?.createdAt || upload?.updatedAt || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const isUploadExpired = upload => {
  const uploadedTime = getUploadTime(upload);
  return Boolean(uploadedTime && Date.now() - uploadedTime > retentionWindowMs);
};

export const pruneExpiredUploads = uploads => (
  Array.isArray(uploads) ? uploads.filter(upload => !isUploadExpired(upload)) : []
);

const clearStaleActiveUpload = uploads => {
  const validIds = new Set(uploads.map(upload => String(upload.id)));
  Object.keys(localStorage)
    .filter(key => key === ACTIVE_UPLOAD_KEY || key.startsWith(`${ACTIVE_UPLOAD_KEY}:`))
    .forEach(key => {
      const activeId = localStorage.getItem(key);
      if (activeId && !validIds.has(String(activeId))) localStorage.removeItem(key);
    });
};

export const hashString = value => {
  const input = normalize(value);
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const createUploadSignature = (...parts) => hashString(parts.map(part => normalize(part)).join('|'));

export const readUploadHistory = user => {
  try {
    const uploads = JSON.parse(localStorage.getItem(RECENT_UPLOADS_KEY) || '[]');
    if (!Array.isArray(uploads)) return [];
    const retainedUploads = pruneExpiredUploads(uploads);
    if (retainedUploads.length !== uploads.length) {
      localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(retainedUploads));
      clearStaleActiveUpload(retainedUploads);
    }
    return user ? retainedUploads.filter(upload => isOwnedBy(upload, user)) : retainedUploads;
  } catch {
    return [];
  }
};

export const getActiveUploadId = user => (
  localStorage.getItem(`${ACTIVE_UPLOAD_KEY}:${getUploadOwnerKey(user)}`) ||
  localStorage.getItem(ACTIVE_UPLOAD_KEY) ||
  ''
);

export const setActiveUploadId = (uploadId, user) => {
  if (!uploadId) return;
  localStorage.setItem(`${ACTIVE_UPLOAD_KEY}:${getUploadOwnerKey(user)}`, String(uploadId));
  localStorage.setItem(ACTIVE_UPLOAD_KEY, String(uploadId));
  window.dispatchEvent(new Event('tdt-upload-history-updated'));
};

export const saveUploadHistoryItem = (upload, user) => {
  const signature = upload.signature || createUploadSignature(upload.name, upload.source, upload.datasetType);
  const ownerKey = upload.ownerKey || getUploadOwnerKey(user);
  const allUploads = readUploadHistory();
  const visibleUploads = readUploadHistory(user);
  const existing = visibleUploads.find(item => item.signature === signature);
  const id = existing?.id || `upload-${Date.now()}`;
  const uploadedAt = upload.uploadedAt || new Date().toISOString();
  const nextItem = {
    status: 'Ready',
    uploadedBy: getUploadOwnerName(user),
    uploaderUserId: user?.id || null,
    uploaderEmail: user?.email || null,
    uploaderName: getUploadOwnerName(user),
    ownerKey,
    datasetType: upload.source || upload.datasetType || 'Dataset',
    ...existing,
    ...upload,
    id,
    signature,
    uploadedAt
  };
  const otherUploads = allUploads.filter(item => item.id !== existing?.id && !(isOwnedBy(item, user) && item.signature === signature));
  const nextOwnerUploads = [nextItem, ...visibleUploads.filter(item => item.id !== existing?.id && item.signature !== signature)]
    .slice(0, maxRecentUploads);
  const nextUploads = [...nextOwnerUploads, ...otherUploads.filter(item => !isOwnedBy(item, user))];
  localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(nextUploads));
  setActiveUploadId(id, user);
  return nextOwnerUploads;
};

export const formatUploadDateTime = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};
