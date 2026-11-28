import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  SafetyDisclaimerFooter,
  SafetyEmergencyBanner,
} from '../components/safety/SafetyChrome';
import {
  SafetyTopic,
  fetchSafetyTopicBySlug,
  getSafetyGroupIcon,
  getSafetyGroupLabel,
} from '../services/safetyService';

export const SafetyDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [topic, setTopic] = useState<SafetyTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromOfflineCache, setFromOfflineCache] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loadTopic = useCallback(async () => {
    if (!slug) {
      setTopic(null);
      setLoading(false);
      setError('Safety topic not found.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchSafetyTopicBySlug(slug);
      setTopic(result.topic);
      setFromOfflineCache(result.fromOfflineCache);
    } catch (err: any) {
      setError(err?.message || 'Could not load this safety topic.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      setToast('Could not open print dialog on this device.');
    }
  };

  const handleShare = async () => {
    if (!topic) return;
    const shareUrl = window.location.href;
    const shareTitle = `${topic.title} — WildDex Safety Guide`;
    const shareText = topic.summary || shareTitle;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setToast('Link copied to share.');
        return;
      }

      setToast('Sharing is not supported in this browser.');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setToast('Could not share right now. Try copying the page address.');
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0 max-w-4xl mx-auto px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Top Emergency Banner */}
      <SafetyEmergencyBanner />

      {/* Back Link + Print/Share Controls */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/safety"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-full bg-surface-container-low border border-outline-variant/30 text-on-surface font-label-md text-xs font-semibold hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to Safety Guide</span>
        </Link>

        {topic && !loading && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-4 py-2 rounded-full bg-surface-container-low border border-outline-variant/35 text-on-surface font-label-md text-xs font-semibold hover:bg-surface-container inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                print
              </span>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="min-h-[44px] px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-xs font-semibold hover:opacity-95 inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                share
              </span>
              <span>Share</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse" aria-label="Loading safety guide">
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/20 space-y-3">
            <div className="h-4 w-24 rounded bg-surface-container-high" />
            <div className="h-7 w-3/4 rounded bg-surface-container-high" />
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-5/6 rounded bg-surface-container-high" />
          </div>
          <div className="h-36 rounded-2xl bg-surface-container-high" />
          <div className="h-44 rounded-2xl bg-surface-container-high" />
          <div className="h-36 rounded-2xl bg-surface-container-high" />
          <div className="h-28 rounded-2xl bg-surface-container-high" />
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
              onClick={loadTopic}
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
            >
              Retry
            </button>
            <Link
              to="/safety"
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-surface border border-outline-variant/40 text-on-surface font-label-md font-semibold inline-flex items-center"
            >
              All topics
            </Link>
          </div>
        </div>
      )}

      {/* Topic Content */}
      {!loading && !error && topic && (
        <article className="space-y-4">
          {/* Header & Summary */}
          <header className="p-4 sm:p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-3 print-avoid-break">
            <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {getSafetyGroupIcon(topic.groupName)}
              </span>
              <span>{getSafetyGroupLabel(topic.groupName)}</span>
            </div>

            <h1 className="font-headline-md sm:font-headline-lg text-on-surface font-bold break-words">
              {topic.title}
            </h1>

            {topic.summary && (
              <p className="font-body-lg text-base text-on-surface leading-relaxed">
                {topic.summary}
              </p>
            )}

            {/* Offline Note */}
            <div className="no-print pt-2 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                  offline_pin
                </span>
                <span>
                  {fromOfflineCache
                    ? 'Offline copy: loaded from this device without internet.'
                    : 'Offline: saved on this device so you can open it without internet.'}
                </span>
              </span>
              {fromOfflineCache && (
                <button
                  type="button"
                  onClick={loadTopic}
                  className="px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/35 text-primary font-semibold"
                >
                  Retry
                </button>
              )}
            </div>
          </header>

          {/* 1. Warning signs */}
          <section
            aria-label="Warning signs"
            className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-3 print-avoid-break"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-tertiary" aria-hidden="true">
                warning
              </span>
              <h2 className="font-headline-sm text-lg text-on-surface font-bold">
                Warning signs
              </h2>
            </div>

            {topic.warningSigns.length > 0 ? (
              <ul className="space-y-2.5">
                {topic.warningSigns.map((sign, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 font-body-md text-sm sm:text-base text-on-surface leading-relaxed"
                  >
                    <span
                      className="w-2 h-2 rounded-full bg-tertiary mt-2 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 break-words">{sign}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-body-sm text-sm text-on-surface-variant">
                Watch closely for pain, swelling, dizziness, rash, or trouble breathing.
              </p>
            )}
          </section>

          {/* 2. What to do now (numbered list with big readable text) */}
          <section
            aria-label="What to do now"
            className="p-4 sm:p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-4 print-avoid-break"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">
                check_circle
              </span>
              <h2 className="font-headline-sm text-lg sm:text-xl text-primary font-bold">
                What to do now
              </h2>
            </div>

            {topic.doNow.length > 0 ? (
              <ol className="space-y-3.5">
                {topic.doNow.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3.5">
                    <span
                      className="w-8 h-8 rounded-full bg-primary text-on-primary font-headline-sm text-sm font-bold flex items-center justify-center shrink-0 tabular-nums mt-0.5"
                      aria-hidden="true"
                    >
                      {idx + 1}
                    </span>
                    <p className="font-body-lg text-base sm:text-lg text-on-surface font-medium leading-relaxed min-w-0 break-words">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-body-md text-base text-on-surface-variant">
                Stay calm, move to a safe area, and contact medical or vet help.
              </p>
            )}
          </section>

          {/* 3. What NOT to do (with red X icons) */}
          <section
            aria-label="What NOT to do"
            className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-error/25 shadow-sm space-y-3 print-avoid-break"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-error" aria-hidden="true">
                do_not_disturb_on
              </span>
              <h2 className="font-headline-sm text-lg text-error font-bold">
                What NOT to do
              </h2>
            </div>

            {topic.doNot.length > 0 ? (
              <ul className="space-y-2.5">
                {topic.doNot.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 font-body-md text-sm sm:text-base text-on-surface leading-relaxed"
                  >
                    <span
                      className="w-6 h-6 rounded-full bg-error-container text-error flex items-center justify-center shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">
                        close
                      </span>
                    </span>
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-body-sm text-sm text-on-surface-variant">
                Do not delay calling a doctor, vet, or poison centre if symptoms worsen.
              </p>
            )}
          </section>

          {/* 4. Get help (highlighted box) */}
          <section
            aria-label="Get help"
            className="p-4 sm:p-6 rounded-2xl bg-secondary-container/45 border border-secondary/35 space-y-2.5 print-avoid-break"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">
                local_hospital
              </span>
              <h2 className="font-headline-sm text-lg text-on-secondary-container font-bold">
                Get help
              </h2>
            </div>

            <p className="font-body-lg text-sm sm:text-base text-on-surface leading-relaxed whitespace-pre-wrap break-words">
              {topic.getHelp ||
                'Call your local doctor, veterinarian, or poison control centre right away if you are unsure.'}
            </p>
          </section>
        </article>
      )}

      {/* Bottom Disclaimer */}
      <SafetyDisclaimerFooter />

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-xs shadow-lg max-w-[90vw] truncate"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
