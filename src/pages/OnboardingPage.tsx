import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, FavoriteSpeciesItem } from '../contexts/AuthContext';
import { fetchMyUserPrivate } from '../services/userPrivateService';

interface InterestGroup {
  id: string;
  label: string;
  icon: string;
  wikiSubject: string;
}

const INTEREST_GROUPS: InterestGroup[] = [
  { id: 'Mammals', label: 'Mammals', icon: 'pets', wikiSubject: 'Red fox' },
  { id: 'Birds', label: 'Birds', icon: 'flutter', wikiSubject: 'Peregrine falcon' },
  { id: 'Reptiles', label: 'Reptiles', icon: 'cruelty_free', wikiSubject: 'Green iguana' },
  { id: 'Insects', label: 'Insects', icon: 'bug_report', wikiSubject: 'Monarch butterfly' },
  { id: 'Marine life', label: 'Marine life', icon: 'water', wikiSubject: 'Common bottlenose dolphin' },
  { id: 'Plants', label: 'Plants', icon: 'local_florist', wikiSubject: 'Rosa' },
  { id: 'Trees', label: 'Trees', icon: 'park', wikiSubject: 'Sequoiadendron giganteum' },
  { id: 'Fungi', label: 'Fungi', icon: 'psychiatry', wikiSubject: 'Amanita muscaria' },
  { id: 'Pets', label: 'Pets', icon: 'pets', wikiSubject: 'Dog' },
  { id: 'Farm animals', label: 'Farm animals', icon: 'agriculture', wikiSubject: 'Cattle' },
  { id: 'Crops', label: 'Crops', icon: 'grass', wikiSubject: 'Wheat' },
];

const POPULAR_BY_GROUP: Record<string, FavoriteSpeciesItem[]> = {
  Mammals: [
    { id: 42069, commonName: 'Red Fox', scientificName: 'Vulpes vulpes' },
    { id: 43094, commonName: 'Gray Wolf', scientificName: 'Canis lupus' },
    { id: 41663, commonName: 'Black Bear', scientificName: 'Ursus americanus' },
  ],
  Birds: [
    { id: 9083, commonName: 'Bald Eagle', scientificName: 'Haliaeetus leucocephalus' },
    { id: 12727, commonName: 'American Robin', scientificName: 'Turdus migratorius' },
    { id: 4647, commonName: 'Peregrine Falcon', scientificName: 'Falco peregrinus' },
  ],
  Reptiles: [
    { id: 35342, commonName: 'Green Iguana', scientificName: 'Iguana iguana' },
    { id: 39702, commonName: 'Red-eared Slider', scientificName: 'Trachemys scripta elegans' },
    { id: 28339, commonName: 'Common Garter Snake', scientificName: 'Thamnophis sirtalis' },
  ],
  Insects: [
    { id: 48662, commonName: 'Monarch Butterfly', scientificName: 'Danaus plexippus' },
    { id: 47219, commonName: 'Western Honey Bee', scientificName: 'Apis mellifera' },
    { id: 48486, commonName: 'Seven-spotted Ladybug', scientificName: 'Coccinella septempunctata' },
  ],
  'Marine life': [
    { id: 41482, commonName: 'Bottlenose Dolphin', scientificName: 'Tursiops truncatus' },
    { id: 41521, commonName: 'Orca', scientificName: 'Orcinus orca' },
    { id: 41860, commonName: 'California Sea Lion', scientificName: 'Zalophus californianus' },
  ],
  Plants: [
    { id: 53438, commonName: 'Dog Rose', scientificName: 'Rosa canina' },
    { id: 57622, commonName: 'Common Sunflower', scientificName: 'Helianthus annuus' },
    { id: 47602, commonName: 'Common Dandelion', scientificName: 'Taraxacum officinale' },
  ],
  Trees: [
    { id: 47851, commonName: 'Coast Redwood', scientificName: 'Sequoia sempervirens' },
    { id: 47727, commonName: 'Sugar Maple', scientificName: 'Acer saccharum' },
    { id: 54769, commonName: 'English Oak', scientificName: 'Quercus robur' },
  ],
  Fungi: [
    { id: 48715, commonName: 'Fly Agaric', scientificName: 'Amanita muscaria' },
    { id: 47348, commonName: 'Golden Chanterelle', scientificName: 'Cantharellus cibarius' },
    { id: 54134, commonName: 'Turkey Tail', scientificName: 'Trametes versicolor' },
  ],
  Pets: [
    { id: 47144, commonName: 'Domestic Dog', scientificName: 'Canis lupus familiaris' },
    { id: 118552, commonName: 'Domestic Cat', scientificName: 'Felis catus' },
    { id: 43151, commonName: 'European Rabbit', scientificName: 'Oryctolagus cuniculus' },
  ],
  'Farm animals': [
    { id: 71272, commonName: 'Domestic Cattle', scientificName: 'Bos taurus' },
    { id: 506064, commonName: 'Domestic Goat', scientificName: 'Capra hircus' },
    { id: 47119, commonName: 'Red Junglefowl (Chicken)', scientificName: 'Gallus gallus' },
  ],
  Crops: [
    { id: 51737, commonName: 'Tomato', scientificName: 'Solanum lycopersicum' },
    { id: 57107, commonName: 'Bread Wheat', scientificName: 'Triticum aestivum' },
    { id: 49940, commonName: 'Maize (Corn)', scientificName: 'Zea mays' },
  ],
};

const MAX_FAVORITES = 10;
const wikiGroupPhotoCache = new Map<string, string | null>();

const InterestPicture: React.FC<{ subject: string; label: string; icon: string }> = ({
  subject,
  label,
  icon,
}) => {
  const [src, setSrc] = useState<string | null>(() => {
    const key = subject.toLowerCase();
    return wikiGroupPhotoCache.has(key) ? wikiGroupPhotoCache.get(key) ?? null : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = subject.toLowerCase();
    if (wikiGroupPhotoCache.has(key)) {
      setSrc(wikiGroupPhotoCache.get(key) ?? null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(subject)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          wikiGroupPhotoCache.set(key, null);
          return;
        }
        const json = await res.json();
        const url =
          typeof json?.thumbnail?.source === 'string' && json.thumbnail.source.trim()
            ? json.thumbnail.source.trim()
            : null;
        wikiGroupPhotoCache.set(key, url);
        if (!cancelled) {
          setFailed(false);
          setSrc(url);
        }
      } catch {
        // fallback icon stays visible
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [subject]);

  if (!src || failed) {
    return (
      <div className="w-full h-24 sm:h-28 bg-secondary-container/35 flex items-center justify-center text-secondary">
        <span className="material-symbols-outlined text-[34px]">{icon}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-24 sm:h-28 bg-surface-container overflow-hidden">
      <img
        src={src}
        alt={label}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

interface OnboardingPageProps {
  fullScreen?: boolean;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ fullScreen = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userProfile, saveOnboardingPreferences } = useAuth();
  const isEditMode = searchParams.get('edit') === '1';

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    () => userProfile?.interests ?? []
  );
  const [favoriteSpecies, setFavoriteSpecies] = useState<FavoriteSpeciesItem[]>(
    () => userProfile?.favoriteSpecies ?? []
  );

  // Step 2 iNaturalist autocomplete state
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [speciesResults, setSpeciesResults] = useState<FavoriteSpeciesItem[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [speciesRetryTick, setSpeciesRetryTick] = useState(0);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load directly from signed-in user's user_private row in edit mode
  useEffect(() => {
    if (!isEditMode || !userProfile?.id) return;
    let active = true;

    fetchMyUserPrivate()
      .then((priv) => {
        if (!active) return;
        const source = priv ?? userProfile;
        setSelectedInterests(source.interests || []);
        setFavoriteSpecies(source.favoriteSpecies || []);
      })
      .catch((err) => {
        console.warn('Could not load user_private in edit mode:', err);
      });

    return () => {
      active = false;
    };
  }, [isEditMode, userProfile?.id]);

  // Step 2: Debounced (300ms) iNaturalist taxa autocomplete
  useEffect(() => {
    const trimmed = speciesQuery.trim();
    if (!trimmed) {
      setSpeciesResults([]);
      setSpeciesLoading(false);
      setSpeciesError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSpeciesLoading(true);
      setSpeciesError(null);
      try {
        const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(
          trimmed
        )}&per_page=10`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Could not search species (${res.status})`);
        }
        const json = await res.json();
        const mapped: FavoriteSpeciesItem[] = Array.isArray(json?.results)
          ? json.results.map((taxon: any) => ({
              id: Number(taxon.id),
              commonName: taxon.preferred_common_name || taxon.name || 'Unknown species',
              scientificName: taxon.name || '',
              photoUrl:
                taxon.default_photo?.square_url ||
                taxon.default_photo?.medium_url ||
                undefined,
            }))
          : [];
        setSpeciesResults(mapped);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('iNaturalist autocomplete error:', err);
        setSpeciesError(err?.message || 'Could not load species matches. Please try again.');
        setSpeciesResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setSpeciesLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [speciesQuery, speciesRetryTick]);

  const toggleInterest = (id: string) => {
    setSaveError(null);
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isFavoriteSelected = (item: FavoriteSpeciesItem) =>
    favoriteSpecies.some(
      (f) =>
        (f.id && item.id && f.id === item.id) ||
        f.scientificName.toLowerCase() === item.scientificName.toLowerCase()
    );

  const toggleFavorite = (item: FavoriteSpeciesItem) => {
    setSaveError(null);
    if (isFavoriteSelected(item)) {
      setFavoriteSpecies((prev) =>
        prev.filter(
          (f) =>
            !(
              (f.id && item.id && f.id === item.id) ||
              f.scientificName.toLowerCase() === item.scientificName.toLowerCase()
            )
        )
      );
      return;
    }

    if (favoriteSpecies.length >= MAX_FAVORITES) {
      return;
    }

    setFavoriteSpecies((prev) => [...prev, item]);
  };

  const persistAndFinish = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await saveOnboardingPreferences({
        interests: selectedInterests,
        favoriteSpecies,
        onboardingDone: true,
        locationConsent: false,
        homeLat: null,
        homeLng: null,
        homeLabel: '',
      });

      let pendingJoinCode = '';
      try {
        pendingJoinCode = sessionStorage.getItem('wilddex_pending_join_code') || '';
      } catch {}

      if (pendingJoinCode && !isEditMode) {
        navigate(`/join/${encodeURIComponent(pendingJoinCode)}`, { replace: true });
      } else if (isEditMode) {
        navigate('/profile');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Failed to save onboarding preferences:', err);
      setSaveError(err?.message || 'Could not save your choices. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const quickPickSuggestions: FavoriteSpeciesItem[] = [];
  const seenQuickIds = new Set<number>();
  for (const group of selectedInterests) {
    const items = POPULAR_BY_GROUP[group] || [];
    for (const item of items) {
      if (!seenQuickIds.has(item.id)) {
        seenQuickIds.add(item.id);
        quickPickSuggestions.push(item);
      }
    }
  }

  const progressPct = currentStep === 1 ? 50 : 100;

  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen bg-surface pt-safe pb-safe' : 'min-h-[calc(100vh-5rem)] pb-8'
      } w-full flex flex-col`}
    >
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col px-3 sm:px-6 py-4 sm:py-6">
        {/* Top Bar & Progress */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  forest
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-headline-sm text-headline-sm text-primary font-bold truncate">
                  {isEditMode ? 'Edit my interests & favorites' : 'Welcome to WildDex'}
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Step {currentStep} of 2
                </p>
              </div>
            </div>

            {isEditMode && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-3.5 min-h-[40px] rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold shrink-0"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* STEP 1: What do you love? */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="space-y-1">
              <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-on-surface font-bold leading-tight">
                What do you love?
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Pick one or more groups you want to explore.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INTEREST_GROUPS.map((group) => {
                const isSelected = selectedInterests.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleInterest(group.id)}
                    aria-pressed={isSelected}
                    className={`rounded-2xl overflow-hidden text-left transition-all active:scale-[0.98] flex flex-col border-2 ${
                      isSelected
                        ? 'border-primary bg-secondary-container/25 shadow-md ring-2 ring-primary/20'
                        : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <div className="relative w-full">
                      <InterestPicture
                        subject={group.wikiSubject}
                        label={group.label}
                        icon={group.icon}
                      />
                      <span
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                          isSelected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface/85 text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isSelected ? 'check' : 'add'}
                        </span>
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-3 flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                        {group.icon}
                      </span>
                      <span className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                        {group.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {selectedInterests.length === 0
                  ? 'Pick at least one group to continue.'
                  : `${selectedInterests.length} selected`}
              </p>
              {isEditMode && selectedInterests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedInterests([])}
                  className="font-label-sm text-label-sm text-error font-semibold hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Pick your favorites */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <h1 className="font-headline-lg text-[24px] sm:text-[28px] text-on-surface font-bold leading-tight">
                  Pick your favorites
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Search for animals, plants, or fungi you like (up to {MAX_FAVORITES}).
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={persistAndFinish}
                className="px-4 min-h-[40px] rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md font-semibold shrink-0 disabled:opacity-50"
              >
                Skip
              </button>
            </div>

            {/* Selected Favorites Chips */}
            {favoriteSpecies.length > 0 && (
              <div className="bg-surface-container-low rounded-2xl p-3 space-y-2 border border-outline-variant/25">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    Your favorites ({favoriteSpecies.length} / {MAX_FAVORITES})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFavoriteSpecies([])}
                    className="font-label-sm text-label-sm text-error font-semibold hover:underline"
                  >
                    Clear favorites
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {favoriteSpecies.map((fav) => (
                    <button
                      key={`${fav.id}-${fav.scientificName}`}
                      type="button"
                      onClick={() => toggleFavorite(fav)}
                      className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 min-h-[38px] rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm active:scale-95"
                    >
                      {fav.photoUrl ? (
                        <img
                          src={fav.photoUrl}
                          alt={fav.commonName}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-on-primary/15 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[14px]">eco</span>
                        </span>
                      )}
                      <span className="truncate max-w-[160px]">{fav.commonName}</span>
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {favoriteSpecies.length >= MAX_FAVORITES && (
              <p className="font-label-sm text-label-sm text-secondary font-semibold">
                You picked {MAX_FAVORITES} favorites (maximum reached). Remove one to swap it.
              </p>
            )}

            {/* Quick-Pick Popular Species in Chosen Groups */}
            {quickPickSuggestions.length > 0 && (
              <div className="space-y-2">
                <p className="font-label-sm text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                  Popular in your chosen groups
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPickSuggestions.map((item) => {
                    const selected = isFavoriteSelected(item);
                    const disabled = !selected && favoriteSpecies.length >= MAX_FAVORITES;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleFavorite(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full font-label-md text-label-md transition-colors ${
                          selected
                            ? 'bg-secondary text-on-secondary font-bold shadow-sm'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-45'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {selected ? 'check' : 'add'}
                        </span>
                        <span>{item.commonName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Input (iNaturalist 300ms Debounce) */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={speciesQuery}
                onChange={(e) => setSpeciesQuery(e.target.value)}
                placeholder="Search any animal, plant, or mushroom..."
                aria-label="Search favorite species"
                className="w-full min-w-0 min-h-[48px] bg-surface-container pl-11 pr-10 py-2.5 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
              />
              {speciesQuery && (
                <button
                  type="button"
                  onClick={() => setSpeciesQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Search Loading Skeleton */}
            {speciesLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low animate-pulse"
                  >
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-surface-container-high rounded w-1/2" />
                      <div className="h-3 bg-surface-container-high rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search Error State with Retry */}
            {!speciesLoading && speciesError && (
              <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-2">
                <p className="font-body-sm text-body-sm text-error">{speciesError}</p>
                <button
                  type="button"
                  onClick={() => setSpeciesRetryTick((t) => t + 1)}
                  className="px-4 min-h-[40px] rounded-full bg-error text-on-error font-label-md text-label-md font-semibold shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Search Results */}
            {!speciesLoading && !speciesError && speciesQuery.trim() && (
              <div className="space-y-2">
                {speciesResults.length === 0 ? (
                  <p className="text-center py-4 font-body-sm text-body-sm text-on-surface-variant">
                    No matching species found. Try another name.
                  </p>
                ) : (
                  speciesResults.map((item) => {
                    const selected = isFavoriteSelected(item);
                    const disabled = !selected && favoriteSpecies.length >= MAX_FAVORITES;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleFavorite(item)}
                        className={`w-full p-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all border ${
                          selected
                            ? 'bg-secondary-container/30 border-secondary'
                            : 'bg-surface-container-low border-outline-variant/25 hover:bg-surface-container disabled:opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.commonName}
                              loading="lazy"
                              className="w-12 h-12 rounded-xl object-cover shrink-0 bg-surface-container"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary shrink-0">
                              <span className="material-symbols-outlined text-[22px]">eco</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                              {item.commonName}
                            </p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
                              {item.scientificName}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-secondary text-on-secondary'
                              : 'bg-surface-container text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {selected ? 'check' : 'add'}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Save Error Banner with Retry */}
        {saveError && (
          <div className="mt-4 p-3.5 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                error
              </span>
              <p className="font-body-sm text-body-sm text-error break-words">{saveError}</p>
            </div>
            <button
              type="button"
              onClick={persistAndFinish}
              className="px-4 min-h-[40px] rounded-full bg-error text-on-error font-label-md text-label-md font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Bottom Navigation: Back & Next / Finish */}
        <div className="pt-6 mt-auto flex items-center gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSaveError(null);
                setCurrentStep(1);
              }}
              className="px-5 min-h-[48px] rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Back</span>
            </button>
          )}

          {currentStep === 1 ? (
            <button
              type="button"
              disabled={selectedInterests.length === 0}
              onClick={() => {
                setSaveError(null);
                setCurrentStep(2);
              }}
              className="flex-1 min-h-[48px] rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={persistAndFinish}
              className="flex-1 min-h-[48px] rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">
                    progress_activity
                  </span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>{isEditMode ? 'Save Changes' : 'Finish & Explore'}</span>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
