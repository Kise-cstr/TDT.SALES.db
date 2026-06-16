import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiFileText,
  FiVolume2,
  FiTrash2,
  FiUploadCloud,
  FiUserPlus,
  FiX
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import {
  clearNotifications as apiClearNotifications,
  deleteNotification as apiDeleteNotification,
  getNotifications as apiGetNotifications,
  getUnreadNotificationCount as apiGetUnreadNotificationCount,
  markAllNotificationsAsRead as apiMarkAllNotificationsAsRead,
  markNotificationAsRead as apiMarkNotificationAsRead
} from '../api/notificationsApi';
import '../styles/notifications.css';

const NotificationContext = createContext(null);

const PAGE_SIZE = 8;
const TOAST_LIMIT = 4;
const TOAST_TIMEOUT = 5000;
const POLL_INTERVAL = 5000;

const filters = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'uploads', label: 'Uploads' },
  { value: 'user_requests', label: 'User Requests' },
  { value: 'account_activities', label: 'Account Activities' }
];

const getId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const isNotificationRoleEnabled = role => ['admin', 'sub-admin'].includes(String(role || '').toLowerCase());

const dedupeById = items => {
  const seen = new Set();
  return items.filter(item => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const formatRelativeTime = value => {
  if (!value) return 'Just now';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'Just now';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))} min ago`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))} hour${Math.round(diff / hour) === 1 ? '' : 's'} ago`;
  return `${Math.max(1, Math.round(diff / day))} day${Math.round(diff / day) === 1 ? '' : 's'} ago`;
};

const formatFullDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} • ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

const normalizeUploadFiles = notification => {
  const meta = notification?.meta || {};
  const candidates = Array.isArray(meta.files)
    ? meta.files
    : Array.isArray(meta.fileNames)
      ? meta.fileNames
      : typeof meta.fileName === 'string'
        ? meta.fileName.split(/\s*\+\s*/g)
        : typeof notification?.fileName === 'string'
          ? notification.fileName.split(/\s*\+\s*/g)
          : [];

  return candidates.map(file => String(file || '').trim()).filter(Boolean);
};

const getNotificationIcon = type => {
  const key = String(type || '').toLowerCase();
  if (key === 'new_upload') return FiUploadCloud;
  if (key === 'new_user_request') return FiUserPlus;
  if (key === 'account_approved') return FiCheckCircle;
  if (key === 'account_disabled') return FiAlertTriangle;
  if (key === 'system_announcement') return FiVolume2;
  return FiFileText;
};

const getNotificationAccent = type => {
  const key = String(type || '').toLowerCase();
  if (key === 'new_upload') return 'upload';
  if (key === 'new_user_request') return 'request';
  if (key === 'account_approved') return 'success';
  if (key === 'account_disabled') return 'warning';
  if (key === 'system_announcement') return 'announcement';
  return 'neutral';
};

function NotificationToastStack({ toasts, onDismiss, onOpenToast, onPauseToast, onResumeToast }) {
  const [hoveredToastIds, setHoveredToastIds] = useState([]);

  const setHovered = (id, isHovered) => {
    setHoveredToastIds(current => (
      isHovered
        ? (current.includes(id) ? current : [...current, id])
        : current.filter(existingId => existingId !== id)
    ));
  };

  return (
    <div className="notification-toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const Icon = getNotificationIcon(toast.notification?.type);
          const accent = getNotificationAccent(toast.notification?.type);
          const isHovered = hoveredToastIds.includes(toast.id);
          return (
            <motion.article
              key={toast.id}
              className={`notification-toast notification-toast-${accent}`}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, x: 36, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 36, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => {
                setHovered(toast.id, true);
                onPauseToast?.(toast.id);
              }}
              onMouseLeave={() => {
                setHovered(toast.id, false);
                onResumeToast?.(toast.id);
              }}
              onFocus={() => {
                setHovered(toast.id, true);
                onPauseToast?.(toast.id);
              }}
              onBlur={() => {
                setHovered(toast.id, false);
                onResumeToast?.(toast.id);
              }}
              onClick={() => {
                onOpenToast?.(toast.notification);
                onDismiss(toast.id);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenToast?.(toast.notification);
                  onDismiss(toast.id);
                }
              }}
            >
              <span className="notification-inline-row-accent" />
              <span className="notification-toast-icon">
                <Icon />
              </span>
              <div className="notification-toast-copy">
                <div className="notification-inline-row-head">
                  <strong>{toast.notification?.title || 'Notification'}</strong>
                  <span>{formatRelativeTime(toast.notification?.createdAt)}</span>
                </div>
                <span>{toast.notification?.message || ''}</span>
              </div>
              <button
                type="button"
                className="notification-toast-close"
                onClick={event => {
                  event.stopPropagation();
                  onDismiss(toast.id);
                }}
                aria-label="Dismiss notification"
              >
                <FiX />
              </button>
              <span className="notification-toast-progress" style={{ animationPlayState: isHovered ? 'paused' : 'running' }} />
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function NotificationRow({ notification, onClick, trailing }) {
  const Icon = getNotificationIcon(notification.type);
  const accent = getNotificationAccent(notification.type);
  const isUnread = !notification.readAt;
  const fullDateTime = formatFullDateTime(notification.createdAt);

  return (
    <motion.article
      className={`notification-inline-row notification-inline-row-${accent}${isUnread ? ' is-unread' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      <span className="notification-inline-row-accent" />
      <span className="notification-inline-row-icon">
        <Icon />
      </span>
      <div className="notification-inline-row-copy">
        <div className="notification-inline-row-head">
          <strong>{notification.title}</strong>
          <span className="notification-time-stack">
            <span className="notification-time-relative">{formatRelativeTime(notification.createdAt)}</span>
            {fullDateTime && <span className="notification-time-full">{fullDateTime}</span>}
          </span>
        </div>
        <p>{notification.message}</p>
      </div>
      <div className="notification-inline-row-trailing">
        {trailing}
      </div>
    </motion.article>
  );
}

function NotificationCenterPanel({
  isOpen,
  notifications,
  unreadCount,
  activeFilter,
  hasMore,
  isLoading,
  onClose,
  onClearAll,
  onDelete,
  onFilterChange,
  onLoadMore,
  onMarkAllRead,
  onMarkRead,
  onOpenNotification,
  onCloseDetails,
  onDeleteSelected,
  selectedNotification
}) {
  const selected = selectedNotification || null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="notification-center-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.aside
            className="notification-center-panel"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Notification center"
          >
            <header className="notification-center-header">
              <div className="notification-center-title">
                <span className="notification-center-icon">
                  <FiBell />
                </span>
                <div>
                  <strong>Notifications</strong>
                  <span>{unreadCount} unread</span>
                </div>
              </div>
              <button type="button" className="notification-center-close" onClick={onClose} aria-label="Close notification center">
                <FiX />
              </button>
            </header>

            <div className="notification-center-toolbar">
              <div className="notification-filter-tabs" role="tablist" aria-label="Notification filters">
                {filters.map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    className={activeFilter === filter.value ? 'is-active' : ''}
                    onClick={() => onFilterChange(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="notification-center-actions">
                <button type="button" className="notification-action-link" onClick={onMarkAllRead} disabled={!unreadCount}>
                  Mark all as read
                </button>
                <button type="button" className="notification-action-link notification-action-danger" onClick={onClearAll} disabled={!notifications.length}>
                  <FiTrash2 size={14} />
                  Clear all
                </button>
              </div>
            </div>

            <div className="notification-center-body">
              <div className="notification-center-list">
                {notifications.length ? notifications.map(notification => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onClick={() => onOpenNotification(notification)}
                    trailing={!notification.readAt ? <span className="notification-inline-row-dot" /> : null}
                  />
                )) : (
                  <div className="notification-empty-state">
                    <FiBell />
                    <strong>No notifications yet</strong>
                    <span>Fresh updates will appear here as they arrive.</span>
                  </div>
                )}
              </div>

              <aside className="notification-details-drawer" aria-label="Notification details">
                {selected ? (
                  <>
                    {(() => {
                      const Icon = getNotificationIcon(selected.type);
                      const fullDateTime = formatFullDateTime(selected.meta?.uploadedAt || selected.createdAt);
                      return (
                        <div className="notification-details-header">
                          <span className={`notification-details-icon notification-card-${getNotificationAccent(selected.type)}`}>
                            <Icon />
                          </span>
                          <div>
                            <strong>{selected.title}</strong>
                            <span className="notification-time-stack">
                              <span className="notification-time-relative">{formatRelativeTime(selected.createdAt)}</span>
                              {fullDateTime && <span className="notification-time-full">{fullDateTime}</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="notification-details-meta">
                      {selected.meta?.uploaderName && (
                        <div>
                          <span>Uploaded By</span>
                          <strong>{selected.meta.uploaderName}</strong>
                        </div>
                      )}
                      {selected.meta?.uploadedAt && (
                        <div>
                          <span>Date</span>
                          <strong>{new Date(selected.meta.uploadedAt).toLocaleDateString()}</strong>
                        </div>
                      )}
                      {selected.meta?.uploadedAt && (
                        <div>
                          <span>Time</span>
                          <strong>{new Date(selected.meta.uploadedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
                        </div>
                      )}
                      <div className="notification-details-status">
                        <span>Status</span>
                        <strong>
                          <span className={`notification-status-badge ${selected.readAt ? 'is-read' : 'is-unread'}`}>
                            <span className="notification-status-dot" aria-hidden="true" />
                            {selected.readAt ? 'Read' : 'Unread'}
                          </span>
                        </strong>
                      </div>
                    </div>

                    <div className="notification-details-description">
                      <span>Description</span>
                      <p className="notification-details-message">{selected.message}</p>
                    </div>

                    {String(selected.type || '').toLowerCase() === 'new_upload' && normalizeUploadFiles(selected).length > 0 && (
                      <div className="notification-details-files">
                        <span>Files Uploaded</span>
                        <ul>
                          {normalizeUploadFiles(selected).map(fileName => (
                            <li key={`${selected.id}-${fileName}`}>{fileName}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="notification-details-actions">
                      {!selected.readAt && (
                        <button type="button" className="notification-details-button" onClick={() => onMarkRead(selected.id)}>
                          Mark as Read
                        </button>
                      )}
                      <button type="button" className="notification-details-button" onClick={onCloseDetails}>
                        Close
                      </button>
                      <button type="button" className="notification-details-button notification-details-button-danger" onClick={() => onDeleteSelected(selected.id)}>
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="notification-details-empty">
                    <FiBell />
                    <strong>Select a notification</strong>
                    <span>Click a row to view the full details.</span>
                  </div>
                )}
              </aside>
            </div>

            <footer className="notification-center-footer">
              {hasMore ? (
                <button type="button" className="notification-load-more" onClick={onLoadMore} disabled={isLoading}>
                  {isLoading ? 'Loading...' : 'Load more'}
                </button>
              ) : (
                <span className="notification-center-footnote">Showing the most recent notifications.</span>
              )}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isNotificationEnabled = isNotificationRoleEnabled(user?.role);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isOpen, setIsOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const knownIdsRef = useRef(new Set());
  const toastedIdsRef = useRef(new Set());
  const toastTimersRef = useRef(new Map());
  const activeFilterRef = useRef('all');

  const dismissToast = useCallback(id => {
    const timerState = toastTimersRef.current.get(id);
    if (timerState?.timeoutId) {
      window.clearTimeout(timerState.timeoutId);
    }
    toastTimersRef.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const scheduleToastDismiss = useCallback((id, delay = TOAST_TIMEOUT) => {
    const timerState = toastTimersRef.current.get(id) || { remaining: delay, startedAt: Date.now(), timeoutId: null };
    if (timerState.timeoutId) {
      window.clearTimeout(timerState.timeoutId);
    }
    timerState.remaining = delay;
    timerState.startedAt = Date.now();
    timerState.timeoutId = window.setTimeout(() => dismissToast(id), delay);
    toastTimersRef.current.set(id, timerState);
  }, [dismissToast]);

  const pauseToast = useCallback(id => {
    const timerState = toastTimersRef.current.get(id);
    if (!timerState?.timeoutId) return;
    const elapsed = Date.now() - timerState.startedAt;
    timerState.remaining = Math.max(0, timerState.remaining - elapsed);
    window.clearTimeout(timerState.timeoutId);
    timerState.timeoutId = null;
    toastTimersRef.current.set(id, timerState);
  }, []);

  const resumeToast = useCallback(id => {
    const timerState = toastTimersRef.current.get(id);
    if (!timerState || timerState.timeoutId || timerState.remaining <= 0) return;
    timerState.startedAt = Date.now();
    timerState.timeoutId = window.setTimeout(() => dismissToast(id), timerState.remaining);
    toastTimersRef.current.set(id, timerState);
  }, [dismissToast]);

  const enqueueToast = useCallback(notification => {
    if (!notification || !isNotificationEnabled) return;
    if (notification.id && toastedIdsRef.current.has(notification.id)) return;
    if (notification.id) toastedIdsRef.current.add(notification.id);
    const id = getId();
    const toast = { id, notification };
    setToasts(current => [toast, ...current].slice(0, TOAST_LIMIT));
    scheduleToastDismiss(id, TOAST_TIMEOUT);
  }, [isNotificationEnabled, scheduleToastDismiss]);

  const applyNotificationPayload = useCallback((payload, { append = false, allowToast = false } = {}) => {
    const items = dedupeById(Array.isArray(payload?.items) ? payload.items : []);
    const unread = Number(payload?.unreadCount || 0);
    const previousIds = knownIdsRef.current;

    setUnreadCount(unread);
    setHasMore(Boolean(payload?.hasMore));
    setCurrentPage(Number(payload?.page || 1));

    setNotifications(current => {
      const next = append ? dedupeById([...current, ...items]) : items;
      if (allowToast && !append) {
        const newItems = items.filter(item => item?.id && !previousIds.has(item.id) && !toastedIdsRef.current.has(item.id));
        if (newItems.length) {
          newItems.slice(0, 3).reverse().forEach(enqueueToast);
        }
      }
      knownIdsRef.current = new Set(next.map(item => item.id));
      return next;
    });
  }, [enqueueToast]);

  const fetchNotifications = useCallback(async ({ page = 1, append = false, allowToast = false, filter = activeFilterRef.current } = {}) => {
    if (!user?.id || !isAuthenticated || !isNotificationEnabled) return;
    setIsLoading(true);
    try {
      const response = await apiGetNotifications({ filter, page, limit: PAGE_SIZE });
      if (response?.data) {
        applyNotificationPayload(response.data, { append, allowToast });
      }
    } catch {
      // Keep the UI resilient when offline or when the API is unavailable.
    } finally {
      setIsLoading(false);
    }
  }, [applyNotificationPayload, isAuthenticated, isNotificationEnabled, user?.id]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id || !isAuthenticated || !isNotificationEnabled) return;
    try {
      const response = await apiGetUnreadNotificationCount();
      setUnreadCount(Number(response?.data?.unreadCount || 0));
    } catch {
      // Ignore summary refresh errors.
    }
  }, [isAuthenticated, isNotificationEnabled, user?.id]);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !isNotificationEnabled) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setCurrentPage(1);
      setToasts([]);
      setSelectedNotificationId(null);
      knownIdsRef.current = new Set();
      toastedIdsRef.current = new Set();
      return undefined;
    }

    void fetchNotifications({ page: 1, append: false, allowToast: false, filter: activeFilter });
    void refreshUnreadCount();

    const pollId = window.setInterval(() => {
      void fetchNotifications({ page: 1, append: false, allowToast: true, filter: activeFilterRef.current });
      void refreshUnreadCount();
    }, POLL_INTERVAL);

    const handleFocus = () => {
      void fetchNotifications({ page: 1, append: false, allowToast: true, filter: activeFilterRef.current });
      void refreshUnreadCount();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeFilter, fetchNotifications, isAuthenticated, isNotificationEnabled, refreshUnreadCount, user?.id]);

  useEffect(() => {
    const handleStorage = event => {
      if (!isNotificationEnabled) return;
      if (event.key === 'tdt_notifications_sync') {
        void fetchNotifications({ page: 1, append: false, allowToast: true, filter: activeFilterRef.current });
        void refreshUnreadCount();
      }
    };

    const handleManualSync = () => {
      if (!isNotificationEnabled) return;
      void fetchNotifications({ page: 1, append: false, allowToast: true, filter: activeFilterRef.current });
      void refreshUnreadCount();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('tdt_notifications_sync', handleManualSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tdt_notifications_sync', handleManualSync);
    };
  }, [fetchNotifications, isNotificationEnabled, refreshUnreadCount]);

  useEffect(() => {
    const expiredTimers = toastTimersRef.current;
    return () => {
      expiredTimers.forEach(timerState => {
        if (timerState?.timeoutId) window.clearTimeout(timerState.timeoutId);
      });
      expiredTimers.clear();
    };
  }, []);

  const openCenter = useCallback(async (notification = null) => {
    if (!isNotificationEnabled) return;
    setIsOpen(true);
    setSelectedNotificationId(notification?.id || notifications[0]?.id || null);
    try {
      await fetchNotifications({ page: 1, append: false, allowToast: false, filter: activeFilterRef.current });
    } catch {
      // Opening the drawer should still work if refresh fails.
    }
  }, [fetchNotifications, isNotificationEnabled, notifications]);

  const markAllRead = useCallback(async () => {
    if (!isNotificationEnabled) return;
    try {
      await apiMarkAllNotificationsAsRead();
      setNotifications(current => current.map(notification => ({
        ...notification,
        readAt: notification.readAt || new Date().toISOString(),
      })));
      setUnreadCount(0);
      window.localStorage.setItem('tdt_notifications_sync', String(Date.now()));
    } catch {
      // Keep the notification drawer usable even if mark-all fails.
    }
  }, [isNotificationEnabled]);

  const closeCenter = useCallback(() => {
    setIsOpen(false);
    setSelectedNotificationId(null);
  }, []);

  const openNotificationDetails = useCallback(notification => {
    if (!notification) return;
    setIsOpen(true);
    setSelectedNotificationId(notification.id);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedNotificationId(null);
  }, []);

  const markRead = useCallback(async id => {
    if (!isNotificationEnabled) return;
    try {
      await apiMarkNotificationAsRead(id);
      setNotifications(current => current.map(notification => (
        notification.id === id
          ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
          : notification
      )));
      void refreshUnreadCount();
      window.localStorage.setItem('tdt_notifications_sync', String(Date.now()));
    } catch {
      // Keep local state as-is if the request fails.
    }
  }, [isNotificationEnabled, refreshUnreadCount]);

  const deleteItem = useCallback(async id => {
    if (!isNotificationEnabled) return;
    try {
      await apiDeleteNotification(id);
      setNotifications(current => current.filter(notification => notification.id !== id));
      knownIdsRef.current.delete(id);
      void refreshUnreadCount();
      window.localStorage.setItem('tdt_notifications_sync', String(Date.now()));
    } catch {
      // Ignore delete failures so the rest of the drawer remains usable.
    }
  }, [isNotificationEnabled, refreshUnreadCount]);

  const deleteSelected = useCallback(async id => {
    await deleteItem(id);
    setSelectedNotificationId(current => (current === id ? null : current));
  }, [deleteItem]);

  const clearAll = useCallback(async () => {
    if (!isNotificationEnabled) return;
    try {
      await apiClearNotifications();
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      knownIdsRef.current = new Set();
      window.localStorage.setItem('tdt_notifications_sync', String(Date.now()));
    } catch {
      // Ignore clear failures.
    }
  }, [isNotificationEnabled]);

  const loadMore = useCallback(() => {
    if (!isNotificationEnabled) return;
    if (isLoading || !hasMore) return;
    void fetchNotifications({
      page: currentPage + 1,
      append: true,
      allowToast: false,
      filter: activeFilterRef.current
    });
  }, [currentPage, fetchNotifications, hasMore, isLoading, isNotificationEnabled]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    isNotificationEnabled,
    isNotificationCenterOpen: isOpen,
    activeNotificationFilter: activeFilter,
    hasMoreNotifications: hasMore,
    isNotificationsLoading: isLoading,
    openNotificationCenter: openCenter,
    closeNotificationCenter: closeCenter,
    openNotificationDetails,
    setActiveNotificationFilter: setActiveFilter,
    markNotificationRead: markRead,
    deleteNotificationItem: deleteItem,
    clearAllNotifications: clearAll,
    loadMoreNotifications: loadMore,
    refreshUnreadNotifications: refreshUnreadCount,
  }), [activeFilter, clearAll, closeCenter, deleteItem, hasMore, isLoading, isNotificationEnabled, loadMore, markRead, notifications, openCenter, openNotificationDetails, refreshUnreadCount, unreadCount, isOpen]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {isNotificationEnabled && (
        <>
          <NotificationCenterPanel
            isOpen={isOpen}
            notifications={notifications}
            unreadCount={unreadCount}
            activeFilter={activeFilter}
            hasMore={hasMore}
            isLoading={isLoading}
            onClose={closeCenter}
            onClearAll={clearAll}
            onDelete={deleteItem}
            onFilterChange={setActiveFilter}
            onLoadMore={loadMore}
            onMarkAllRead={markAllRead}
            onMarkRead={markRead}
            onOpenNotification={openNotificationDetails}
            onCloseDetails={closeDetails}
            onDeleteSelected={deleteSelected}
            selectedNotification={notifications.find(notification => notification.id === selectedNotificationId) || null}
          />
          <NotificationToastStack
            toasts={toasts}
            onDismiss={dismissToast}
            onOpenToast={openCenter}
            onPauseToast={pauseToast}
            onResumeToast={resumeToast}
          />
        </>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
