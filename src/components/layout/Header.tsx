import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  title?: string;
  locationName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  locationName = 'Pacific Northwest',
}) => {
  const location = useLocation();
  const { currentUser, userProfile, setAuthModalOpen } = useAuth();
  const displayName = userProfile?.displayName || currentUser?.displayName || 'Explorer';
  const avatarUrl = userProfile?.photoURL || currentUser?.photoURL;
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMoreOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const getPageTitle = () => {
    if (title) return title;
    switch (location.pathname) {
      case '/':
        return 'Home';
      case '/explore':
        return 'Explore';
      case '/compare':
        return 'Compare';
      case '/lifecycle':
        return 'How It Grows';
      case '/health':
        return 'Health Help';
      case '/collection':
        return 'My Collection';
      case '/profile':
        return 'Profile';
      case '/feed':
        return 'Community';
      case '/invite':
        return 'Invite Friends';
      case '/shared-collection':
        return 'Shared Collection';
      case '/leaderboard':
        return 'Leaderboard';
      case '/settings':
        return 'Settings';
      case '/onboarding':
        return 'Welcome';
      default:
        if (location.pathname.startsWith('/species/')) return 'Animal or Plant';
        return 'Home';
    }
  };

  const pageTitle = getPageTitle();

  // First 4 links shown on Medium (768px-1279px) and Desktop (1280px+)
  const primaryLinks = [
    { to: '/', label: 'Home' },
    { to: '/explore', label: 'Explore' },
    { to: '/compare', label: 'Compare' },
    { to: '/health', label: 'Health Help' },
  ];

  // Secondary links: in "More" dropdown on Medium, and inline on Desktop (1280px+)
  const overflowLinks = [
    { to: '/lifecycle', label: 'How It Grows', icon: 'timelapse' },
    { to: '/collection', label: 'My Collection', icon: 'bookmarks' },
    { to: '/feed', label: 'Community', icon: 'dynamic_feed' },
  ];

  const extraMenuLinks = [
    { to: '/shared-collection', label: 'Shared Collection', icon: 'group_work' },
    { to: '/leaderboard', label: 'BioBlitz League', icon: 'trophy' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const isOverflowActive = overflowLinks.concat(extraMenuLinks).some((l) =>
    location.pathname.startsWith(l.to)
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe border-b border-outline-variant/20">
      {/* Strict 1-row flex container: justify-between, items-center, gap-4 (16px between groups) */}
      <div className="h-16 px-margin flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        
        {/* GROUP 1: LEFT (Tree Logo & Mobile Title) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Tree Logo Brand Element (links to Home, strictly no text) */}
          <Link
            to="/"
            aria-label="WildDex Home"
            className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm hover:scale-105 active:scale-95 transition-transform shrink-0"
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              forest
            </span>
          </Link>

          {/* Mobile hamburger menu button & context label (below 768px) */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-95"
              aria-label="Open mobile menu"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <div className="flex flex-col truncate max-w-[130px]">
              <Link to="/" className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight leading-none">
                WildDex
              </Link>
              <span className="text-on-surface-variant text-[11px] truncate mt-0.5">{pageTitle}</span>
            </div>
          </div>
        </div>

        {/* GROUP 2: CENTER (Nav links with 16px gap, flex-1, min-w-0, whitespace-nowrap) */}
        <nav className="hidden md:flex flex-1 min-w-0 items-center gap-4 font-label-md text-label-md">
          {/* First 4 links (always visible on 768px and wider) */}
          {primaryLinks.map((link) => {
            const isActive =
              link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative py-1 whitespace-nowrap transition-colors flex items-center ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant hover:text-primary font-medium'
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 inset-x-0 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Desktop-only links (visible on 1280px and wider) */}
          <div className="hidden xl:flex items-center gap-4">
            {overflowLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative py-1 whitespace-nowrap transition-colors flex items-center ${
                    isActive
                      ? 'text-primary font-bold'
                      : 'text-on-surface-variant hover:text-primary font-medium'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 inset-x-0 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Medium viewports (768px to 1279px): "More" dropdown containing How It Grows, My Collection, Community */}
          <div className="relative xl:hidden" ref={moreDropdownRef}>
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              className={`relative py-1 px-1.5 flex items-center gap-0.5 whitespace-nowrap transition-colors rounded-lg hover:bg-surface-container ${
                isOverflowActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-primary font-medium'
              }`}
              aria-label="More navigation items"
              aria-expanded={moreOpen}
            >
              <span>More</span>
              <span className={`material-symbols-outlined text-[18px] transition-transform ${moreOpen ? 'rotate-180' : ''}`}>
                arrow_drop_down
              </span>
              {isOverflowActive && (
                <span className="absolute -bottom-1 inset-x-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>

            {/* Dropdown Menu */}
            {moreOpen && (
              <div className="absolute top-10 left-0 z-50 w-52 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 py-1.5 animate-in fade-in slide-in-from-top-1">
                {overflowLinks.concat(extraMenuLinks).map((item) => {
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2.5 px-3.5 py-2 font-label-md text-label-md transition-colors ${
                        isActive
                          ? 'bg-secondary-container/40 text-primary font-bold'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* GROUP 3: RIGHT (AI Scanner, Notification Bell, Avatar with 12px gap & flex-shrink-0) */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/scan"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-tertiary text-on-tertiary font-label-md text-label-md shadow-sm hover:opacity-95 active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            <span>AI Scanner</span>
          </Link>
          <button
            aria-label="Notifications"
            className="relative w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-95 transition-all shrink-0"
            type="button"
            onClick={() => {}}
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-tertiary ring-2 ring-surface"></span>
          </button>
          {currentUser ? (
            <Link
              aria-label="User Profile"
              to="/profile"
              className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform shrink-0"
            >
              {avatarUrl ? (
                <img
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-fixed"
                  src={avatarUrl}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs ring-2 ring-primary-fixed">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <button
              aria-label="Sign In"
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform shrink-0"
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center ring-2 ring-outline-variant/30">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Slide-Out Drawer Menu (for full navigation access below 768px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-start animate-in fade-in md:hidden">
          <div className="w-72 bg-surface h-full shadow-2xl p-5 flex flex-col gap-4 overflow-y-auto border-r border-outline-variant/30">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    forest
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-primary font-bold">WildDex</h3>
                  <span className="text-[11px] text-on-surface-variant">{locationName}</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                aria-label="Close Menu"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {[
                { to: '/', label: 'Home', icon: 'home' },
                { to: '/explore', label: 'Explore', icon: 'explore' },
                { to: '/scan', label: 'AI Scanner', icon: 'document_scanner' },
                { to: '/compare', label: 'Compare', icon: 'compare_arrows' },
                { to: '/health', label: 'Health Help', icon: 'healing' },
                { to: '/lifecycle', label: 'How It Grows', icon: 'timelapse' },
                { to: '/collection', label: 'My Collection', icon: 'bookmarks' },
                { to: '/feed', label: 'Community', icon: 'dynamic_feed' },
                { to: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
                { to: '/settings', label: 'Settings', icon: 'settings' },
              ].map((item) => {
                const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-md text-label-md transition-colors ${
                      isActive
                        ? 'bg-primary text-on-primary font-bold'
                        : 'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};
