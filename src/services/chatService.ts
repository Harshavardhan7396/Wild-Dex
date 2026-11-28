import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchFollowList, FollowListUser } from './publicProfileService';

export const UNREAD_REFRESH_EVENT = 'wilddex:unread-changed';

export interface ChatConversation {
  id: string;
  otherUserId: string;
  otherUsername: string;
  otherDisplayName: string;
  otherAvatarUrl: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  unreadCount: number;
  hasUnread: boolean;
  otherLastReadAt: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  localStatus?: 'sending' | 'failed';
  localError?: string;
}

export interface MutualFriend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export function notifyUnreadChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNREAD_REFRESH_EVENT));
  }
}

function normalizeNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeChatMessageRow(row: any): ChatMessage {
  const isReadBool = typeof row?.is_read === 'boolean' ? row.is_read : false;
  const readAt =
    row?.read_at ? String(row.read_at) : isReadBool ? String(row?.updated_at || row?.created_at || new Date().toISOString()) : null;

  return {
    id: String(row?.id || ''),
    conversationId: String(row?.conversation_id || ''),
    senderId: String(row?.sender_id || row?.user_id || ''),
    body: String(row?.body ?? row?.content ?? row?.text ?? ''),
    createdAt: String(row?.created_at || new Date().toISOString()),
    readAt,
  };
}

/**
 * Fetch total unread messages count via supabase.rpc('unread_total').
 */
export async function fetchUnreadTotal(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const { data, error } = await supabase.rpc('unread_total');
    if (error) {
      throw new Error(error.message || 'Could not load unread count.');
    }

    if (typeof data === 'number' || typeof data === 'string') {
      return Math.max(0, normalizeNumber(data));
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (typeof row === 'number' || typeof row === 'string') {
      return Math.max(0, normalizeNumber(row));
    }
    if (row && typeof row === 'object') {
      return Math.max(
        0,
        normalizeNumber(
          row.unread_total ?? row.total ?? row.count ?? row.unread_count ?? 0
        )
      );
    }

    return 0;
  } catch (err) {
    console.error('Error calling unread_total:', err);
    return 0;
  }
}

/**
 * Fetch inbox conversations via supabase.rpc('my_conversations').
 */
export async function fetchMyConversations(): Promise<ChatConversation[]> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  try {
    const { data, error } = await supabase.rpc('my_conversations');
    if (error) {
      throw new Error(error.message || 'Could not load conversations.');
    }

    if (!Array.isArray(data)) return [];

    return data
      .filter((row: any) => Boolean(row && (row.conversation_id || row.id)))
      .map((row: any) => {
        const id = String(row.conversation_id || row.id || '');
        const otherUserId = String(
          row.other_user_id || row.other_id || row.peer_id || row.user_id || ''
        );
        const otherUsername = String(
          row.other_username || row.username || row.other_display_name || row.display_name || 'Explorer'
        );
        const otherDisplayName = String(
          row.other_display_name || row.display_name || otherUsername
        );
        const unreadCount = normalizeNumber(
          row.unread_count ?? row.unread ?? 0
        );
        const hasUnread =
          typeof row.has_unread === 'boolean'
            ? row.has_unread || unreadCount > 0
            : unreadCount > 0 || row.is_unread === true;

        return {
          id,
          otherUserId,
          otherUsername,
          otherDisplayName,
          otherAvatarUrl: String(row.other_avatar_url || row.avatar_url || ''),
          lastMessage: String(
            row.last_message ?? row.last_message_body ?? row.last_body ?? row.body ?? ''
          ),
          lastMessageAt: String(
            row.last_message_at || row.last_created_at || row.updated_at || row.created_at || ''
          ),
          lastSenderId: String(row.last_sender_id || row.sender_id || ''),
          unreadCount,
          hasUnread,
          otherLastReadAt: row.other_last_read_at
            ? String(row.other_last_read_at)
            : row.last_read_at
            ? String(row.last_read_at)
            : null,
        };
      });
  } catch (err: any) {
    console.error('Error calling my_conversations:', err);
    throw err instanceof Error ? err : new Error('Could not load conversations.');
  }
}

/**
 * Fetch mutual friends using follow_list RPC (both i_follow and follows_me are true).
 */
export async function fetchMutualFriends(currentUserId: string): Promise<MutualFriend[]> {
  if (!isSupabaseConfigured || !currentUserId) return [];

  try {
    const [followers, following] = await Promise.all([
      fetchFollowList({ targetUserId: currentUserId, kind: 'followers', currentUserId }),
      fetchFollowList({ targetUserId: currentUserId, kind: 'following', currentUserId }),
    ]);

    const followingIds = new Set(following.map((u) => u.id));
    const followersIds = new Set(followers.map((u) => u.id));

    const mutualMap = new Map<string, FollowListUser>();

    for (const user of followers) {
      if ((user.iFollow && user.followsMe) || followingIds.has(user.id)) {
        mutualMap.set(user.id, user);
      }
    }
    for (const user of following) {
      if ((user.iFollow && user.followsMe) || followersIds.has(user.id)) {
        if (!mutualMap.has(user.id)) {
          mutualMap.set(user.id, user);
        }
      }
    }

    return Array.from(mutualMap.values())
      .filter((u) => u.id !== currentUserId)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  } catch (err: any) {
    console.error('Error loading mutual friends:', err);
    throw err instanceof Error ? err : new Error('Could not load friends list.');
  }
}

/**
 * Get or create a 1:1 conversation via supabase.rpc('start_conversation', { p_other }).
 */
export async function startConversation(otherUserId: string): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  if (!otherUserId) {
    throw new Error('Invalid recipient.');
  }

  try {
    const { data, error } = await supabase.rpc('start_conversation', {
      p_other: otherUserId,
    });

    if (error) {
      throw new Error(error.message || 'Could not start conversation.');
    }

    if (typeof data === 'string' && data.trim()) {
      return data.trim();
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (typeof row === 'string' && row.trim()) {
      return row.trim();
    }
    if (row && typeof row === 'object') {
      const id = String(row.conversation_id || row.id || row.start_conversation || '');
      if (id) return id;
    }

    throw new Error('Could not open conversation.');
  } catch (err: any) {
    console.error('Error calling start_conversation:', err);
    throw err instanceof Error ? err : new Error('Could not start conversation.');
  }
}

/**
 * Fetch metadata for a specific conversation (from my_conversations, with participant/profile fallback).
 */
export async function fetchConversationDetails(
  conversationId: string,
  currentUserId: string
): Promise<ChatConversation | null> {
  if (!isSupabaseConfigured || !conversationId || !currentUserId) return null;

  try {
    const list = await fetchMyConversations();
    const matched = list.find((c) => c.id === conversationId);
    if (matched) return matched;
  } catch (err) {
    console.warn('Could not find conversation in my_conversations, checking participants:', err);
  }

  // Fallback: inspect conversation_participants / conversations + public_profiles
  try {
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('user_id, last_read_at')
      .eq('conversation_id', conversationId);

    const otherPart = (parts || []).find((p: any) => p.user_id !== currentUserId);
    if (otherPart?.user_id) {
      const { data: prof } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', otherPart.user_id)
        .maybeSingle();

      return {
        id: conversationId,
        otherUserId: String(otherPart.user_id),
        otherUsername: String(prof?.username || prof?.display_name || 'Explorer'),
        otherDisplayName: String(prof?.display_name || prof?.username || 'Explorer'),
        otherAvatarUrl: String(prof?.avatar_url || ''),
        lastMessage: '',
        lastMessageAt: '',
        lastSenderId: '',
        unreadCount: 0,
        hasUnread: false,
        otherLastReadAt: otherPart.last_read_at ? String(otherPart.last_read_at) : null,
      };
    }

    // Second fallback: conversations table with user_a / user_b columns
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (conv) {
      const candidates = [conv.user_a, conv.user_b, conv.user1_id, conv.user2_id].filter(Boolean);
      const otherId = candidates.find((uid: string) => uid !== currentUserId);
      if (otherId) {
        const { data: prof } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', otherId)
          .maybeSingle();

        return {
          id: conversationId,
          otherUserId: String(otherId),
          otherUsername: String(prof?.username || prof?.display_name || 'Explorer'),
          otherDisplayName: String(prof?.display_name || prof?.username || 'Explorer'),
          otherAvatarUrl: String(prof?.avatar_url || ''),
          lastMessage: '',
          lastMessageAt: '',
          lastSenderId: '',
          unreadCount: 0,
          hasUnread: false,
          otherLastReadAt: null,
        };
      }
    }
  } catch (err) {
    console.warn('Conversation fallback lookup failed:', err);
  }

  return null;
}

/**
 * Load latest 50 messages (or earlier 50 before a timestamp), returned oldest -> newest.
 */
export async function fetchConversationMessages(params: {
  conversationId: string;
  beforeCreatedAt?: string;
  limit?: number;
}): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { conversationId, beforeCreatedAt, limit = 50 } = params;
  if (!conversationId) return { messages: [], hasMore: false };

  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeCreatedAt) {
      query = query.lt('created_at', beforeCreatedAt);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message || 'Could not load messages.');
    }

    const rows = Array.isArray(data) ? data : [];
    const normalized = rows.map(normalizeChatMessageRow).reverse();

    return {
      messages: normalized,
      hasMore: rows.length >= limit,
    };
  } catch (err: any) {
    console.error('Error fetching messages:', err);
    throw err instanceof Error ? err : new Error('Could not load messages.');
  }
}

/**
 * Insert a new message with sender_id = signed-in user's id.
 */
export async function sendChatMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<ChatMessage> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const cleanBody = params.body.trim();
  if (!cleanBody) {
    throw new Error('Message cannot be empty.');
  }
  if (cleanBody.length > 1000) {
    throw new Error('Message cannot exceed 1000 characters.');
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: params.conversationId,
          sender_id: params.senderId,
          body: cleanBody,
        },
      ])
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Could not send message.');
    }

    return normalizeChatMessageRow(data);
  } catch (err: any) {
    console.error('Error sending message:', err);
    throw err instanceof Error ? err : new Error('Could not send message.');
  }
}

/**
 * Delete own message from messages table.
 */
export async function deleteChatMessage(params: {
  messageId: string;
  senderId: string;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', params.messageId)
      .eq('sender_id', params.senderId);

    if (error) {
      throw new Error(error.message || 'Could not delete message.');
    }
  } catch (err: any) {
    console.error('Error deleting message:', err);
    throw err instanceof Error ? err : new Error('Could not delete message.');
  }
}

/**
 * Mark conversation as read via supabase.rpc('mark_read', { p_conv }).
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  if (!isSupabaseConfigured || !conversationId) return;

  try {
    const { error } = await supabase.rpc('mark_read', {
      p_conv: conversationId,
    });

    if (error) {
      throw new Error(error.message || 'Could not mark messages as read.');
    }
    notifyUnreadChanged();
  } catch (err) {
    console.error('Error calling mark_read:', err);
  }
}

/**
 * Report another user's message (inserts into reports with message_id and reported_user).
 */
export async function reportChatMessage(params: {
  messageId: string;
  reportedUserId: string;
  reporterId: string;
  reason: string;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const cleanReason = params.reason.trim();
  if (!cleanReason) {
    throw new Error('Please choose a reason for reporting.');
  }

  try {
    const { error } = await supabase.from('reports').insert([
      {
        message_id: params.messageId,
        reported_user: params.reportedUserId,
        reporter_id: params.reporterId,
        reason: cleanReason,
      },
    ]);

    if (error) {
      throw new Error(error.message || 'Could not submit report.');
    }
  } catch (err: any) {
    console.error('Error reporting message:', err);
    throw err instanceof Error ? err : new Error('Could not submit report.');
  }
}
