import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  PublicProfileData,
  PublicUserPost,
  PublicCollectionItem,
  getProfileByUsername,
  fetchPublicUserPosts,
  fetchPublicUserCollection,
  fetchIsFollowingUser,
  toggleFollowUser,
} from '../services/publicProfileService';

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

  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'posts' | 'collection'>('posts');

  const [posts, setPosts] = useState<PublicUserPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [collectionItems, setCollectionItems] = useState<PublicCollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const isOwnProfile = Boolean(
    currentUser && profile && currentUser.id === profile.id
  );

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
    setPosts([]);
    setCollectionItems([]);
    setPostsError(null);
    setCollectionError(null);

    try {
      const loaded = await getProfileByUsername(clean);
      if (!loaded) {
        setProfile(null);
        setNotFound(true);
        return;
      }

      setProfile(loaded);

      const isSelf = Boolean(currentUser && currentUser.id === loaded.id);

      // Load follow state when signed in and viewing someone else
      if (currentUser && !isSelf && loaded.id) {
        try {
          const following = await fetchIsFollowingUser(currentUser.id, loaded.id);
          setIsFollowing(following);
        } catch {
          setIsFollowing(false);
        }
      } else {
        setIsFollowing(false);
      }

      // Only load public posts and public collection when permitted
      if (loaded.isPublic) {
        setActiveTab('posts');
        await Promise.all([
          loadPosts(loaded.id),
          loadCollection(loaded.id),
        ]);
      } else if (isSelf) {
        setActiveTab('posts');
        await loadPosts(loaded.id);
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Could not load profile.');
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [username, currentUser?.id, loadPosts, loadCollection]);

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
    const currentlyFollowing = isFollowing;

    // Optimistic update
    setIsFollowing(!currentlyFollowing);
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
      setIsFollowing(nextState);
    } catch (err: any) {
      // Revert optimistic update on failure
      setIsFollowing(currentlyFollowing);
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

  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-2 space-y-space-md">
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

                <button
                  type="button"
                  disabled={followBusy}
                  onClick={handleToggleFollow}
                  className={`px-5 py-2 rounded-full font-label-md text-label-md font-semibold transition-colors shrink-0 disabled:opacity-60 ${
                    isFollowing
                      ? 'bg-surface-container text-on-surface hover:bg-surface-container-lowest'
                      : 'bg-primary text-on-primary hover:opacity-95'
                  }`}
                >
                  {followBusy ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>

              {followError && (
                <p className="font-body-sm text-body-sm text-error px-1">
                  {followError}
                </p>
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
                    </div>
                  </div>

                  {/* Follow/Unfollow or Edit profile button */}
                  <div className="shrink-0">
                    {isOwnProfile ? (
                      <Link
                        to="/profile"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:opacity-95 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                        <span>Edit profile</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={followBusy}
                        onClick={handleToggleFollow}
                        className={`px-5 py-2 rounded-full font-label-md text-label-md font-semibold transition-colors disabled:opacity-60 ${
                          isFollowing
                            ? 'bg-surface-container text-on-surface hover:bg-surface-container-lowest'
                            : 'bg-primary text-on-primary hover:opacity-95'
                        }`}
                      >
                        {followBusy ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>

                {followError && (
                  <p className="font-body-sm text-body-sm text-error">{followError}</p>
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
                  <div className="p-2.5 rounded-2xl bg-surface-container-lowest">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {profile.followersCount}
                    </span>
                    <p className="font-label-sm text-[11px] text-on-surface-variant">
                      Followers
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-surface-container-lowest">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      {profile.followingCount}
                    </span>
                    <p className="font-label-sm text-[11px] text-on-surface-variant">
                      Following
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs: Posts | Collection (Collection only when is_public is true) */}
              <div className="flex bg-surface-container-low p-1 rounded-full gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('posts')}
                  className={`flex-1 py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
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
                    className={`flex-1 py-1.5 px-3 rounded-full font-label-md text-label-md transition-all ${
                      activeTab === 'collection'
                        ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Collection
                  </button>
                )}
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
            </div>
          )}
        </>
      )}
    </div>
  );
};
