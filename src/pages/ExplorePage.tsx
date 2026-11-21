import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  searchSpecies,
  saveSpeciesToCache,
  ExploreSearchResult,
  IconicTaxonGroup,
} from '../services/speciesService';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { formatConservationStatus, getConservationMeaning } from '../utils/formatters';

const GROUP_CHIPS: { id: 'all' | IconicTaxonGroup; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'public' },
  { id: 'Mammalia', label: 'Mammals', icon: 'pets' },
  { id: 'Aves', label: 'Birds', icon: 'flutter_dash' },
  { id: 'Reptilia', label: 'Reptiles', icon: 'pest_control' },
  { id: 'Insecta', label: 'Insects', icon: 'bug_report' },
  { id: 'Plantae', label: 'Plants', icon: 'eco' },
  { id: 'Fungi', label: 'Fungi', icon: 'forest' },
];

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState<string>(urlQuery);
  const [selectedGroup, setSelectedGroup] = useState<'all' | IconicTaxonGroup>('all');

  const [results, setResults] = useState<ExploreSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync query when URL search parameter changes externally (e.g. from Home search or back navigation)
  useEffect(() => {
    setQuery((prev) => (prev === urlQuery ? prev : urlQuery));
  }, [urlQuery]);

  // 300ms debounced iNaturalist autocomplete search with AbortController cancellation
  useEffect(() => {
    const trimmed = query.trim();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const iconicTaxon = selectedGroup === 'all' ? null : selectedGroup;
        const data = await searchSpecies(trimmed, iconicTaxon, controller.signal);
        if (!isActive || controller.signal.aborted) return;
        setResults(data);
        setError(null);
        setLoading(false);
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted || !isActive) {
          return;
        }
        console.error('Explore species search failed:', err);
        setResults([]);
        setError(err?.message || 'Could not search species right now.');
        setLoading(false);
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [query, selectedGroup, retryTick]);

  const trimmedQuery = query.trim();

  const handleInputChange = (val: string) => {
    setQuery(val);
    setSearchParams(val ? { q: val } : {}, { replace: true });
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Search Bar & Group Chips */}
      <section className="px-3 sm:px-margin pt-space-sm pb-space-xs flex flex-col gap-space-sm">
        <div className="flex items-center gap-2 sm:gap-space-sm w-full">
          <div className="flex-1 min-w-0 flex items-center h-12 px-3 sm:px-space-md bg-surface-container rounded-full shadow-sm focus-within:bg-surface-container-lowest focus-within:shadow-md transition-all">
            <span className="material-symbols-outlined text-secondary text-[22px] shrink-0">
              search
            </span>
            <input
              aria-label="Search animals, plants, fungi"
              className="flex-1 min-w-0 w-full bg-transparent px-2 sm:px-space-sm font-body-md text-on-surface focus:outline-none placeholder:text-outline"
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search animals, plants, fungi..."
            />
            {query && (
              <button
                aria-label="Clear search input"
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
                onClick={() => handleInputChange('')}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          <Link
            to="/compare"
            className="h-12 px-3 sm:px-4 inline-flex items-center gap-1.5 rounded-full bg-surface-container-high text-primary font-label-md text-label-md font-semibold hover:bg-surface-container-highest shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
            <span className="hidden sm:inline">Compare</span>
          </Link>
        </div>

        {/* Group Filter Chips (only added to request when user picks a group other than All) */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 sm:gap-2 md:overflow-x-auto no-scrollbar py-1">
          {GROUP_CHIPS.map((chip) => {
            const active = selectedGroup === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedGroup(chip.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-full font-label-md text-label-md shrink-0 transition-all ${
                  active
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Area */}
      <section className="px-3 sm:px-margin mt-space-sm">
        {/* Minimum 2 character prompt */}
        {trimmedQuery.length < 2 && (
          <div className="p-6 sm:p-8 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-2 max-w-xl mx-auto mt-4">
            <div className="w-12 h-12 rounded-full bg-secondary-container/50 text-primary mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[26px]">travel_explore</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Search wild species
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Type at least 2 characters to search by common name, science name, or partial word.
            </p>
          </div>
        )}

        {/* Loading Skeletons */}
        {trimmedQuery.length >= 2 && loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20 animate-pulse"
              >
                <div className="h-44 w-full bg-surface-container-high" />
                <div className="p-4 space-y-2.5">
                  <div className="h-5 w-2/3 rounded bg-surface-container-high" />
                  <div className="h-4 w-1/2 rounded bg-surface-container-high" />
                  <div className="h-6 w-24 rounded-full bg-surface-container mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry */}
        {trimmedQuery.length >= 2 && !loading && error && (
          <div className="p-5 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-3 max-w-2xl mx-auto">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="material-symbols-outlined text-[22px] text-error shrink-0 mt-0.5">
                error
              </span>
              <div className="space-y-0.5 min-w-0">
                <p className="font-label-lg text-label-lg font-bold text-error">
                  Search failed
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {error}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRetryTick((t) => t + 1)}
              className="px-5 min-h-[44px] rounded-full bg-error text-on-error font-label-md text-label-md font-bold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {trimmedQuery.length >= 2 && !loading && !error && results.length === 0 && (
          <div className="p-6 sm:p-8 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-3 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-surface-container-high text-on-surface-variant mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">search_off</span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              No match for '{trimmedQuery}'. Try another name.
            </p>
            {selectedGroup !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className="px-4 min-h-[40px] rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold"
              >
                Search across All groups
              </button>
            )}
          </div>
        )}

        {/* Results Header + Grid */}
        {trimmedQuery.length >= 2 && !loading && !error && results.length > 0 && (
          <>
            <div className="flex items-baseline gap-1.5 mb-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {results.length}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {results.length === 1 ? 'species found' : 'species found'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
              {results.map((sp) => {
                const friendlyStatus = formatConservationStatus(
                  sp.conservationStatus || sp.statusLabel
                );

                return (
                  <Link
                    key={sp.id}
                    to={`/species/${sp.id}`}
                    onClick={() => saveSpeciesToCache(sp)}
                    className="text-left flex flex-col bg-surface-container-lowest rounded-xl shadow-[0_4px_16px_-2px_rgba(27,94,32,0.06),0_2px_4px_-1px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:shadow-[0_8px_24px_-4px_rgba(27,94,32,0.12)] active:scale-[0.99] border border-outline-variant/15"
                  >
                    <div className="relative h-44 w-full overflow-hidden bg-surface-container-high">
                      {sp.photoUrl ? (
                        <img
                          alt={sp.commonName}
                          className="w-full h-full object-cover object-center"
                          src={sp.photoUrl}
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant gap-1">
                          <span className="material-symbols-outlined text-[40px] opacity-50">
                            pets
                          </span>
                          <span className="font-label-sm text-label-sm opacity-70">
                            No photo
                          </span>
                        </div>
                      )}

                      {sp.conservationStatus !== 'LC' && (
                        <div className="absolute top-space-sm left-space-sm">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold shadow-sm ${
                              sp.conservationStatus === 'EN' || sp.conservationStatus === 'CR'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-tertiary-fixed text-on-tertiary-fixed'
                            }`}
                          >
                            <span>{friendlyStatus}</span>
                            <InfoTooltip text={getConservationMeaning(sp.conservationStatus)} />
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-space-md flex flex-col gap-1.5 flex-1">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                        {sp.commonName}
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
                        {sp.scientificName}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2">
                        {sp.iconicTaxonName && (
                          <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                            {sp.iconicTaxonName}
                          </span>
                        )}
                        {typeof sp.observationsCount === 'number' && (
                          <span className="font-label-sm text-label-sm text-outline ml-auto">
                            {sp.observationsCount.toLocaleString()} sightings
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
