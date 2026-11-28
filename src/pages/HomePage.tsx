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
import {
  CARE_REMINDERS_REFRESH_EVENT,
  DueCareReminderItem,
  completeCareReminder,
  formatEntryDate,
  getReminderStatus,
  getReminderTypeMeta,
  listDueCareRemindersAcrossSubjects,
} from '../services/careService';

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

  // "Today's care" due/overdue reminders state
  const [dueCareReminders, setDueCareReminders] = useState<DueCareReminderItem[]>([]);
  const [dueCareLoading, setDueCareLoading] = useState(false);
  const [dueCareLoadedOnce, setDueCareLoadedOnce] = useState(false);
  const [dueCareError, setDueCareError] = useState<string | null>(null);
  const [completingReminderId, setCompletingReminderId] = useState<string | null>(null);
  const [careActionError, setCareActionError] = useState<{
    message: string;
    reminder: DueCareReminderItem;
  } | null>(null);

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
  ]);

  const effectivePrivate = currentUser ? privateData ?? userProfile : null;
  const interests = effectivePrivate?.interests ?? [];
  const favorites = effectivePrivate?.favoriteSpecies ?? [];
  const notInterestedIds = userProfile?.notInterestedIds ?? [];

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

  // Load "Today's care" due or overdue reminders across all non-archived subjects
  const loadDueCareReminders = useCallback(async () => {
    if (!currentUser?.id) {
      setDueCareReminders([]);
      setDueCareError(null);
      setDueCareLoading(false);
      setDueCareLoadedOnce(false);
      return;
    }

    setDueCareLoading(true);
    setDueCareError(null);
    try {
      const items = await listDueCareRemindersAcrossSubjects();
      setDueCareReminders(items);
    } catch (err: any) {
      setDueCareError(err?.message || "Could not load today's care reminders.");
    } finally {
      setDueCareLoading(false);
      setDueCareLoadedOnce(true);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadDueCareReminders();
  }, [loadDueCareReminders]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const handleRefresh = () => {
      loadDueCareReminders();
    };
    window.addEventListener(CARE_REMINDERS_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(CARE_REMINDERS_REFRESH_EVENT, handleRefresh);
    };
  }, [currentUser?.id, loadDueCareReminders]);

  const handleCompleteDueCare = useCallback(
    async (reminder: DueCareReminderItem) => {
      if (completingReminderId) return;
      setCompletingReminderId(reminder.id);
      setCareActionError(null);
      try {
        await completeCareReminder(reminder.id);
        await loadDueCareReminders();
        showToast(`Done! Logged "${reminder.title}" for ${reminder.subjectName}.`);
      } catch (err: any) {
        setCareActionError({
          message: err?.message || 'Could not mark reminder done.',
          reminder,
        });
      } finally {
        setCompletingReminderId(null);
      }
    },
    [completingReminderId, loadDueCareReminders]
  );

  // Fetch "For You" species worldwide
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadForYou() {
      setForYouLoading(true);
      setForYouError(null);
      try {
        const items = await fetchForYouSpecies({
          interests,
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
  }, [interestsKey, forYouRefreshTick]);

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
              <span>Edit interests &amp; favorites</span>
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
            placeholder="Search animals, plants, fungi..."
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

      {/* TODAY'S CARE CARD (shown only when loading, errored, or there are due/overdue reminders) */}
      {currentUser &&
        ((dueCareLoading && !dueCareLoadedOnce) ||
          Boolean(dueCareError) ||
          dueCareReminders.length > 0) && (
          <section
            aria-label="Today's care"
            className="px-3 sm:px-margin py-space-xs"
          >
            {dueCareLoading && !dueCareLoadedOnce ? (
              <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/25 space-y-3 animate-pulse">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-5 w-36 rounded bg-surface-container-high" />
                  <div className="h-4 w-16 rounded bg-surface-container-high" />
                </div>
                <div className="h-14 rounded-2xl bg-surface-container-high" />
              </div>
            ) : dueCareError ? (
              <div className="p-4 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                    error
                  </span>
                  <p className="font-body-sm text-body-sm text-error">
                    {dueCareError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadDueCareReminders}
                  className="px-4 min-h-[40px] rounded-full bg-error text-on-error font-label-md text-xs font-bold shrink-0"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-secondary-container/50 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                        yard
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-headline-sm text-base sm:text-lg font-bold text-primary">
                          Today&apos;s care
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-error/15 text-error text-[11px] font-bold">
                          {dueCareReminders.length}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Reminders show when you open WildDex. Notifications are coming later.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/care"
                    className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-full bg-surface-container-low hover:bg-surface-container text-primary font-label-sm text-xs font-semibold shrink-0"
                  >
                    <span>My Care</span>
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      chevron_right
                    </span>
                  </Link>
                </div>

                {careActionError && (
                  <div className="p-3 rounded-xl bg-error-container/25 border border-error/35 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-on-error-container font-medium">
                      {careActionError.message}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(completingReminderId)}
                      onClick={() => handleCompleteDueCare(careActionError.reminder)}
                      className="px-3 py-1 rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40 shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {dueCareReminders.map((rem) => {
                    const { status, label } = getReminderStatus(rem.nextDue);
                    const tMeta = getReminderTypeMeta(rem.kind);
                    const isBusy = completingReminderId === rem.id;
                    const badgeClasses =
                      status === 'overdue'
                        ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/35'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35';

                    return (
                      <div
                        key={rem.id}
                        className="p-3 rounded-2xl bg-surface-container-low/70 border border-outline-variant/20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5"
                      >
                        <Link
                          to={`/care/${rem.subjectId}`}
                          className="flex items-center gap-3 min-w-0 flex-1 group"
                        >
                          <div
                            className="w-9 h-9 rounded-xl bg-surface-container-lowest border border-outline-variant/25 text-primary flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {tMeta.icon}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-label-md text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                                {rem.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${badgeClasses}`}
                              >
                                {label}
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant truncate mt-0.5">
                              {rem.subjectName}
                              {status === 'overdue'
                                ? ` · Was due ${formatEntryDate(rem.nextDue)}`
                                : ' · Due today'}
                            </p>
                          </div>
                        </Link>

                        <button
                          type="button"
                          disabled={Boolean(completingReminderId)}
                          onClick={() => handleCompleteDueCare(rem)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 shrink-0 ml-auto"
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              isBusy ? 'animate-spin' : ''
                            }`}
                            aria-hidden="true"
                          >
                            {isBusy ? 'progress_activity' : 'check_circle'}
                          </span>
                          <span>{isBusy ? 'Saving...' : 'Mark done'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

      {/* FOR YOU SECTION */}
      <section className="px-3 sm:px-margin py-space-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold flex items-center gap-1.5">
              <span>For You</span>
              <span className="material-symbols-outlined text-[20px] text-secondary">public</span>
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Popular species worldwide in your chosen groups
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
                  : 'Try picking more groups to see more wildlife.'}
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
                <span>{currentUser ? 'Edit interests & favorites' : 'Browse Explore'}</span>
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
