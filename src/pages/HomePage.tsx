import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSpeciesOfTheDay, CURATED_SPECIES, MOCK_FEED_OBSERVATIONS } from '../services/speciesService';
import { Species } from '../types/species';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { formatConservationStatus, getConservationMeaning } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [speciesOfDay] = useState<Species>(() => getSpeciesOfTheDay());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [bookmarked, setBookmarked] = useState(false);
  const [clapsCount, setClapsCount] = useState(42);
  const [hasClapped, setHasClapped] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [audioMatchActive, setAudioMatchActive] = useState(false);
  const [audioListening, setAudioListening] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const categories = [
    { id: 'all', label: 'All', icon: '🐾', count: '45.2k' },
    { id: 'mammals', label: 'Mammals', icon: '🐯', count: '6.1k' },
    { id: 'birds', label: 'Birds', icon: '🦅', count: '10.8k' },
    { id: 'reptiles', label: 'Reptiles', icon: '🦎', count: '4.3k' },
    { id: 'insects', label: 'Insects', icon: '🦋', count: '14.9k' },
    { id: 'marine', label: 'Marine Life', icon: '🐋', count: '3.7k' },
    { id: 'plants', label: 'Plants', icon: '🌿', count: '18.2k' },
    { id: 'fungi', label: 'Fungi', icon: '🍄', count: '2.4k' },
  ];

  // Filtered discoveries for carousel
  const trendingSpecies = CURATED_SPECIES.filter(
    (s) => s.id !== 'bengal-tiger' && (selectedCategory === 'all' || s.category === selectedCategory)
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Explorer';
    const firstName = name.split(' ')[0];
    return `${timeGreeting}, ${firstName}`;
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
          progress_activity
        </span>
        <p className="font-label-md text-label-md text-on-surface-variant">Connecting to WildDex...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-margin py-8">
        <div className="w-full max-w-md p-8 rounded-3xl bg-surface-container-high border border-outline-variant/30 text-center flex flex-col items-center gap-5 shadow-lg">
          <div className="w-20 h-20 rounded-3xl bg-primary-container text-on-primary flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-[40px]">forest</span>
          </div>

          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary font-bold">
              Sign in to WildDex
            </h1>
            <p className="font-body-md text-sm text-on-surface-variant mt-2 leading-relaxed">
              Connect with your Google account to catalog species discoveries, scan specimens with AI, organize field albums, and sync your collection securely.
            </p>
          </div>

          {authError && (
            <div className="w-full p-3 rounded-2xl bg-error-container text-on-error-container text-xs text-left flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
              <span>{authError}</span>
            </div>
          )}

          <div className="w-full space-y-3 pt-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              type="button"
              className="w-full py-3.5 px-5 rounded-full bg-primary text-on-primary font-label-lg font-bold flex items-center justify-center gap-3 shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
            >
              {signingIn ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#ffffff"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#acf4a4"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#ffdbd1"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#ffffff"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <p className="font-label-sm text-[11px] text-outline text-center">
              Sign-in provides automatic cloud backups for all your observation notes and field photo albums.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Greeting & Live Search Context */}
      <section className="px-margin pt-3 pb-space-sm flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="font-headline-md text-headline-md text-primary tracking-tight flex items-center gap-1.5">
              {getGreeting()} <span>🌿</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              What will you discover today?
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container/50 text-on-secondary-container">
            <span
              className="material-symbols-outlined text-[16px] text-secondary animate-pulse"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              sensors
            </span>
            <span className="font-label-sm text-label-sm font-semibold tracking-wide uppercase">Field Mode</span>
          </div>
        </div>

        {/* Search Field with Tactile Filter Trigger */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full mt-1">
          <div className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[22px]">search</span>
          </div>
          <input
            className="w-full h-12 pl-11 pr-14 rounded-full bg-surface-container text-on-surface placeholder:text-on-surface-variant/70 font-body-md text-body-md shadow-sm focus:outline-none focus:bg-surface-container-lowest transition-all"
            placeholder="Search 45,000+ species, habitats, fungi..."
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            aria-label="Open Advanced Taxonomic Filters"
            className="absolute right-1.5 w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform"
            type="button"
            onClick={() => navigate('/explore')}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-tertiary"></span>
          </button>
        </form>
      </section>

      {/* Species of the Day (Immersive Hero Card) */}
      <section className="px-margin py-space-sm">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-md bg-surface-container-low flex flex-col">
          {/* Media Box with Scrim */}
          <div className="relative w-full h-64 overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt={speciesOfDay.commonName}
              src={speciesOfDay.photoUrl}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/95 via-inverse-surface/40 to-transparent"></div>

            {/* Floating Status Badges */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed backdrop-blur-md shadow-sm">
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
                <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider">
                  Species of the Day
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary text-on-tertiary font-label-sm text-label-sm font-semibold tracking-wide">
                  <span>{formatConservationStatus(speciesOfDay.conservationStatus || speciesOfDay.statusLabel)}</span>
                  <InfoTooltip text={getConservationMeaning(speciesOfDay.conservationStatus)} />
                </span>
                <button
                  aria-label="Bookmark species"
                  className={`w-9 h-9 rounded-full bg-inverse-surface/60 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all ${
                    bookmarked ? 'text-tertiary' : 'text-surface-container-lowest'
                  }`}
                  onClick={() => {
                    setBookmarked(!bookmarked);
                    showToast(bookmarked ? 'Removed from collection' : 'Saved to My Collection');
                  }}
                  type="button"
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    bookmark
                  </span>
                </button>
              </div>
            </div>

            {/* Overlaid Titles */}
            <div className="absolute bottom-3 inset-x-3.5 flex flex-col">
              <div className="flex items-center gap-1 text-primary-fixed-dim">
                <span className="font-label-sm text-label-sm uppercase font-semibold tracking-wider">
                  Group: {speciesOfDay.taxonomy.order || 'Carnivora'} • {speciesOfDay.taxonomy.family || 'Felidae'}
                </span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-surface-container-lowest tracking-tight leading-tight drop-shadow-sm">
                {speciesOfDay.commonName}
              </h2>
              <div className="flex items-center gap-1 -mt-0.5">
                <span className="text-[10px] uppercase font-bold text-surface-variant/90 tracking-wider">Science name:</span>
                <span className="font-body-sm text-body-sm text-surface-variant italic opacity-95">
                  {speciesOfDay.scientificName}
                </span>
              </div>
            </div>
          </div>

          {/* Hero Card Details & Meta Bar */}
          <div className="p-space-md flex flex-col gap-3 bg-surface-container-low text-on-surface">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px]">forest</span>
                <span>{speciesOfDay.habitat}</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px] text-tertiary">warning</span>
                <span>How Rare: {speciesOfDay.rarity}</span>
              </div>
              {speciesOfDay.population && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                  <span className="material-symbols-outlined text-[15px] text-primary">public</span>
                  <span>Living in Wild: {speciesOfDay.population}</span>
                </div>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
              {speciesOfDay.description}
            </p>
            <div className="pt-1 flex items-center justify-between gap-3">
              <Link
                className="flex-1 h-11 px-5 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all hover:bg-primary-container"
                to={`/species/${speciesOfDay.id}`}
              >
                <span>View Details</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <button
                aria-label="Add observation note"
                className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center active:scale-95 transition-transform hover:bg-surface-container-highest"
                type="button"
                onClick={() => showToast('GPS pinned at current trail coordinates')}
              >
                <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Chips (Horizontal Scroll) */}
      <section className="py-space-sm flex flex-col gap-2">
        <div className="px-margin flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-primary">Explore Groups</h3>
          <Link
            className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
            to="/explore"
          >
            Family Tree
          </Link>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-margin no-scrollbar py-1">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 h-11 px-4 rounded-full flex items-center gap-2 shadow-sm font-label-md text-label-md active:scale-95 transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                }`}
                type="button"
              >
                <span>{cat.icon} {cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full font-label-sm text-label-sm ${
                    isActive
                      ? 'bg-on-primary-container text-primary font-bold'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Action Shortcuts (2x2 Grid) */}
      <section className="px-margin py-space-sm">
        <div className="grid grid-cols-2 gap-space-sm">
          {/* AI Photo Scanner */}
          <Link
            className="p-space-md rounded-2xl bg-surface-container-high hover:bg-surface-container-highest flex flex-col justify-between gap-3 shadow-sm active:scale-98 transition-all min-h-[120px]"
            to="/scan"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">photo_camera</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-sm text-label-sm font-bold uppercase">
                99% Match
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface">AI Scanner</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Identify plants & animals</p>
            </div>
          </Link>

          {/* Health Help */}
          <Link
            className="p-space-md rounded-2xl bg-surface-container-high hover:bg-surface-container-highest flex flex-col justify-between gap-3 shadow-sm active:scale-98 transition-all min-h-[120px]"
            to="/health"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">healing</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary font-label-sm text-label-sm font-semibold">
                Care Tips
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface">Health Help</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Plant & animal health</p>
            </div>
          </Link>

          {/* How It Grows */}
          <Link
            className="p-space-md rounded-2xl bg-surface-container-high hover:bg-surface-container-highest flex flex-col justify-between gap-3 shadow-sm active:scale-98 transition-all min-h-[120px]"
            to="/lifecycle"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">published_with_changes</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-sm text-label-sm font-semibold">
                Interactive
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface">How It Grows</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">How living things grow</p>
            </div>
          </Link>

          {/* Field Audio Match */}
          <button
            onClick={() => {
              setAudioMatchActive(true);
              setAudioListening(true);
              setTimeout(() => {
                setAudioListening(false);
                showToast('Acoustic match detected: Pacific Tree Frog (94.2%)');
              }, 2500);
            }}
            className="p-space-md rounded-2xl bg-surface-container-high hover:bg-surface-container-highest flex flex-col justify-between gap-3 shadow-sm active:scale-98 transition-all min-h-[120px] text-left"
            type="button"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">mic</span>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
              </span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface">Audio Match</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Birdsong & calls</p>
            </div>
          </button>
        </div>
      </section>

      {/* Audio Match Modal Sheet */}
      {audioMatchActive && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-surface-container p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-bottom-6">
            <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-secondary relative">
              <span className="material-symbols-outlined text-[32px] animate-pulse">mic</span>
              {audioListening && (
                <span className="absolute inset-0 rounded-full border-2 border-secondary animate-ping"></span>
              )}
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {audioListening ? 'Listening for Bio-Acoustics...' : 'Field Audio Match Complete'}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                {audioListening
                  ? 'Isolating environmental noise and comparing against 12,000 recorded wildlife vocalizations.'
                  : 'Pacific Tree Frog (Pseudacris regilla) vocal chorus verified with 94.2% confidence.'}
              </p>
            </div>
            <button
              onClick={() => setAudioMatchActive(false)}
              className="w-full h-11 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Trending Discoveries Carousel */}
      <section className="py-space-sm flex flex-col gap-2.5">
        <div className="px-margin flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-1.5">
              <span>Trending Discoveries</span>
              <span className="material-symbols-outlined text-[18px] text-tertiary">local_fire_department</span>
            </h3>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Active field observations nearby
            </span>
          </div>
          <Link
            className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
            to="/explore"
          >
            See All ({trendingSpecies.length + 138})
          </Link>
        </div>

        <div className="flex items-center gap-3.5 overflow-x-auto px-margin no-scrollbar py-1">
          {trendingSpecies.map((sp) => (
            <div
              key={sp.id}
              className="shrink-0 w-64 rounded-2xl bg-surface-container-low overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="relative w-full h-36">
                <img className="w-full h-full object-cover" alt={sp.commonName} src={sp.photoUrl} />
                <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-transparent to-transparent"></div>
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-surface/90 text-primary font-label-sm text-label-sm font-semibold backdrop-blur-sm capitalize">
                  {sp.category}
                </span>
                <span
                  className={`absolute top-2 right-2 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-bold ${
                    sp.conservationStatus === 'EN' || sp.conservationStatus === 'CR'
                      ? 'bg-tertiary text-on-tertiary'
                      : sp.conservationStatus === 'VU'
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                      : 'bg-secondary text-on-secondary'
                  }`}
                >
                  {sp.statusLabel.split(' ')[0]}
                </span>
                <div className="absolute bottom-2 left-2 right-2 flex items-baseline justify-between text-surface-container-lowest">
                  <span className="font-label-sm text-label-sm opacity-90 truncate max-w-[120px]">
                    {sp.habitat}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary-fixed font-semibold">
                    128 logged
                  </span>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface truncate">
                    {sp.commonName}
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
                    {sp.scientificName}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-tertiary">favorite</span>
                    <span className="font-label-sm text-label-sm">520</span>
                  </div>
                  <Link
                    className="font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-0.5 hover:underline"
                    to={`/species/${sp.id}`}
                  >
                    <span>View</span>
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Endangered Spotlight Banner */}
      <section className="px-margin py-space-sm">
        <div className="p-space-md rounded-2xl bg-tertiary-container text-on-tertiary-container relative overflow-hidden shadow-md flex flex-col gap-3">
          <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-tertiary-fixed-dim/20 blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary">
                <span className="material-symbols-outlined text-[18px]">emergency</span>
              </div>
              <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-tertiary-fixed">
                Wildlife In Danger
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-label-sm font-bold">
              <span>IN SERIOUS DANGER</span>
              <InfoTooltip text="Very few remain in the wild. They need immediate protection so they do not disappear forever." />
            </span>
          </div>
          <div className="relative z-10 flex flex-col gap-1">
            <h3 className="font-headline-md text-headline-md text-surface-container-lowest leading-tight">
              Javan Rhino & Amur Leopard
            </h3>
            <p className="font-body-sm text-body-sm text-tertiary-fixed opacity-95">
              Fewer than 76 Javan Rhinos and 120 Amur Leopards remain in the wild. Ranger patrols are actively protecting their habitats this week.
            </p>
          </div>
          {/* Actions */}
          <div className="relative z-10 flex items-center gap-2 pt-1">
            <button
              onClick={() => showToast('Thank you for supporting wildlife protection!')}
              className="flex-1 h-11 px-4 rounded-full bg-surface-container-lowest text-tertiary font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Help Protect Them</span>
            </button>
            <button
              onClick={() => navigate('/scan')}
              aria-label="Save Sighting"
              className="h-11 px-3.5 rounded-full bg-tertiary text-on-tertiary font-label-md text-label-md flex items-center justify-center gap-1 active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Save Sighting</span>
            </button>
          </div>
        </div>
      </section>

      {/* Community Activity Feed Preview */}
      <section className="px-margin pt-space-sm pb-space-lg flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-1">
              <span>Community</span>
              <span className="material-symbols-outlined text-[18px] text-secondary">groups</span>
            </h3>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Recent sightings from nature lovers near you
            </span>
          </div>
          <Link
            className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
            to="/feed"
          >
            See Community
          </Link>
        </div>

        {/* Social Observation Card */}
        {MOCK_FEED_OBSERVATIONS.map((obs) => (
          <div key={obs.id} className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
            {/* User Info Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface-container-high shrink-0">
                  <img className="w-full h-full object-cover" alt={obs.userName} src={obs.userAvatar} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-headline-sm text-headline-sm text-on-surface leading-snug truncate">
                    {obs.userName}
                  </span>
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px] text-secondary">pin_drop</span>
                    <span className="font-label-sm text-label-sm truncate">{obs.locationName}</span>
                  </div>
                </div>
              </div>
              <button
                aria-label="Card options"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                type="button"
                onClick={() => showToast('Observation shared to clipboard')}
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>
            </div>

            {/* Sighting Media & Confidence HUD */}
            <div className="relative w-full h-44 rounded-xl overflow-hidden">
              <img className="w-full h-full object-cover" alt={obs.speciesName} src={obs.photoUrl} />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-sm text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span className="font-label-sm text-label-sm font-semibold">{obs.aiMatchScore}% Match Score</span>
                <InfoTooltip text={`We are ${obs.aiMatchScore}% sure this is a ${obs.speciesName}.`} />
              </div>
            </div>

            {/* Observation Title & Description */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <h4 className="font-headline-sm text-headline-sm text-on-surface">{obs.speciesName}</h4>
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container font-semibold">
                  Local Wildlife
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-outline">Science name:</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant italic">{obs.scientificName}</p>
              </div>
              <p className="font-body-md text-body-md text-on-surface mt-1">{obs.caption}</p>
            </div>

            {/* Social Interaction Row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {/* Leaf Clap micro-action */}
                <button
                  className={`h-9 px-3 rounded-full flex items-center gap-1.5 font-label-sm text-label-sm active:scale-90 transition-transform ${
                    hasClapped
                      ? 'bg-secondary-container text-on-secondary-container font-bold'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                  }`}
                  onClick={() => {
                    setHasClapped(!hasClapped);
                    setClapsCount(hasClapped ? clapsCount - 1 : clapsCount + 1);
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">eco</span>
                  <span>{clapsCount}</span>
                </button>
                {/* Comment Action */}
                <button
                  className="h-9 px-3 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center gap-1.5 text-on-surface font-label-sm text-label-sm active:scale-95 transition-transform"
                  type="button"
                  onClick={() => showToast('Opening discussion thread...')}
                >
                  <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                  <span>{obs.commentsCount}</span>
                </button>
              </div>

              {/* Add to Wishlist / Log Encounter */}
              <button
                className={`h-9 px-3 rounded-full flex items-center gap-1 font-label-sm text-label-sm font-semibold active:scale-95 transition-all ${
                  wishlisted
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container-high text-on-surface hover:text-primary'
                }`}
                onClick={() => {
                  setWishlisted(!wishlisted);
                  showToast(wishlisted ? 'Removed from wishlist' : 'Added to naturalist wishlist!');
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                <span>{wishlisted ? 'Wishlisted' : 'Add to Wishlist'}</span>
              </button>
            </div>
          </div>
        ))}

        {/* Field Naturalist Discovery Pill */}
        <div className="p-3 rounded-2xl bg-secondary-container/30 flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">explore_nearby</span>
            </div>
            <p className="font-label-sm text-label-sm text-on-secondary-container font-medium truncate">
              18 field naturalists active near Olympic Peninsula today
            </p>
          </div>
          <Link
            to="/invite"
            className="shrink-0 px-3 py-1.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold shadow-xs active:scale-95 transition-transform"
          >
            Connect
          </Link>
        </div>
      </section>
    </div>
  );
};
