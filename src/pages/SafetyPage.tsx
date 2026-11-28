import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SafetyDisclaimerFooter,
  SafetyEmergencyBanner,
} from '../components/safety/SafetyChrome';
import {
  SafetyTopic,
  buildSafetyGroupChips,
  fetchSafetyTopics,
  getSafetyGroupIcon,
  getSafetyGroupLabel,
} from '../services/safetyService';

export const SafetyPage: React.FC = () => {
  const [topics, setTopics] = useState<SafetyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromOfflineCache, setFromOfflineCache] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSafetyTopics();
      setTopics(result.topics);
      setFromOfflineCache(result.fromOfflineCache);
    } catch (err: any) {
      setError(err?.message || 'Could not load the safety guide right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const groupChips = useMemo(() => buildSafetyGroupChips(topics), [topics]);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return topics.filter((topic) => {
      if (selectedGroup && topic.groupName !== selectedGroup) {
        return false;
      }
      if (!q) return true;
      return (
        topic.title.toLowerCase().includes(q) ||
        topic.summary.toLowerCase().includes(q)
      );
    });
  }, [topics, selectedGroup, searchQuery]);

  const hasActiveFilters = Boolean(selectedGroup || searchQuery.trim());

  return (
    <div className="flex flex-col w-full min-w-0 max-w-5xl mx-auto px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Top Emergency Banner */}
      <SafetyEmergencyBanner />

      {/* Page Title */}
      <div className="space-y-1 min-w-0">
        <h1 className="font-headline-sm sm:font-headline-md text-primary font-bold">
          Safety Guide
        </h1>
        <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
          Simple first steps for bites, stings, plants, mushrooms, sea life, animals, and pets. Opened guides are saved on your device for offline use.
        </p>
      </div>

      {/* Offline Notice if loaded from device cache */}
      {fromOfflineCache && !loading && !error && (
        <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/35 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0" aria-hidden="true">
              offline_pin
            </span>
            <span>Showing saved offline guide because you appear to be offline.</span>
          </span>
          <button
            type="button"
            onClick={loadTopics}
            className="px-3 py-1.5 min-h-[36px] rounded-full bg-surface border border-outline-variant/40 text-primary font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Group Filter Chips */}
      {!loading && !error && topics.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <span
              className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search safety topics..."
              aria-label="Search safety topics"
              className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl bg-surface-container-low border border-outline-variant/35 text-sm text-on-surface placeholder:text-on-surface-variant/75 focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container absolute right-1 top-1/2 -translate-y-1/2"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  close
                </span>
              </button>
            )}
          </div>

          {groupChips.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5"
              role="group"
              aria-label="Filter by topic group"
            >
              <button
                type="button"
                aria-pressed={selectedGroup === null}
                onClick={() => setSelectedGroup(null)}
                className={`px-3.5 py-2 min-h-[44px] rounded-full font-label-md text-xs whitespace-nowrap shrink-0 transition-colors ${
                  selectedGroup === null
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                All
              </button>

              {groupChips.map((chip) => {
                const active = selectedGroup === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedGroup(chip.key)}
                    className={`px-3.5 py-2 min-h-[44px] rounded-full font-label-md text-xs whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-secondary text-on-secondary font-semibold shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      {getSafetyGroupIcon(chip.key)}
                    </span>
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-3 animate-pulse" aria-label="Loading safety topics">
          <div className="h-11 w-full rounded-xl bg-surface-container-high" />
          <div className="flex gap-2 overflow-hidden">
            <div className="h-10 w-16 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-10 w-24 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-10 w-24 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-10 w-20 rounded-full bg-surface-container-high shrink-0" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-surface-container-high shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-surface-container-high" />
                    <div className="h-3 w-1/3 rounded bg-surface-container-high" />
                  </div>
                </div>
                <div className="h-3.5 w-full rounded bg-surface-container-high" />
                <div className="h-3.5 w-5/6 rounded bg-surface-container-high" />
              </div>
            ))}
          </div>
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
          <button
            type="button"
            onClick={loadTopics}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty States */}
      {!loading && !error && topics.length === 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[30px]" aria-hidden="true">
              health_and_safety
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface font-medium">
            No safety topics are available yet.
          </p>
          <button
            type="button"
            onClick={loadTopics}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-surface border border-outline-variant/40 text-primary font-label-md font-semibold"
          >
            Refresh
          </button>
        </div>
      )}

      {!loading && !error && topics.length > 0 && filteredTopics.length === 0 && (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3">
          <p className="font-body-md text-body-md text-on-surface-variant">
            No safety guides match your search.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedGroup(null);
                setSearchQuery('');
              }}
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-surface border border-outline-variant/40 text-primary font-label-md font-semibold"
            >
              Show all topics
            </button>
          )}
        </div>
      )}

      {/* Safety Topics Grid */}
      {!loading && !error && filteredTopics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTopics.map((topic) => {
            const iconName = getSafetyGroupIcon(topic.groupName);
            const groupLabel = getSafetyGroupLabel(topic.groupName);
            return (
              <Link
                key={topic.id || topic.slug}
                to={`/safety/${encodeURIComponent(topic.slug)}`}
                className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm hover:border-primary/40 transition-colors flex items-start gap-3.5 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="w-11 h-11 rounded-xl bg-secondary-container/45 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                    {iconName}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="font-body-sm text-xs text-secondary font-semibold">
                        {groupLabel}
                      </p>
                      <h2 className="font-headline-sm text-base sm:text-[17px] text-on-surface group-hover:text-primary font-bold leading-snug break-words transition-colors">
                        {topic.title}
                      </h2>
                    </div>
                    <span
                      className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 mt-1"
                      aria-hidden="true"
                    >
                      chevron_right
                    </span>
                  </div>

                  {topic.summary && (
                    <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant line-clamp-3 leading-relaxed">
                      {topic.summary}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom Disclaimer */}
      <SafetyDisclaimerFooter />
    </div>
  );
};
