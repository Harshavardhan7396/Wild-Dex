import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CollectionItem, getSupabaseUserCollection } from '../services/supabaseCollectionService';
import {
  AlbumDetailData,
  AlbumInviteResult,
  AlbumRole,
  InviteRole,
  SharedAlbumItem,
  SharedAlbumSummary,
  addCollectionItemToSharedAlbum,
  createAlbumInvite,
  createSharedAlbum,
  fetchAlbumDetail,
  fetchMyAndSharedAlbums,
  removeOrLeaveAlbumMember,
  removeSharedAlbumItem,
} from '../services/sharedAlbumService';

const ROLE_LABELS: Record<AlbumRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_BADGE_CLASSES: Record<AlbumRole, string> = {
  owner: 'bg-primary text-on-primary',
  editor: 'bg-secondary-container text-on-secondary-container',
  viewer: 'bg-surface-container text-on-surface-variant',
};

const AvatarCircle: React.FC<{
  avatarUrl?: string;
  name: string;
  sizeClass?: string;
}> = ({ avatarUrl, name, sizeClass = 'w-9 h-9' }) => {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim().charAt(0) || 'E').toUpperCase();

  if (avatarUrl && !failed) {
    return (
      <img
        alt={name}
        src={avatarUrl}
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 bg-surface-container`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} rounded-full bg-primary-container text-on-primary-container font-bold text-xs flex items-center justify-center shrink-0 select-none`}
    >
      {initial}
    </div>
  );
};

export const SharedCollectionPage: React.FC = () => {
  const { albumId } = useParams<{ albumId?: string }>();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, setAuthModalOpen } = useAuth();

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // =========================================================================
  // ALBUM LIST STATE (/shared-collection)
  // =========================================================================
  const [albums, setAlbums] = useState<SharedAlbumSummary[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [albumsError, setAlbumsError] = useState<string | null>(null);

  // Create shared album modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [createAlbumError, setCreateAlbumError] = useState<string | null>(null);

  // =========================================================================
  // ALBUM DETAIL STATE (/shared-collection/:albumId)
  // =========================================================================
  const [detail, setDetail] = useState<AlbumDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Invite modal (Owner only)
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<InviteRole>('editor');
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteResult, setInviteResult] = useState<AlbumInviteResult | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Add item from collection modal (Owner & Editors only)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [myCollection, setMyCollection] = useState<CollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // Remove / Leave busy states
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leavingAlbum, setLeavingAlbum] = useState(false);

  const loadAlbumsList = useCallback(async () => {
    if (!currentUser) return;
    setAlbumsLoading(true);
    setAlbumsError(null);
    try {
      const list = await fetchMyAndSharedAlbums(currentUser.id);
      setAlbums(list);
    } catch (err: any) {
      setAlbumsError(err?.message || 'Could not load shared albums.');
    } finally {
      setAlbumsLoading(false);
    }
  }, [currentUser]);

  const loadAlbumDetail = useCallback(async () => {
    if (!currentUser || !albumId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await fetchAlbumDetail(albumId, currentUser.id);
      setDetail(data);
    } catch (err: any) {
      setDetailError(err?.message || 'Could not load this shared album.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [currentUser, albumId]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    if (albumId) {
      loadAlbumDetail();
    } else {
      loadAlbumsList();
    }
  }, [authLoading, currentUser?.id, albumId, loadAlbumDetail, loadAlbumsList]);

  const myAlbums = useMemo(() => albums.filter((a) => a.myRole === 'owner'), [albums]);
  const sharedWithMe = useMemo(() => albums.filter((a) => a.myRole !== 'owner'), [albums]);

  // Create new shared album
  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!newAlbumName.trim()) {
      setCreateAlbumError('Please enter an album name.');
      return;
    }

    setCreatingAlbum(true);
    setCreateAlbumError(null);
    try {
      const created = await createSharedAlbum({
        userId: currentUser.id,
        name: newAlbumName,
        description: newAlbumDesc,
      });
      setCreateModalOpen(false);
      setNewAlbumName('');
      setNewAlbumDesc('');
      showToast('Shared album created!');
      navigate(`/shared-collection/${created.id}`);
    } catch (err: any) {
      setCreateAlbumError(err?.message || 'Could not create album.');
    } finally {
      setCreatingAlbum(false);
    }
  };

  // Generate invite link (Owner only)
  const handleGenerateInvite = async () => {
    if (!currentUser || !detail) return;
    setInviteCreating(true);
    setInviteError(null);
    try {
      const res = await createAlbumInvite({
        albumId: detail.album.id,
        userId: currentUser.id,
        role: inviteRole,
      });
      setInviteResult(res);
    } catch (err: any) {
      setInviteError(err?.message || 'Could not create invite link.');
    } finally {
      setInviteCreating(false);
    }
  };

  const copyInviteUrl = async (url: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        showToast('Invite link copied!');
        return;
      }
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Invite link copied!');
    } catch {
      showToast('Could not copy automatically. Please copy the link text.');
    }
  };

  const shareInviteUrl = async (url: string, albumName: string) => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join "${albumName}" on WildDex`,
          text: `You're invited to collaborate on "${albumName}" in WildDex.`,
          url,
        });
        showToast('Invite link shared!');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await copyInviteUrl(url);
  };

  // Add item from collection (Owner & Editor only)
  const openCollectionPicker = async () => {
    if (!currentUser) return;
    setPickerOpen(true);
    setCollectionLoading(true);
    setCollectionError(null);
    try {
      const list = await getSupabaseUserCollection(currentUser.id);
      setMyCollection(list);
    } catch (err: any) {
      setCollectionError(err?.message || 'Could not load your collection.');
    } finally {
      setCollectionLoading(false);
    }
  };

  const handleAddCollectionItem = async (item: CollectionItem) => {
    if (!currentUser || !detail || addingItemId) return;
    setAddingItemId(item.id);
    try {
      const added = await addCollectionItemToSharedAlbum({
        albumId: detail.album.id,
        userId: currentUser.id,
        collectionItem: item,
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              album: { ...prev.album, itemCount: prev.album.itemCount + 1 },
              items: [added, ...prev.items],
            }
          : prev
      );
      setPickerOpen(false);
      showToast(`${item.commonName} added to album!`);
    } catch (err: any) {
      showToast(err?.message || 'Could not add item to album.');
    } finally {
      setAddingItemId(null);
    }
  };

  // Remove item (Owner removes any; Editor removes own)
  const handleRemoveItem = async (item: SharedAlbumItem) => {
    if (!currentUser || !detail || removingItemId) return;
    setRemovingItemId(item.id);
    try {
      await removeSharedAlbumItem(item.id);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              album: { ...prev.album, itemCount: Math.max(0, prev.album.itemCount - 1) },
              items: prev.items.filter((i) => i.id !== item.id),
            }
          : prev
      );
      showToast('Item removed from album.');
    } catch (err: any) {
      showToast(err?.message || 'Could not remove item.');
    } finally {
      setRemovingItemId(null);
    }
  };

  // Owner removes a member
  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!detail || removingMemberId) return;
    setRemovingMemberId(memberUserId);
    try {
      await removeOrLeaveAlbumMember({
        albumId: detail.album.id,
        memberUserId,
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              album: { ...prev.album, memberCount: Math.max(1, prev.album.memberCount - 1) },
              members: prev.members.filter((m) => m.userId !== memberUserId),
            }
          : prev
      );
      showToast(`Removed ${memberName} from album.`);
    } catch (err: any) {
      showToast(err?.message || 'Could not remove member.');
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Non-owner leaves album
  const handleLeaveAlbum = async () => {
    if (!currentUser || !detail || leavingAlbum) return;
    setLeavingAlbum(true);
    try {
      await removeOrLeaveAlbumMember({
        albumId: detail.album.id,
        memberUserId: currentUser.id,
      });
      setConfirmLeaveOpen(false);
      showToast('You left the shared album.');
      navigate('/shared-collection', { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Could not leave album.');
    } finally {
      setLeavingAlbum(false);
    }
  };

  // Signed-out guard
  if (!authLoading && !currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin py-8">
        <div className="max-w-lg mx-auto w-full rounded-2xl bg-surface-container-low border border-outline-variant/25 p-6 text-center shadow-sm flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">folder_shared</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            Shared Collection
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Sign in to create shared albums, collaborate with friends, and view albums shared with you.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="mt-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER ALBUM DETAIL PAGE (/shared-collection/:albumId)
  // =========================================================================
  if (albumId) {
    const myRole = detail?.album.myRole || 'viewer';
    const isOwner = myRole === 'owner';
    const canEdit = myRole === 'owner' || myRole === 'editor';

    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-2 space-y-space-md">
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 max-w-[90vw]">
            <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
              check_circle
            </span>
            <span className="truncate">{toast}</span>
          </div>
        )}

        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate('/shared-collection')}
            aria-label="Back to shared albums"
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <span className="font-headline-sm text-headline-sm text-primary font-bold truncate">
            Shared Album
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setInviteResult(null);
                  setInviteError(null);
                  setInviteRole('editor');
                  setInviteModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold shadow-sm active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Invite</span>
              </button>
            )}
            {!isOwner && detail && (
              <button
                type="button"
                onClick={() => setConfirmLeaveOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-surface-container text-error font-label-md text-label-md font-semibold hover:bg-error-container/30 transition-colors"
              >
                Leave
              </button>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {(authLoading || detailLoading) && (
          <div className="space-y-4 animate-pulse" aria-label="Loading album">
            <div className="p-4 rounded-2xl bg-surface-container-low space-y-2">
              <div className="h-6 w-48 rounded bg-surface-container-high" />
              <div className="h-4 w-full rounded bg-surface-container-high" />
            </div>
            <div className="p-4 rounded-2xl bg-surface-container-low space-y-3">
              <div className="h-5 w-32 rounded bg-surface-container-high" />
              <div className="h-10 w-full rounded-xl bg-surface-container-high" />
              <div className="h-10 w-full rounded-xl bg-surface-container-high" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="aspect-square rounded-2xl bg-surface-container-high" />
              <div className="aspect-square rounded-2xl bg-surface-container-high" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!authLoading && !detailLoading && detailError && (
          <div className="p-6 rounded-2xl bg-error-container/30 border border-error/30 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[32px] text-error">error_outline</span>
            <p className="font-body-md text-body-md text-on-surface font-medium">{detailError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={loadAlbumDetail}
                className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold"
              >
                Retry
              </button>
              <Link
                to="/shared-collection"
                className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
              >
                All Albums
              </Link>
            </div>
          </div>
        )}

        {/* Loaded Album Content */}
        {!authLoading && !detailLoading && !detailError && detail && (
          <>
            {/* Album Header Card */}
            <div className="p-4 sm:p-space-md rounded-2xl bg-surface-container-high shadow-sm flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-label-sm text-[11px] font-bold ${ROLE_BADGE_CLASSES[myRole]}`}
                    >
                      {ROLE_LABELS[myRole]}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {detail.members.length}{' '}
                      {detail.members.length === 1 ? 'Member' : 'Members'} • {detail.items.length}{' '}
                      {detail.items.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                  <h1 className="font-headline-md text-headline-md text-on-surface font-bold mt-1.5">
                    {detail.album.name}
                  </h1>
                  {detail.album.description && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      {detail.album.description}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={openCollectionPicker}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm active:scale-95 transition-transform shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    <span>Add from Collection</span>
                  </button>
                )}
              </div>

              {/* Leave Confirmation Banner */}
              {confirmLeaveOpen && !isOwner && (
                <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-body-sm text-body-sm text-on-surface font-medium">
                    Leave "{detail.album.name}"?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmLeaveOpen(false)}
                      className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={leavingAlbum}
                      onClick={handleLeaveAlbum}
                      className="px-3 py-1 rounded-full bg-error text-on-error font-label-sm font-semibold disabled:opacity-60"
                    >
                      {leavingAlbum ? 'Leaving...' : 'Leave Album'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Members Card */}
            <div className="p-3 sm:p-space-md rounded-2xl bg-surface-container-low border border-outline-variant/15 shadow-sm flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Members
                </h2>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setInviteResult(null);
                      setInviteError(null);
                      setInviteRole('editor');
                      setInviteModalOpen(true);
                    }}
                    className="font-label-md text-primary font-semibold hover:underline"
                  >
                    + Invite Member
                  </button>
                )}
              </div>

              <div className="flex flex-col divide-y divide-outline-variant/20">
                {detail.members.map((member) => {
                  const isMe = currentUser?.id === member.userId;
                  const canRemoveMember = isOwner && member.role !== 'owner' && !isMe;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 py-2 first:pt-1 last:pb-1"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <AvatarCircle
                          avatarUrl={member.profile.avatarUrl}
                          name={member.profile.displayName || member.profile.username}
                          sizeClass="w-9 h-9"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-label-md text-label-md font-bold text-on-surface truncate">
                            {member.profile.username}
                            {isMe ? ' (You)' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-label-sm text-[11px] font-bold ${ROLE_BADGE_CLASSES[member.role]}`}
                        >
                          {ROLE_LABELS[member.role]}
                        </span>

                        {canRemoveMember && (
                          <button
                            type="button"
                            disabled={removingMemberId === member.userId}
                            onClick={() =>
                              handleRemoveMember(member.userId, member.profile.username)
                            }
                            aria-label={`Remove ${member.profile.username}`}
                            className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-error-container/30 text-on-surface-variant hover:text-error font-label-sm text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            {removingMemberId === member.userId ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shared Items Grid */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Shared Items
                </h2>
                {canEdit && (
                  <button
                    type="button"
                    onClick={openCollectionPicker}
                    className="font-label-md text-primary font-semibold hover:underline"
                  >
                    + Add Item
                  </button>
                )}
              </div>

              {detail.items.length === 0 ? (
                <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-2.5">
                  <span className="material-symbols-outlined text-[34px] text-primary">
                    collections
                  </span>
                  <p className="font-body-md text-body-md text-on-surface font-semibold">
                    No items in this album yet.
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                    {canEdit
                      ? 'Add species from your collection to share them with everyone in this album.'
                      : 'Items added by the owner and editors will appear here.'}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={openCollectionPicker}
                      className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
                    >
                      Add from Collection
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-sm">
                  {detail.items.map((item) => {
                    const canRemoveItem =
                      isOwner || (myRole === 'editor' && item.addedBy === currentUser?.id);

                    return (
                      <div
                        key={item.id}
                        className="bg-surface-container-low border border-outline-variant/15 rounded-2xl overflow-hidden shadow-sm flex flex-col"
                      >
                        <div className="relative w-full aspect-[4/3] bg-surface-container">
                          {item.photoUrl ? (
                            <img
                              alt={item.speciesName}
                              src={item.photoUrl}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                              <span className="material-symbols-outlined text-[36px]">
                                image_not_supported
                              </span>
                            </div>
                          )}
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-xs text-[11px] text-white font-medium">
                            Added by {item.addedByName}
                          </span>
                        </div>

                        <div className="p-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-label-md text-label-md font-bold text-on-surface truncate">
                              {item.speciesName}
                            </h3>
                            {item.scientificName && (
                              <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
                                {item.scientificName}
                              </p>
                            )}
                          </div>

                          {canRemoveItem && (
                            <button
                              type="button"
                              disabled={removingItemId === item.id}
                              onClick={() => handleRemoveItem(item)}
                              aria-label={`Remove ${item.speciesName}`}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors shrink-0 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Owner Invite Modal */}
        {inviteModalOpen && isOwner && detail && (
          <div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Invite to Shared Album"
          >
            <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Invite to "{detail.album.name}"
                </h2>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  aria-label="Close invite modal"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface font-semibold">
                  Choose Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteRole('editor');
                      setInviteResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      inviteRole === 'editor'
                        ? 'border-primary bg-primary-container/25 text-primary'
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <p className="font-label-md font-bold">Editor</p>
                    <p className="font-body-sm text-[11px] opacity-80">
                      Can add items and remove their own
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteRole('viewer');
                      setInviteResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      inviteRole === 'viewer'
                        ? 'border-primary bg-primary-container/25 text-primary'
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <p className="font-label-md font-bold">Viewer</p>
                    <p className="font-body-sm text-[11px] opacity-80">
                      Can view shared items only
                    </p>
                  </button>
                </div>
              </div>

              {inviteError && (
                <p className="font-body-sm text-body-sm text-error">{inviteError}</p>
              )}

              {!inviteResult ? (
                <button
                  type="button"
                  disabled={inviteCreating}
                  onClick={handleGenerateInvite}
                  className="w-full h-11 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm disabled:opacity-60"
                >
                  {inviteCreating ? 'Creating Invite Link...' : 'Create Invite Link'}
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-2.5">
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                    {inviteResult.role === 'editor' ? 'Editor' : 'Viewer'} invite link:
                  </p>
                  <div className="px-3 py-2 rounded-lg bg-surface-container text-on-surface font-mono text-xs break-all select-all">
                    {inviteResult.inviteUrl}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyInviteUrl(inviteResult.inviteUrl)}
                      className="flex-1 h-10 rounded-full bg-surface-container-high text-on-surface font-label-md font-semibold flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        shareInviteUrl(inviteResult.inviteUrl, detail.album.name)
                      }
                      className="flex-1 h-10 rounded-full bg-primary text-on-primary font-label-md font-semibold flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pick from Collection Modal (Owner & Editors only) */}
        {pickerOpen && canEdit && (
          <div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Add from Collection"
          >
            <div className="w-full max-w-lg max-h-[85vh] rounded-2xl bg-surface p-4 sm:p-5 shadow-2xl border border-outline-variant/25 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Add from My Collection
                </h2>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  aria-label="Close picker"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {collectionLoading ? (
                <div className="py-8 text-center text-on-surface-variant font-body-sm">
                  Loading your collection...
                </div>
              ) : collectionError ? (
                <div className="p-4 rounded-xl bg-error-container/30 text-center flex flex-col items-center gap-2">
                  <p className="font-body-sm text-error">{collectionError}</p>
                  <button
                    type="button"
                    onClick={openCollectionPicker}
                    className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : myCollection.length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center gap-2">
                  <p className="font-body-md text-on-surface font-medium">
                    Your collection is empty.
                  </p>
                  <Link
                    to="/scan"
                    className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold"
                  >
                    Scan Something First
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                  {myCollection.map((item) => {
                    const isBusy = addingItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={Boolean(addingItemId)}
                        onClick={() => handleAddCollectionItem(item)}
                        className="text-left rounded-xl overflow-hidden border border-outline-variant/25 bg-surface-container-low hover:border-primary transition-all flex flex-col disabled:opacity-60"
                      >
                        <div className="relative aspect-[4/3] w-full bg-surface-container">
                          <img
                            src={item.photoUrl}
                            alt={item.commonName}
                            className="w-full h-full object-cover"
                          />
                          {isBusy && (
                            <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white font-label-sm font-bold">
                              Adding...
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="font-label-sm text-xs font-bold text-on-surface truncate">
                            {item.commonName}
                          </p>
                          <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">
                            {item.scientificName}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER ALBUMS LIST PAGE (/shared-collection)
  // =========================================================================
  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-space-sm space-y-space-md">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 max-w-[90vw]">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
            check_circle
          </span>
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="font-headline-md text-headline-md text-primary font-bold">
            Shared Collection
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Albums you own and albums shared with you
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateAlbumError(null);
            setNewAlbumName('');
            setNewAlbumDesc('');
            setCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm active:scale-95 transition-transform shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
          <span>New shared album</span>
        </button>
      </div>

      {/* Loading Skeletons */}
      {(authLoading || albumsLoading) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse" aria-label="Loading albums">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/15 space-y-2.5"
            >
              <div className="h-5 w-40 rounded bg-surface-container-high" />
              <div className="h-3.5 w-full rounded bg-surface-container-high" />
              <div className="h-3.5 w-24 rounded bg-surface-container-high" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!authLoading && !albumsLoading && albumsError && (
        <div className="p-6 rounded-2xl bg-error-container/30 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error">error_outline</span>
          <p className="font-body-md text-body-md text-on-surface font-medium">{albumsError}</p>
          <button
            type="button"
            onClick={loadAlbumsList}
            className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!authLoading && !albumsLoading && !albumsError && albums.length === 0 && (
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[36px] text-primary">folder_shared</span>
          <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
            No shared albums yet
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            Create a shared album to collect sightings together with friends, classmates, or family.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            New shared album
          </button>
        </div>
      )}

      {/* My Albums & Shared With Me Lists */}
      {!authLoading && !albumsLoading && !albumsError && albums.length > 0 && (
        <div className="space-y-6">
          {myAlbums.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                My Albums
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myAlbums.map((album) => (
                  <Link
                    key={album.id}
                    to={`/shared-collection/${album.id}`}
                    className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/50 shadow-sm transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                        {album.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-label-sm text-[11px] font-bold shrink-0 ${ROLE_BADGE_CLASSES[album.myRole]}`}
                      >
                        {ROLE_LABELS[album.myRole]}
                      </span>
                    </div>
                    {album.description && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                        {album.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-on-surface-variant font-label-sm text-label-sm pt-1 mt-auto">
                      <span>
                        {album.memberCount} {album.memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <span>•</span>
                      <span>
                        {album.itemCount} {album.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {sharedWithMe.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Shared With Me
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sharedWithMe.map((album) => (
                  <Link
                    key={album.id}
                    to={`/shared-collection/${album.id}`}
                    className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 hover:border-primary/50 shadow-sm transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                        {album.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-label-sm text-[11px] font-bold shrink-0 ${ROLE_BADGE_CLASSES[album.myRole]}`}
                      >
                        {ROLE_LABELS[album.myRole]}
                      </span>
                    </div>
                    {album.description && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                        {album.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-on-surface-variant font-label-sm text-label-sm pt-1 mt-auto">
                      <span>
                        {album.memberCount} {album.memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <span>•</span>
                      <span>
                        {album.itemCount} {album.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* New Shared Album Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="New shared album"
        >
          <form
            onSubmit={handleCreateAlbum}
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl border border-outline-variant/25 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                New shared album
              </h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Album name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="e.g. Weekend Bird Walk"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 font-body-md focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface font-semibold">
                Description
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={newAlbumDesc}
                onChange={(e) => setNewAlbumDesc(e.target.value)}
                placeholder="What are you collecting together?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 font-body-md resize-none focus:outline-none focus:border-primary"
              />
            </div>

            {createAlbumError && (
              <p className="font-body-sm text-body-sm text-error">{createAlbumError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingAlbum}
                className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm disabled:opacity-60"
              >
                {creatingAlbum ? 'Creating...' : 'Create Album'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
