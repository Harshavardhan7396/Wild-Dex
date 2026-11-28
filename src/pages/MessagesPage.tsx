import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import {
  ChatConversation,
  MutualFriend,
  fetchMyConversations,
  fetchMutualFriends,
  startConversation,
} from '../services/chatService';

function formatShortRelativeTime(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString();
}

export const MessagesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New message friend picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState<MutualFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState('');
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!currentUser) {
        setConversations([]);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const list = await fetchMyConversations();
        setConversations(list);
        setError(null);
      } catch (err: any) {
        if (!silent) {
          setError(err?.message || 'Could not load messages.');
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [currentUser?.id]
  );

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  // Refresh inbox in realtime whenever a new message arrives
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`inbox-messages-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          loadConversations(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadConversations]);

  const loadFriendsPicker = useCallback(async () => {
    if (!currentUser) return;
    setFriendsLoading(true);
    setFriendsError(null);
    setStartError(null);

    try {
      const list = await fetchMutualFriends(currentUser.id);
      setFriends(list);
    } catch (err: any) {
      setFriendsError(err?.message || 'Could not load mutual followers.');
    } finally {
      setFriendsLoading(false);
    }
  }, [currentUser?.id]);

  const handleOpenPicker = () => {
    setFriendSearch('');
    setStartError(null);
    setPickerOpen(true);
    loadFriendsPicker();
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !startingUserId) {
        setPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pickerOpen, startingUserId]);

  const filteredFriends = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        f.displayName.toLowerCase().includes(q)
    );
  }, [friends, friendSearch]);

  const handlePickFriend = async (friend: MutualFriend) => {
    if (startingUserId) return;
    setStartingUserId(friend.id);
    setStartError(null);
    try {
      const conversationId = await startConversation(friend.id);
      setPickerOpen(false);
      navigate(`/messages/${encodeURIComponent(conversationId)}`);
    } catch (err: any) {
      setStartError(err?.message || 'Could not start chat.');
    } finally {
      setStartingUserId(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to view Messages"
          description="Send private messages with fellow explorers who follow each other in real time."
          icon="chat"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-headline-sm text-headline-sm text-primary font-bold">
          Messages
        </h1>
        <button
          type="button"
          onClick={handleOpenPicker}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">edit_square</span>
          <span>New message</span>
        </button>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-2.5 animate-pulse" aria-label="Loading conversations">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-high shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between gap-4">
                  <div className="h-4 w-32 rounded bg-surface-container-high" />
                  <div className="h-3 w-12 rounded bg-surface-container-high" />
                </div>
                <div className="h-3.5 w-48 rounded bg-surface-container-high" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error">
            error_outline
          </span>
          <p className="font-body-md text-body-md text-on-surface font-medium">
            {error}
          </p>
          <button
            type="button"
            onClick={() => loadConversations(false)}
            className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conversations.length === 0 && (
        <div className="p-8 rounded-3xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-container/50 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">chat_bubble_outline</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            No messages yet. Follow people and say hello!
          </p>
          <button
            type="button"
            onClick={handleOpenPicker}
            className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Start a chat
          </button>
        </div>
      )}

      {/* Conversations List */}
      {!loading && !error && conversations.length > 0 && (
        <div className="flex flex-col gap-2">
          {conversations.map((conv) => {
            const initial = (conv.otherUsername || conv.otherDisplayName || 'E')
              .charAt(0)
              .toUpperCase();
            const isUnread = conv.hasUnread || conv.unreadCount > 0;
            const previewText = conv.lastMessage
              ? conv.lastSenderId === currentUser.id
                ? `You: ${conv.lastMessage}`
                : conv.lastMessage
              : 'Say hello!';
            const timeText = formatShortRelativeTime(conv.lastMessageAt);

            return (
              <Link
                key={conv.id}
                to={`/messages/${encodeURIComponent(conv.id)}`}
                className={`p-3.5 rounded-2xl border transition-colors flex items-center gap-3 ${
                  isUnread
                    ? 'bg-surface-container-high border-primary/25 shadow-sm'
                    : 'bg-surface-container-low border-outline-variant/15 hover:bg-surface-container'
                }`}
              >
                <div className="relative shrink-0">
                  {conv.otherAvatarUrl ? (
                    <img
                      src={conv.otherAvatarUrl}
                      alt={conv.otherUsername}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-primary-fixed"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg ring-2 ring-primary-fixed">
                      {initial}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-label-lg text-sm truncate ${
                        isUnread
                          ? 'text-on-surface font-bold'
                          : 'text-on-surface font-semibold'
                      }`}
                    >
                      {conv.otherUsername}
                    </span>
                    {timeText && (
                      <span
                        className={`text-[11px] shrink-0 ${
                          isUnread
                            ? 'text-primary font-bold'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        {timeText}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs truncate mt-0.5 ${
                      isUnread
                        ? 'text-on-surface font-semibold'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {previewText}
                  </p>
                </div>

                {isUnread && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-primary shrink-0"
                    aria-label="Unread messages"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* New Message Mutual Friends Picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="New message"
          onClick={() => {
            if (!startingUserId) setPickerOpen(false);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-surface-container-lowest border border-outline-variant/25 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-outline-variant/50" />
            </div>

            <div className="flex items-center justify-between px-4 pt-2 sm:pt-4 pb-3 border-b border-outline-variant/20">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  New message
                </h2>
                <p className="font-body-sm text-[11px] text-on-surface-variant">
                  People who follow you back
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(startingUserId)}
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-outline-variant/15">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Search friends..."
                  aria-label="Search friends"
                  className="w-full pl-9 pr-9 py-2 rounded-full bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {friendSearch && (
                  <button
                    type="button"
                    onClick={() => setFriendSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
              {startError && (
                <p className="mt-2 font-body-sm text-xs text-error px-1">{startError}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[220px]">
              {friendsLoading ? (
                <div className="space-y-3 animate-pulse" aria-label="Loading friends">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="flex items-center gap-3 py-1">
                      <div className="w-11 h-11 rounded-full bg-surface-container-high shrink-0" />
                      <div className="h-4 w-32 rounded bg-surface-container-high" />
                    </div>
                  ))}
                </div>
              ) : friendsError ? (
                <div className="p-5 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5">
                  <p className="font-body-sm text-xs text-error font-medium">
                    {friendsError}
                  </p>
                  <button
                    type="button"
                    onClick={loadFriendsPicker}
                    className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-xs font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-10 px-4 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[34px] text-on-surface-variant">
                    {friendSearch.trim() ? 'search_off' : 'group'}
                  </span>
                  <p className="font-body-sm text-sm text-on-surface-variant">
                    {friendSearch.trim()
                      ? `No friends matching "${friendSearch.trim()}".`
                      : 'No mutual followers yet. Follow people who follow you back to chat!'}
                  </p>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const initial = (friend.username || friend.displayName || 'E')
                    .charAt(0)
                    .toUpperCase();
                  const isBusy = startingUserId === friend.id;

                  return (
                    <button
                      key={friend.id}
                      type="button"
                      disabled={Boolean(startingUserId)}
                      onClick={() => handlePickFriend(friend)}
                      className="w-full p-2.5 rounded-2xl hover:bg-surface-container flex items-center justify-between gap-3 text-left transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt={friend.username}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-primary-fixed shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-base shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-label-md text-sm font-bold text-on-surface truncate">
                            {friend.username}
                          </p>
                          {friend.displayName &&
                            friend.displayName.toLowerCase() !==
                              friend.username.toLowerCase() && (
                              <p className="font-body-sm text-xs text-on-surface-variant truncate">
                                {friend.displayName}
                              </p>
                            )}
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-xs font-semibold shrink-0">
                        {isBusy ? 'Opening...' : 'Chat'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
