import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { formatRaritySimple } from '../services/lifeListService';
import {
  YearReviewData,
  fetchAvailableReviewYears,
  fetchSafeUsername,
  fetchYearReview,
  formatCategoryLabel,
} from '../services/yearReviewService';
import { generateYearReviewCardBlob } from '../utils/yearReviewCanvas';

function detectFileShareSupport(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  if (typeof File === 'undefined') return false;

  try {
    const sample = new File([''], 'wilddex.png', { type: 'image/png' });
    return navigator.canShare({ files: [sample] });
  } catch {
    return false;
  }
}

export const YearReviewPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();

  const initialYear = useMemo(() => {
    const raw = Number(searchParams.get('year'));
    if (Number.isInteger(raw) && raw >= 1900 && raw <= 2100) {
      return raw;
    }
    return currentYear;
  }, [currentYear, searchParams]);

  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  const [review, setReview] = useState<YearReviewData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [rarestPhotoBroken, setRarestPhotoBroken] = useState(false);

  const [safeUsername, setSafeUsername] = useState<string>('Explorer');
  const [savingImage, setSavingImage] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<'save' | 'share' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canShareFiles = useMemo(() => detectFileShareSupport(), []);
  const activeReviewReqRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loadYearsAndUsername = useCallback(async () => {
    if (!currentUser) {
      setAvailableYears([currentYear]);
      setYearsLoading(false);
      setYearsError(null);
      return;
    }

    setYearsLoading(true);
    setYearsError(null);
    try {
      const [years, handle] = await Promise.all([
        fetchAvailableReviewYears(),
        fetchSafeUsername(userProfile?.displayName || currentUser.displayName),
      ]);

      const merged = years.includes(selectedYear)
        ? years
        : [selectedYear, ...years].sort((a, b) => b - a);
      setAvailableYears(merged);
      setSafeUsername(handle);
    } catch (err: any) {
      setYearsError(err?.message || 'Could not load your sighting years.');
    } finally {
      setYearsLoading(false);
    }
  }, [currentUser?.id, currentUser?.displayName, userProfile?.displayName, currentYear, selectedYear]);

  const loadReview = useCallback(async () => {
    if (!currentUser) {
      setReview(null);
      setReviewLoading(false);
      setReviewError(null);
      return;
    }

    const reqId = ++activeReviewReqRef.current;
    setReviewLoading(true);
    setReviewError(null);
    setRarestPhotoBroken(false);

    try {
      const data = await fetchYearReview(selectedYear);
      if (reqId !== activeReviewReqRef.current) return;
      setReview(data);
    } catch (err: any) {
      if (reqId !== activeReviewReqRef.current) return;
      setReviewError(err?.message || 'Could not load your year in review.');
    } finally {
      if (reqId === activeReviewReqRef.current) {
        setReviewLoading(false);
      }
    }
  }, [currentUser?.id, selectedYear]);

  useEffect(() => {
    loadYearsAndUsername();
  }, [loadYearsAndUsername]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const handleYearChange = (nextYear: number) => {
    setSelectedYear(nextYear);
    setActionError(null);
    setLastFailedAction(null);
    if (nextYear === currentYear) {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ year: String(nextYear) }, { replace: true });
    }
  };

  const handleSaveAsImage = async () => {
    if (!review || savingImage || sharingImage) return;
    setSavingImage(true);
    setActionError(null);
    setLastFailedAction(null);

    try {
      const blob = await generateYearReviewCardBlob(review, safeUsername);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wilddex-year-review-${review.year}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      setToast('Summary card saved to your device.');
    } catch (err: any) {
      setLastFailedAction('save');
      setActionError(err?.message || 'Could not save summary image. Please try again.');
    } finally {
      setSavingImage(false);
    }
  };

  const handleShareImage = async () => {
    if (!review || savingImage || sharingImage || !canShareFiles) return;
    setSharingImage(true);
    setActionError(null);
    setLastFailedAction(null);

    try {
      const blob = await generateYearReviewCardBlob(review, safeUsername);
      const file = new File([blob], `wilddex-year-review-${review.year}.png`, {
        type: 'image/png',
      });

      await navigator.share({
        files: [file],
        title: `My ${review.year} WildDex Year in Review`,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      setLastFailedAction('share');
      setActionError(err?.message || 'Could not share summary image. Please try again.');
    } finally {
      setSharingImage(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to see your Year in Review"
          description="Look back on the species you found, your busiest month outdoors, and a card you can save on your device."
          icon="calendar_month"
        />
      </div>
    );
  }

  const maxMonthCount = review?.months.length
    ? Math.max(1, ...review.months.map((m) => m.count))
    : 1;
  const maxTopSpeciesCount = review?.topSpecies.length
    ? Math.max(1, ...review.topSpecies.map((s) => s.count))
    : 1;

  const hasEnoughSightings =
    review !== null && review.sightings !== null && review.sightings >= 3;

  const statCards: { key: string; headline: string; detail: string; accentClass: string }[] = [];
  if (review) {
    if (review.species !== null) {
      statCards.push({
        key: 'species',
        headline: `You spotted ${review.species} ${review.species === 1 ? 'species' : 'species'}`,
        detail:
          review.sightings !== null
            ? `Across ${review.sightings} ${review.sightings === 1 ? 'sighting' : 'sightings'} in ${review.year}`
            : `Recorded in ${review.year}`,
        accentClass: 'text-primary',
      });
    }
    if (review.newSpecies !== null) {
      statCards.push({
        key: 'newSpecies',
        headline: `${review.newSpecies} ${review.newSpecies === 1 ? 'was' : 'were'} new to you`,
        detail: 'First time added to your life list',
        accentClass: 'text-secondary',
      });
    }
    if (review.topCategory) {
      statCards.push({
        key: 'topCategory',
        headline: `Your favorite group: ${formatCategoryLabel(review.topCategory)}`,
        detail: 'Most spotted category this year',
        accentClass: 'text-primary',
      });
    }
    if (review.busiestMonthName) {
      const busiestCount =
        review.busiestMonth !== null
          ? review.months.find((m) => m.month === review.busiestMonth)?.count
          : undefined;
      statCards.push({
        key: 'busiestMonth',
        headline: `Busiest month: ${review.busiestMonthName}`,
        detail:
          busiestCount !== undefined
            ? `${busiestCount} ${busiestCount === 1 ? 'sighting' : 'sightings'} logged`
            : 'Peak time outdoors',
        accentClass: 'text-tertiary',
      });
    }
  }

  return (
    <div className="flex flex-col w-full min-w-0 max-w-5xl mx-auto px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Top Navigation & Year Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
            <Link
              to="/life-list"
              className="inline-flex items-center gap-1 hover:text-primary transition-colors min-h-[36px]"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                arrow_back
              </span>
              <span>Life List</span>
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to="/profile"
              className="hover:text-primary transition-colors min-h-[36px] inline-flex items-center"
            >
              Profile
            </Link>
          </div>
          <h1 className="font-headline-sm sm:font-headline-md text-primary font-bold">
            Year in Review
          </h1>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
            A calm look back at what you found in {selectedYear}.
          </p>
        </div>

        {/* Year Picker */}
        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="year-review-picker"
            className="font-label-md text-xs text-on-surface-variant whitespace-nowrap"
          >
            Year
          </label>
          {yearsLoading ? (
            <div className="h-11 w-28 rounded-xl bg-surface-container-high animate-pulse" />
          ) : (
            <select
              id="year-review-picker"
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              aria-label="Select year"
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm font-semibold text-on-surface tabular-nums focus:outline-none focus:border-primary"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Years Load Error Banner */}
      {yearsError && (
        <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3">
          <p className="font-body-sm text-xs sm:text-sm text-on-surface font-medium">
            {yearsError}
          </p>
          <button
            type="button"
            onClick={loadYearsAndUsername}
            className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {reviewLoading && (
        <div className="space-y-4 animate-pulse" aria-label="Loading year in review">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="h-24 rounded-2xl bg-surface-container-high" />
            <div className="h-24 rounded-2xl bg-surface-container-high" />
            <div className="h-24 rounded-2xl bg-surface-container-high" />
            <div className="h-24 rounded-2xl bg-surface-container-high" />
          </div>
          <div className="h-48 rounded-2xl bg-surface-container-high" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="h-64 rounded-2xl bg-surface-container-high" />
            <div className="h-64 rounded-2xl bg-surface-container-high" />
          </div>
        </div>
      )}

      {/* Review RPC Error State with Retry */}
      {!reviewLoading && reviewError && (
        <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error" aria-hidden="true">
            error_outline
          </span>
          <p className="font-body-md text-body-md text-on-surface font-medium max-w-md">
            {reviewError}
          </p>
          <button
            type="button"
            onClick={loadReview}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Fewer than 3 sightings state */}
      {!reviewLoading && !reviewError && review && !hasEnoughSightings && (
        <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3.5">
          <div className="w-16 h-16 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[34px]" aria-hidden="true">
              calendar_month
            </span>
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            {selectedYear} Year in Review
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
            Add a few more sightings to see your year in review
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1 w-full sm:w-auto">
            <Link
              to="/scan"
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 inline-flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                document_scanner
              </span>
              <span>Open AI Scanner</span>
            </Link>
            <Link
              to="/life-list"
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-full bg-surface border border-outline-variant/40 text-primary font-label-md font-semibold hover:bg-surface-container inline-flex items-center justify-center"
            >
              Back to My Life List
            </Link>
          </div>
        </div>
      )}

      {/* Main Year in Review Content (3+ sightings) */}
      {!reviewLoading && !reviewError && review && hasEnoughSightings && (
        <div className="space-y-4">
          {/* Save as image & Share Controls */}
          <section
            aria-label="Save or share summary card"
            className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-label-md text-sm font-bold text-on-surface">
                Shareable summary card
              </p>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Made on your device. Nothing is uploaded or shared publicly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={savingImage || sharingImage}
                onClick={handleSaveAsImage}
                className="min-h-[44px] px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60"
              >
                {savingImage ? (
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    download
                  </span>
                )}
                <span>{savingImage ? 'Creating image...' : 'Save as image'}</span>
              </button>

              {canShareFiles && (
                <button
                  type="button"
                  disabled={savingImage || sharingImage}
                  onClick={handleShareImage}
                  className="min-h-[44px] px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-xs font-semibold hover:opacity-95 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60"
                >
                  {sharingImage ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      share
                    </span>
                  )}
                  <span>{sharingImage ? 'Preparing...' : 'Share'}</span>
                </button>
              )}
            </div>
          </section>

          {/* Image Save / Share Error Banner */}
          {actionError && (
            <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3">
              <p className="font-body-sm text-xs sm:text-sm text-on-surface font-medium">
                {actionError}
              </p>
              {lastFailedAction && (
                <button
                  type="button"
                  onClick={
                    lastFailedAction === 'share' ? handleShareImage : handleSaveAsImage
                  }
                  className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Friendly Summary Headline Cards */}
          {statCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {statCards.map((card) => (
                <article
                  key={card.key}
                  className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm min-w-0"
                >
                  <h2
                    className={`font-headline-sm text-lg font-bold tabular-nums break-words ${card.accentClass}`}
                  >
                    {card.headline}
                  </h2>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                    {card.detail}
                  </p>
                </article>
              ))}
            </div>
          )}

          {/* 12-Month Bar Chart */}
          {review.months.length > 0 && (
            <section
              aria-label="Sightings by month"
              className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-4 min-w-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-headline-sm text-base sm:text-lg text-on-surface font-bold">
                  Sightings across {review.year}
                </h2>
                {review.sightings !== null && (
                  <span className="font-label-md text-xs text-on-surface-variant tabular-nums">
                    {review.sightings} total
                  </span>
                )}
              </div>

              <div
                className="grid grid-cols-12 gap-1 sm:gap-2 items-end h-36 pt-4"
                role="img"
                aria-label={`Monthly sightings bar chart for ${review.year}`}
              >
                {review.months.map((m) => {
                  const pct =
                    m.count > 0
                      ? Math.max(10, Math.round((m.count / maxMonthCount) * 100))
                      : 0;
                  const isBusiest =
                    review.busiestMonth !== null && m.month === review.busiestMonth;
                  return (
                    <div
                      key={m.month}
                      className="flex flex-col items-center justify-end h-full gap-1.5 min-w-0"
                      title={`${m.label}: ${m.count}`}
                    >
                      <span className="text-[10px] font-medium text-on-surface-variant tabular-nums leading-none">
                        {m.count > 0 ? m.count : ''}
                      </span>
                      <div className="w-full flex-1 flex items-end justify-center">
                        <div
                          className={`w-full max-w-[22px] rounded-t-md transition-[height] duration-300 ${
                            m.count === 0
                              ? 'h-1 bg-surface-container-high'
                              : isBusiest
                              ? 'bg-primary'
                              : 'bg-secondary/65'
                          }`}
                          style={m.count > 0 ? { height: `${pct}%` } : undefined}
                        />
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs leading-none ${
                          isBusiest
                            ? 'font-bold text-primary'
                            : 'text-on-surface-variant font-medium'
                        }`}
                      >
                        <span className="sm:hidden">{m.shortLabel.charAt(0)}</span>
                        <span className="hidden sm:inline">{m.shortLabel}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Rarest Find & Most Seen Top 5 */}
          {(review.rarest || review.topSpecies.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
              {review.rarest && (
                <section
                  aria-label="Rarest find"
                  className="rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm overflow-hidden flex flex-col min-w-0"
                >
                  <div className="aspect-[16/10] w-full bg-surface-container flex items-center justify-center overflow-hidden">
                    {review.rarest.photoUrl && !rarestPhotoBroken ? (
                      <img
                        src={review.rarest.photoUrl}
                        alt={review.rarest.name}
                        referrerPolicy="no-referrer"
                        onError={() => setRarestPhotoBroken(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-on-surface-variant p-4 text-center">
                        <span className="material-symbols-outlined text-[40px]" aria-hidden="true">
                          eco
                        </span>
                        <span className="font-body-sm text-xs">No photo available</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="font-body-sm text-xs text-tertiary font-semibold">
                      {formatRaritySimple(review.rarest.rarity).label}
                    </p>
                    <h2 className="font-headline-sm text-lg text-on-surface font-bold break-words">
                      Rarest find: {review.rarest.name}
                    </h2>
                  </div>
                </section>
              )}

              {review.topSpecies.length > 0 && (
                <section
                  aria-label="Most seen species"
                  className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm flex flex-col justify-between gap-3 min-w-0"
                >
                  <div className="space-y-3">
                    <h2 className="font-headline-sm text-base sm:text-lg text-on-surface font-bold">
                      Most seen
                    </h2>

                    <ol className="space-y-2.5">
                      {review.topSpecies.slice(0, 5).map((item, idx) => {
                        const widthPct = Math.max(
                          8,
                          Math.round((item.count / maxTopSpeciesCount) * 100)
                        );
                        return (
                          <li key={`${item.name}-${idx}`} className="space-y-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="font-medium text-on-surface truncate">
                                <span className="text-on-surface-variant tabular-nums mr-1.5">
                                  {idx + 1}.
                                </span>
                                {item.name}
                              </span>
                              <span className="font-semibold text-primary tabular-nums shrink-0 text-xs">
                                {item.count} {item.count === 1 ? 'sighting' : 'sightings'}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                              <div
                                className="h-full rounded-full bg-secondary"
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Yearly Goal Progress Card (hidden if no goal exists) */}
          {review.goal && (
            <section
              aria-label="Yearly goal progress"
              className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 space-y-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-headline-sm text-base text-on-surface font-bold">
                  {review.year} species goal
                </h2>
                <span className="font-label-md text-sm font-bold text-primary tabular-nums">
                  {review.goal.currentSpecies} of {review.goal.targetSpecies} species
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Year in review species goal progress"
                aria-valuemin={0}
                aria-valuemax={review.goal.targetSpecies}
                aria-valuenow={Math.min(
                  review.goal.currentSpecies,
                  review.goal.targetSpecies
                )}
                className="w-full h-3 rounded-full bg-surface-container-highest overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (review.goal.currentSpecies / review.goal.targetSpecies) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant">
                {review.goal.currentSpecies >= review.goal.targetSpecies
                  ? `You reached your ${review.year} goal.`
                  : `${review.goal.targetSpecies - review.goal.currentSpecies} more species toward your ${review.year} goal.`}
              </p>
            </section>
          )}
        </div>
      )}

      {/* Toast */}
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
