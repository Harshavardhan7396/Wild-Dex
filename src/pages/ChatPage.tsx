import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import {
  ChatConversation,
  ChatMessage,
  fetchConversationDetails,
  fetchConversationMessages,
  sendChatMessage,
  deleteChatMessage,
  markConversationRead,
  reportChatMessage,
  normalizeChatMessageRow,
} from '../services/chatService';
import {
  UserRelationship,
  fetchRelationship,
  blockUser,
} from '../services/publicProfileService';

const MESSAGE_REPORT_REASONS = [
  'Harassment or bullying',
  'Spam or scam',
  'Inappropriate or explicit content',
  'Hate speech or threats',
];

function formatDateSeparator(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getDateKey(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatMessageTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const ChatPage: React.FC = () => {
  const { conversationId = '' } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const decodedConvId = decodeURIComponent(conversationId || '');

  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [relationship, setRelationship] = useState<UserRelationship | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasEarlier, setHasEarlier] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  // Per-message action menu (via ⋯ or long press)
  const [activeActionMsg, setActiveActionMsg] = useState<ChatMessage | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Report modal
  const [reportTargetMsg, setReportTargetMsg] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState(MESSAGE_REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const initialScrolledRef = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  const loadChat = useCallback(async () => {
    if (!currentUser || !decodedConvId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    initialScrolledRef.current = false;

    try {
      const [convMeta, msgPage] = await Promise.all([
        fetchConversationDetails(decodedConvId, currentUser.id),
        fetchConversationMessages({ conversationId: decodedConvId, limit: 50 }),
      ]);

      setConversation(convMeta);
      setMessages(msgPage.messages);
      setHasEarlier(msgPage.hasMore);

      // Determine other participant ID from metadata or messages
      const otherId =
        convMeta?.otherUserId ||
        msgPage.messages.find((m) => m.senderId !== currentUser.id)?.senderId ||
        '';

      if (otherId) {
        try {
          const rel = await fetchRelationship(otherId);
          setRelationship(rel);
        } catch (relErr) {
          console.warn('Could not check relationship in chat:', relErr);
          setRelationship(null);
        }
      } else {
        setRelationship(null);
      }

      // Mark messages as read when chat opens
      await markConversationRead(decodedConvId);
    } catch (err: any) {
      setError(err?.message || 'Could not load conversation.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, decodedConvId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Scroll to bottom once initial chat finishes loading
  useEffect(() => {
    if (!loading && !error && !initialScrolledRef.current) {
      initialScrolledRef.current = true;
      scrollToBottom('auto');
    }
  }, [loading, error, scrollToBottom]);

  // Keep latest messages visible when virtual keyboard opens on mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleResize = () => {
      if (document.activeElement === textareaRef.current) {
        scrollToBottom('auto');
      }
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [scrollToBottom]);

  // Realtime subscription for incoming messages, read receipts, and deletions
  useEffect(() => {
    if (!currentUser || !decodedConvId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`chat-${decodedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${decodedConvId}`,
        },
        (payload) => {
          const incoming = normalizeChatMessageRow(payload.new);
          if (!incoming.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) {
              return prev;
            }

            // Reconcile optimistic message sent by me if Realtime beats insert().select()
            if (incoming.senderId === currentUser.id) {
              const pendingIdx = prev.findIndex(
                (m) =>
                  m.localStatus === 'sending' &&
                  m.senderId === currentUser.id &&
                  m.body.trim() === incoming.body.trim()
              );
              if (pendingIdx !== -1) {
                const updated = [...prev];
                updated[pendingIdx] = incoming;
                return updated;
              }
            }

            return [...prev, incoming];
          });

          if (incoming.senderId !== currentUser.id) {
            markConversationRead(decodedConvId);
          }

          scrollToBottom('smooth');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${decodedConvId}`,
        },
        (payload) => {
          const updatedRow = normalizeChatMessageRow(payload.new);
          if (!updatedRow.id) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedRow.id ? { ...m, ...updatedRow } : m))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${decodedConvId}`,
        },
        (payload) => {
          const oldId = String((payload.old as any)?.id || '');
          if (!oldId) return;
          setMessages((prev) => prev.filter((m) => m.id !== oldId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, decodedConvId, scrollToBottom]);

  const handleLoadEarlier = async () => {
    if (loadingEarlier || !hasEarlier || messages.length === 0) return;

    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;

    setLoadingEarlier(true);
    setEarlierError(null);

    try {
      const oldest = messages[0];
      const older = await fetchConversationMessages({
        conversationId: decodedConvId,
        beforeCreatedAt: oldest.createdAt,
        limit: 50,
      });

      setHasEarlier(older.hasMore);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const uniqueOlder = older.messages.filter((m) => !existingIds.has(m.id));
        return [...uniqueOlder, ...prev];
      });

      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        }
      });
    } catch (err: any) {
      setEarlierError(err?.message || 'Could not load earlier messages.');
    } finally {
      setLoadingEarlier(false);
    }
  };

  const canMessage = useMemo(() => {
    if (!relationship) return true; // If relationship wasn't loaded/unknown, rely on server RLS
    return relationship.iFollow && relationship.followsMe && !relationship.isBlocked;
  }, [relationship]);

  const sendOptimisticMessage = async (text: string, retryTempId?: string) => {
    if (!currentUser || !decodedConvId || !canMessage) return;
    const clean = text.trim();
    if (!clean || clean.length > 1000) return;

    const tempId = retryTempId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    if (retryTempId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === retryTempId ? { ...m, localStatus: 'sending', localError: undefined } : m
        )
      );
    } else {
      const optimistic: ChatMessage = {
        id: tempId,
        conversationId: decodedConvId,
        senderId: currentUser.id,
        body: clean,
        createdAt: nowIso,
        readAt: null,
        localStatus: 'sending',
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      scrollToBottom('smooth');
    }

    try {
      const saved = await sendChatMessage({
        conversationId: decodedConvId,
        senderId: currentUser.id,
        body: clean,
      });

      setMessages((prev) => {
        const alreadyInsertedByRealtime = prev.some((m) => m.id === saved.id);
        if (alreadyInsertedByRealtime) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? saved : m));
      });
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                localStatus: 'failed',
                localError: err?.message || 'Could not send message.',
              }
            : m
        )
      );
    }
  };

  const handleSendClick = () => {
    if (!draft.trim() || draft.length > 1000 || !canMessage) return;
    sendOptimisticMessage(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, 1000);
    setDraft(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const startLongPress = (msg: ChatMessage) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      setActiveActionMsg(msg);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!currentUser || deleteBusy) return;

    // Local failed/unsent message only needs local removal
    if (msg.localStatus === 'failed' || msg.id.startsWith('temp-')) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setActiveActionMsg(null);
      return;
    }

    const previous = messages;
    setDeleteBusy(true);
    setActiveActionMsg(null);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));

    try {
      await deleteChatMessage({ messageId: msg.id, senderId: currentUser.id });
    } catch (err: any) {
      setMessages(previous);
      showToast(err?.message || 'Could not delete message.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleOpenReport = (msg: ChatMessage) => {
    setActiveActionMsg(null);
    setReportReason(MESSAGE_REPORT_REASONS[0]);
    setReportDetails('');
    setReportError(null);
    setReportTargetMsg(msg);
  };

  const handleSubmitMessageReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reportTargetMsg || reportBusy) return;

    const fullReason = reportDetails.trim()
      ? `${reportReason}: ${reportDetails.trim()}`
      : reportReason;

    setReportBusy(true);
    setReportError(null);
    try {
      await reportChatMessage({
        messageId: reportTargetMsg.id,
        reportedUserId: reportTargetMsg.senderId,
        reporterId: currentUser.id,
        reason: fullReason,
      });
      setReportTargetMsg(null);
      showToast('Report submitted. Thank you for keeping WildDex safe.');
    } catch (err: any) {
      setReportError(err?.message || 'Could not submit report.');
    } finally {
      setReportBusy(false);
    }
  };

  const handleConfirmBlock = async () => {
    const otherId = conversation?.otherUserId;
    if (!otherId || blockBusy) return;

    setBlockBusy(true);
    try {
      await blockUser(otherId);
      setRelationship({ iFollow: false, followsMe: false, isBlocked: true });
      setConfirmBlockOpen(false);
      showToast(`Blocked ${conversation?.otherUsername || 'user'}.`);
    } catch (err: any) {
      setConfirmBlockOpen(false);
      showToast(err?.message || 'Could not block user.');
    } finally {
      setBlockBusy(false);
    }
  };

  // Find ID of my last message that has been read by the other person
  const lastSeenMessageId = useMemo(() => {
    if (!currentUser) return null;
    const otherLastReadMs = conversation?.otherLastReadAt
      ? new Date(conversation.otherLastReadAt).getTime()
      : null;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.senderId !== currentUser.id) continue;
      if (m.localStatus === 'sending' || m.localStatus === 'failed') continue;
      if (m.readAt) return m.id;
      if (
        otherLastReadMs !== null &&
        Number.isFinite(otherLastReadMs) &&
        new Date(m.createdAt).getTime() <= otherLastReadMs
      ) {
        return m.id;
      }
    }
    return null;
  }, [messages, currentUser?.id, conversation?.otherLastReadAt]);

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to view this conversation"
          description="Sign in to send and receive private messages with friends who follow each other."
          icon="chat"
        />
      </div>
    );
  }

  const otherUsername = conversation?.otherUsername || 'Explorer';
  const otherInitial = otherUsername.charAt(0).toUpperCase();
  const profileLink = conversation?.otherUsername
    ? `/u/${encodeURIComponent(conversation.otherUsername)}`
    : undefined;

  return (
    <div className="fixed inset-0 z-[55] md:relative md:inset-auto md:z-auto h-[100dvh] md:h-[calc(100dvh-6.5rem)] w-full bg-surface md:rounded-3xl md:border md:border-outline-variant/25 md:shadow-sm flex flex-col overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-xs shadow-xl">
          {toast}
        </div>
      )}

      {/* Chat Header */}
      <header className="shrink-0 h-16 px-2 sm:px-4 bg-surface/95 backdrop-blur-md border-b border-outline-variant/25 flex items-center justify-between gap-2 pt-safe">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate('/messages')}
            aria-label="Back to messages"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>

          {profileLink ? (
            <Link
              to={profileLink}
              className="flex items-center gap-2.5 min-w-0 flex-1 group"
            >
              {conversation?.otherAvatarUrl ? (
                <img
                  src={conversation.otherAvatarUrl}
                  alt={otherUsername}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-fixed shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-base shrink-0">
                  {otherInitial}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-headline-sm text-base font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                  {otherUsername}
                </h1>
                {!canMessage && (
                  <p className="text-[11px] text-error truncate">Messaging disabled</p>
                )}
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-base shrink-0">
                {otherInitial}
              </div>
              <h1 className="font-headline-sm text-base font-bold text-on-surface truncate">
                {otherUsername}
              </h1>
            </div>
          )}
        </div>

        {/* ⋯ Menu with Block */}
        {conversation?.otherUserId && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Conversation options"
              aria-expanded={headerMenuOpen}
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">more_horiz</span>
            </button>

            {headerMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-44 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl py-1.5 z-30 overflow-hidden">
                  {profileLink && (
                    <Link
                      to={profileLink}
                      onClick={() => setHeaderMenuOpen(false)}
                      className="w-full px-3.5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container flex items-center gap-2.5"
                    >
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        person
                      </span>
                      <span>View profile</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={relationship?.isBlocked}
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setConfirmBlockOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-sm font-medium text-error hover:bg-error-container/20 flex items-center gap-2.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">block</span>
                    <span>{relationship?.isBlocked ? 'Blocked' : 'Block'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Scrollable Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-2"
      >
        {loading ? (
          <div className="space-y-3 py-2 animate-pulse" aria-label="Loading chat">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className={`flex ${idx % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`h-11 rounded-2xl bg-surface-container-high ${
                    idx % 2 === 0 ? 'w-48' : 'w-40'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 my-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[32px] text-error">
              error_outline
            </span>
            <p className="font-body-sm text-sm text-on-surface font-medium">{error}</p>
            <button
              type="button"
              onClick={loadChat}
              className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Load earlier button */}
            {hasEarlier && (
              <div className="flex flex-col items-center py-2 gap-1.5">
                {earlierError && (
                  <p className="text-xs text-error">{earlierError}</p>
                )}
                <button
                  type="button"
                  disabled={loadingEarlier}
                  onClick={handleLoadEarlier}
                  className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface font-label-sm text-xs font-semibold hover:bg-surface-container-high transition-colors disabled:opacity-60"
                >
                  {loadingEarlier ? 'Loading...' : 'Load earlier'}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="py-12 px-4 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[34px] text-on-surface-variant">
                  waving_hand
                </span>
                <p className="font-body-md text-sm text-on-surface-variant">
                  Say hello to <span className="font-semibold text-on-surface">{otherUsername}</span>!
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMine = msg.senderId === currentUser.id;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateSep =
                  !prevMsg || getDateKey(prevMsg.createdAt) !== getDateKey(msg.createdAt);
                const showSeen = isMine && msg.id === lastSeenMessageId;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSep && (
                      <div className="flex justify-center py-2">
                        <span className="px-3 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-medium">
                          {formatDateSeparator(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isMine ? 'items-end' : 'items-start'
                      } group`}
                    >
                      <div
                        className={`flex items-end gap-1.5 max-w-[82%] sm:max-w-[72%] ${
                          isMine ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div
                          onTouchStart={() => startLongPress(msg)}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onTouchCancel={cancelLongPress}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setActiveActionMsg(msg);
                          }}
                          className={`px-3.5 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap select-text shadow-xs ${
                            isMine
                              ? `bg-primary text-on-primary rounded-br-sm ${
                                  msg.localStatus === 'failed'
                                    ? 'opacity-80 ring-2 ring-error/50'
                                    : msg.localStatus === 'sending'
                                    ? 'opacity-80'
                                    : ''
                                }`
                              : 'bg-surface-container-high text-on-surface rounded-bl-sm'
                          }`}
                        >
                          {msg.body}
                        </div>

                        <button
                          type="button"
                          aria-label="Message actions"
                          onClick={() => setActiveActionMsg(msg)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            more_horiz
                          </span>
                        </button>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 mt-0.5 px-1 text-[10px] text-on-surface-variant ${
                          isMine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <span>
                          {msg.localStatus === 'sending'
                            ? 'Sending...'
                            : formatMessageTime(msg.createdAt)}
                        </span>
                        {showSeen && (
                          <span className="text-primary font-semibold">• Seen</span>
                        )}
                      </div>

                      {msg.localStatus === 'failed' && (
                        <button
                          type="button"
                          onClick={() => sendOptimisticMessage(msg.body, msg.id)}
                          className="mt-0.5 px-2 py-0.5 rounded-full bg-error-container/30 text-error text-[11px] font-semibold hover:bg-error-container/50 transition-colors"
                        >
                          Not sent. Tap to retry
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Friendship Guard Banner + Bottom Input Bar */}
      <footer className="shrink-0 border-t border-outline-variant/25 bg-surface px-3 py-2.5 pb-safe">
        {!canMessage ? (
          <div className="p-3 rounded-2xl bg-surface-container text-center space-y-2">
            <p className="font-body-sm text-xs text-on-surface-variant font-medium">
              You can only message people who follow you back
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                placeholder="Messaging unavailable"
                className="flex-1 px-3.5 py-2 rounded-full bg-surface-container-low text-xs text-on-surface-variant opacity-60 cursor-not-allowed"
              />
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold opacity-40 cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                maxLength={1000}
                placeholder="Message..."
                aria-label="Message text"
                disabled={loading || Boolean(error)}
                className="flex-1 min-h-[42px] max-h-[120px] px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSendClick}
                disabled={loading || Boolean(error) || !draft.trim() || draft.length > 1000}
                aria-label="Send message"
                className="h-[42px] px-4 rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold flex items-center justify-center gap-1 shadow-sm hover:opacity-95 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <div className="flex justify-between items-center px-1 text-[10px] text-on-surface-variant">
              <span className="hidden sm:inline">Enter to send • Shift+Enter for new line</span>
              <span className={`ml-auto ${draft.length >= 950 ? 'text-error font-semibold' : ''}`}>
                {draft.length}/1000
              </span>
            </div>
          </div>
        )}
      </footer>

      {/* Message Action Sheet (Delete own / Report theirs) */}
      {activeActionMsg && (
        <div
          className="fixed inset-0 z-[65] bg-black/45 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Message options"
          onClick={() => setActiveActionMsg(null)}
        >
          <div
            className="w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-4 shadow-2xl space-y-2 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-on-surface-variant truncate px-2 pb-1 border-b border-outline-variant/20">
              {activeActionMsg.body}
            </p>
            {activeActionMsg.senderId === currentUser.id ? (
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => handleDeleteMessage(activeActionMsg)}
                className="w-full py-2.5 px-3 rounded-xl text-left text-sm font-semibold text-error hover:bg-error-container/20 flex items-center gap-2.5"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>{deleteBusy ? 'Deleting...' : 'Delete message'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenReport(activeActionMsg)}
                className="w-full py-2.5 px-3 rounded-xl text-left text-sm font-semibold text-error hover:bg-error-container/20 flex items-center gap-2.5"
              >
                <span className="material-symbols-outlined text-[18px]">flag</span>
                <span>Report message</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveActionMsg(null)}
              className="w-full py-2.5 px-3 rounded-xl text-center text-sm font-semibold bg-surface-container text-on-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm Block Dialog */}
      {confirmBlockOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={`Block ${otherUsername}`}
          onClick={() => {
            if (!blockBusy) setConfirmBlockOpen(false);
          }}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-5 shadow-2xl space-y-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-error-container/40 text-error flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[22px]">block</span>
            </div>
            <h3 className="font-headline-sm text-base font-bold text-on-surface">
              Block {otherUsername}?
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              You won&apos;t be able to message each other unless unblocked.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={blockBusy}
                onClick={() => setConfirmBlockOpen(false)}
                className="flex-1 py-2 rounded-full bg-surface-container text-on-surface font-label-sm text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blockBusy}
                onClick={handleConfirmBlock}
                className="flex-1 py-2 rounded-full bg-error text-on-error font-label-sm text-xs font-semibold disabled:opacity-60"
              >
                {blockBusy ? 'Blocking...' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Message Dialog */}
      {reportTargetMsg && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report message"
          onClick={() => {
            if (!reportBusy) setReportTargetMsg(null);
          }}
        >
          <form
            onSubmit={handleSubmitMessageReport}
            className="w-full max-w-sm rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-base font-bold text-on-surface">
                Report message
              </h3>
              <button
                type="button"
                disabled={reportBusy}
                onClick={() => setReportTargetMsg(null)}
                aria-label="Close report dialog"
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {MESSAGE_REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors"
                >
                  <input
                    type="radio"
                    name="message-report-reason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="accent-primary"
                  />
                  <span className="font-body-sm text-xs text-on-surface">{reason}</span>
                </label>
              ))}
            </div>

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional details..."
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            {reportError && (
              <p className="font-body-sm text-xs text-error">{reportError}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={reportBusy}
                onClick={() => setReportTargetMsg(null)}
                className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-label-sm text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportBusy}
                className="px-4 py-2 rounded-full bg-error text-on-error font-label-sm text-xs font-semibold disabled:opacity-60"
              >
                {reportBusy ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
