import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchUnreadTotal,
  UNREAD_REFRESH_EVENT,
} from '../../services/chatService';
import {
  CARE_REMINDERS_REFRESH_EVENT,
  hasDueCareReminders,
} from '../../services/careService';

interface HeaderProps {
  title?: string;
  locationName?: string;
}

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  tier: 'primary' | 'secondary' | 'more' | 'account' | 'drawer';
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', tier: 'primary' },
  { to: '/explore', label: 'Explore', icon: 'explore', tier: 'primary' },
  { to: '/compare', label: 'Compare', icon: 'compare_arrows', tier: 'primary' },
  { to: '/health', label: 'Health Help', icon: 'healing', tier: 'primary' },
  { to: '/lifecycle', label: 'How It Grows', icon: 'timelapse', tier: 'secondary' },
  { to: '/collection', label: 'My Collection', icon: 'bookmarks', tier: 'secondary' },
  { to: '/life-list', label: 'Life List', icon: 'menu_book', tier: 'secondary' },
  { to: '/care', label: 'My Care', icon: 'yard', tier: 'secondary' },
  { to: '/feed', label: 'Community', icon: 'dynamic_feed', tier: 'secondary' },
  { to: '/ask', label: 'Ask', icon: 'live_help', tier: 'secondary' },
  { to: '/safety', label: 'Safety', icon: 'health_and_safety', tier: 'secondary' },
  { to: '/messages', label: 'Messages', icon: 'chat', tier: 'drawer' },
  { to: '/shared-collection', label: 'Shared Collection', icon: 'group_work', tier: 'more' },
  { to: '/leaderboard', label: 'Weekly Challenge', icon: 'trophy', tier: 'more' },
  { to: '/profile', label: 'Profile', icon: 'person', tier: 'account' },
  { to: '/settings', label: 'Settings', icon: 'settings', tier: 'more' },
];

export const Header: React.FC<HeaderProps> = ({
  title,
  locationName = 'Pacific Northwest',
}) => {
  const location = useLocation();
  const { currentUser, userProfile, setAuthModalOpen, logout } = useAuth();
  const displayName = userProfile?.displayName || currentUser?.displayName || 'Explorer';
  const emailText = currentUser?.email || userProfile?.email;
  const avatarUrl = userProfile?.photoURL || currentUser?.photoURL;
  const [moreOpen, setMoreOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [hasCareDue, setHasCareDue] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const hamburgerBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!currentUser) {
      setUnreadTotal(0);
      return;
    }
    const count = await fetchUnreadTotal();
    setUnreadTotal(count);
  }, [currentUser?.id]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount, location.pathname]);

  useEffect(() => {
    if (!currentUser) return;

    const handleUnreadEvent = () => {
      refreshUnreadCount();
    };
    window.addEventListener(UNREAD_REFRESH_EVENT, handleUnreadEvent);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`header-unread-${currentUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => {
            refreshUnreadCount();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener(UNREAD_REFRESH_EVENT, handleUnreadEvent);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser?.id, refreshUnreadCount]);

  const refreshCareDue = useCallback(async () => {
    if (!currentUser) {
      setHasCareDue(false);
      return;
    }
    const due = await hasDueCareReminders();
    setHasCareDue(due);
  }, [currentUser?.id]);

  useEffect(() => {
    refreshCareDue();
  }, [refreshCareDue, location.pathname]);

  useEffect(() => {
    if (!currentUser) return;
    const handleCareEvent = () => {
      refreshCareDue();
    };
    window.addEventListener(CARE_REMINDERS_REFRESH_EVENT, handleCareEvent);
    window.addEventListener('focus', handleCareEvent);
    return () => {
      window.removeEventListener(CARE_REMINDERS_REFRESH_EVENT, handleCareEvent);
      window.removeEventListener('focus', handleCareEvent);
    };
  }, [currentUser?.id, refreshCareDue]);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMoreOpen(false);
    setAvatarMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Close mobile drawer on Escape key & lock page scrolling while open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        hamburgerBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Move focus to close button when drawer opens
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [mobileMenuOpen]);

  const getPageTitle = () => {
    if (title) return title;
    const matchedNav = ALL_NAV_ITEMS.find((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    );
    if (matchedNav) return matchedNav.label;
    if (location.pathname === '/invite') return 'Invite Friends';
    if (location.pathname === '/onboarding') return 'Welcome';
    if (location.pathname.startsWith('/species/')) return 'Animal or Plant';
    return 'Home';
  };

  const pageTitle = getPageTitle();

  const primaryLinks = ALL_NAV_ITEMS.filter((item) => item.tier === 'primary');
  const secondaryLinks = ALL_NAV_ITEMS.filter((item) => item.tier === 'secondary');
  const moreOnlyLinks = ALL_NAV_ITEMS.filter((item) => item.tier === 'more');
  const moreDropdownLinks = [...secondaryLinks, ...moreOnlyLinks];
  const avatarMenuLinks = ALL_NAV_ITEMS.filter(
    (item) => item.to === '/profile' || item.to === '/settings'
  );

  const isSecondaryRouteActive = secondaryLinks.some((l) =>
    location.pathname.startsWith(l.to)
  );
  const isMoreOnlyRouteActive = moreOnlyLinks.some((l) =>
    location.pathname.startsWith(l.to)
  );

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.03)] pt-safe border-b border-outline-variant/20">
        {/* Strict 1-row flex container: justify-between, items-center */}
        <div className="h-16 px-3 md:px-margin flex items-center justify-between gap-2 md:gap-4 max-w-7xl mx-auto w-full">
          {/* GROUP 1: LEFT (Mobile Hamburger, Tree Logo & Tablet-Mobile Title) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0 min-w-0">
            {/* Mobile hamburger menu button (below 768px) */}
            <button
              ref={hamburgerBtnRef}
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                menu
              </span>
            </button>

            {/* Tree Logo Brand Element */}
            <Link
              to="/"
              aria-label="WildDex Home"
              className="w-11 h-11 min-w-[44px] min-h-[44px] md:w-10 md:h-10 md:min-w-0 md:min-h-0 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm hover:scale-105 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0"
            >
              <span
                className="material-symbols-outlined text-[22px] md:text-[24px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                forest
              </span>
            </Link>

            {/* Context label visible on 640px-767px where space allows without overlapping */}
            <div className="hidden sm:flex md:hidden flex-col truncate max-w-[140px]">
              <Link
                to="/"
                className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                WildDex
              </Link>
              <span className="text-on-surface-variant text-[11px] truncate mt-0.5">{pageTitle}</span>
            </div>
          </div>

          {/* GROUP 2: CENTER (Nav links hidden below 768px) */}
          <nav
            className="hidden md:flex flex-1 min-w-0 items-center gap-3 xl:gap-4 font-label-md text-label-md"
            aria-label="Primary navigation"
          >
            {/* First 4 links (always visible on 768px and wider) */}
            {primaryLinks.map((link) => {
              const isActive =
                link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded ${
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

            {/* Wide screen links (visible on 1024px and wider) */}
            <div className="hidden lg:flex items-center gap-3 xl:gap-4 shrink-0">
              {secondaryLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.to);
                const showCareDot = link.to === '/care' && hasCareDue;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative py-1 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded ${
                      isActive
                        ? 'text-primary font-bold'
                        : 'text-on-surface-variant hover:text-primary font-medium'
                    }`}
                  >
                    <span>{link.label}</span>
                    {showCareDot && (
                      <span
                        className="w-2 h-2 rounded-full bg-error shrink-0"
                        aria-label="Care reminder due"
                      />
                    )}
                    {isActive && (
                      <span className="absolute -bottom-1 inset-x-0 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* "More" dropdown: always visible on 768px+ and wide screens */}
            <div className="relative shrink-0" ref={moreDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen((prev) => !prev);
                  setAvatarMenuOpen(false);
                }}
                className={`relative py-1 px-1.5 flex items-center gap-0.5 whitespace-nowrap transition-colors rounded-lg hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isMoreOnlyRouteActive
                    ? 'text-primary font-bold'
                    : isSecondaryRouteActive
                    ? 'text-primary lg:text-on-surface-variant font-bold lg:font-medium lg:hover:text-primary'
                    : 'text-on-surface-variant hover:text-primary font-medium'
                }`}
                aria-label="More navigation items"
                aria-expanded={moreOpen}
              >
                <span>More</span>
                <span
                  className={`material-symbols-outlined text-[18px] transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  arrow_drop_down
                </span>
                {isMoreOnlyRouteActive && (
                  <span className="absolute -bottom-1 inset-x-0 h-0.5 bg-primary rounded-full" />
                )}
                {!isMoreOnlyRouteActive && isSecondaryRouteActive && (
                  <span className="lg:hidden absolute -bottom-1 inset-x-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>

              {/* Dropdown Menu */}
              {moreOpen && (
                <div className="absolute top-10 left-0 z-50 w-56 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 py-1.5">
                  {moreDropdownLinks.map((item) => {
                    const isActive = location.pathname.startsWith(item.to);
                    const hideOnLarge = item.tier === 'secondary' ? 'lg:hidden' : '';
                    const showCareDot = item.to === '/care' && hasCareDue;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className={`${hideOnLarge} flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] font-label-md text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isActive
                            ? 'bg-secondary-container/40 text-primary font-bold'
                            : 'text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {showCareDot && (
                          <span
                            className="w-2 h-2 rounded-full bg-error shrink-0"
                            aria-label="Care reminder due"
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* GROUP 3: RIGHT (AI Scanner, Messages, Notification Bell, Avatar Menu) */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 md:gap-2 shrink-0">
            <Link
              to="/scan"
              aria-label="AI Scanner"
              className="inline-flex items-center justify-center gap-1 md:gap-1.5 min-h-[40px] md:min-h-0 px-2.5 md:px-3.5 py-1.5 rounded-full bg-tertiary text-on-tertiary font-label-md text-[11px] sm:text-label-md shadow-sm hover:opacity-95 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]" aria-hidden="true">
                document_scanner
              </span>
              <span>AI Scanner</span>
            </Link>
            <Link
              to="/messages"
              aria-label={unreadTotal > 0 ? `Messages (${unreadTotal} unread)` : 'Messages'}
              className={`relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0 ${
                location.pathname.startsWith('/messages')
                  ? 'text-primary bg-surface-container/60'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
                chat_bubble_outline
              </span>
              {unreadTotal > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center ring-2 ring-surface">
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </Link>
            <button
              aria-label="Notifications"
              className="relative w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0"
              type="button"
              onClick={() => {}}
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                notifications
              </span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-tertiary ring-2 ring-surface"></span>
            </button>

            {/* Avatar Dropdown Menu */}
            <div className="relative shrink-0" ref={avatarMenuRef}>
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={avatarMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setAvatarMenuOpen((prev) => !prev);
                  setMoreOpen(false);
                }}
                className="w-11 h-11 min-w-[44px] min-h-[44px] md:w-10 md:h-10 md:min-w-0 md:min-h-0 flex items-center justify-center rounded-full active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0"
              >
                {currentUser ? (
                  avatarUrl ? (
                    <img
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-fixed"
                      src={avatarUrl}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs ring-2 ring-primary-fixed">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center ring-2 ring-outline-variant/30">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      person
                    </span>
                  </div>
                )}
              </button>

              {avatarMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute top-12 right-0 z-50 w-56 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 py-1.5"
                >
                  <div className="px-3.5 py-2 border-b border-outline-variant/25">
                    <p className="font-label-md text-label-md font-bold text-on-surface truncate">
                      {currentUser ? displayName : 'Guest Explorer'}
                    </p>
                    {emailText && (
                      <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                        {emailText}
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    {avatarMenuLinks.map((item) => {
                      const isActive = location.pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setAvatarMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] font-label-md text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            isActive
                              ? 'bg-secondary-container/40 text-primary font-bold'
                              : 'text-on-surface hover:bg-surface-container-low'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="pt-1 border-t border-outline-variant/25">
                    {currentUser ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] font-label-md text-label-md text-error hover:bg-error-container/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          logout
                        </span>
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          setAuthModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] font-label-md text-label-md text-primary font-semibold hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          login
                        </span>
                        <span>Sign In</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Full-Height Slide-In Drawer Menu (rendered outside <header> so fixed inset-0 is full viewport) */}
      <div
        className={`fixed inset-0 z-[60] md:hidden flex justify-start transition-[opacity,visibility] duration-300 ${
          mobileMenuOpen
            ? 'opacity-100 visible pointer-events-auto'
            : 'opacity-0 invisible pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Dark Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Slide-in Drawer Panel */}
        <aside
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 w-72 max-w-[85vw] h-full bg-surface shadow-2xl p-4 flex flex-col gap-3 overflow-y-auto border-r border-outline-variant/30 transition-transform duration-300 ease-out pt-safe pb-safe ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shrink-0">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  forest
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold truncate">WildDex</h2>
                <span className="text-[11px] text-on-surface-variant block truncate">{locationName}</span>
              </div>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              tabIndex={mobileMenuOpen ? 0 : -1}
              onClick={() => {
                setMobileMenuOpen(false);
                hamburgerBtnRef.current?.focus();
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface shrink-0"
              aria-label="Close navigation menu"
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <nav className="flex flex-col gap-1 flex-1" aria-label="Mobile navigation">
            {ALL_NAV_ITEMS.map((item) => {
              const isActive =
                item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  tabIndex={mobileMenuOpen ? 0 : -1}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl font-label-md text-label-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                    isActive
                      ? 'bg-primary text-on-primary font-bold shadow-sm'
                      : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.to === '/care' && hasCareDue && (
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isActive ? 'bg-error-container' : 'bg-error'
                      }`}
                      aria-label="Care reminder due"
                    />
                  )}
                  {item.to === '/messages' && unreadTotal > 0 && (
                    <span
                      className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-on-primary text-primary'
                          : 'bg-primary text-on-primary'
                      }`}
                    >
                      {unreadTotal > 99 ? '99+' : unreadTotal}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
};
