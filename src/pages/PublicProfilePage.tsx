import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FollowListKind,
  PublicProfileData,
  PublicUserPost,
  PublicCollectionItem,
  UserRelationship,
  getProfileByUsername,
  fetchPublicUserPosts,
  fetchPublicUserCollection,
  fetchIsFollowingUser,
  fetchRelationship,
  toggleFollowUser,
  blockUser,
  reportUser,
} from '../services/publicProfileService';
import {
  FollowListSheet,
  FollowCountsDelta,
} from '../components/profile/FollowListSheet';
import { startConversation } from '../services/chatService';
import {
  AskQuestion,
  ProfileAskAnswer,
  fetchHelperCount,
  listAnswersByAuthor,
  listQuestionsByAuthor,
} from '../services/askService';
import {
  ProfileAnswersTab,
  ProfileQuestionsTab,
} from '../components/ask/ProfileAskTabs';

const REPORT_REASONS = [
  'Spam or misleading sightings',
  'Harassment or inappropriate behavior',
  'Impersonation',
  'Inappropriate content or photos',
];

function formatRelativeDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString();
}

export const PublicProfilePage: React.FC = () => {
  const { username = '' } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { currentUser, setAuthModalOpen } = useAuth();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [relationship, setRelationship] = useState<UserRelationship>({
    iFollow: false,
    followsMe: false,
    isBlocked: false,
  });
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'posts' | 'collection' | 'questions' | 'answers'>('posts');

  const [posts, setPosts] = useState<PublicUserPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [collectionItems, setCollectionItems] = useState<PublicCollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const [helperCount, setHelperCount] = useState<number>(0);
  const [userQuestions, setUserQuestions] = useState<AskQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const [userAnswers, setUserAnswers] = useState<ProfileAskAnswer[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);

  // Follow sheet state
  const [followSheetOpen, setFollowSheetOpen] = useState(false);
  const [followSheetTab, setFollowSheetTab] = useState<FollowListKind>('followers');

  // More menu (⋯), Block, Report, and Message dialogs
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNotes, setReportNotes] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportModalError, setReportModalError] = useState<string | null>(null);

  const [messageBusy, setMessageBusy] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const isOwnProfile = Boolean(
    currentUser && profile && currentUser.id === profile.id
  );

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3000);
  };

  const loadPosts = useCallback(async (targetUserId: string) => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const data = await fetchPublicUserPosts(targetUserId);
      setPosts(data);
    } catch (err: any) {
      setPostsError(err?.message || 'Could not load posts.');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const loadCollection = useCallback(async (targetUserId: string) => {
    setCollectionLoading(true);
    setCollectionError(null);
    try {
      const data = await fetchPublicUserCollection(targetUserId);
      setCollectionItems(data);
    } catch (err: any) {
      setCollectionError(err?.message || 'Could not load collection.');
    } finally {
      setCollectionLoading(false);
    }
  }, []);

  const loadUserQuestions = useCallback(async (targetUserId: string) => {
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const data = await listQuestionsByAuthor(targetUserId);
      setUserQuestions(data);
    } catch (err: any) {
      setQuestionsError(err?.message || 'Could not load questions.');
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const loadUserAnswers = useCallback(async (targetUserId: string) => {
    setAnswersLoading(true);
    setAnswersError(null);
    try {
      const data = await listAnswersByAuthor(targetUserId);
      setUserAnswers(data);
    } catch (err: any) {
      setAnswersError(err?.message || 'Could not load answers.');
    } finally {
      setAnswersLoading(false);
    }
  }, []);

  const loadRelationshipState = useCallback(
    async (targetUserId: string) => {
      if (!currentUser || !targetUserId || currentUser.id === targetUserId) {
        setRelationship({ iFollow: false, followsMe: false, isBlocked: false });
        setRelationshipError(null);
        return;
      }

      setRelationshipError(null);
      try {
        const rel = await fetchRelationship(targetUserId);
        setRelationship(rel);
      } catch (err: any) {
        console.warn('relationship RPC failed, falling back to user_follows check:', err);
        setRelationshipError(err?.message || 'Could not load relationship status.');
        try {
          const following = await fetchIsFollowingUser(currentUser.id, targetUserId);
          setRelationship({ iFollow: following, followsMe: false, isBlocked: false });
        } catch {
          setRelationship({ iFollow: false, followsMe: false, isBlocked: false });
        }
      }
    },
    [currentUser?.id]
  );

  const loadProfile = useCallback(async () => {
    const clean = decodeURIComponent(username || '').trim();
    if (!clean) {
      setProfile(null);
      setNotFound(true);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);
    setNotFound(false);
    setFollowError(null);
    setRelationshipError(null);
    setMoreMenuOpen(false);
    setPosts([]);
    setCollectionItems([]);
    setUserQuestions([]);
    setUserAnswers([]);
    setHelperCount(0);
    setPostsError(null);
    setCollectionError(null);
    setQuestionsError(null);
    setAnswersError(null);

    try {
      const loaded = await getProfileByUsername(clean);
      if (!loaded) {
        setProfile(null);
        setNotFound(true);
        return;
      }

      setProfile(loaded);

      const isSelf = Boolean(currentUser && currentUser.id === loaded.id);

      // Load relationship when signed in and viewing someone else
      if (currentUser && !isSelf && loaded.id) {
        await loadRelationshipState(loaded.id);
      } else {
        setRelationship({ iFollow: false, followsMe: false, isBlocked: false });
      }

      fetchHelperCount(loaded.id)
        .then((count) => setHelperCount(count))
        .catch(() => setHelperCount(0));

      // Only load public posts, public collection, and Q&A when permitted
      if (loaded.isPublic) {
        setActiveTab('posts');
        await Promise.all([
          loadPosts(loaded.id),
          loadCollection(loaded.id),
          loadUserQuestions(loaded.id),
          loadUserAnswers(loaded.id),
        ]);
      } else if (isSelf) {
        setActiveTab('posts');
        await Promise.all([
          loadPosts(loaded.id),
          loadUserQuestions(loaded.id),
          loadUserAnswers(loaded.id),
        ]);
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Could not load profile.');
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [username, currentUser?.id, loadPosts, loadCollection, loadUserQuestions, loadUserAnswers, loadRelationshipState]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleToggleFollow = async () => {
    if (!profile || isOwnProfile || followBusy) return;
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    setFollowBusy(true);
    setFollowError(null);
    const currentlyFollowing = relationship.iFollow;
    const optimisticNext = !currentlyFollowing;

    // Optimistic update
    setRelationship((prev) => ({ ...prev, iFollow: optimisticNext }));
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            followersCount: Math.max(
              0,
              prev.followersCount + (currentlyFollowing ? -1 : 1)
            ),
          }
        : prev
    );

    try {
      const nextState = await toggleFollowUser({
        followerId: currentUser.id,
        followingId: profile.id,
        currentlyFollowing,
      });
      setRelationship((prev) => ({ ...prev, iFollow: nextState }));
    } catch (err: any) {
      // Roll back optimistic update on failure
      setRelationship((prev) => ({ ...prev, iFollow: currentlyFollowing }));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followersCount: Math.max(
                0,
                prev.followersCount + (currentlyFollowing ? 1 : -1)
              ),
            }
          : prev
      );
      setFollowError(err?.message || 'Could not update follow status.');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!profile || isOwnProfile || blockBusy) return;
    if (!currentUser) {
      setConfirmBlockOpen(false);
      setAuthModalOpen(true);
      return;
    }

    setBlockBusy(true);
    setFollowError(null);
    const prevRel = relationship;

    try {
      await blockUser(profile.id);
      setRelationship({ iFollow: false, followsMe: false, isBlocked: true });
      if (prevRel.iFollow) {
        setProfile((prev) =>
          prev
            ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) }
            : prev
        );
      }
      setConfirmBlockOpen(false);
      showToast(`Blocked ${profile.username}.`);
    } catch (err: any) {
      setFollowError(err?.message || 'Could not block user.');
      setConfirmBlockOpen(false);
    } finally {
      setBlockBusy(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || reportBusy) return;
    if (!currentUser) {
      setReportModalOpen(false);
      setAuthModalOpen(true);
      return;
    }

    const fullReason = reportNotes.trim()
      ? `${reportReason}: ${reportNotes.trim()}`
      : reportReason;

    setReportBusy(true);
    setReportModalError(null);
    try {
      await reportUser({
        reportedUserId: profile.id,
        reporterId: currentUser.id,
        reason: fullReason,
      });
      setReportModalOpen(false);
      setReportNotes('');
      showToast('Report submitted. Thank you for keeping WildDex safe.');
    } catch (err: any) {
      setReportModalError(err?.message || 'Could not submit report.');
    } finally {
      setReportBusy(false);
    }
  };

  const handleStartMessage = async () => {
    if (!profile || isOwnProfile || messageBusy) return;
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    setMessageBusy(true);
    setFollowError(null);
    try {
      const conversationId = await startConversation(profile.id);
      navigate(`/messages/${encodeURIComponent(conversationId)}`);
    } catch (err: any) {
      setFollowError(err?.message || 'Could not start conversation.');
    } finally {
      setMessageBusy(false);
    }
  };

  const openFollowSheet = (kind: FollowListKind) => {
    setFollowSheetTab(kind);
    setFollowSheetOpen(true);
  };

  const handleCountsDelta = (delta: FollowCountsDelta) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            followersCount: Math.max(
              0,
              prev.followersCount + (delta.followersDelta || 0)
            ),
            followingCount: Math.max(
              0,
              prev.followingCount + (delta.followingDelta || 0)
            ),
          }
        : prev
    );
  };

  const handleViewerFollowTargetChange = (targetId: string, nowFollowing: boolean) => {
    if (!profile || targetId !== profile.id) return;
    setRelationship((prev) => {
      if (prev.iFollow === nowFollowing) return prev;
      setProfile((p) =>
        p
          ? {
              ...p,
              followersCount: Math.max(0, p.followersCount + (nowFollowing ? 1 : -1)),
            }
          : p
      );
      return { ...prev, iFollow: nowFollowing };
    });
  };

  const renderAvatar = (p: PublicProfileData) => {
    const initial = (p.username || p.displayName || 'E').charAt(0).toUpperCase();
    if (p.avatarUrl) {
      return (
        <img
          src={p.avatarUrl}
          alt={p.username}
          className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-fixed shadow-md shrink-0"
        />
      );
    }
    return (
      <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-3xl ring-4 ring-primary-fixed shadow-md shrink-0">
        {initial}
      </div>
    );
  };

  const renderPersonActions = (p: PublicProfileData) => {
    if (isOwnProfile) {
      return (
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:opacity-95 transition-opacity"
        >
          <span className="material-symbols-outlined text-[17px]">edit</span>
          <span>Edit profile</span>
        </Link>
      );
    }

    const followButtonLabel = relationship.iFollow
      ? 'Following'
      : relationship.followsMe
      ? 'Follow back'
      : 'Follow';

    const canMessage = relationship.iFollow && relationship.followsMe && !relationship.isBlocked;
    const showFollowBackToMessage =
      relationship.followsMe && !relationship.iFollow && !relationship.isBlocked;

    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {!relationship.isBlocked ? (
            <button
              type="button"
              disabled={followBusy}
              onClick={handleToggleFollow}
              className={`px-5 py-2 rounded-full font-label-md text-label-md font-semibold transition-colors disabled:opacity-60 ${
                relationship.iFollow
                  ? 'bg-surface-container text-on-surface hover:bg-surface-container-lowest'
                  : 'bg-primary text-on-primary hover:opacity-95'
              }`}
            >
              {followBusy ? '...' : followButtonLabel}
            </button>
          ) : (
            <span className="px-4 py-2 rounded-full bg-surface-container text-on-surface-variant font-label-md text-xs font-semibold">
              Blocked
            </span>
          )}

          {canMessage && (
            <button
              type="button"
              disabled={messageBusy}
              onClick={handleStartMessage}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[17px]">mail</span>
              <span>{messageBusy ? 'Opening...' : 'Message'}</span>
            </button>
          )}

          {/* ⋯ Menu with Block & Report */}
          <div className="relative">
            <button
              type="button"
              aria-label="More profile actions"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-lowest transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
            </button>

            {moreMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMoreMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-44 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl py-1.5 z-30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      if (!currentUser) {
                        setAuthModalOpen(true);
                        return;
                      }
                      setConfirmBlockOpen(true);
                    }}
                    disabled={relationship.isBlocked}
                    className="w-full px-3.5 py-2.5 text-left text-sm font-medium text-on-surface hover:bg-surface-container flex items-center gap-2.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px] text-error">
                      block
                    </span>
                    <span>{relationship.isBlocked ? 'Blocked' : 'Block'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      if (!currentUser) {
                        setAuthModalOpen(true);
                        return;
                      }
                      setReportModalError(null);
                      setReportModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-sm font-medium text-error hover:bg-error-container/20 flex items-center gap-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">flag</span>
                    <span>Report</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showFollowBackToMessage && (
          <p className="font-label-sm text-[11px] text-primary font-semibold">
            Follow back to message
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-2 space-y-space-md">
      {/* Toast Notification */}
      {actionToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">
            check_circle
          </span>
          <span>{actionToast}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <span className="font-headline-sm text-headline-sm text-primary font-bold truncate">
          Explorer Profile
        </span>
        <div className="w-10" />
      </div>

      {/* Loading Skeleton */}
      {loadingProfile && (
        <div
          className="space-y-4 animate-pulse"
          aria-label="Loading profile"
        >
          <div className="p-4 sm:p-space-md rounded-3xl bg-surface-container-low border border-outline-variant/20 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-20 h-20 rounded-full bg-surface-container-high shrink-0" />
                <div className="space-y-2">
                  <div className="h-5 w-36 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-52 rounded bg-surface-container-high" />
                </div>
              </div>
              <div className="h-9 w-24 rounded-full bg-surface-container-high shrink-0" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-14 rounded-2xl bg-surface-container-high"
                />
              ))}
            </div>
          </div>
          <div className="h-10 rounded-full bg-surface-container-high" />
          <div className="h-48 rounded-2xl bg-surface-container-high" />
        </div>
      )}

      {/* Error State with Retry */}
      {!loadingProfile && profileError && (
        <div className="p-6 rounded-2xl bg-error-container/30 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error">
            error_outline
          </span>
          <p className="font-body-md text-body-md text-on-surface font-medium">
            {profileError}
          </p>
          <button
            type="button"
            onClick={loadProfile}
            className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Not Found State */}
      {!loadingProfile && !profileError && notFound && (
        <div className="p-8 rounded-3xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
            person_off
          </span>
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Person not found
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
            We couldn&apos;t find a naturalist with that username.
          </p>
          <Link
            to="/feed"
            className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Back to Community
          </Link>
        </div>
      )}

      {/* Profile Content */}
      {!loadingProfile && !profileError && !notFound && profile && (
        <>
          {/* Private Profile (when is_public is false and not me) */}
          {!profile.isPublic && !isOwnProfile ? (
            <div className="space-y-4">
              <div className="p-4 sm:p-space-md rounded-3xl bg-surface-container-high border border-outline-variant/20 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {renderAvatar(profile)}
                  <div className="min-w-0">
                    <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                      {profile.username}
                    </h1>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Naturalist
                    </p>
                  </div>
                </div>

                {renderPersonActions(profile)}
              </div>

              {(followError || relationshipError) && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="font-body-sm text-body-sm text-error">
                    {followError || relationshipError}
                  </p>
                  {relationshipError && (
                    <button
                      type="button"
                      onClick={() => loadRelationshipState(profile.id)}
                      className="text-xs font-semibold text-primary underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              <div className="p-8 rounded-3xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-2.5">
                <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                  lock
                </span>
                <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  This profile is private
                </p>
              </div>
            </div>
          ) : (
            /* Public Profile or Own Profile */
            <div className="space-y-4">
              {/* Profile Header Card */}
              <div className="p-4 sm:p-space-md rounded-3xl bg-surface-container-high border border-outline-variant/20 shadow-sm flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {renderAvatar(profile)}
                    <div className="min-w-0 flex-1">
                      <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                        {profile.username}
                      </h1>
                      {isOwnProfile && !profile.isPublic && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-semibold">
                          <span className="material-symbols-outlined text-[13px]">lock</span>
                          Private profile
                        </span>
                      )}
                      {!isOwnProfile && relationship.followsMe && !relationship.isBlocked && (
                        <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-semibold">
                          Follows you
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Follow/Following/Message/More or Edit profile button */}
                  <div className="shrink-0">
                    {renderPersonActions(profile)}
                  </div>
                </div>

                {(followError || relationshipError) && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-body-sm text-body-sm text-error">
                      {followError || relationshipError}
                    </p>
                    {relationshipError && (
                      <button
                        type="button"
                        onClick={() => loadRelationshipState(profile.id)}
                        className="text-xs font-semibold text-primary underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {/* Bio */}
                {profile.bio && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {profile.bio}
                  </p>
                )}

                {/* Counts Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/30 text-center">
                  <div className="p-2.5 rounded-2xl bg-surface-container-lowest">
                    <span className="font-headline-sm text-headline-sm text-primary font-bold">
                      {profile.speciesFound}
                    </span>
                    <p className="font-label-sm text-[11px] text-on-surface-variant">
                      Species Found
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-surface-container-lowest">
                    <span className="font-headline-sm text-headline-sm text-secondary font-bold">
                      {profile.scansCount}
                    </span>
                    <p className="font-label-sm text-[11px] text-on-surface-variant">
                      Scans
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openFollowSheet('followers')}
                    className="p-2.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {profile.followersCount}
                    </span>
                    <p className="font-label-sm text-[11px] text-on-surface-variant">
                      Followers
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFollowSheet('following')}
                    className="p-2.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {profile.followingCount}
                    </span>
                    <p className="font-label-sm text-[11px] text-on-surface-variant">
                      Following
                    </p>
                  </button>
                </div>

                {/* Helped identify count (hidden on other people's profiles when 0) */}
                {(isOwnProfile || helperCount > 0) && (
                  <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-secondary-container/60 text-on-secondary-container flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                          verified
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-label-md text-xs text-on-surface font-bold">
                          Helped identify
                        </p>
                        <p className="font-body-sm text-[11px] text-on-surface-variant">
                          times a best answer
                        </p>
                      </div>
                    </div>
                    <span className="font-headline-sm text-xl text-primary font-bold tabular-nums shrink-0">
                      {helperCount}
                    </span>
                  </div>
                )}
              </div>

              {/* Tabs: Posts | Collection (when public) | Questions | Answers */}
              <div className="flex flex-wrap sm:flex-nowrap bg-surface-container-low p-1 rounded-2xl sm:rounded-full gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('posts')}
                  className={`flex-1 min-w-[72px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                    activeTab === 'posts'
                      ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Posts
                </button>
                {profile.isPublic && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('collection')}
                    className={`flex-1 min-w-[72px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                      activeTab === 'collection'
                        ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Collection
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('questions')}
                  className={`flex-1 min-w-[72px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                    activeTab === 'questions'
                      ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Questions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('answers')}
                  className={`flex-1 min-w-[72px] py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                    activeTab === 'answers'
                      ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Answers
                </button>
              </div>

              {/* Posts Tab */}
              {activeTab === 'posts' && (
                <div className="space-y-3">
                  {postsLoading ? (
                    <div className="space-y-3 animate-pulse" aria-label="Loading posts">
                      {[0, 1].map((idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 space-y-3"
                        >
                          <div className="w-full aspect-[4/3] rounded-xl bg-surface-container-high" />
                          <div className="h-4 w-44 rounded bg-surface-container-high" />
                          <div className="h-3.5 w-full rounded bg-surface-container-high" />
                        </div>
                      ))}
                    </div>
                  ) : postsError ? (
                    <div className="p-5 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5">
                      <p className="font-body-sm text-body-sm text-error font-medium">
                        {postsError}
                      </p>
                      <button
                        type="button"
                        onClick={() => loadPosts(profile.id)}
                        className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        No public posts yet.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {posts.map((post) => (
                        <article
                          key={post.id}
                          className="p-3 sm:p-space-md rounded-2xl bg-surface-container-low border border-outline-variant/15 shadow-sm flex flex-col gap-2.5"
                        >
                          {post.photoUrl && (
                            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container">
                              <img
                                src={post.photoUrl}
                                alt={post.speciesName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                              {post.speciesName}
                            </h2>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              {formatRelativeDate(post.createdAt)}
                            </span>
                          </div>
                          {post.scientificName && (
                            <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                              {post.scientificName}
                            </p>
                          )}
                          {post.caption && (
                            <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap break-words">
                              {post.caption}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Collection Tab (only when is_public is true; photo + species name only; never locations) */}
              {activeTab === 'collection' && profile.isPublic && (
                <div className="space-y-3">
                  {collectionLoading ? (
                    <div
                      className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse"
                      aria-label="Loading collection"
                    >
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl bg-surface-container-low border border-outline-variant/15 overflow-hidden"
                        >
                          <div className="w-full aspect-square bg-surface-container-high" />
                          <div className="p-2.5">
                            <div className="h-3.5 w-24 rounded bg-surface-container-high" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : collectionError ? (
                    <div className="p-5 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5">
                      <p className="font-body-sm text-body-sm text-error font-medium">
                        {collectionError}
                      </p>
                      <button
                        type="button"
                        onClick={() => loadCollection(profile.id)}
                        className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  ) : collectionItems.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        No collection sightings yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {collectionItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl bg-surface-container-low overflow-hidden border border-outline-variant/20 shadow-sm flex flex-col"
                        >
                          <div className="w-full aspect-square bg-surface-container flex items-center justify-center overflow-hidden">
                            {item.photoUrl ? (
                              <img
                                src={item.photoUrl}
                                alt={item.speciesName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                                eco
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="font-label-md text-label-md font-bold text-on-surface truncate">
                              {item.speciesName}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Questions Tab */}
              {activeTab === 'questions' && (
                <ProfileQuestionsTab
                  questions={userQuestions}
                  loading={questionsLoading}
                  error={questionsError}
                  onRetry={() => loadUserQuestions(profile.id)}
                />
              )}

              {/* Answers Tab */}
              {activeTab === 'answers' && (
                <ProfileAnswersTab
                  answers={userAnswers}
                  loading={answersLoading}
                  error={answersError}
                  onRetry={() => loadUserAnswers(profile.id)}
                />
              )}
            </div>
          )}

          {/* Followers / Following Sheet */}
          <FollowListSheet
            open={followSheetOpen}
            initialTab={followSheetTab}
            targetUserId={profile.id}
            targetUsername={profile.username}
            currentUserId={currentUser?.id}
            isOwner={isOwnProfile}
            isPublic={profile.isPublic}
            followersCount={profile.followersCount}
            followingCount={profile.followingCount}
            onClose={() => setFollowSheetOpen(false)}
            onRequireAuth={() => {
              setFollowSheetOpen(false);
              setAuthModalOpen(true);
            }}
            onCountsDelta={handleCountsDelta}
            onViewerFollowTargetChange={handleViewerFollowTargetChange}
          />

          {/* Confirm Block Dialog */}
          {confirmBlockOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
              role="alertdialog"
              aria-modal="true"
              aria-label={`Block ${profile.username}`}
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
                  Block {profile.username}?
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  They won&apos;t be able to follow or interact with your profile anymore.
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

          {/* Report User Dialog */}
          {reportModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Report ${profile.username}`}
              onClick={() => {
                if (!reportBusy) setReportModalOpen(false);
              }}
            >
              <form
                onSubmit={handleSubmitReport}
                className="w-full max-w-sm rounded-3xl bg-surface-container-lowest border border-outline-variant/30 p-5 shadow-2xl space-y-3.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">
                    Report {profile.username}
                  </h3>
                  <button
                    type="button"
                    disabled={reportBusy}
                    onClick={() => setReportModalOpen(false)}
                    aria-label="Close report dialog"
                    className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors"
                    >
                      <input
                        type="radio"
                        name="report-reason"
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
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Optional details..."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40"
                />

                {reportModalError && (
                  <p className="font-body-sm text-xs text-error">{reportModalError}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={reportBusy}
                    onClick={() => setReportModalOpen(false)}
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
        </>
      )}
    </div>
  );
};
