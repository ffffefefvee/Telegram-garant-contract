import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasRole, useAppStore } from '../store/appStore';
import { UserRole } from '../types';
import './BottomNav.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  /** If set, the item is only rendered when the current user has this role. */
  requiresRole?: UserRole;
  /** Match the item as active when the pathname starts with this prefix. */
  matchPrefix?: boolean;
}

const dealsIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path
      fill="currentColor"
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H6v-2h6v2zm4-4H6v-2h10v2zm0-4H6V7h10v2z"
    />
  </svg>
);

const newIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  </svg>
);

const profileIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path
      fill="currentColor"
      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
    />
  </svg>
);

const gavelIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path
      fill="currentColor"
      d="M5.66 7.93L9.2 11.47c.39.39 1.02.39 1.41 0l6.36-6.36c.39-.39.39-1.02 0-1.41L13.43.16c-.39-.39-1.02-.39-1.41 0L5.66 6.52c-.39.39-.39 1.02 0 1.41zm-3.9 8.33l7.78-7.78 1.41 1.41-7.78 7.78zM21 20H6v2h15z"
    />
  </svg>
);

const adminIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path
      fill="currentColor"
      d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"
    />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { path: '/deals', label: 'Сделки', icon: dealsIcon },
  { path: '/deals/new', label: 'Новая', icon: newIcon },
  {
    path: '/arbitrator',
    label: 'Арбитраж',
    icon: gavelIcon,
    requiresRole: UserRole.ARBITRATOR,
    matchPrefix: true,
  },
  {
    path: '/admin',
    label: 'Админка',
    icon: adminIcon,
    requiresRole: UserRole.ADMIN,
    matchPrefix: true,
  },
  { path: '/profile', label: 'Профиль', icon: profileIcon },
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const isActive = (item: NavItem) =>
    item.matchPrefix
      ? location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)
      : location.pathname === item.path;

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.filter((item) => !item.requiresRole || hasRole(user, item.requiresRole)).map(
        (item) => (
          <button
            key={item.path}
            className={`nav-item ${isActive(item) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ),
      )}
    </nav>
  );
};
