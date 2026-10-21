import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CURATED_SPECIES, searchSpecies } from '../services/speciesService';
import { Species } from '../types/species';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { formatConservationStatus, getConservationMeaning } from '../utils/formatters';

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || 'Rainforest';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Species[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Facet state
  const [selectedTab, setSelectedTab] = useState<'all' | 'fauna' | 'flora' | 'fungi'>('all');
  const [activeBiome, setActiveBiome] = useState<string | null>('Rainforest');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDiet, setSelectedDiet] = useState<string>('all');
  const [atRiskOnly, setAtRiskOnly] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [results, setResults] = useState<Species[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Live autocomplete suggestions
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length >= 2) {
      const matches = CURATED_SPECIES.filter(
        (s) =>
          s.commonName.toLowerCase().includes(q) ||
          s.scientificName.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.habitat.toLowerCase().includes(q)
      ).slice(0, 4);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query]);

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Main search and filter aggregation
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const runSearch = async () => {
      let filtered = await searchSpecies(debouncedQuery);

      if (atRiskOnly) {
        filtered = filtered.filter((s) => ['VU', 'EN', 'CR'].includes(s.conservationStatus));
      }

      if (activeBiome) {
        filtered = filtered.filter(
          (s) =>
            s.habitat.toLowerCase().includes(activeBiome.toLowerCase()) ||
            s.biomes.some((b) => b.toLowerCase().includes(activeBiome.toLowerCase())) ||
            s.description.toLowerCase().includes(activeBiome.toLowerCase())
        );
      }

      if (selectedRegion !== 'all') {
        filtered = filtered.filter(
          (s) =>
            s.nativeRegion.toLowerCase().includes(selectedRegion.toLowerCase()) ||
            s.locationName?.toLowerCase().includes(selectedRegion.toLowerCase())
        );
      }

      if (selectedDiet !== 'all') {
        filtered = filtered.filter(
          (s) => s.preyGuild?.category.toLowerCase() === selectedDiet.toLowerCase()
        );
      }

      if (selectedTab === 'fauna') {
        filtered = filtered.filter((s) =>
          ['mammals', 'birds', 'reptiles', 'amphibians', 'insects', 'marine'].includes(s.category)
        );
      } else if (selectedTab === 'flora') {
        filtered = filtered.filter((s) => s.category === 'plants');
      } else if (selectedTab === 'fungi') {
        filtered = filtered.filter((s) => s.category === 'fungi');
      }

      if (filtered.length === 0) {
        filtered = CURATED_SPECIES.slice(0, 5);
      }

      if (isMounted) {
        setResults(filtered);
        setLoading(false);
      }
    };

    runSearch();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, selectedTab, activeBiome, selectedRegion, selectedDiet, atRiskOnly, audioOnly]);

  const toggleBookmark = (id: string) => {
    const next = new Set(bookmarkedIds);
    if (next.has(id)) {
      next.delete(id);
      showToast('Removed from Field Journal');
    } else {
      next.add(id);
      showToast('Saved to Field Journal');
    }
    setBookmarkedIds(next);
  };

  const activeFiltersCount = [
    activeBiome,
    atRiskOnly,
    audioOnly,
    selectedRegion !== 'all' ? selectedRegion : null,
    selectedDiet !== 'all' ? selectedDiet : null,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Search & Filter Control Bar */}
      <section className="px-margin pt-space-sm pb-space-xs flex flex-col gap-space-sm">
        <div className="flex items-center gap-space-sm w-full relative" ref={searchContainerRef}>
          {/* Search Input Container */}
          <div className="flex-1 flex items-center h-12 px-space-md bg-surface-container rounded-full shadow-sm focus-within:bg-surface-container-lowest focus-within:shadow-md transition-all">
            <span className="material-symbols-outlined text-secondary text-[22px] shrink-0">search</span>
            <input
              aria-label="Search biodiversity encyclopedia"
              className="flex-1 bg-transparent px-space-sm font-body-md text-on-surface focus:outline-none placeholder:text-outline"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchParams({ q: e.target.value });
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search animals, plants, places..."
            />
            {query && (
              <button
                aria-label="Clear search input"
                className="w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
                onClick={() => {
                  setQuery('');
                  setSearchParams({});
                  setShowSuggestions(false);
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
            <div className="h-4 w-px bg-outline-variant mx-1 shrink-0"></div>
            <button
              aria-label="Voice search query"
              className="w-8 h-8 flex items-center justify-center rounded-full text-primary hover:bg-surface-container-high active:scale-95 transition-all shrink-0"
              type="button"
              onClick={() => showToast('Listening for animal or plant name...')}
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
          </div>

          {/* Filter Tray Trigger Button */}
          <button
            className="h-12 px-space-md flex items-center gap-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm active:scale-95 transition-transform shrink-0"
            type="button"
            onClick={() => setShowFilterDrawer(true)}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Live Debounced Autocomplete Dropdown */}
          {showSuggestions && (
            <div className="absolute top-14 inset-x-0 z-40 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-1 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Instant Matches
              </div>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    navigate(`/species/${s.id}`);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-container-low transition-colors text-left"
                >
                  <img alt={s.commonName} src={s.photoUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md font-bold text-on-surface truncate">{s.commonName}</p>
                    <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">{s.scientificName}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                    {s.statusLabel.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Filter Chips */}
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1 -mx-margin px-margin">
          {activeBiome && (
            <button
              onClick={() => setActiveBiome(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shrink-0 shadow-sm hover:opacity-90 active:scale-95 transition-all"
              type="button"
            >
              <span>Biome: <strong>{activeBiome}</strong></span>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}

          {atRiskOnly && (
            <button
              onClick={() => setAtRiskOnly(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shrink-0 shadow-sm hover:opacity-90 active:scale-95 transition-all"
              type="button"
            >
              <span>Status: <strong>At-Risk Only</strong></span>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}

          {selectedRegion !== 'all' && (
            <button
              onClick={() => setSelectedRegion('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shrink-0 shadow-sm hover:opacity-90 active:scale-95 transition-all"
              type="button"
            >
              <span>Region: <strong>{selectedRegion}</strong></span>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}

          <button
            onClick={() => setAudioOnly(!audioOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md shrink-0 shadow-sm transition-all ${
              audioOnly
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[14px] text-primary">graphic_eq</span>
            <span>Verified Audio</span>
            {audioOnly && <span className="material-symbols-outlined text-[14px]">close</span>}
          </button>

          <Link
            to="/compare"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-primary font-label-md text-label-md hover:bg-surface-container-highest shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
            <span>Compare Tool</span>
          </Link>
        </div>
      </section>

      {/* Category Segmentation Tabs */}
      <section className="px-margin mt-space-xs">
        <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedTab('all')}
            className={`flex-1 min-w-[76px] py-1.5 px-3 rounded-full font-label-md text-label-md text-center shrink-0 transition-all ${
              selectedTab === 'all'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            All (142)
          </button>
          <button
            onClick={() => setSelectedTab('fauna')}
            className={`flex-1 min-w-[76px] py-1.5 px-3 rounded-full font-label-md text-label-md text-center shrink-0 transition-all ${
              selectedTab === 'fauna'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Fauna (86)
          </button>
          <button
            onClick={() => setSelectedTab('flora')}
            className={`flex-1 min-w-[76px] py-1.5 px-3 rounded-full font-label-md text-label-md text-center shrink-0 transition-all ${
              selectedTab === 'flora'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Flora (38)
          </button>
          <button
            onClick={() => setSelectedTab('fungi')}
            className={`flex-1 min-w-[96px] py-1.5 px-3 rounded-full font-label-md text-label-md text-center shrink-0 transition-all ${
              selectedTab === 'fungi'
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Fungi & Lichen (18)
          </button>
        </div>
      </section>

      {/* Results Count & Relevancy Sort Header */}
      <section className="px-margin mt-space-md flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{results.length}</span>
          <span className="font-label-md text-label-md text-on-surface-variant">Animals & Plants Found</span>
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-colors"
            type="button"
            onClick={() => showToast('Sorted by match score')}
          >
            <span className="material-symbols-outlined text-[14px] text-secondary">auto_awesome</span>
            <span>Match Score</span>
            <span className="material-symbols-outlined text-[16px] text-outline">arrow_drop_down</span>
          </button>
        </div>
      </section>

      {/* Search Results Cards Stack */}
      <section className="px-margin mt-space-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px] text-primary animate-spin">progress_activity</span>
            <p className="font-label-md text-label-md">Finding animals and plants...</p>
          </div>
        ) : (
          results.map((sp, idx) => {
            const isBookmarked = bookmarkedIds.has(sp.id);
            const matchScore = (99.4 - idx * 0.2).toFixed(0);
            const friendlyStatus = formatConservationStatus(sp.conservationStatus || sp.statusLabel);
            return (
              <article
                key={sp.id}
                className="flex flex-col bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_-2px_rgba(27,94,32,0.06),0_2px_4px_-1px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:shadow-[0_8px_24px_-4px_rgba(27,94,32,0.12)]"
              >
                <div className="relative h-44 w-full overflow-hidden bg-surface-container-high">
                  <img alt={sp.commonName} className="w-full h-full object-cover object-center" src={sp.photoUrl} />
                  {/* Status Overlay */}
                  <div className="absolute top-space-sm inset-x-space-sm flex items-center justify-between pointer-events-none">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold shadow-sm pointer-events-auto ${
                        sp.conservationStatus === 'EN' || sp.conservationStatus === 'CR'
                          ? 'bg-error-container text-on-error-container'
                          : sp.conservationStatus === 'VU'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      <span>{friendlyStatus}</span>
                      <InfoTooltip text={getConservationMeaning(sp.conservationStatus)} />
                    </span>
                    <div className="flex items-center gap-1 pointer-events-auto">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[13px] text-primary">sensors</span>
                        <span>{matchScore}% sure</span>
                        <InfoTooltip text={`We are ${matchScore}% sure this matches your search.`} />
                      </span>
                    </div>
                  </div>

                  {idx === 0 && (
                    <div className="absolute bottom-space-sm left-space-sm flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/85 backdrop-blur-md text-on-primary font-label-sm text-label-sm shadow-sm">
                      <span className="material-symbols-outlined text-[13px] text-primary-fixed">near_me</span>
                      <span>Nearby your location</span>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-space-md flex flex-col gap-space-xs">
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                        <Link to={`/species/${sp.id}`} className="hover:text-primary">
                          {sp.commonName}
                        </Link>
                      </h3>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold text-outline">Science name:</span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">{sp.scientificName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        aria-label="Play audio sample"
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low text-secondary hover:bg-secondary-container hover:text-on-secondary-container transition-colors"
                        type="button"
                        onClick={() => showToast(`Playing bio-acoustic call for ${sp.commonName}`)}
                      >
                        <span className="material-symbols-outlined text-[18px]">volume_up</span>
                      </button>
                      <button
                        aria-label="Bookmark species"
                        className={`w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low transition-colors ${
                          isBookmarked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
                        }`}
                        type="button"
                        onClick={() => toggleBookmark(sp.id)}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isBookmarked ? 'bookmark' : 'bookmark_border'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Ecological Attributes */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                      {sp.habitat}
                    </span>
                    {sp.biomes.slice(0, 2).map((b, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                        {b}
                      </span>
                    ))}
                  </div>

                  <div className="mt-space-xs pt-space-xs flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Observation count: 32 this season</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => showToast(`Logged sighting for ${sp.commonName}`)}
                        className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Quick Log</span>
                      </button>
                      <Link
                        to={`/species/${sp.id}`}
                        className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 hover:bg-surface-container-highest transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">menu_book</span>
                        <span>Taxon Guide</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* List Footer */}
      <section className="px-margin mt-space-lg mb-space-sm flex flex-col items-center gap-space-sm text-center">
        <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          <span>Showing {results.length} of 142 results</span>
          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
        </div>
        <button
          className="w-full max-w-xs h-12 rounded-full bg-surface-container-high text-on-surface font-label-lg text-label-lg hover:bg-surface-container-highest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
          type="button"
          onClick={() => showToast('Loading next 20 verified specimens...')}
        >
          <span className="material-symbols-outlined text-[20px] text-primary">expand_more</span>
          <span>Load More</span>
        </button>
        <p className="font-body-sm text-body-sm text-outline mt-1 max-w-xs">
          Wildlife observations updated continuously from naturalists worldwide.
        </p>
      </section>

      {/* Multi-Facet Filter Drawer Modal */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Filters</h3>
              </div>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Where It Lives */}
            <div className="space-y-2">
              <label className="font-label-md text-label-md font-bold text-on-surface">Where It Lives</label>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Rainforest', 'Taiga', 'Deciduous', 'Ocean', 'Grasslands'].map((b) => (
                  <button
                    key={b}
                    onClick={() => setActiveBiome(b === 'All' ? null : b)}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
                      (b === 'All' && !activeBiome) || activeBiome === b
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Native Region */}
            <div className="space-y-2">
              <label className="font-label-md text-label-md font-bold text-on-surface">Geographic Region</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All Regions' },
                  { id: 'Pacific', label: 'Pacific Northwest' },
                  { id: 'Indian', label: 'Indian Subcontinent' },
                  { id: 'Russian', label: 'Russian Far East' },
                  { id: 'Amazon', label: 'Amazonian Basin' },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRegion(r.id)}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
                      selectedRegion === r.id
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* What It Eats */}
            <div className="space-y-2">
              <label className="font-label-md text-label-md font-bold text-on-surface">What It Eats</label>
              <div className="flex flex-wrap gap-1.5">
                {['all', 'Carnivore', 'Herbivore', 'Omnivore', 'Detritivore'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDiet(d)}
                    className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
                      selectedDiet === d
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {d === 'all' ? 'All Foods' : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Is It Rare? Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-low">
              <div>
                <p className="font-label-md text-label-md font-bold text-on-surface">In Danger Only</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Show only at-risk animals and plants</p>
              </div>
              <input
                type="checkbox"
                checked={atRiskOnly}
                onChange={(e) => setAtRiskOnly(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => {
                  setActiveBiome(null);
                  setSelectedRegion('all');
                  setSelectedDiet('all');
                  setAtRiskOnly(false);
                  setAudioOnly(false);
                  showToast('Filters cleared');
                }}
                className="flex-1 h-12 rounded-full bg-surface-container text-on-surface font-label-md text-label-md font-semibold"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFilterDrawer(false);
                  showToast(`Applied filters`);
                }}
                className="flex-1 h-12 rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
