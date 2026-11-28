import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { AddPastSightingModal } from '../components/lifeList/AddPastSightingModal';
import {
  LifeListEntry,
  SightingRecord,
  SpeciesDetailData,
  deleteSighting,
  fetchSpeciesDetailAndSightings,
  formatLifeListDate,
  formatRaritySimple,
  getLifeListCategoryIcon,
  todayLocalYmd,
  updateSighting,
} from '../services/lifeListService';

export const LifeListDetailPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { itemId } = useParams<{ itemId: string }>();
  const location = useLocation();
  const stateEntry = (location.state as { entry?: LifeListEntry } | null)?.entry ?? null;

  const [detail, setDetail] = useState<SpeciesDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});
  const [heroPhotoFailed, setHeroPhotoFailed] = useState(false);

  // Quick favorite toggle state
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [favoriteRetryTarget, setFavoriteRetryTarget] = useState<SightingRecord | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  // Edit sighting modal state
  const [editingSighting, setEditingSighting] = useState<SightingRecord | null>(null);
  const [editSeenOn, setEditSeenOn] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editFavorite, setEditFavorite] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete sighting confirmation state
  const [deletingSighting, setDeletingSighting] = useState<SightingRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add another sighting modal
  const [pastModalOpen, setPastModalOpen] = useState(false);

  // Enlarged photo preview
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const resolvedSpeciesNameRef = useRef<string | undefined>(stateEntry?.speciesName);

  useEffect(() => {
    resolvedSpeciesNameRef.current = stateEntry?.speciesName;
  }, [itemId, stateEntry?.speciesName]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loadDetail = useCallback(async () => {
    if (!currentUser || !itemId) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setHeroPhotoFailed(false);
    try {
      const data = await fetchSpeciesDetailAndSightings(
        itemId,
        resolvedSpeciesNameRef.current || stateEntry?.speciesName
      );
      resolvedSpeciesNameRef.current = data.speciesName;
      setDetail(data);
      setBrokenPhotoIds({});
    } catch (err: any) {
      setError(err?.message || 'Could not load this species right now.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, itemId, stateEntry?.speciesName]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Escape key closes open dialogs
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (enlargedPhotoUrl) {
        setEnlargedPhotoUrl(null);
      } else if (editingSighting && !editSaving) {
        setEditingSighting(null);
        setEditError(null);
      } else if (deletingSighting && !deleting) {
        setDeletingSighting(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enlargedPhotoUrl, editingSighting, editSaving, deletingSighting, deleting]);

  const openEditModal = (sighting: SightingRecord) => {
    setEditingSighting(sighting);
    setEditSeenOn(
      sighting.seenOn || (sighting.createdAt ? sighting.createdAt.slice(0, 10) : todayLocalYmd())
    );
    setEditNotes(sighting.notes || '');
    setEditFavorite(Boolean(sighting.favorite));
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSighting || editSaving) return;

    const today = todayLocalYmd();
    if (editSeenOn && editSeenOn > today) {
      setEditError('Date seen cannot be in the future.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await updateSighting({
        id: editingSighting.id,
        notes: editNotes,
        seenOn: editSeenOn,
        favorite: editFavorite,
      });
      setEditingSighting(null);
      setToast('Sighting updated.');
      await loadDetail();
    } catch (err: any) {
      setEditError(err?.message || 'Could not update sighting. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleQuickToggleFavorite = async (sighting: SightingRecord) => {
    if (favoriteBusyId) return;
    setFavoriteBusyId(sighting.id);
    setFavoriteError(null);
    setFavoriteRetryTarget(null);

    const nextFav = !sighting.favorite;
    const seenOnVal =
      sighting.seenOn || (sighting.createdAt ? sighting.createdAt.slice(0, 10) : '');

    try {
      const updated = await updateSighting({
        id: sighting.id,
        notes: sighting.notes,
        seenOn: seenOnVal,
        favorite: nextFav,
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              sightings: prev.sightings.map((s) =>
                s.id === updated.id ? { ...s, favorite: updated.favorite } : s
              ),
            }
          : prev
      );
    } catch (err: any) {
      setFavoriteRetryTarget(sighting);
      setFavoriteError(err?.message || 'Could not update favorite. Please try again.');
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSighting || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const removedId = deletingSighting.id;
      await deleteSighting({
        id: removedId,
        photoPath: deletingSighting.photoPath,
      });
      setDeletingSighting(null);
      setToast('Sighting deleted.');

      const remaining = (detail?.sightings || []).filter((s) => s.id !== removedId);
      if (remaining.length === 0) {
        setDetail((prev) => (prev ? { ...prev, sightings: [] } : null));
      } else {
        await loadDetail();
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete this sighting. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to view this species"
          description="Sign in to open your life list and view or edit your sightings."
          icon="menu_book"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/life-list"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-full bg-surface-container-low border border-outline-variant/30 text-on-surface font-label-md text-xs font-semibold hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to My Life List</span>
        </Link>

        {detail && detail.sightings.length > 0 && (
          <button
            type="button"
            onClick={() => setPastModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shadow-sm hover:opacity-95"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add
            </span>
            <span>Add a past sighting</span>
          </button>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse" aria-label="Loading species details">
          <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden">
            <div className="aspect-[16/10] sm:aspect-[16/7] w-full bg-surface-container-high" />
            <div className="p-5 space-y-3">
              <div className="h-7 w-48 rounded bg-surface-container-high" />
              <div className="h-4 w-36 rounded bg-surface-container-high" />
              <div className="h-4 w-64 rounded bg-surface-container-high" />
            </div>
          </div>
          <div className="h-24 rounded-2xl bg-surface-container-high" />
          <div className="h-24 rounded-2xl bg-surface-container-high" />
        </div>
      )}

      {/* Error State with Retry */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error" aria-hidden="true">
            error_outline
          </span>
          <p className="font-body-md text-body-md text-on-surface font-medium max-w-md">
            {error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={loadDetail}
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
            >
              Retry
            </button>
            <Link
              to="/life-list"
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-surface border border-outline-variant/40 text-on-surface font-label-md font-semibold inline-flex items-center"
            >
              Back to My Life List
            </Link>
          </div>
        </div>
      )}

      {/* Empty after deleting all sightings */}
      {!loading && !error && detail && detail.sightings.length === 0 && (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-3">
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            {detail.speciesName}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            No sightings left for this species.
          </p>
          <Link
            to="/life-list"
            className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold"
          >
            Back to My Life List
          </Link>
        </div>
      )}

      {/* Main Species Detail & Sightings */}
      {!loading && !error && detail && detail.sightings.length > 0 && (
        <>
          {/* Hero Species Card */}
          <section className="rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm overflow-hidden">
            <div className="aspect-[16/10] sm:aspect-[16/7] w-full bg-surface-container flex items-center justify-center overflow-hidden">
              {detail.heroPhotoUrl && !heroPhotoFailed ? (
                <button
                  type="button"
                  onClick={() => setEnlargedPhotoUrl(detail.heroPhotoUrl)}
                  aria-label={`View larger photo of ${detail.speciesName}`}
                  className="w-full h-full block cursor-zoom-in"
                >
                  <img
                    src={detail.heroPhotoUrl}
                    alt={detail.speciesName}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroPhotoFailed(true)}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[48px]" aria-hidden="true">
                    {getLifeListCategoryIcon(detail.category)}
                  </span>
                  {detail.category && (
                    <span className="font-body-sm text-xs capitalize">{detail.category}</span>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="font-headline-md text-headline-md text-on-surface font-bold break-words">
                    {detail.speciesName}
                  </h1>
                  {detail.scientificName && (
                    <p className="font-body-md text-body-md text-on-surface-variant italic">
                      {detail.scientificName}
                    </p>
                  )}
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    formatRaritySimple(detail.rarity).badgeClass
                  }`}
                >
                  {formatRaritySimple(detail.rarity).label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-outline-variant/20">
                <div className="p-3 rounded-2xl bg-surface-container-low">
                  <p className="font-label-sm text-[11px] text-on-surface-variant">First seen</p>
                  <p className="font-label-md text-sm text-on-surface font-semibold mt-0.5 tabular-nums">
                    {formatLifeListDate(detail.firstSeen)}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-surface-container-low">
                  <p className="font-label-sm text-[11px] text-on-surface-variant">Last seen</p>
                  <p className="font-label-md text-sm text-on-surface font-semibold mt-0.5 tabular-nums">
                    {formatLifeListDate(detail.lastSeen)}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-surface-container-low">
                  <p className="font-label-sm text-[11px] text-on-surface-variant">
                    Total sightings
                  </p>
                  <p className="font-label-md text-sm text-primary font-bold mt-0.5 tabular-nums">
                    {detail.sightings.length === 1
                      ? '1 sighting'
                      : `${detail.sightings.length} sightings`}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Favorite toggle error banner */}
          {favoriteError && (
            <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3">
              <p className="font-body-sm text-xs sm:text-sm text-on-surface font-medium">
                {favoriteError}
              </p>
              {favoriteRetryTarget && (
                <button
                  type="button"
                  onClick={() => handleQuickToggleFavorite(favoriteRetryTarget)}
                  className="px-3.5 py-2 min-h-[38px] rounded-full bg-error text-on-error font-label-md text-xs font-semibold shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Sightings List */}
          <section className="space-y-3" aria-label="Sightings of this species">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              All sightings ({detail.sightings.length})
            </h2>

            <div className="space-y-3">
              {detail.sightings.map((sighting) => {
                const showPhoto =
                  Boolean(sighting.photoUrl) && !brokenPhotoIds[sighting.id];
                const iconName = getLifeListCategoryIcon(
                  sighting.category || detail.category
                );
                const isFavBusy = favoriteBusyId === sighting.id;

                return (
                  <article
                    key={sighting.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Sighting Photo or Icon */}
                      {showPhoto ? (
                        <button
                          type="button"
                          onClick={() => setEnlargedPhotoUrl(sighting.photoUrl)}
                          aria-label="View sighting photo"
                          className="w-20 h-20 rounded-xl overflow-hidden bg-surface-container shrink-0 cursor-zoom-in"
                        >
                          <img
                            src={sighting.photoUrl}
                            alt={sighting.speciesName}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenPhotoIds((prev) => ({
                                ...prev,
                                [sighting.id]: true,
                              }))
                            }
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div
                          className="w-20 h-20 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0"
                          aria-hidden="true"
                        >
                          <span className="material-symbols-outlined text-[28px]">
                            {iconName}
                          </span>
                        </div>
                      )}

                      {/* Date, Notes & Favorite */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-label-md text-sm text-on-surface font-bold tabular-nums">
                            {formatLifeListDate(sighting.effectiveDate)}
                          </p>

                          <button
                            type="button"
                            disabled={isFavBusy}
                            onClick={() => handleQuickToggleFavorite(sighting)}
                            aria-label={
                              sighting.favorite
                                ? 'Remove favorite'
                                : 'Mark sighting as favorite'
                            }
                            aria-pressed={sighting.favorite}
                            className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center transition-colors ${
                              sighting.favorite
                                ? 'bg-tertiary-fixed/70 text-tertiary'
                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                            } disabled:opacity-50`}
                          >
                            <span
                              className={`material-symbols-outlined text-[20px] ${
                                sighting.favorite ? 'fill-1' : ''
                              }`}
                              aria-hidden="true"
                            >
                              star
                            </span>
                          </button>
                        </div>

                        {sighting.notes ? (
                          <p className="font-body-sm text-sm text-on-surface whitespace-pre-wrap break-words">
                            {sighting.notes}
                          </p>
                        ) : (
                          <p className="font-body-sm text-xs text-on-surface-variant">
                            No notes added.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Edit & Delete Actions */}
                    <div className="pt-2 border-t border-outline-variant/20 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(sighting)}
                        className="flex-1 min-h-[40px] px-3 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          edit
                        </span>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingSighting(sighting);
                        }}
                        className="flex-1 min-h-[40px] px-3 rounded-full bg-error-container/20 hover:bg-error-container/35 text-error font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          delete
                        </span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Edit Sighting Modal */}
      {editingSighting && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            if (!editSaving) {
              setEditingSighting(null);
              setEditError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit sighting"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-surface p-5 shadow-2xl border border-outline-variant/30 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Edit sighting
              </h2>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => {
                  setEditingSighting(null);
                  setEditError(null);
                }}
                aria-label="Close edit dialog"
                className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-sighting-date"
                  className="block font-label-md text-xs font-semibold text-on-surface"
                >
                  Date seen
                </label>
                <input
                  id="edit-sighting-date"
                  type="date"
                  max={todayLocalYmd()}
                  value={editSeenOn}
                  onChange={(e) => setEditSeenOn(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="edit-sighting-notes"
                    className="block font-label-md text-xs font-semibold text-on-surface"
                  >
                    Notes
                  </label>
                  <span className="text-[11px] text-on-surface-variant tabular-nums">
                    {editNotes.length} / 1000
                  </span>
                </div>
                <textarea
                  id="edit-sighting-notes"
                  rows={4}
                  maxLength={1000}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value.slice(0, 1000))}
                  placeholder="Write what you saw..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 cursor-pointer min-h-[48px]">
                <span className="flex items-center gap-2 font-label-md text-sm text-on-surface font-medium">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      editFavorite ? 'text-tertiary fill-1' : 'text-on-surface-variant'
                    }`}
                    aria-hidden="true"
                  >
                    star
                  </span>
                  <span>Favorite sighting</span>
                </span>
                <input
                  type="checkbox"
                  checked={editFavorite}
                  onChange={(e) => setEditFavorite(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded cursor-pointer"
                />
              </label>

              {editError && (
                <div className="p-3 rounded-xl bg-error-container/30 border border-error/35 text-xs text-on-error-container flex items-center justify-between gap-2">
                  <span>{editError}</span>
                  <button
                    type="button"
                    disabled={editSaving}
                    onClick={handleSaveEdit}
                    className="px-3 py-1 rounded-full bg-surface text-primary font-semibold border border-outline-variant/40 shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => {
                    setEditingSighting(null);
                    setEditError(null);
                  }}
                  className="flex-1 min-h-[44px] px-4 rounded-full bg-surface-container text-on-surface font-label-md text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 min-h-[44px] px-4 rounded-full bg-primary text-on-primary font-label-md text-sm font-semibold shadow-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                >
                  {editSaving && (
                    <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                      progress_activity
                    </span>
                  )}
                  <span>{editSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Sighting Confirmation Modal */}
      {deletingSighting && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!deleting) {
              setDeletingSighting(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete sighting"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl border border-outline-variant/30 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  delete_forever
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Delete this sighting?
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  This removes the sighting from {formatLifeListDate(deletingSighting.effectiveDate)} permanently.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container flex items-center justify-between gap-2">
                <span>{deleteError}</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="px-2.5 py-1 rounded-full bg-surface text-primary font-semibold border border-outline-variant/40 shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeletingSighting(null);
                  setDeleteError(null);
                }}
                className="flex-1 min-h-[44px] px-4 rounded-full bg-surface-container text-on-surface font-label-md text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[44px] px-4 rounded-full bg-error text-on-error font-label-md text-sm font-semibold shadow-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {deleting && (
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                    progress_activity
                  </span>
                )}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Past Sighting Modal (prefilled for this species) */}
      <AddPastSightingModal
        isOpen={pastModalOpen}
        prefill={
          detail
            ? {
                speciesName: detail.speciesName,
                scientificName: detail.scientificName,
                category: detail.category,
              }
            : null
        }
        onClose={() => setPastModalOpen(false)}
        onSaved={() => {
          setPastModalOpen(false);
          setToast('Sighting added.');
          loadDetail();
        }}
      />

      {/* Photo Lightbox */}
      {enlargedPhotoUrl && (
        <div
          className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEnlargedPhotoUrl(null)}
        >
          <button
            type="button"
            onClick={() => setEnlargedPhotoUrl(null)}
            aria-label="Close photo preview"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-surface/90 text-on-surface flex items-center justify-center shadow-lg"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              close
            </span>
          </button>
          <img
            src={enlargedPhotoUrl}
            alt={detail?.speciesName || 'Sighting photo'}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-xs shadow-lg max-w-[90vw] truncate"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
