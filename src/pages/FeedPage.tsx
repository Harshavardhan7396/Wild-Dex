import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FindPeopleBox } from '../components/common/FindPeopleBox';
import { CollectionItem, getSupabaseUserCollection } from '../services/supabaseCollectionService';
import {
  AlbumInviteResult,
  SharedAlbumSummary,
  acceptAlbumInvite,
  createAlbumInvite,
  fetchActiveAlbumInvites,
  fetchMyAndSharedAlbums,
  getShareableAppOrigin,
} from '../services/sharedAlbumService';
import {
  COMMUNITY_PAGE_SIZE,
  CommunityPost,
  CommunityTab,
  PostComment,
  PostVisibility,
  StoryCircle,
  addPostComment,
  containsExactCoordinates,
  createCommunityPost,
  deleteCommunityPost,
  deletePostComment,
  fetchCommunityPosts,
  fetchFollowedStories24h,
  fetchFollowingIds,
  fetchPostComments,
  formatRelativeTime,
  reportCommunityPost,
  resolveAreaInfo,
  toggleFollowUser,
  togglePostLike,
} from '../services/communityService';

const REPORT_REASONS = [
  'Spam or misleading',
  'Exact location of sensitive species',
  'Inappropriate or off-topic photo',
  'Harassment or unsafe content',
];

const AvatarBadge: React.FC<{
  avatarUrl?: string;
  name: string;
  sizeClass?: string;
  textClass?: string;
}> = ({ avatarUrl, name, sizeClass = 'w-10 h-10', textClass = 'text-sm' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name.trim().charAt(0) || 'E').toUpperCase();

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 bg-surface-container`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center shrink-0 select-none ${textClass}`}
    >
      {initial}
    </div>
  );
};

export const FeedPage: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading, setAuthModalOpen } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<CommunityTab>('everyone');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [stories, setStories] = useState<StoryCircle[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [areaLabel, setAreaLabel] = useState<string>('');
  const [areaTokens, setAreaTokens] = useState<string[]>([]);
  const [areaResolved, setAreaResolved] = useState<boolean>(false);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Post interactions state
  const [likeBusyIds, setLikeBusyIds] = useState<Record<string, boolean>>({});
  const [followBusyUserIds, setFollowBusyUserIds] = useState<Record<string, boolean>>({});
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [deleteBusyPostId, setDeleteBusyPostId] = useState<string | null>(null);

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentsError, setCommentsError] = useState<Record<string, string | null>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  // Report modal state
  const [reportTargetPost, setReportTargetPost] = useState<CommunityPost | null>(null);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState<string>('');
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Story preview modal state
  const [activeStory, setActiveStory] = useState<StoryCircle | null>(null);

  // Log Scan composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'collection' | 'upload'>('collection');
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string>('');
  const [speciesNameInput, setSpeciesNameInput] = useState('');
  const [scientificNameInput, setScientificNameInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [placeLabelInput, setPlaceLabelInput] = useState('');
  const [visibilityInput, setVisibilityInput] = useState<PostVisibility>('public');
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Invite & Joining Code state
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [ownedAlbums, setOwnedAlbums] = useState<SharedAlbumSummary[]>([]);
  const [selectedInviteAlbumId, setSelectedInviteAlbumId] = useState<string>('');
  const [albumCodeInvite, setAlbumCodeInvite] = useState<AlbumInviteResult | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCreating, setCodeCreating] = useState(false);
  const [joinCodeValue, setJoinCodeValue] = useState('');
  const [joiningAlbum, setJoiningAlbum] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    };
  }, [uploadedPreviewUrl]);

  const hasSavedHomeLocation = Boolean(
    userProfile?.locationConsent &&
      typeof userProfile?.homeLat === 'number' &&
      typeof userProfile?.homeLng === 'number'
  );

  // Resolve user's general saved area tokens (never exact coordinates)
  useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      setAreaLabel('');
      setAreaTokens([]);
      setAreaResolved(true);
      return;
    }

    if (
      userProfile?.locationConsent &&
      typeof userProfile.homeLat === 'number' &&
      typeof userProfile.homeLng === 'number'
    ) {
      setAreaResolved(false);
      resolveAreaInfo(userProfile.homeLat, userProfile.homeLng)
        .then((info) => {
          if (cancelled) return;
          setAreaLabel(info.primaryLabel);
          setAreaTokens(info.tokens);
          setAreaResolved(true);
        })
        .catch(() => {
          if (cancelled) return;
          setAreaLabel('');
          setAreaTokens([]);
          setAreaResolved(true);
        });
    } else {
      setAreaLabel('');
      setAreaTokens([]);
      setAreaResolved(true);
    }

    return () => {
      cancelled = true;
    };
  }, [currentUser, userProfile?.locationConsent, userProfile?.homeLat, userProfile?.homeLng]);

  // Load followed user IDs + 24h story circles
  const refreshFollowsAndStories = useCallback(async () => {
    if (!currentUser) {
      setFollowingIds([]);
      setStories([]);
      return [];
    }
    try {
      const ids = await fetchFollowingIds(currentUser.id);
      setFollowingIds(ids);
      const recentStories = await fetchFollowedStories24h(ids);
      setStories(recentStories);
      return ids;
    } catch (err) {
      console.warn('Could not refresh following/stories:', err);
      return [];
    }
  }, [currentUser]);

  // Load feed posts for the active tab
  const loadFeed = useCallback(
    async (targetPage: number, append: boolean, explicitFollowingIds?: string[]) => {
      if (!currentUser) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setFeedLoading(true);
        setFeedError(null);
      }

      try {
        const activeFollowing = explicitFollowingIds ?? followingIds;
        const { posts: fetchedPosts, hasMore: moreAvailable } = await fetchCommunityPosts({
          tab: activeTab,
          userId: currentUser.id,
          followingIds: activeFollowing,
          areaTokens,
          page: targetPage,
          pageSize: COMMUNITY_PAGE_SIZE,
        });

        setPosts((prev) => {
          if (!append) return fetchedPosts;
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNext = fetchedPosts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNext];
        });
        setPage(targetPage);
        setHasMore(moreAvailable);
      } catch (err: any) {
        console.error('Community feed load error:', err);
        setFeedError(err?.message || 'Could not load community posts. Please try again.');
      } finally {
        setFeedLoading(false);
        setLoadingMore(false);
      }
    },
    [currentUser, activeTab, followingIds, areaTokens]
  );

  // Initial load & tab switches
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setPosts([]);
      setStories([]);
      setFollowingIds([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const ids = await refreshFollowsAndStories();
        if (cancelled) return;
        if (activeTab === 'nearby' && hasSavedHomeLocation && !areaResolved) {
          return;
        }
        await loadFeed(0, false, ids);
      } catch (err: any) {
        if (!cancelled) {
          setFeedError(err?.message || 'Could not load community feed.');
          setFeedLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    currentUser?.id,
    activeTab,
    areaResolved,
    hasSavedHomeLocation,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    areaTokens.join('|'),
  ]);

  const handleRetryFeed = async () => {
    try {
      const ids = await refreshFollowsAndStories();
      await loadFeed(0, false, ids);
    } catch (err: any) {
      setFeedError(err?.message || 'Could not reload community feed.');
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    await loadFeed(page + 1, true);
  };

  const copyShareText = async (text: string, successMessage: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        showToast(successMessage);
        return true;
      }
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      if (ok) showToast(successMessage);
      return ok;
    } catch {
      return false;
    }
  };

  const loadAlbumInviteCode = useCallback(
    async (albumId: string) => {
      if (!currentUser || !albumId) return;
      setCodeLoading(true);
      try {
        const active = await fetchActiveAlbumInvites(albumId);
        let latest = active[0] || null;
        if (!latest) {
          latest = await createAlbumInvite({
            albumId,
            userId: currentUser.id,
            role: 'editor',
          });
        }
        setAlbumCodeInvite(latest);
      } catch {
        setAlbumCodeInvite(null);
      } finally {
        setCodeLoading(false);
      }
    },
    [currentUser]
  );

  const openInviteAndCodePanel = useCallback(
    async (toggleIfOpen = true) => {
      if (toggleIfOpen && invitePanelOpen) {
        setInvitePanelOpen(false);
        return;
      }
      setInvitePanelOpen(true);
      setJoinCodeError(null);
      if (!currentUser) return;

      setCodeLoading(true);
      try {
        const albums = await fetchMyAndSharedAlbums(currentUser.id);
        const mine = albums.filter((a) => a.myRole === 'owner');
        setOwnedAlbums(mine);
        if (mine.length > 0) {
          const targetId =
            selectedInviteAlbumId && mine.some((a) => a.id === selectedInviteAlbumId)
              ? selectedInviteAlbumId
              : mine[0].id;
          setSelectedInviteAlbumId(targetId);
          await loadAlbumInviteCode(targetId);
        } else {
          setSelectedInviteAlbumId('');
          setAlbumCodeInvite(null);
        }
      } catch {
        setCodeLoading(false);
      }
    },
    [currentUser, invitePanelOpen, selectedInviteAlbumId, loadAlbumInviteCode]
  );

  const handleGenerateNewFeedCode = async () => {
    if (!currentUser || !selectedInviteAlbumId || codeCreating) return;
    setCodeCreating(true);
    try {
      const created = await createAlbumInvite({
        albumId: selectedInviteAlbumId,
        userId: currentUser.id,
        role: 'editor',
      });
      setAlbumCodeInvite(created);
      showToast('New joining code created!');
    } catch (err: any) {
      showToast(err?.message || 'Could not create joining code.');
    } finally {
      setCodeCreating(false);
    }
  };

  const handleJoinAlbumByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const raw = joinCodeValue.trim();
    const urlMatch = raw.match(/\/join\/([^/?#]+)/i);
    const cleanCode = decodeURIComponent((urlMatch?.[1] || raw).trim());
    if (!cleanCode) {
      setJoinCodeError('Please enter a joining code or invite link.');
      return;
    }

    setJoiningAlbum(true);
    setJoinCodeError(null);
    try {
      const albumId = await acceptAlbumInvite(cleanCode);
      setJoinCodeValue('');
      showToast('Joined shared album!');
      navigate(`/shared-collection/${albumId}`);
    } catch (err: any) {
      setJoinCodeError(err?.message || 'This invite is not valid or has expired');
    } finally {
      setJoiningAlbum(false);
    }
  };

  // Invite button: Shareable origin + Web Share API
  const handleInviteShare = async (customUrl?: string) => {
    const shareUrl = customUrl || getShareableAppOrigin();
    const shareTitle = 'Join me on WildDex';
    const shareText = 'Discover and share wildlife sightings with me on WildDex!';

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        await copyShareText(shareUrl, 'Invite shared & link copied!');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          await copyShareText(shareUrl, 'Invite link copied!');
          return;
        }
      }
    }

    const copied = await copyShareText(shareUrl, 'Invite link copied to clipboard!');
    if (!copied) showToast(`Share this link: ${shareUrl}`);
  };

  // Composer: open & load user's collection items
  const openComposer = async () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    setComposerOpen(true);
    setComposerError(null);
    setCaptionInput('');
    setVisibilityInput('public');
    setPlaceLabelInput((prev) => prev || areaLabel || '');

    setCollectionLoading(true);
    setCollectionError(null);
    try {
      const items = await getSupabaseUserCollection(currentUser.id);
      setCollectionItems(items);
      if (items.length > 0) {
        setComposerMode('collection');
        setSelectedCollectionId(items[0].id);
        setSpeciesNameInput(items[0].commonName);
        setScientificNameInput(items[0].scientificName);
      } else {
        setComposerMode('upload');
        setSelectedCollectionId('');
        setSpeciesNameInput('');
        setScientificNameInput('');
      }
    } catch (err: any) {
      console.error('Could not load collection items for composer:', err);
      setCollectionError(err?.message || 'Could not load your collection items.');
      setComposerMode('upload');
    } finally {
      setCollectionLoading(false);
    }
  };

  const closeComposer = () => {
    if (composerSubmitting) return;
    setComposerOpen(false);
    setComposerError(null);
    setUploadedFile(null);
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
      setUploadedPreviewUrl('');
    }
  };

  const selectedCollectionItem = useMemo(
    () => collectionItems.find((item) => item.id === selectedCollectionId) || null,
    [collectionItems, selectedCollectionId]
  );

  const handleSelectCollectionItem = (item: CollectionItem) => {
    setSelectedCollectionId(item.id);
    setSpeciesNameInput(item.commonName);
    setScientificNameInput(item.scientificName);
    setComposerError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setComposerError('Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedFile(file);
    setUploadedPreviewUrl(URL.createObjectURL(file));
    setComposerError(null);
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    setComposerError(null);

    const photoSource: File | string | null =
      composerMode === 'collection'
        ? selectedCollectionItem?.photoUrl || null
        : uploadedFile;

    if (!photoSource) {
      setComposerError(
        composerMode === 'collection'
          ? 'Please pick one of your collection items or upload a photo.'
          : 'Please upload a photo to share.'
      );
      return;
    }

    if (!speciesNameInput.trim()) {
      setComposerError('Please enter the species or animal name.');
      return;
    }

    if (!captionInput.trim()) {
      setComposerError('Please add a short caption about what you spotted.');
      return;
    }

    if (captionInput.trim().length > 500) {
      setComposerError('Caption must be 500 characters or fewer.');
      return;
    }

    if (containsExactCoordinates(placeLabelInput)) {
      setComposerError(
        'Please use a general place name (like a city or park) instead of exact coordinates.'
      );
      return;
    }

    setComposerSubmitting(true);
    try {
      const createdPost = await createCommunityPost({
        userId: currentUser.id,
        collectionItemId: composerMode === 'collection' ? selectedCollectionItem?.id || null : null,
        speciesName: speciesNameInput.trim(),
        scientificName: scientificNameInput.trim(),
        caption: captionInput.trim(),
        placeLabel: placeLabelInput.trim(),
        photoSource,
        visibility: visibilityInput,
      });

      setComposerOpen(false);
      setUploadedFile(null);
      if (uploadedPreviewUrl) {
        URL.revokeObjectURL(uploadedPreviewUrl);
        setUploadedPreviewUrl('');
      }
      setCaptionInput('');
      setSpeciesNameInput('');
      setScientificNameInput('');

      // Prepend if compatible with current tab, or switch to Everyone/My Circle appropriately
      const matchesNearby =
        activeTab === 'nearby' &&
        createdPost.visibility === 'public' &&
        areaTokens.some((token) =>
          createdPost.placeLabel.toLowerCase().includes(token.toLowerCase())
        );

      if (
        activeTab === 'circle' ||
        (activeTab === 'everyone' && createdPost.visibility === 'public') ||
        matchesNearby
      ) {
        setPosts((prev) => [createdPost, ...prev]);
      } else {
        setActiveTab(createdPost.visibility === 'followers' ? 'circle' : 'everyone');
      }

      showToast('Discovery shared with the community!');
    } catch (err: any) {
      console.error('Publish post error:', err);
      setComposerError(err?.message || 'Could not publish your post. Please try again.');
    } finally {
      setComposerSubmitting(false);
    }
  };

  // Like toggle
  const handleToggleLike = async (post: CommunityPost) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (likeBusyIds[post.id]) return;

    const prevLiked = post.isLiked;
    const prevCount = post.likesCount;

    setLikeBusyIds((prev) => ({ ...prev, [post.id]: true }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              isLiked: !prevLiked,
              likesCount: prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
            }
          : p
      )
    );

    try {
      await togglePostLike({
        postId: post.id,
        userId: currentUser.id,
        currentlyLiked: prevLiked,
      });
    } catch (err: any) {
      // Revert optimistic update on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, isLiked: prevLiked, likesCount: prevCount } : p
        )
      );
      showToast(err?.message || 'Could not update like.');
    } finally {
      setLikeBusyIds((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  // Follow / Unfollow author
  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (targetUserId === currentUser.id || followBusyUserIds[targetUserId]) return;

    const currentlyFollowing = followingIds.includes(targetUserId);
    setFollowBusyUserIds((prev) => ({ ...prev, [targetUserId]: true }));

    try {
      const nowFollowing = await toggleFollowUser({
        followerId: currentUser.id,
        followingId: targetUserId,
        currentlyFollowing,
      });

      const nextFollowingIds = nowFollowing
        ? Array.from(new Set([...followingIds, targetUserId]))
        : followingIds.filter((id) => id !== targetUserId);

      setFollowingIds(nextFollowingIds);
      const updatedStories = await fetchFollowedStories24h(nextFollowingIds);
      setStories(updatedStories);

      if (activeTab === 'circle' && !nowFollowing) {
        setPosts((prev) =>
          prev.filter((p) => p.userId !== targetUserId || p.userId === currentUser.id)
        );
      }

      showToast(nowFollowing ? 'Following user' : 'Unfollowed user');
    } catch (err: any) {
      showToast(err?.message || 'Could not update follow status.');
    } finally {
      setFollowBusyUserIds((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Expand / load comments
  const handleToggleComments = async (postId: string) => {
    const nextOpen = !expandedComments[postId];
    setExpandedComments((prev) => ({ ...prev, [postId]: nextOpen }));

    if (!nextOpen) return;

    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    setCommentsError((prev) => ({ ...prev, [postId]: null }));

    try {
      const list = await fetchPostComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: list }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsCount: list.length } : p))
      );
    } catch (err: any) {
      setCommentsError((prev) => ({
        ...prev,
        [postId]: err?.message || 'Could not load comments.',
      }));
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleSubmitComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft) return;

    setCommentSubmitting((prev) => ({ ...prev, [postId]: true }));
    setCommentsError((prev) => ({ ...prev, [postId]: null }));

    try {
      const created = await addPostComment({
        postId,
        userId: currentUser.id,
        body: draft,
        fallbackAuthor: {
          id: currentUser.id,
          username: userProfile?.displayName || currentUser.displayName || 'Explorer',
          displayName: userProfile?.displayName || currentUser.displayName || 'Explorer',
          avatarUrl: userProfile?.photoURL || currentUser.photoURL || '',
        },
      });

      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), created],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
      );
    } catch (err: any) {
      setCommentsError((prev) => ({
        ...prev,
        [postId]: err?.message || 'Could not post comment.',
      }));
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!currentUser) return;
    try {
      await deletePostComment({ commentId, userId: currentUser.id });
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
        )
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not delete comment.');
    }
  };

  // Delete own post
  const handleConfirmDeletePost = async (post: CommunityPost) => {
    if (!currentUser || post.userId !== currentUser.id) return;
    setDeleteBusyPostId(post.id);
    try {
      await deleteCommunityPost({
        userId: currentUser.id,
        postId: post.id,
        photoPath: post.photoPath,
      });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setConfirmDeletePostId(null);
      showToast('Post deleted.');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete post.');
    } finally {
      setDeleteBusyPostId(null);
    }
  };

  // Report post
  const openReportModal = (post: CommunityPost) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setReportTargetPost(post);
    setReportReason(REPORT_REASONS[0]);
    setReportNote('');
    setReportError(null);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reportTargetPost) return;

    setReportSubmitting(true);
    setReportError(null);
    const fullReason = reportNote.trim()
      ? `${reportReason}: ${reportNote.trim()}`
      : reportReason;

    try {
      await reportCommunityPost({
        postId: reportTargetPost.id,
        reporterId: currentUser.id,
        reason: fullReason,
      });
      setReportTargetPost(null);
      setReportNote('');
      showToast('Report submitted. Thank you for helping keep WildDex safe.');
    } catch (err: any) {
      setReportError(err?.message || 'Could not submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  // Auth guard view
  if (!authLoading && !currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin py-8">
        <div className="max-w-lg mx-auto w-full rounded-2xl bg-surface-container-low border border-outline-variant/25 p-6 text-center shadow-sm flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            Community Feed
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sign in to see wildlife discoveries from explorers, follow naturalists, and share your own sightings.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="mt-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 max-w-[90vw]">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
            check_circle
          </span>
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Header Bar */}
      <section className="px-3 sm:px-margin pt-space-sm pb-space-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Community</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Real sightings shared by explorers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openComposer}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold active:scale-95 transition-transform shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
            <span>Log Scan</span>
          </button>
          <button
            type="button"
            onClick={() => openInviteAndCodePanel(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold active:scale-95 transition-transform shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Invite</span>
          </button>
          <button
            type="button"
            onClick={() => openInviteAndCodePanel(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-container/30 text-primary font-label-md text-label-md font-semibold active:scale-95 transition-transform shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            <span>Code</span>
          </button>
        </div>
      </section>

      {/* Find People Search Box */}
      <section className="px-3 sm:px-margin pb-2">
        <FindPeopleBox />
      </section>

      {/* Separate Invite & Joining Code Sections */}
      {invitePanelOpen && (
        <section className="px-3 sm:px-margin pb-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Invite Section */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[20px] text-secondary">
                      person_add
                    </span>
                    <span>Invite Link</span>
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    {albumCodeInvite
                      ? 'Share this album invite link with friends.'
                      : 'Invite friends to explore sightings with you on WildDex.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvitePanelOpen(false)}
                  aria-label="Close invite and code panel"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="px-3 py-2 rounded-xl bg-surface-container text-on-surface font-mono text-xs break-all select-all">
                {albumCodeInvite ? albumCodeInvite.inviteUrl : getShareableAppOrigin()}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyShareText(
                      albumCodeInvite ? albumCodeInvite.inviteUrl : getShareableAppOrigin(),
                      'Invite link copied!'
                    )
                  }
                  className="flex-1 min-h-[38px] px-3 rounded-full bg-surface-container-high text-on-surface font-label-sm font-semibold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  <span>Copy Link</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleInviteShare(
                      albumCodeInvite ? albumCodeInvite.inviteUrl : getShareableAppOrigin()
                    )
                  }
                  className="flex-1 min-h-[38px] px-3 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-semibold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">share</span>
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Separate Joining Code Section (beside Invite) */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[20px] text-primary">key</span>
                    <span>Joining Code</span>
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Share a code for your shared album or enter a friend&apos;s code to join.
                  </p>
                </div>
                {albumCodeInvite && (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-[11px] font-bold shrink-0">
                    {albumCodeInvite.role === 'editor' ? 'Editor' : 'Viewer'}
                  </span>
                )}
              </div>

              {ownedAlbums.length > 0 ? (
                <div className="space-y-2">
                  {ownedAlbums.length > 1 && (
                    <select
                      value={selectedInviteAlbumId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedInviteAlbumId(nextId);
                        loadAlbumInviteCode(nextId);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm border border-outline-variant/25 focus:outline-none focus:border-primary"
                    >
                      {ownedAlbums.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {codeLoading ? (
                    <div className="h-11 rounded-xl bg-surface-container animate-pulse" />
                  ) : albumCodeInvite ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-surface-container">
                      <span className="font-mono text-base font-bold tracking-wider text-on-surface select-all">
                        {albumCodeInvite.code}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            copyShareText(albumCodeInvite.code, 'Joining code copied!')
                          }
                          className="px-3 min-h-[34px] rounded-full bg-primary text-on-primary font-label-sm font-semibold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            content_copy
                          </span>
                          <span>Copy Code</span>
                        </button>
                        <button
                          type="button"
                          disabled={codeCreating}
                          onClick={handleGenerateNewFeedCode}
                          className="px-2.5 min-h-[34px] rounded-full bg-surface-container-high text-on-surface font-label-sm font-semibold disabled:opacity-60"
                        >
                          {codeCreating ? '...' : 'New'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={codeCreating}
                      onClick={handleGenerateNewFeedCode}
                      className="w-full min-h-[38px] px-3 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
                    >
                      Get Joining Code
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-container/60">
                  <span className="font-body-sm text-xs text-on-surface-variant">
                    Create a shared album to get your own joining code.
                  </span>
                  <Link
                    to="/shared-collection"
                    className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-xs font-semibold shrink-0"
                  >
                    Create Album
                  </Link>
                </div>
              )}

              {/* Join with a friend's code */}
              <form
                onSubmit={handleJoinAlbumByCode}
                className="pt-2 border-t border-outline-variant/20 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={joinCodeValue}
                    onChange={(e) => setJoinCodeValue(e.target.value)}
                    placeholder="Enter friend's joining code..."
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant/30 font-body-sm text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={joiningAlbum}
                    className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold shrink-0 disabled:opacity-60"
                  >
                    {joiningAlbum ? 'Joining...' : 'Join'}
                  </button>
                </div>
                {joinCodeError && (
                  <p className="font-body-sm text-xs text-error px-1">{joinCodeError}</p>
                )}
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Top Story Circles (ONLY people followed who posted in the last 24h; hidden if none) */}
      {stories.length > 0 && (
        <section className="py-space-sm border-b border-outline-variant/20">
          <div className="flex items-center gap-3 overflow-x-auto px-3 sm:px-margin no-scrollbar py-1">
            {stories.map((story) => (
              <div
                key={story.userId}
                className="flex flex-col items-center gap-1 shrink-0 group"
              >
                <button
                  type="button"
                  onClick={() => setActiveStory(story)}
                  aria-label={`View ${story.username}'s story`}
                  className="relative p-0.5 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-surface"
                >
                  <AvatarBadge
                    avatarUrl={story.avatarUrl}
                    name={story.displayName}
                    sizeClass="w-13 h-13"
                    textClass="text-base"
                  />
                </button>
                <Link
                  to={`/u/${encodeURIComponent(story.username)}`}
                  className="font-label-sm text-[11px] text-on-surface hover:text-primary truncate max-w-[68px] transition-colors"
                >
                  {story.username}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tabs: My Circle | Nearby | Everyone */}
      <section className="px-3 sm:px-margin pt-3">
        <div className="flex flex-wrap sm:flex-nowrap bg-surface-container-low p-1 rounded-2xl sm:rounded-full gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('circle')}
            className={`flex-1 min-w-[95px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
              activeTab === 'circle'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            My Circle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nearby')}
            className={`flex-1 min-w-[95px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
              activeTab === 'nearby'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Nearby
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('everyone')}
            className={`flex-1 min-w-[95px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
              activeTab === 'everyone'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Everyone
          </button>
        </div>

        {activeTab === 'nearby' && areaLabel && (
          <p className="mt-2 px-1 font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-secondary">pin_drop</span>
            <span>Showing public discoveries near {areaLabel}</span>
          </p>
        )}
      </section>

      {/* Feed Content */}
      <section className="px-3 sm:px-margin pt-space-sm flex flex-col gap-space-md">
        {/* Loading Skeletons */}
        {(authLoading || feedLoading) && (
          <div className="flex flex-col gap-4" aria-label="Loading community posts">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 flex flex-col gap-3 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-surface-container-high" />
                    <div className="h-3 w-44 rounded bg-surface-container-high" />
                  </div>
                </div>
                <div className="w-full aspect-[4/3] rounded-xl bg-surface-container-high" />
                <div className="h-4 w-48 rounded bg-surface-container-high" />
                <div className="h-3.5 w-full rounded bg-surface-container-high" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!authLoading && !feedLoading && feedError && (
          <div className="p-6 rounded-2xl bg-error-container/30 border border-error/30 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[32px] text-error">error_outline</span>
            <p className="font-body-md text-body-md text-on-surface font-medium">{feedError}</p>
            <button
              type="button"
              onClick={handleRetryFeed}
              className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Nearby missing saved location notice */}
        {!authLoading &&
          !feedLoading &&
          !feedError &&
          activeTab === 'nearby' &&
          areaResolved &&
          areaTokens.length === 0 && (
            <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[32px] text-primary">
                location_searching
              </span>
              <p className="font-body-md text-body-md text-on-surface font-medium">
                No saved home area yet
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Add your general area in preferences to see public sightings near you. Your exact spot is never shown publicly.
              </p>
              <Link
                to="/onboarding?edit=1"
                className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
              >
                Set My Area
              </Link>
            </div>
          )}

        {/* Empty State */}
        {!authLoading &&
          !feedLoading &&
          !feedError &&
          posts.length === 0 &&
          !(activeTab === 'nearby' && areaResolved && areaTokens.length === 0) && (
            <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-primary">
                explore
              </span>
              <p className="font-body-md text-body-md text-on-surface font-semibold">
                No posts yet. Be the first to share a discovery!
              </p>
              <button
                type="button"
                onClick={openComposer}
                className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm active:scale-95 transition-transform"
              >
                Log Scan
              </button>
            </div>
          )}

        {/* Real Posts List */}
        {!authLoading &&
          !feedLoading &&
          !feedError &&
          posts.map((post) => {
            const isOwnPost = currentUser?.id === post.userId;
            const isFollowingAuthor = followingIds.includes(post.userId);
            const commentsOpen = Boolean(expandedComments[post.id]);
            const postComments = commentsByPost[post.id] || [];

            return (
              <article
                key={post.id}
                className="p-3 sm:p-space-md rounded-2xl bg-surface-container-low border border-outline-variant/15 shadow-sm flex flex-col gap-3"
              >
                {/* Author Header */}
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Link
                      to={`/u/${encodeURIComponent(post.author.username)}`}
                      className="shrink-0"
                    >
                      <AvatarBadge
                        avatarUrl={post.author.avatarUrl}
                        name={post.author.displayName}
                        sizeClass="w-10 h-10"
                        textClass="text-sm"
                      />
                    </Link>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={`/u/${encodeURIComponent(post.author.username)}`}
                          className="font-headline-sm text-headline-sm text-on-surface hover:text-primary font-semibold leading-snug truncate transition-colors"
                        >
                          {post.author.username}
                        </Link>
                        {post.visibility === 'followers' && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-semibold">
                            Followers only
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                        {post.placeLabel && (
                          <>
                            <span className="material-symbols-outlined text-[13px] text-secondary">
                              pin_drop
                            </span>
                            <span className="truncate max-w-[180px] sm:max-w-[260px]">
                              {post.placeLabel}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatRelativeTime(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Follow / Delete / Report actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isOwnPost && (
                      <button
                        type="button"
                        disabled={Boolean(followBusyUserIds[post.userId])}
                        onClick={() => handleToggleFollow(post.userId)}
                        className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-colors ${
                          isFollowingAuthor
                            ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                            : 'bg-secondary-container text-on-secondary-container hover:opacity-90'
                        } disabled:opacity-60`}
                      >
                        {followBusyUserIds[post.userId]
                          ? '...'
                          : isFollowingAuthor
                          ? 'Following'
                          : 'Follow'}
                      </button>
                    )}

                    {isOwnPost ? (
                      <button
                        type="button"
                        aria-label="Delete post"
                        onClick={() =>
                          setConfirmDeletePostId((prev) => (prev === post.id ? null : post.id))
                        }
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[19px]">delete</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Report post"
                        onClick={() => openReportModal(post)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[19px]">flag</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Delete Confirmation */}
                {confirmDeletePostId === post.id && (
                  <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-body-sm text-body-sm text-on-surface font-medium">
                      Delete this post permanently?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePostId(null)}
                        className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deleteBusyPostId === post.id}
                        onClick={() => handleConfirmDeletePost(post)}
                        className="px-3 py-1 rounded-full bg-error text-on-error font-label-sm font-semibold disabled:opacity-60"
                      >
                        {deleteBusyPostId === post.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sighting Photo */}
                {post.photoUrl && (
                  <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container">
                    <img
                      alt={post.speciesName}
                      src={post.photoUrl}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Species Name & Caption */}
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {post.speciesName}
                    </h2>
                    {post.scientificName && (
                      <span className="font-body-sm text-body-sm text-on-surface-variant italic">
                        {post.scientificName}
                      </span>
                    )}
                  </div>
                  <p className="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap break-words">
                    {post.caption}
                  </p>
                </div>

                {/* Like & Comments Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(likeBusyIds[post.id])}
                      onClick={() => handleToggleLike(post)}
                      className={`h-9 px-3 rounded-full flex items-center gap-1.5 font-label-sm text-label-sm active:scale-95 transition-transform ${
                        post.isLiked
                          ? 'bg-secondary-container text-on-secondary-container font-bold'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {post.isLiked ? 'favorite' : 'favorite_border'}
                      </span>
                      <span>{post.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleComments(post.id)}
                      className={`h-9 px-3 rounded-full flex items-center gap-1.5 font-label-sm text-label-sm active:scale-95 transition-transform ${
                        commentsOpen
                          ? 'bg-primary-container text-on-primary-container font-semibold'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        chat_bubble_outline
                      </span>
                      <span>{post.commentsCount}</span>
                    </button>
                  </div>

                  {!isOwnPost && (
                    <button
                      type="button"
                      onClick={() => openReportModal(post)}
                      className="text-on-surface-variant hover:text-error font-label-sm text-label-sm px-2 py-1 rounded-full"
                    >
                      Report
                    </button>
                  )}
                </div>

                {/* Expandable Comments Section */}
                {commentsOpen && (
                  <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-3">
                    {commentsLoading[post.id] ? (
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Loading comments...
                      </p>
                    ) : commentsError[post.id] ? (
                      <p className="font-body-sm text-body-sm text-error">
                        {commentsError[post.id]}
                      </p>
                    ) : postComments.length === 0 ? (
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        No comments yet. Start the conversation!
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {postComments.map((comment) => {
                          const isOwnComment = currentUser?.id === comment.userId;
                          return (
                            <li
                              key={comment.id}
                              className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-container"
                            >
                              <Link
                                to={`/u/${encodeURIComponent(comment.author.username)}`}
                                className="shrink-0"
                              >
                                <AvatarBadge
                                  avatarUrl={comment.author.avatarUrl}
                                  name={comment.author.displayName}
                                  sizeClass="w-7 h-7"
                                  textClass="text-xs"
                                />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <Link
                                    to={`/u/${encodeURIComponent(comment.author.username)}`}
                                    className="font-label-md text-label-md font-semibold text-on-surface hover:text-primary truncate transition-colors"
                                  >
                                    {comment.author.username}
                                  </Link>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-label-sm text-[11px] text-on-surface-variant">
                                      {formatRelativeTime(comment.createdAt)}
                                    </span>
                                    {isOwnComment && (
                                      <button
                                        type="button"
                                        aria-label="Delete comment"
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="text-on-surface-variant hover:text-error"
                                      >
                                        <span className="material-symbols-outlined text-[15px]">
                                          close
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="font-body-sm text-body-sm text-on-surface mt-0.5 break-words">
                                  {comment.body}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Add Comment Form */}
                    <form
                      onSubmit={(e) => handleSubmitComment(post.id, e)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        maxLength={500}
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        placeholder="Write a comment..."
                        className="flex-1 min-w-0 px-3.5 py-2 rounded-full bg-surface-container text-on-surface placeholder:text-on-surface-variant/70 font-body-sm text-body-sm border border-outline-variant/30 focus:outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        disabled={
                          Boolean(commentSubmitting[post.id]) ||
                          !(commentDrafts[post.id] || '').trim()
                        }
                        className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm font-semibold disabled:opacity-50 shrink-0"
                      >
                        {commentSubmitting[post.id] ? '...' : 'Post'}
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}

        {/* Load More Pagination */}
        {!authLoading && !feedLoading && !feedError && hasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="px-6 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-md font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              {loadingMore ? 'Loading more...' : 'Load more'}
            </button>
          </div>
        )}
      </section>

      {/* Log Scan Composer Modal */}
      {composerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Log Scan to Community"
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-4 sm:p-6 shadow-2xl border border-outline-variant/25 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                Share a Discovery
              </h2>
              <button
                type="button"
                onClick={closeComposer}
                aria-label="Close composer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Source Mode Switch */}
            <div className="flex bg-surface-container-low p-1 rounded-full gap-1">
              <button
                type="button"
                onClick={() => {
                  setComposerMode('collection');
                  if (selectedCollectionItem) {
                    setSpeciesNameInput(selectedCollectionItem.commonName);
                    setScientificNameInput(selectedCollectionItem.scientificName);
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                  composerMode === 'collection'
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                From My Collection
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('upload')}
                className={`flex-1 py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                  composerMode === 'upload'
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Upload Photo
              </button>
            </div>

            <form onSubmit={handlePublishPost} className="flex flex-col gap-3.5">
              {composerMode === 'collection' ? (
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">
                    Pick a saved discovery
                  </label>
                  {collectionLoading ? (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Loading your collection...
                    </p>
                  ) : collectionError ? (
                    <p className="font-body-sm text-body-sm text-error">{collectionError}</p>
                  ) : collectionItems.length === 0 ? (
                    <div className="p-3 rounded-xl bg-surface-container text-body-sm text-on-surface-variant flex items-center justify-between gap-2">
                      <span>No saved items in your collection yet.</span>
                      <button
                        type="button"
                        onClick={() => setComposerMode('upload')}
                        className="text-primary font-semibold shrink-0"
                      >
                        Upload photo instead
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {collectionItems.map((item) => {
                        const isSelected = item.id === selectedCollectionId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectCollectionItem(item)}
                            className={`text-left rounded-xl overflow-hidden border transition-all ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary/40 bg-primary-container/20'
                                : 'border-outline-variant/25 bg-surface-container-low hover:border-primary/50'
                            }`}
                          >
                            <div className="aspect-[4/3] w-full bg-surface-container overflow-hidden">
                              <img
                                src={item.photoUrl}
                                alt={item.commonName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="px-2 py-1.5 font-label-sm text-[11px] font-semibold text-on-surface truncate">
                              {item.commonName}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">
                    Photo (resized to 1280px max)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {uploadedPreviewUrl ? (
                    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container">
                      <img
                        src={uploadedPreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-surface/90 text-on-surface font-label-sm font-semibold shadow-sm"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary bg-surface-container-low flex flex-col items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[28px]">add_photo_alternate</span>
                      <span className="font-label-md text-label-md font-semibold">
                        Choose a photo from device
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Species Name */}
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface font-semibold">
                  Species or animal name
                </label>
                <input
                  type="text"
                  required
                  value={speciesNameInput}
                  onChange={(e) => setSpeciesNameInput(e.target.value)}
                  placeholder="e.g. Red Fox, Monarch Butterfly, Coast Redwood"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 font-body-md text-body-md focus:outline-none focus:border-primary"
                />
              </div>

              {/* Caption */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-on-surface font-semibold">
                    Caption
                  </label>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {captionInput.length}/500
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  required
                  value={captionInput}
                  onChange={(e) => setCaptionInput(e.target.value)}
                  placeholder="What did you notice?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 font-body-md text-body-md focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* General Place Name */}
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface font-semibold">
                  General place name
                </label>
                <input
                  type="text"
                  value={placeLabelInput}
                  onChange={(e) => setPlaceLabelInput(e.target.value)}
                  placeholder="e.g. Portland, OR or Local River Trail"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 font-body-md text-body-md focus:outline-none focus:border-primary"
                />
                <span className="font-label-sm text-[11px] text-on-surface-variant">
                  Use a city, park, or general area — never exact coordinates.
                </span>
              </div>

              {/* Visibility */}
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface font-semibold">
                  Who can see this?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibilityInput('public')}
                    className={`flex-1 py-2 px-3 rounded-xl border font-label-md text-label-md font-semibold transition-all ${
                      visibilityInput === 'public'
                        ? 'border-primary bg-primary-container/30 text-primary'
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityInput('followers')}
                    className={`flex-1 py-2 px-3 rounded-xl border font-label-md text-label-md font-semibold transition-all ${
                      visibilityInput === 'followers'
                        ? 'border-primary bg-primary-container/30 text-primary'
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    Followers only
                  </button>
                </div>
              </div>

              {composerError && (
                <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-error font-body-sm text-body-sm">
                  {composerError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeComposer}
                  disabled={composerSubmitting}
                  className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composerSubmitting}
                  className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm disabled:opacity-60"
                >
                  {composerSubmitting ? 'Sharing...' : 'Share Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTargetPost && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report Post"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl border border-outline-variant/25 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Report Post
              </h2>
              <button
                type="button"
                onClick={() => setReportTargetPost(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Help keep WildDex helpful and safe. Why are you reporting this post?
            </p>
            <form onSubmit={handleSubmitReport} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer ${
                      reportReason === reason
                        ? 'border-primary bg-primary-container/20'
                        : 'border-outline-variant/25 bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                      className="accent-primary"
                    />
                    <span className="font-body-sm text-body-sm text-on-surface">{reason}</span>
                  </label>
                ))}
              </div>

              <textarea
                rows={2}
                maxLength={250}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Optional extra details..."
                className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 font-body-sm text-body-sm resize-none focus:outline-none focus:border-primary"
              />

              {reportError && (
                <p className="font-body-sm text-body-sm text-error">{reportError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTargetPost(null)}
                  className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="px-5 py-2 rounded-full bg-error text-on-error font-label-md font-semibold disabled:opacity-60"
                >
                  {reportSubmitting ? 'Sending...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Story Circle Preview Modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Recent Discovery Story"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface overflow-hidden shadow-2xl border border-outline-variant/25 flex flex-col">
            <div className="p-3.5 flex items-center justify-between gap-2 border-b border-outline-variant/20">
              <Link
                to={`/u/${encodeURIComponent(activeStory.username)}`}
                onClick={() => setActiveStory(null)}
                className="flex items-center gap-2.5 min-w-0 group"
              >
                <AvatarBadge
                  avatarUrl={activeStory.avatarUrl}
                  name={activeStory.displayName}
                  sizeClass="w-9 h-9"
                />
                <div className="min-w-0">
                  <p className="font-label-md font-bold text-on-surface group-hover:text-primary truncate transition-colors">
                    {activeStory.username}
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {activeStory.latestPlaceLabel
                      ? `${activeStory.latestPlaceLabel} • `
                      : ''}
                    {formatRelativeTime(activeStory.latestCreatedAt)}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setActiveStory(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {activeStory.latestPhotoUrl && (
              <div className="aspect-[4/3] w-full bg-surface-container overflow-hidden">
                <img
                  src={activeStory.latestPhotoUrl}
                  alt={activeStory.latestSpeciesName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-4 flex flex-col gap-1">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                {activeStory.latestSpeciesName}
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {activeStory.latestCaption}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
