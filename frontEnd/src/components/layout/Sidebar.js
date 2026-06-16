import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiBell, FiBookOpen, FiChevronUp, FiGrid, FiLogOut, FiMenu, FiSettings, FiUploadCloud, FiUsers, FiUser, FiShield } from 'react-icons/fi';
import { useAuth } from '../../auth/AuthContext';
import { useNotifications } from '../../notifications/NotificationContext';
import UserGuidelinesModal from './UserGuidelinesModal';
import '../../styles/sidebar.css';

const mainNavItems = [
  { path: '/dashboard', label: 'Dashboard', Icon: FiGrid },
  { path: '/sales-team', label: 'Sales Team', Icon: FiUsers }
];

const adminNavItems = [
  { path: '/admin', label: 'Admin Panel', Icon: FiShield, roles: ['admin'] },
  { path: '/admin/uploads', label: 'Manage Uploads', Icon: FiUploadCloud, roles: ['admin'] },
  { path: '/admin/users', label: 'User Management', Icon: FiUsers, roles: ['admin', 'sub-admin'] }
];

const SidebarNavItem = memo(function SidebarNavItem({ path, label, Icon }) {
  return (
    <NavLink
      to={path}
      end
      className={({ isActive }) => (
        `sidebar-link sidebar-nav-button sidebar-button sidebar-main-button${isActive ? ' active' : ''}`
      )}
    >
      <span className="sidebar-link-icon">
        <Icon />
      </span>
      <span className="sidebar-link-label">{label}</span>
    </NavLink>
  );
});

const SidebarSectionLabel = memo(function SidebarSectionLabel({ children }) {
  return (
    <div className="sidebar-section-label sidebar-section-title">
      <span>{children}</span>
    </div>
  );
});

const ProfileMenu = memo(function ProfileMenu({
  isOpen,
  isAdmin,
  showNotifications,
  user,
  roleLabel,
  menuRef,
  onOpenProfile,
  onOpenSettings,
  onOpenGuidelines,
  onOpenNotifications,
  unreadCount,
  onOpenLogout
}) {
  const badgeLabel = typeof unreadCount === 'number' && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : '';
  return (
    <motion.div
      ref={menuRef}
      className={`sidebar-profile-menu ${isOpen ? 'sidebar-profile-menu-inline' : 'sidebar-profile-menu-popover'}`}
      initial={{ opacity: 0, y: isOpen ? 10 : 6, x: isOpen ? 0 : -6, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, y: isOpen ? 6 : 4, x: isOpen ? 0 : -4, scale: 0.99 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <button className="sidebar-profile-menu-card sidebar-profile-menu-card-button" type="button" onClick={onOpenProfile}>
        <span className="sidebar-profile-menu-avatar">
          {user?.avatar ? <img src={user.avatar} alt="" /> : <FiUser />}
        </span>
        <div>
          <strong>{user?.name || 'Operations Lead'}</strong>
          <span className={`profile-role-pill ${isAdmin ? 'profile-role-admin' : 'profile-role-employee'}`}>
            {roleLabel}
          </span>
        </div>
      </button>

      <button className="sidebar-profile-menu-item" type="button" onClick={onOpenSettings}>
        <FiSettings size={16} />
        <span>Settings</span>
      </button>

      <button className="sidebar-profile-menu-item" type="button" onClick={onOpenGuidelines}>
        <FiBookOpen size={16} />
        <span>User Guidelines</span>
      </button>

      {showNotifications && (
        <button className="sidebar-profile-menu-item sidebar-profile-menu-item-notifications" type="button" onClick={onOpenNotifications}>
          <span className="sidebar-profile-menu-item-label">
            <FiBell size={16} className={unreadCount ? 'notification-bell-pulse' : ''} />
            <span>Notifications</span>
          </span>
          {badgeLabel ? <span key={badgeLabel} className="notification-badge">{badgeLabel}</span> : null}
        </button>
      )}

      <button className="sidebar-profile-menu-item" type="button" onClick={onOpenLogout}>
        <FiLogOut size={16} />
        <span>Logout</span>
      </button>
    </motion.div>
  );
});

function Sidebar({ isOpen, onToggle, onOpenLogout }) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const {
    isNotificationEnabled,
    unreadCount,
    openNotificationCenter
  } = useNotifications();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const profileZoneRef = useRef(null);
  const profileMenuRef = useRef(null);
  const showNotifications = Boolean(isNotificationEnabled && (isAdmin || isSubAdmin));
  const roleLabel = isAdmin ? 'Administrator' : isSubAdmin ? 'Sub-Admin' : 'Sales Representative';

  const handleOpenSettings = useCallback(() => {
    setIsProfileMenuOpen(false);
    navigate('/settings');
  }, [navigate]);

  const handleOpenGuidelines = useCallback(() => {
    setIsProfileMenuOpen(false);
    setIsGuidelinesOpen(true);
  }, []);

  const handleOpenNotifications = useCallback(() => {
    setIsProfileMenuOpen(false);
    openNotificationCenter?.();
  }, [openNotificationCenter]);

  const handleCloseGuidelines = useCallback(() => {
    setIsGuidelinesOpen(false);
  }, []);

  const handleOpenLogout = useCallback(() => {
    setIsProfileMenuOpen(false);
    onOpenLogout?.();
  }, [onOpenLogout]);

  const handleOpenProfile = useCallback(() => {
    setIsProfileMenuOpen(false);
    navigate('/profile');
  }, [navigate]);

  const toggleProfileMenu = useCallback(() => {
    setIsProfileMenuOpen(open => !open);
  }, []);

  useEffect(() => {
    const handlePointerDown = event => {
      const clickedTrigger = profileZoneRef.current?.contains(event.target);
      const clickedMenu = profileMenuRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedMenu) {
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [isOpen]);

  const profileMenu = (
    <ProfileMenu
      isOpen={isOpen}
      isAdmin={isAdmin}
      showNotifications={showNotifications}
      user={user}
      roleLabel={roleLabel}
      menuRef={profileMenuRef}
      onOpenProfile={handleOpenProfile}
      onOpenSettings={handleOpenSettings}
      onOpenGuidelines={handleOpenGuidelines}
      onOpenNotifications={handleOpenNotifications}
      onOpenLogout={handleOpenLogout}
      unreadCount={unreadCount}
    />
  );

  return (
    <aside className={`sidebar sidebar-container ${isOpen ? 'sidebar-expanded' : 'sidebar-collapsed sidebar-mini'}`}>
      <button type="button" className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        <FiMenu />
      </button>

      <nav className="sidebar-menu sidebar-scroll">
        <div className="sidebar-nav-section sidebar-primary-nav">
          {mainNavItems.map(({ path, label, Icon }) => (
            <SidebarNavItem
              key={path}
              path={path}
              label={label}
              Icon={Icon}
            />
          ))}
        </div>

        {(isAdmin || isSubAdmin) && (
          <div className="sidebar-nav-section sidebar-admin-section">
            <SidebarSectionLabel>Admin</SidebarSectionLabel>
            {adminNavItems
              .filter(item => isAdmin || item.roles.includes('sub-admin'))
              .map(({ path, label, Icon }) => (
                <SidebarNavItem
                  key={path}
                  path={path}
                  label={label}
                  Icon={Icon}
                />
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-profile-zone" ref={profileZoneRef}>
        <button
          type="button"
          className="sidebar-profile-trigger sidebar-profile profile-card"
          onClick={toggleProfileMenu}
          aria-haspopup="menu"
          aria-expanded={isProfileMenuOpen}
        >
          <span className="sidebar-profile-avatar profile-avatar">
            {user?.avatar ? <img src={user.avatar} alt="" /> : <FiUser />}
          </span>
          <span className="sidebar-profile-copy">
            <strong className="profile-name">{roleLabel}</strong>
            <small className={`sidebar-role-badge profile-role ${isAdmin ? 'sidebar-role-admin' : 'sidebar-role-employee'}`}>
              {isAdmin ? 'Executive Ops' : (user?.position || user?.name || 'Sales Ops')}
            </small>
          </span>
          <span className={`sidebar-profile-chevron ${isProfileMenuOpen ? 'open' : ''}`}>
            <FiChevronUp size={16} />
          </span>
        </button>
      </div>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>{isProfileMenuOpen && profileMenu}</AnimatePresence>,
        document.body
      )}

      <UserGuidelinesModal isOpen={isGuidelinesOpen} onClose={handleCloseGuidelines} />
    </aside>
  );
}

export default memo(Sidebar);
