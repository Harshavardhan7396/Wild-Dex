import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { AddPastSightingModal } from '../components/lifeList/AddPastSightingModal';
import {
  LIFE_LIST_PAGE_SIZE,
  LifeListEntry,
  LifeListSort,
  LifeListSummary,
  YearlyGoalState,
  downloadLifeListCsv,
  fetchAllLifeListEntries,
  fetchLifeListPage,
  fetchLifeListSummary,
  fetchYearlyGoal,
  formatLifeListDate,
  formatRaritySimple,
  getLifeListCategoryIcon,
  saveYearlyGoal,
} from '../services/lifeListService';

const SORT_OPTIONS: { value: LifeListSort; label: string }[] = [
  { value: 'recent', label: 'Newest' },
  { value: 'az', label: 'A to Z' },
  { value: 'rarity', label: 'Rarest' },
  { value: 'favorites', label: 'Favorites' },
];

const GoalProgressRing: React.FC<{
  current: number;
  goal: number;
}> = ({ current, goal }) => {
  const safeGoal = Math.max(1, goal);
  const ratio = Math.min(1, Math.max(0, current / safeGoal));
  const pct = Math.round(ratio * 100);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <div className="col-span-2 md:col-span-1 p-3.5 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center gap-3.5 min-w-0">
      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 56 56"
          className="w-14 h-14 -rotate-90"
          role="img"
          aria-label={`This year's goal progress: ${pct}%`}
        >
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-surface-container-highest"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-primary transition-[stroke-dashoffset] duration-300"
          />
        </svg>
        <span className="absolute text-[11px] font-bold text-primary tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-label-md text-xs text-on-surface-variant">
          This year&apos;s goal
        </p>
        <p className="font-headline-sm text-lg text-on-surface font-bold tabular-nums">
          {current} / {goal}
        </p>
        <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
          {current >= goal ? 'Goal reached' : `${goal - current} more species to go`}
        </p>
      </div>
    </div>
  );
};

export const LifeListPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Summary state
  const [summary, setSummary] = useState<LifeListSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Filters & view state
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<LifeListSort>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // List state
  const [entries, setEntries] = useState<LifeListEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [brokenPhotoKeys, setBrokenPhotoKeys] = useState<Record<string, boolean>>({});

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Yearly goal state
  const currentYear = new Date().getFullYear();
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalState | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [goalLoading, setGoalLoading] = useState(true);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaveError, setGoalSaveError] = useState<string | null>(null);

  // Add past sighting modal
  const [pastModalOpen, setPastModalOpen] = useState(false);

  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // 300ms search debounce
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    if (!currentUser) {
      setSummary(null);
      setSummaryLoading(false);
      setSummaryError(null);
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const result = await fetchLifeListSummary();
      setSummary(result);
    } catch (err: any) {
      setSummaryError(err?.message || 'Could not load your life list summary.');
    } finally {
      setSummaryLoading(false);
    }
  }, [currentUser?.id]);

  const loadFirstPage = useCallback(async () => {
    if (!currentUser) {
      setEntries([]);
      setListLoading(false);
      setListError(null);
      setHasMore(false);
      return;
    }

    const reqId = ++activeRequestIdRef.current;
    setListLoading(true);
    setListError(null);
    setLoadMoreError(null);

    try {
      const res = await fetchLifeListPage({
        group: selectedGroup,
        search: debouncedSearch,
        sort: sortBy,
        limit: LIFE_LIST_PAGE_SIZE,
        offset: 0,
      });

      if (reqId !== activeRequestIdRef.current) return;
      setEntries(res.entries);
      setHasMore(res.hasMore);
      setBrokenPhotoKeys({});
    } catch (err: any) {
      if (reqId !== activeRequestIdRef.current) return;
      setListError(err?.message || 'Could not load your life list.');
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setListLoading(false);
      }
    }
  }, [currentUser?.id, selectedGroup, debouncedSearch, sortBy]);

  const loadGoal = useCallback(async () => {
    if (!currentUser) {
      setYearlyGoal(null);
      setGoalInput('');
      setGoalLoading(false);
      setGoalError(null);
      return;
    }

    setGoalLoading(true);
    setGoalError(null);
    try {
      const state = await fetchYearlyGoal(currentYear);
      setYearlyGoal(state);
      setGoalInput(state.targetSpecies ? String(state.targetSpecies) : '');
    } catch (err: any) {
      setGoalError(err?.message || 'Could not load your yearly goal.');
    } finally {
      setGoalLoading(false);
    }
  }, [currentUser?.id, currentYear]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !currentUser) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await fetchLifeListPage({
        group: selectedGroup,
        search: debouncedSearch,
        sort: sortBy,
        limit: LIFE_LIST_PAGE_SIZE,
        offset: entries.length,
      });

      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.speciesKey));
        const uniqueNext = res.entries.filter((e) => !seen.has(e.speciesKey));
        return [...prev, ...uniqueNext];
      });
      setHasMore(res.hasMore);
    } catch (err: any) {
      setLoadMoreError(err?.message || 'Could not load more species.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExportCsv = async () => {
    if (exporting || !currentUser) return;
    setExporting(true);
    setExportError(null);
    try {
      const allEntries = await fetchAllLifeListEntries({
        group: selectedGroup,
        search: debouncedSearch,
        sort: sortBy,
      });
      if (allEntries.length === 0) {
        setToast('Nothing to export yet.');
        return;
      }
      downloadLifeListCsv(allEntries);
      setToast(`Exported ${allEntries.length} ${allEntries.length === 1 ? 'species' : 'species'} to CSV.`);
    } catch (err: any) {
      setExportError(err?.message || 'Could not export your life list.');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveGoal = async () => {
    if (goalSaving || !currentUser) return;
    const numericTarget = Number(goalInput.trim());
    if (!Number.isFinite(numericTarget) || numericTarget < 1 || numericTarget > 10000) {
      setGoalSaveError('Please enter a number between 1 and 10,000.');
      return;
    }

    setGoalSaving(true);
    setGoalSaveError(null);
    try {
      const savedTarget = await saveYearlyGoal(currentYear, numericTarget);
      setYearlyGoal((prev) => ({
        year: currentYear,
        targetSpecies: savedTarget,
        speciesThisYear: prev?.speciesThisYear ?? summary?.yearSpeciesCount ?? 0,
      }));
      setGoalInput(String(savedTarget));
      setToast(`Goal saved for ${currentYear}.`);
    } catch (err: any) {
      setGoalSaveError(err?.message || 'Could not save your goal. Please try again.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleOpenEntry = (entry: LifeListEntry) => {
    const targetParam = entry.itemId || entry.speciesKey;
    navigate(`/life-list/${encodeURIComponent(targetParam)}`, {
      state: { entry },
    });
  };

  const effectiveYearGoal = yearlyGoal?.targetSpecies ?? summary?.yearGoal ?? null;
  const effectiveYearCount =
    yearlyGoal !== null ? yearlyGoal.speciesThisYear : (summary?.yearSpeciesCount ?? 0);

  const hasActiveFilters = Boolean(selectedGroup || debouncedSearch || sortBy !== 'recent');

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to open My Life List"
          description="Keep a life list of every species you have ever found, check first-seen dates, and export your list anytime."
          icon="menu_book"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-headline-sm text-headline-sm text-primary font-bold">
            My Life List
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            One entry for every species you have ever found.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 shrink-0">
          <Link
            to="/year-review"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold hover:opacity-95 active:scale-[0.98] transition-all shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              calendar_month
            </span>
            <span>See my {currentYear} in review</span>
          </Link>

          <button
            type="button"
            onClick={() => setPastModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add
            </span>
            <span>Add a past sighting</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || (listLoading && entries.length === 0)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full bg-surface-container-low border border-outline-variant/40 text-primary font-label-md text-label-md font-semibold hover:bg-surface-container active:scale-[0.98] transition-all shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            {exporting ? (
              <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                download
              </span>
            )}
            <span>{exporting ? 'Exporting...' : 'Export list'}</span>
          </button>
        </div>
      </div>

      {/* Export Error Banner */}
      {exportError && (
        <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3">
          <p className="font-body-sm text-xs sm:text-sm text-on-surface font-medium">
            {exportError}
          </p>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 min-h-[38px] rounded-full bg-error text-on-error font-label-md text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Numbers & Year Goal Ring */}
      {summaryLoading ? (
        <div className="space-y-3 animate-pulse" aria-label="Loading life list summary">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-surface-container-high" />
            <div className="h-20 rounded-2xl bg-surface-container-high" />
          </div>
          <div className="flex gap-2 overflow-hidden">
            <div className="h-9 w-16 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-9 w-24 rounded-full bg-surface-container-high shrink-0" />
            <div className="h-9 w-20 rounded-full bg-surface-container-high shrink-0" />
          </div>
        </div>
      ) : summaryError ? (
        <div className="p-4 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3">
          <p className="font-body-sm text-xs sm:text-sm text-on-surface font-medium">
            {summaryError}
          </p>
          <button
            type="button"
            onClick={loadSummary}
            className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      ) : summary ? (
        <div className="space-y-3">
          <div
            className={`grid gap-3 ${
              effectiveYearGoal ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'
            }`}
          >
            <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 min-w-0">
              <p className="font-label-md text-xs text-on-surface-variant">
                Species found
              </p>
              <p className="font-headline-md text-2xl sm:text-[26px] text-primary font-bold mt-1 tabular-nums">
                {summary.speciesFound}
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 min-w-0">
              <p className="font-label-md text-xs text-on-surface-variant">
                Total sightings
              </p>
              <p className="font-headline-md text-2xl sm:text-[26px] text-on-surface font-bold mt-1 tabular-nums">
                {summary.totalSightings}
              </p>
            </div>

            {effectiveYearGoal !== null && effectiveYearGoal > 0 && (
              <GoalProgressRing
                current={effectiveYearCount}
                goal={effectiveYearGoal}
              />
            )}
          </div>

          {/* Group Chips (dynamically built from returned groups) */}
          {summary.groups.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5"
              role="group"
              aria-label="Filter by group"
            >
              <button
                type="button"
                aria-pressed={selectedGroup === null}
                onClick={() => setSelectedGroup(null)}
                className={`px-3.5 py-2 min-h-[40px] rounded-full font-label-md text-xs whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                  selectedGroup === null
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <span>All</span>
                <span className="tabular-nums opacity-85">{summary.speciesFound}</span>
              </button>

              {summary.groups.map((grp) => {
                const active = selectedGroup === grp.key;
                return (
                  <button
                    key={grp.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedGroup(grp.key)}
                    className={`px-3.5 py-2 min-h-[40px] rounded-full font-label-md text-xs whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-secondary text-on-secondary font-semibold shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <span>{grp.label}</span>
                    {grp.count !== null && (
                      <span className="tabular-nums opacity-85">{grp.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Yearly Goal Card */}
      {goalLoading ? (
        <div
          className="h-28 rounded-2xl bg-surface-container-high animate-pulse"
          aria-label="Loading yearly goal"
        />
      ) : goalError ? (
        <div className="p-4 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3">
          <p className="font-body-sm text-xs sm:text-sm text-on-surface font-medium">
            {goalError}
          </p>
          <button
            type="button"
            onClick={loadGoal}
            className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      ) : (
        <section
          aria-label="Yearly goal"
          className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h2 className="font-headline-sm text-base text-on-surface font-bold">
                Yearly goal
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveGoal();
                }}
                className="flex flex-wrap items-center gap-2 text-sm text-on-surface"
              >
                <span>I want to find</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  value={goalInput}
                  onChange={(e) => {
                    setGoalInput(e.target.value);
                    if (goalSaveError) setGoalSaveError(null);
                  }}
                  placeholder="25"
                  aria-label={`Target number of species to find in ${currentYear}`}
                  className="w-20 min-h-[40px] px-2.5 py-1.5 rounded-xl bg-surface border border-outline-variant/45 text-center font-semibold text-on-surface tabular-nums focus:outline-none focus:border-primary"
                />
                <span>species in {currentYear}</span>
                <button
                  type="submit"
                  disabled={goalSaving}
                  className="px-4 py-2 min-h-[40px] rounded-full bg-secondary-container text-on-secondary-container font-label-md text-xs font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {goalSaving && (
                    <span className="material-symbols-outlined text-[16px] animate-spin" aria-hidden="true">
                      progress_activity
                    </span>
                  )}
                  <span>{goalSaving ? 'Saving...' : 'Save goal'}</span>
                </button>
              </form>
            </div>

            {yearlyGoal?.targetSpecies && (
              <p className="font-label-md text-xs sm:text-sm font-semibold text-primary tabular-nums shrink-0">
                {yearlyGoal.speciesThisYear} of {yearlyGoal.targetSpecies} species this year
              </p>
            )}
          </div>

          {goalSaveError && (
            <div className="p-2.5 rounded-xl bg-error-container/25 border border-error/30 text-xs text-on-error-container flex items-center justify-between gap-2">
              <span>{goalSaveError}</span>
              <button
                type="button"
                disabled={goalSaving}
                onClick={handleSaveGoal}
                className="px-3 py-1 rounded-full bg-surface text-primary font-semibold border border-outline-variant/40 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {yearlyGoal?.targetSpecies && (
            <div className="space-y-1.5">
              <div
                role="progressbar"
                aria-label="Yearly species goal progress"
                aria-valuemin={0}
                aria-valuemax={yearlyGoal.targetSpecies}
                aria-valuenow={Math.min(yearlyGoal.speciesThisYear, yearlyGoal.targetSpecies)}
                className="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((yearlyGoal.speciesThisYear / yearlyGoal.targetSpecies) * 100)
                    )}%`,
                  }}
                />
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant">
                {yearlyGoal.speciesThisYear >= yearlyGoal.targetSpecies
                  ? `You found ${yearlyGoal.speciesThisYear} species in ${currentYear}.`
                  : 'Go at your own pace. Every new sighting adds to your year.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Search, Sort & Grid/List Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <span
            className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search species or science name..."
            aria-label="Search life list"
            className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl bg-surface-container-low border border-outline-variant/35 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container absolute right-1 top-1/2 -translate-y-1/2"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                close
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <div className="relative flex-1 sm:flex-initial min-w-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LifeListSort)}
              aria-label="Sort life list"
              className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/35 text-sm font-medium text-on-surface focus:outline-none focus:border-primary"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="inline-flex items-center p-1 rounded-xl bg-surface-container-low border border-outline-variant/30 shrink-0"
            role="group"
            aria-label="View layout"
          >
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                grid_view
              </span>
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                view_list
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* List Loading Skeletons */}
      {listLoading && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-pulse'
              : 'flex flex-col gap-2.5 animate-pulse'
          }
          aria-label="Loading life list entries"
        >
          {[0, 1, 2, 3, 4, 5].map((idx) =>
            viewMode === 'grid' ? (
              <div
                key={idx}
                className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden"
              >
                <div className="aspect-[4/3] w-full bg-surface-container-high" />
                <div className="p-3.5 space-y-2.5">
                  <div className="h-5 w-3/4 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-1/2 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-2/3 rounded bg-surface-container-high" />
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-center gap-3"
              >
                <div className="w-16 h-16 rounded-xl bg-surface-container-high shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-28 rounded bg-surface-container-high" />
                  <div className="h-3 w-48 rounded bg-surface-container-high" />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* List Error State with Retry */}
      {!listLoading && listError && (
        <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error" aria-hidden="true">
            error_outline
          </span>
          <p className="font-body-md text-body-md text-on-surface font-medium max-w-md">
            {listError}
          </p>
          <button
            type="button"
            onClick={loadFirstPage}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty States */}
      {!listLoading && !listError && entries.length === 0 && !hasActiveFilters && (
        <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3.5">
          <div className="w-16 h-16 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[34px]" aria-hidden="true">
              menu_book
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface font-medium max-w-sm">
            Your life list is empty. Scan something to add your first species!
          </p>
          <Link
            to="/scan"
            className="mt-1 px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              document_scanner
            </span>
            <span>Open AI Scanner</span>
          </Link>
        </div>
      )}

      {!listLoading && !listError && entries.length === 0 && hasActiveFilters && (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-3">
          <p className="font-body-md text-body-md text-on-surface-variant">
            No species found for this filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedGroup(null);
              setSearchInput('');
              setDebouncedSearch('');
              setSortBy('recent');
            }}
            className="px-4 py-2 min-h-[44px] rounded-full bg-surface border border-outline-variant/40 text-primary font-label-md font-semibold"
          >
            Show all species
          </button>
        </div>
      )}

      {/* Entries Grid or List */}
      {!listLoading && !listError && entries.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {entries.map((entry) => {
                const rarityInfo = formatRaritySimple(entry.rarity);
                const iconName = getLifeListCategoryIcon(entry.category);
                const showPhoto =
                  Boolean(entry.photoUrl) && !brokenPhotoKeys[entry.speciesKey];
                const sightingsLabel =
                  entry.sightings === 1
                    ? '1 sighting'
                    : `${entry.sightings} sightings`;

                return (
                  <button
                    key={entry.speciesKey}
                    type="button"
                    onClick={() => handleOpenEntry(entry)}
                    className="text-left rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm overflow-hidden flex flex-col min-w-0 group hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
                      {showPhoto ? (
                        <img
                          src={entry.photoUrl}
                          alt={entry.speciesName}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenPhotoKeys((prev) => ({
                              ...prev,
                              [entry.speciesKey]: true,
                            }))
                          }
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-on-surface-variant bg-surface-container">
                          <span className="material-symbols-outlined text-[36px]" aria-hidden="true">
                            {iconName}
                          </span>
                          {entry.category && (
                            <span className="font-body-sm text-xs capitalize">
                              {entry.category}
                            </span>
                          )}
                        </div>
                      )}

                      {entry.favorite && (
                        <span
                          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-surface/90 text-tertiary shadow-sm flex items-center justify-center"
                          title="Favorite"
                          aria-label="Favorite species"
                        >
                          <span
                            className="material-symbols-outlined text-[18px] fill-1"
                            aria-hidden="true"
                          >
                            star
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 sm:p-4 flex-1 flex flex-col gap-1.5 w-full min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <h2 className="font-headline-sm text-[17px] leading-snug text-on-surface group-hover:text-primary font-bold truncate transition-colors">
                          {entry.speciesName}
                        </h2>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 whitespace-nowrap ${rarityInfo.badgeClass}`}
                        >
                          {rarityInfo.label}
                        </span>
                      </div>

                      {entry.scientificName && (
                        <p className="font-body-sm text-xs text-on-surface-variant italic truncate">
                          {entry.scientificName}
                        </p>
                      )}

                      <div className="mt-auto pt-2 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-on-surface-variant">
                        <span className="truncate">
                          {entry.category ? (
                            <span className="capitalize font-medium text-secondary">
                              {entry.category}
                            </span>
                          ) : null}
                          {entry.category && entry.firstSeen ? ' · ' : ''}
                          {entry.firstSeen
                            ? `First seen ${formatLifeListDate(entry.firstSeen)}`
                            : ''}
                        </span>
                        <span className="font-medium text-on-surface tabular-nums shrink-0">
                          {sightingsLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {entries.map((entry) => {
                const rarityInfo = formatRaritySimple(entry.rarity);
                const iconName = getLifeListCategoryIcon(entry.category);
                const showPhoto =
                  Boolean(entry.photoUrl) && !brokenPhotoKeys[entry.speciesKey];
                const sightingsLabel =
                  entry.sightings === 1
                    ? '1 sighting'
                    : `${entry.sightings} sightings`;

                return (
                  <button
                    key={entry.speciesKey}
                    type="button"
                    onClick={() => handleOpenEntry(entry)}
                    className="w-full text-left p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm flex items-center gap-3 min-w-0 group hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-surface-container shrink-0 flex items-center justify-center">
                      {showPhoto ? (
                        <img
                          src={entry.photoUrl}
                          alt={entry.speciesName}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenPhotoKeys((prev) => ({
                              ...prev,
                              [entry.speciesKey]: true,
                            }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          className="material-symbols-outlined text-[28px] text-on-surface-variant"
                          aria-hidden="true"
                        >
                          {iconName}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h2 className="font-headline-sm text-base text-on-surface group-hover:text-primary font-bold truncate transition-colors">
                            {entry.speciesName}
                          </h2>
                          {entry.favorite && (
                            <span
                              className="material-symbols-outlined text-[16px] text-tertiary fill-1 shrink-0"
                              aria-label="Favorite species"
                            >
                              star
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 whitespace-nowrap ${rarityInfo.badgeClass}`}
                        >
                          {rarityInfo.label}
                        </span>
                      </div>

                      {entry.scientificName && (
                        <p className="font-body-sm text-xs text-on-surface-variant italic truncate">
                          {entry.scientificName}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-on-surface-variant">
                        {entry.category && (
                          <span className="capitalize font-medium text-secondary">
                            {entry.category}
                          </span>
                        )}
                        {entry.firstSeen && (
                          <>
                            {entry.category && <span aria-hidden="true">&middot;</span>}
                            <span>First seen {formatLifeListDate(entry.firstSeen)}</span>
                          </>
                        )}
                        <span aria-hidden="true">&middot;</span>
                        <span className="font-medium text-on-surface tabular-nums">
                          {sightingsLabel}
                        </span>
                      </div>
                    </div>

                    <span
                      className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 hidden sm:inline-block"
                      aria-hidden="true"
                    >
                      chevron_right
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Load More Error */}
          {loadMoreError && (
            <div className="p-4 rounded-2xl bg-error-container/25 border border-error/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="font-body-sm text-sm text-on-surface font-medium">
                {loadMoreError}
              </p>
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-full bg-surface-container-low border border-outline-variant/40 text-primary font-label-md text-sm font-semibold hover:bg-surface-container disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {loadingMore && (
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                    progress_activity
                  </span>
                )}
                <span>{loadingMore ? 'Loading more...' : 'Load more'}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Past Sighting Modal */}
      <AddPastSightingModal
        isOpen={pastModalOpen}
        onClose={() => setPastModalOpen(false)}
        onSaved={(saved) => {
          setPastModalOpen(false);
          setToast(`Added ${saved.speciesName} to your life list.`);
          loadSummary();
          loadGoal();
          loadFirstPage();
        }}
      />

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
