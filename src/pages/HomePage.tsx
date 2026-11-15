import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ForYouSpeciesItem,
  fetchForYouSpecies,
  fetchSimilarToFavorites,
  buildScanResultFromForYou,
  generateFallbackSpecimenDataUrl,
} from '../services/forYouService';
import {
  addSpecimenToSupabase,
  getSupabaseUserCollection,
} from '../services/supabaseCollectionService';
import { ForYouSpeciesCard } from '../components/home/ForYouSpeciesCard';
import { fetchMyUserPrivate, UserPrivateData } from '../services/userPrivateService';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    userProfile,
    setAuthModalOpen,
    dismissSpeciesInterest,
    resetDismissedSpecies,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [privateData, setPrivateData] = useState<UserPrivateData | null>(null);

  // "For You" state
  const [forYouItems, setForYouItems] = useState<ForYouSpeciesItem[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [forYouError, setForYouError] = useState<string | null>(null);
  const [forYouRefreshTick, setForYouRefreshTick] = useState(0);
  const [forYouForceRefresh, setForYouForceRefresh] = useState(false);

  // "Similar to your favorites" state
  const [similarItems, setSimilarItems] = useState<ForYouSpeciesItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [similarRefreshTick, setSimilarRefreshTick] = useState(0);
  const [similarForceRefresh, setSimilarForceRefresh] = useState(false);

  // Collection saving state
  const [addingTaxonId, setAddingTaxonId] = useState<number | null>(null);
  const [addedSciNames, setAddedSciNames] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load current signed-in user's preferences directly from user_private
  useEffect(() => {
    if (!currentUser?.id) {
      setPrivateData(null);
      return;
    }
    let active = true;
    fetchMyUserPrivate()
      .then((priv) => {
        if (active) setPrivateData(priv);
      })
      .catch((err) => {
        console.warn('Could not read user_private on Home:', err);
      });
    return () => {
      active = false;
    };
  }, [
    currentUser?.id,
    userProfile?.interests,
    userProfile?.favoriteSpecies,
    userProfile?.locationConsent,
    userProfile?.homeLat,
    userProfile?.homeLng,
  ]);

  const effectivePrivate = currentUser ? privateData ?? userProfile : null;
  const interests = effectivePrivate?.interests ?? [];
  const favorites = effectivePrivate?.favoriteSpecies ?? [];
  const notInterestedIds = userProfile?.notInterestedIds ?? [];
  const hasLocation = Boolean(
    effectivePrivate?.locationConsent &&
      effectivePrivate?.homeLat !== null &&
      effectivePrivate?.homeLat !== undefined &&
      effectivePrivate?.homeLng !== null &&
      effectivePrivate?.homeLng !== undefined
  );
  const homeLat = hasLocation ? effectivePrivate?.homeLat ?? null : null;
  const homeLng = hasLocation ? effectivePrivate?.homeLng ?? null : null;

  const interestsKey = interests.join('|');
  const favoritesKey = favorites
    .map((f) => `${f.id}:${f.scientificName}`)
    .join('|');

  // Pre-load existing collection scientific names for signed-in user
  useEffect(() => {
    let active = true;
    if (!currentUser?.id) {
      setAddedSciNames(new Set());
      return;
    }

    getSupabaseUserCollection(currentUser.id)
      .then((items) => {
        if (!active) return;
        const names = new Set(
          items
            .map((item) => item.scientificName?.trim().toLowerCase())
            .filter(Boolean)
        );
        setAddedSciNames(names);
      })
      .catch((err) => {
        console.warn('Could not preload collection items on Home:', err);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  // Fetch "For You" species (with or without home location)
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadForYou() {
      setForYouLoading(true);
      setForYouError(null);
      try {
        const items = await fetchForYouSpecies({
          interests,
          lat: homeLat,
          lng: homeLng,
          hasLocation,
          forceRefresh: forYouForceRefresh,
          signal: controller.signal,
        });
        if (active) {
          setForYouItems(items);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !active) return;
        setForYouError(err?.message || 'Could not load For You suggestions right now.');
        setForYouItems([]);
      } finally {
        if (active) {
          setForYouLoading(false);
          setForYouForceRefresh(false);
        }
      }
    }

    loadForYou();
    return () => {
      active = false;
      controller.abort();
    };
  }, [interestsKey, hasLocation, homeLat, homeLng, forYouRefreshTick]);

  // Fetch "Similar to your favorites" using iNaturalist taxa API (same genus or family)
  useEffect(() => {
    if (favorites.length === 0) {
      setSimilarItems([]);
      setSimilarLoading(false);
      setSimilarError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadSimilar() {
      setSimilarLoading(true);
      setSimilarError(null);
      try {
        const items = await fetchSimilarToFavorites({
          favorites,
          forceRefresh: similarForceRefresh,
          signal: controller.signal,
        });
        if (active) {
          setSimilarItems(items);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || !active) return;
        setSimilarError(err?.message || 'Could not load similar species right now.');
        setSimilarItems([]);
      } finally {
        if (active) {
          setSimilarLoading(false);
          setSimilarForceRefresh(false);
        }
      }
    }

    loadSimilar();
    return () => {
      active = false;
      controller.abort();
    };
  }, [favoritesKey, similarRefreshTick]);

  const dismissedSet = useMemo(() => new Set(notInterestedIds), [notInterestedIds]);

  const visibleForYouItems = useMemo(
    () => forYouItems.filter((item) => !dismissedSet.has(item.taxonId)),
    [forYouItems, dismissedSet]
  );

  const visibleSimilarItems = useMemo(
    () => similarItems.filter((item) => !dismissedSet.has(item.taxonId)),
    [similarItems, dismissedSet]
  );

  const handleAddToCollection = useCallback(
    async (item: ForYouSpeciesItem) => {
      if (!currentUser) {
        showToast('Sign in to save species to your Collection.');
        setAuthModalOpen(true);
        return;
      }

      if (addingTaxonId !== null) return;
      setAddingTaxonId(item.taxonId);

      try {
        const scanResult = buildScanResultFromForYou(item);
        const photoDataUrl =
          item.photoUrl ||
          generateFallbackSpecimenDataUrl(item.commonName, item.scientificName);

        await addSpecimenToSupabase({
          userId: currentUser.id,
          scanResult,
          photoDataUrl,
          includeLocation: false,
        });

        setAddedSciNames((prev) => {
          const next = new Set(prev);
          next.add(item.scientificName.trim().toLowerCase());
          return next;
        });
        showToast(`Added ${item.commonName} to Collection`);
      } catch (err: any) {
        console.error('Failed to add species to collection:', err);
        showToast(err?.message || 'Could not save to Collection. Please try again.');
      } finally {
        setAddingTaxonId(null);
      }
    },
    [currentUser, addingTaxonId, setAuthModalOpen]
  );

  const handleNotInterested = useCallback(
    async (item: ForYouSpeciesItem) => {
      try {
        await dismissSpeciesInterest(item.taxonId);
        showToast(`Hid ${item.commonName} from your suggestions`);
      } catch (err: any) {
        console.error('Failed to save not interested:', err);
        showToast(err?.message || 'Could not save your preference.');
      }
    },
    [dismissSpeciesInterest]
  );

  const handleResetHidden = useCallback(async () => {
    try {
      await resetDismissedSpecies();
      showToast('Hidden suggestions restored');
    } catch (err: any) {
      console.error('Failed to reset hidden suggestions:', err);
      showToast(err?.message || 'Could not restore hidden suggestions.');
    }
  }, [resetDismissedSpecies]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name =
      userProfile?.displayName ||
      currentUser?.displayName ||
      currentUser?.email?.split('@')[0] ||
      'Explorer';
    const firstName = name.split(' ')[0];
    return `${timeGreeting}, ${firstName}`;
  };

  return (
    <div className="flex flex-col w-full relative pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 max-w-[90vw]">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
            verified
          </span>
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Top Greeting & Live Search */}
      <section className="px-3 sm:px-margin pt-3 pb-space-sm flex flex-col gap-space-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight flex flex-wrap items-center gap-1.5">
              {getGreeting()} <span>🌿</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Discover real species tailored to what you love.
            </p>
          </div>
          {currentUser && (
            <Link
              to="/onboarding?edit=1"
              className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold shrink-0 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Edit interests &amp; area</span>
            </Link>
          )}
        </div>

        {/* Search Field */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full mt-1">
          <div className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[22px]">search</span>
          </div>
          <input
            className="w-full h-12 pl-11 pr-14 rounded-full bg-surface-container text-on-surface placeholder:text-on-surface-variant/70 font-body-md text-body-md shadow-sm focus:outline-none focus:bg-surface-container-lowest transition-all"
            placeholder="Search real species, habitats, fungi..."
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            aria-label="Open Explore filters"
            className="absolute right-1.5 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform"
            type="button"
            onClick={() => navigate('/explore')}
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
          </button>
        </form>
      </section>

      {/* FOR YOU SECTION */}
      <section className="px-3 sm:px-margin py-space-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-1.5">
              <span>For You</span>
              <span className="material-symbols-outlined text-[20px] text-secondary">
                {hasLocation ? 'location_on' : 'public'}
              </span>
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {hasLocation
                ? 'Seen near you (within 50 km) from your chosen groups'
                : 'Popular species worldwide in your chosen groups'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!hasLocation && currentUser && (
              <Link
                to="/onboarding?edit=1"
                className="px-3 min-h-[36px] rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold inline-flex items-center gap-1 hover:opacity-95"
              >
                <span className="material-symbols-outlined text-[15px]">add_location</span>
                <span>Add area</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setForYouForceRefresh(true);
                setForYouRefreshTick((t) => t + 1);
              }}
              aria-label="Refresh For You suggestions"
              className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        {/* Active Interests Chips */}
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {interests.map((group) => (
              <span
                key={group}
                className="px-2.5 py-1 rounded-full bg-secondary-container/45 text-on-secondary-container font-label-sm text-label-sm font-semibold"
              >
                {group}
              </span>
            ))}
          </div>
        )}

        {/* Loading Skeletons */}
        {forYouLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden animate-pulse flex flex-col"
              >
                <div className="w-full h-40 bg-surface-container-high" />
                <div className="p-3 space-y-2.5">
                  <div className="h-5 w-2/3 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-1/2 rounded bg-surface-container-high" />
                  <div className="h-10 w-full rounded-full bg-surface-container-high mt-2" />
                  <div className="h-9 w-full rounded-full bg-surface-container" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry */}
        {!forYouLoading && forYouError && (
          <div className="p-4 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                error
              </span>
              <p className="font-body-sm text-body-sm text-error">{forYouError}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setForYouForceRefresh(true);
                setForYouRefreshTick((t) => t + 1);
              }}
              className="px-4 min-h-[44px] rounded-full bg-error text-on-error font-label-md text-label-md font-bold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!forYouLoading && !forYouError && visibleForYouItems.length === 0 && (
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary-container/40 text-secondary mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">travel_explore</span>
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                No species to show right now
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {forYouItems.length > 0 && dismissedSet.size > 0
                  ? 'You hid all current matches for your groups.'
                  : 'Try picking more groups or updating your area to see more local wildlife.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {forYouItems.length > 0 && dismissedSet.size > 0 && (
                <button
                  type="button"
                  onClick={handleResetHidden}
                  className="px-4 min-h-[44px] rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold"
                >
                  Show hidden species
                </button>
              )}
              <Link
                to={currentUser ? '/onboarding?edit=1' : '/explore'}
                className="px-4 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold inline-flex items-center gap-1.5"
              >
                <span>{currentUser ? 'Edit interests & area' : 'Browse Explore'}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {!forYouLoading && !forYouError && visibleForYouItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleForYouItems.map((item) => (
              <ForYouSpeciesCard
                key={item.taxonId}
                item={item}
                layout="grid"
                isAdding={addingTaxonId === item.taxonId}
                isAdded={addedSciNames.has(item.scientificName.trim().toLowerCase())}
                onAddToCollection={handleAddToCollection}
                onNotInterested={handleNotInterested}
              />
            ))}
          </div>
        )}
      </section>

      {/* SIMILAR TO YOUR FAVORITES ROW */}
      <section className="py-space-sm flex flex-col gap-3 mt-2">
        <div className="px-3 sm:px-margin flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-1.5">
              <span>Similar to your favorites</span>
              <span className="material-symbols-outlined text-[20px] text-secondary">
                account_tree
              </span>
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Species from the same genus or family as your favorites
            </p>
          </div>
          {favorites.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSimilarForceRefresh(true);
                setSimilarRefreshTick((t) => t + 1);
              }}
              aria-label="Refresh similar species"
              className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          )}
        </div>

        {/* No favorites saved yet */}
        {favorites.length === 0 ? (
          <div className="px-3 sm:px-margin">
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-secondary-container/40 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">favorite</span>
                </div>
                <div className="min-w-0">
                  <p className="font-label-lg text-label-lg font-bold text-on-surface">
                    No favorite species picked yet
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Pick a few animals, plants, or mushrooms you like to see close relatives here.
                  </p>
                </div>
              </div>
              <Link
                to={currentUser ? '/onboarding?edit=1' : '/explore'}
                className="px-4 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold inline-flex items-center gap-1.5 shrink-0"
              >
                <span>{currentUser ? 'Pick favorites' : 'Explore species'}</span>
              </Link>
            </div>
          </div>
        ) : similarLoading ? (
          /* Loading Skeletons for Similar Row */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-stretch gap-3.5 md:overflow-x-auto px-3 sm:px-margin no-scrollbar py-1">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="w-full md:w-72 md:shrink-0 rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden animate-pulse flex flex-col"
              >
                <div className="w-full h-40 bg-surface-container-high" />
                <div className="p-3 space-y-2.5">
                  <div className="h-5 w-2/3 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-1/2 rounded bg-surface-container-high" />
                  <div className="h-10 w-full rounded-full bg-surface-container-high mt-2" />
                  <div className="h-9 w-full rounded-full bg-surface-container" />
                </div>
              </div>
            ))}
          </div>
        ) : similarError ? (
          /* Error State with Retry */
          <div className="px-3 sm:px-margin">
            <div className="p-4 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                  error
                </span>
                <p className="font-body-sm text-body-sm text-error">{similarError}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSimilarForceRefresh(true);
                  setSimilarRefreshTick((t) => t + 1);
                }}
                className="px-4 min-h-[44px] rounded-full bg-error text-on-error font-label-md text-label-md font-bold shrink-0"
              >
                Retry
              </button>
            </div>
          </div>
        ) : visibleSimilarItems.length === 0 ? (
          /* Empty State */
          <div className="px-3 sm:px-margin">
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-wrap items-center justify-between gap-3">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {similarItems.length > 0 && dismissedSet.size > 0
                  ? 'All similar species are currently hidden.'
                  : 'No closely related species found for your current favorites.'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {similarItems.length > 0 && dismissedSet.size > 0 && (
                  <button
                    type="button"
                    onClick={handleResetHidden}
                    className="px-3.5 min-h-[40px] rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold"
                  >
                    Show hidden species
                  </button>
                )}
                <Link
                  to="/onboarding?edit=1"
                  className="px-3.5 min-h-[40px] rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold inline-flex items-center"
                >
                  Update favorites
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Horizontal Scroll Row on Desktop, Responsive Grid on Mobile */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-stretch gap-3.5 md:overflow-x-auto px-3 sm:px-margin no-scrollbar py-1">
            {visibleSimilarItems.map((item) => (
              <ForYouSpeciesCard
                key={`sim-${item.taxonId}`}
                item={item}
                layout="row"
                isAdding={addingTaxonId === item.taxonId}
                isAdded={addedSciNames.has(item.scientificName.trim().toLowerCase())}
                onAddToCollection={handleAddToCollection}
                onNotInterested={handleNotInterested}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
