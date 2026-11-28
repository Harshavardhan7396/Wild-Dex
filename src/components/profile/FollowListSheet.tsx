import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FollowListKind,
  FollowListUser,
  fetchFollowList,
  removeFollower,
  toggleFollowUser,
} from '../../services/publicProfileService';

export interface FollowCountsDelta {
  followersDelta?: number;
  followingDelta?: number;
}

interface FollowListSheetProps {
  open: boolean;
  initialTab: FollowListKind;
  targetUserId: string;
  targetUsername: string;
  currentUserId?: string;
  isOwner: boolean;
  isPublic: boolean;
  followersCount?: number;
  followingCount?: number;
  onClose: () => void;
  onRequireAuth?: () => void;
  onCountsDelta?: (delta: FollowCountsDelta) => void;
  onViewerFollowTargetChange?: (targetId: string, nowFollowing: boolean) => void;
}

export const FollowListSheet: React.FC<FollowListSheetProps> = ({
  open,
  initialTab,
  targetUserId,
  targetUsername,
  currentUserId,
  isOwner,
  isPublic,
  followersCount,
  followingCount,
  onClose,
  onRequireAuth,
  onCountsDelta,
  onViewerFollowTargetChange,
}) => {
  const [activeTab, setActiveTab] = useState<FollowListKind>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privateBlocked, setPrivateBlocked] = useState(false);

  const [busyUserIds, setBusyUserIds] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmRemoveUser, setConfirmRemoveUser] = useState<FollowListUser | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setActionError(null);
      setConfirmRemoveUser(null);
    }
  }, [open, initialTab, targetUserId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmRemoveUser && !removingBusy) {
          setConfirmRemoveUser(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, confirmRemoveUser, removingBusy, onClose]);

  const loadList = useCallback(
    async (kind: FollowListKind) => {
      if (!open || !targetUserId) return;

      if (!isPublic && !isOwner) {
        setPrivateBlocked(true);
        setUsers([]);
        setLoading(false);
        setError(null);
        return;
      }

      setPrivateBlocked(false);
      setLoading(true);
      setError(null);
      setActionError(null);

      try {
        const list = await fetchFollowList({
          targetUserId,
          kind,
          currentUserId,
        });
        setUsers(list);
      } catch (err: any) {
        const msg = String(err?.message || 'Could not load list.');
        if (msg.toLowerCase().includes('private') && !isOwner) {
          setPrivateBlocked(true);
          setError(null);
        } else {
          setError(msg);
        }
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [open, targetUserId, isPublic, isOwner, currentUserId]
  );

  useEffect(() => {
    if (open) {
      loadList(activeTab);
    }
  }, [open, activeTab, loadList]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const handleToggleFollow = async (row: FollowListUser) => {
    if (busyUserIds[row.id]) return;
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }
    if (row.id === currentUserId) return;

    const currentlyFollowing = row.iFollow;
    const optimisticNext = !currentlyFollowing;

    setActionError(null);
    setBusyUserIds((prev) => ({ ...prev, [row.id]: true }));

    // Optimistic row update
    setUsers((prev) =>
      prev.map((u) => (u.id === row.id ? { ...u, iFollow: optimisticNext } : u))
    );

    // Optimistic count update if editing own list
    if (isOwner) {
      onCountsDelta?.({ followingDelta: optimisticNext ? 1 : -1 });
    }
    onViewerFollowTargetChange?.(row.id, optimisticNext);

    try {
      const nextState = await toggleFollowUser({
        followerId: currentUserId,
        followingId: row.id,
        currentlyFollowing,
      });

      if (nextState !== optimisticNext) {
        setUsers((prev) =>
          prev.map((u) => (u.id === row.id ? { ...u, iFollow: nextState } : u))
        );
      }
    } catch (err: any) {
      // Roll back optimistic state and counts on error
      setUsers((prev) =>
        prev.map((u) => (u.id === row.id ? { ...u, iFollow: currentlyFollowing } : u))
      );
      if (isOwner) {
        onCountsDelta?.({ followingDelta: optimisticNext ? -1 : 1 });
      }
      onViewerFollowTargetChange?.(row.id, currentlyFollowing);
      setActionError(err?.message || 'Could not update follow status.');
    } finally {
      setBusyUserIds((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveUser || removingBusy || !isOwner) return;

    const target = confirmRemoveUser;
    const previousUsers = users;
    setRemovingBusy(true);
    setActionError(null);

    // Optimistic removal and count decrement
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    onCountsDelta?.({ followersDelta: -1 });
    setConfirmRemoveUser(null);

    try {
      await removeFollower(target.id);
    } catch (err: any) {
      // Roll back on failure
      setUsers(previousUsers);
      onCountsDelta?.({ followersDelta: 1 });
      setActionError(err?.message || 'Could not remove follower.');
    } finally {
      setRemovingBusy(false);
    }
  };

  if (!open) return null;

  const isPrivateView = (!isPublic && !isOwner) || privateBlocked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${targetUsername} followers and following`}
      onClick={() => {
        if (confirmRemoveUser && !removingBusy) {
          setConfirmRemoveUser(null);
        } else if (!removingBusy) {
          onClose();
        }
      }}
    >
      {/* Sheet / Dialog Panel */}
      <div
        className="relative w-full sm:max-w-md bg-surface-container-lowest border border-outline-variant/25 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[78vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant/50" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2 sm:pt-4 pb-2 border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
            {targetUsername || 'Connections'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant/20 px-2">
          <button
            type="button"
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-2.5 text-center font-label-md text-label-md font-semibold border-b-2 transition-colors ${
              activeTab === 'followers'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Followers
            {typeof followersCount === 'number' && !isPrivateView ? ` (${followersCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-2.5 text-center font-label-md text-label-md font-semibold border-b-2 transition-colors ${
              activeTab === 'following'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Following
            {typeof followingCount === 'number' && !isPrivateView ? ` (${followingCount})` : ''}
          </button>
        </div>

        {/* Private profile guard */}
        {isPrivateView ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2.5">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
              lock
            </span>
            <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
              This profile is private
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs">
              Only the owner can view followers and following lists on a private profile.
            </p>
          </div>
        ) : (
          <>
            {/* Search box */}
            <div className="px-4 py-3 border-b border-outline-variant/15">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people..."
                  aria-label="Search followers or following"
                  className="w-full pl-9 pr-9 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
              {actionError && (
                <p className="mt-2 font-body-sm text-xs text-error px-1">{actionError}</p>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[240px]">
              {loading ? (
                <div className="space-y-3 animate-pulse" aria-label="Loading list">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-surface-container-high shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-28 rounded bg-surface-container-high" />
                          <div className="h-3 w-20 rounded bg-surface-container-high" />
                        </div>
                      </div>
                      <div className="h-8 w-20 rounded-full bg-surface-container-high shrink-0" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5 my-4">
                  <span className="material-symbols-outlined text-[28px] text-error">
                    error_outline
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface font-medium">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => loadList(activeTab)}
                    className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-10 px-4 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                    {searchQuery.trim() ? 'search_off' : 'group'}
                  </span>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {searchQuery.trim()
                      ? `No results for "${searchQuery.trim()}".`
                      : activeTab === 'followers'
                      ? 'No followers yet. Share your profile!'
                      : 'Not following anyone yet.'}
                  </p>
                </div>
              ) : (
                filteredUsers.map((row) => {
                  const initial = (row.username || row.displayName || 'E')
                    .charAt(0)
                    .toUpperCase();
                  const isSelfRow = Boolean(currentUserId && currentUserId === row.id);
                  const isBusy = Boolean(busyUserIds[row.id]);
                  const followLabel = row.iFollow
                    ? 'Following'
                    : row.followsMe
                    ? 'Follow back'
                    : 'Follow';

                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2.5 py-1.5"
                    >
                      <Link
                        to={`/u/${encodeURIComponent(row.username)}`}
                        onClick={onClose}
                        className="flex items-center gap-3 min-w-0 flex-1 group"
                      >
                        {row.avatarUrl ? (
                          <img
                            src={row.avatarUrl}
                            alt={row.username}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-fixed shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-base shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-label-md text-label-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                              {row.username}
                            </span>
                            {isOwner && row.followsMe && (
                              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-semibold shrink-0">
                                Follows you
                              </span>
                            )}
                          </div>
                          {row.displayName &&
                            row.displayName.toLowerCase() !== row.username.toLowerCase() && (
                              <p className="font-body-sm text-xs text-on-surface-variant truncate">
                                {row.displayName}
                              </p>
                            )}
                        </div>
                      </Link>

                      {!isSelfRow && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleFollow(row)}
                            className={`px-3.5 py-1.5 rounded-full font-label-sm text-xs font-semibold transition-colors disabled:opacity-60 ${
                              row.iFollow
                                ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                                : 'bg-primary text-on-primary hover:opacity-95'
                            }`}
                          >
                            {isBusy ? '...' : followLabel}
                          </button>

                          {isOwner && activeTab === 'followers' && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveUser(row)}
                              className="px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface-variant hover:text-error hover:border-error/40 font-label-sm text-xs font-semibold transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Confirm Remove Follower Dialog */}
        {confirmRemoveUser && (
          <div
            className="absolute inset-0 z-10 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm remove follower"
            onClick={() => {
              if (!removingBusy) setConfirmRemoveUser(null);
            }}
          >
            <div
              className="w-full max-w-xs rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-5 shadow-xl space-y-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-11 h-11 rounded-full bg-error-container/40 text-error flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[22px]">person_remove</span>
              </div>
              <h3 className="font-headline-sm text-base font-bold text-on-surface">
                Remove follower?
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                WildDex won&apos;t tell {confirmRemoveUser.username} they were removed from your followers.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={removingBusy}
                  onClick={() => setConfirmRemoveUser(null)}
                  className="flex-1 py-2 rounded-full bg-surface-container text-on-surface font-label-sm text-xs font-semibold hover:bg-surface-container-high transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={removingBusy}
                  onClick={handleConfirmRemove}
                  className="flex-1 py-2 rounded-full bg-error text-on-error font-label-sm text-xs font-semibold hover:opacity-95 transition-opacity disabled:opacity-60"
                >
                  {removingBusy ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
