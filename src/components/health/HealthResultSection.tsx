import React, { useState, useEffect } from 'react';

export type SeriousnessLevel = 'Low' | 'Medium' | 'High';
export type LikelihoodWord = 'Likely' | 'Possible' | 'Unlikely';

export interface MainPossibility {
  name: string;
  explanation?: string;
  whyItMatches?: string;
  likelihood?: LikelihoodWord;
}

export interface OtherPossibility {
  name: string;
  explanation?: string;
  likelihood?: LikelihoodWord;
}

export interface FoodHelpItem {
  name: string;
  whyItHelps?: string;
  howToGive?: string;
}

export interface FoodAvoidItem {
  name: string;
  why?: string;
}

export interface DetailedHealthResult {
  simpleSummary?: string;
  mainPossibility?: MainPossibility;
  otherPossibilities: OtherPossibility[];
  seriousness?: SeriousnessLevel;
  seriousnessReason?: string;
  emergency: boolean;
  warningSigns: string[];
  whatToDoNow: string[];
  foodsThatHelp: FoodHelpItem[];
  foodsToAvoid: FoodAvoidItem[];
  waterRestAndCare: string[];
  howLongToRecover?: string;
  prevention: string[];
  whenToSeeExpert?: string;
  questionsToAskExpert: string[];
}

const PLANT_CATEGORIES = new Set(['Plant', 'Tree', 'Crop', 'Fungi']);

// Module-level cache for Wikipedia thumbnails so repeated renders do not refetch
const wikiThumbCache = new Map<string, string | null>();

interface FoodPhotoThumbnailProps {
  name: string;
  isPlantLike: boolean;
}

const FoodPhotoThumbnail: React.FC<FoodPhotoThumbnailProps> = ({ name, isPlantLike }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    const key = name.trim().toLowerCase();
    return wikiThumbCache.has(key) ? wikiThumbCache.get(key) ?? null : null;
  });
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const cleanName = name.trim();
    if (!cleanName) {
      setThumbUrl(null);
      return;
    }

    const cacheKey = cleanName.toLowerCase();
    if (wikiThumbCache.has(cacheKey)) {
      setThumbUrl(wikiThumbCache.get(cacheKey) ?? null);
      setImgFailed(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchThumbnail() {
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          wikiThumbCache.set(cacheKey, null);
          if (!cancelled) setThumbUrl(null);
          return;
        }
        const data = await res.json();
        const url =
          typeof data?.thumbnail?.source === 'string' && data.thumbnail.source.trim()
            ? data.thumbnail.source.trim()
            : null;
        wikiThumbCache.set(cacheKey, url);
        if (!cancelled) {
          setImgFailed(false);
          setThumbUrl(url);
        }
      } catch {
        if (!cancelled) {
          setThumbUrl(null);
        }
      }
    }

    fetchThumbnail();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [name]);

  if (!thumbUrl || imgFailed) {
    return (
      <div className="w-full h-32 rounded-t-xl bg-surface-container flex items-center justify-center text-secondary">
        <span className="material-symbols-outlined text-[36px]">
          {isPlantLike ? 'eco' : 'restaurant'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-32 rounded-t-xl bg-surface-container overflow-hidden">
      <img
        src={thumbUrl}
        alt={name}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

interface HealthResultSectionProps {
  result: DetailedHealthResult;
  subjectName: string;
  subjectCategory: string;
  duration: string;
  onNotify: (message: string) => void;
  extraActions?: React.ReactNode;
}

export const HealthResultSection: React.FC<HealthResultSectionProps> = ({
  result,
  subjectName,
  subjectCategory,
  duration,
  onNotify,
  extraActions,
}) => {
  const [othersExpanded, setOthersExpanded] = useState(false);

  const isPlantLike = PLANT_CATEGORIES.has(subjectCategory);
  const showEmergencyBanner = result.seriousness === 'High' || result.emergency;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const lines = [
      `Health Help for ${subjectName}`,
      result.seriousness ? `How serious: ${result.seriousness}` : '',
      result.simpleSummary ? `\nIn simple words:\n${result.simpleSummary}` : '',
      result.mainPossibility?.name ? `\nMost likely cause: ${result.mainPossibility.name}` : '',
      result.whatToDoNow.length > 0
        ? `\nWhat to do right now:\n${result.whatToDoNow.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : '',
      result.whenToSeeExpert ? `\nWhen to see a vet or expert:\n${result.whenToSeeExpert}` : '',
      `\nDisclaimer: This is general information, not a vet or doctor's advice. Do not give medicine without asking a vet.`,
    ].filter(Boolean);

    const shareText = lines.join('\n');

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Health Help: ${subjectName}`,
          text: shareText,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        onNotify('Summary copied so you can share it');
        return;
      }
    } catch {
      // ignore clipboard errors
    }

    onNotify('Use Print or save to keep this summary');
  };

  const likelihoodBadgeClasses = (word?: LikelihoodWord) => {
    if (word === 'Likely') {
      return 'bg-secondary-container text-on-secondary-container';
    }
    if (word === 'Unlikely') {
      return 'bg-surface-container-highest text-on-surface-variant';
    }
    return 'bg-amber-100 text-amber-900';
  };

  const hasExpertCard =
    Boolean(result.whenToSeeExpert) || result.questionsToAskExpert.length > 0;

  return (
    <div className="space-y-space-sm w-full min-w-0">
      {/* Emergency Banner */}
      {showEmergencyBanner && (
        <div
          role="alert"
          className="bg-error text-on-error rounded-xl p-3 sm:p-space-md shadow-md flex items-center gap-3"
        >
          <span
            className="material-symbols-outlined text-[24px] shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            emergency
          </span>
          <p className="font-label-lg text-label-lg font-bold leading-snug">
            See a vet or expert as soon as possible.
          </p>
        </div>
      )}

      {/* Print or Save, Share & Extra Controls */}
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {extraActions}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md font-semibold transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">print</span>
          <span>Print or save</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-full bg-secondary-container text-on-secondary-container hover:opacity-95 font-label-md text-label-md font-semibold transition-opacity active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">share</span>
          <span>Share</span>
        </button>
      </div>

      {/* 1. In simple words */}
      {result.simpleSummary && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">summarize</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              In simple words
            </h3>
          </div>
          <p className="font-body-lg text-[16px] sm:text-[17px] text-on-surface leading-relaxed font-medium break-words">
            {result.simpleSummary}
          </p>
        </section>
      )}

      {/* 2. How serious is it? */}
      {(result.seriousness || result.seriousnessReason) && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              How serious is it?
            </h3>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Duration: {duration}
            </span>
          </div>

          {result.seriousness && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-label-lg text-label-lg font-bold border ${
                  result.seriousness === 'High'
                    ? 'bg-error-container text-on-error-container border-error/40'
                    : result.seriousness === 'Medium'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    result.seriousness === 'High'
                      ? 'bg-error'
                      : result.seriousness === 'Medium'
                      ? 'bg-amber-600'
                      : 'bg-emerald-600'
                  }`}
                ></span>
                <span>{result.seriousness}</span>
              </span>
            </div>
          )}

          {result.seriousnessReason && (
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed break-words">
              {result.seriousnessReason}
            </p>
          )}
        </section>
      )}

      {/* 3. Most likely cause */}
      {result.mainPossibility?.name && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-md space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider mb-1">
                Most likely cause
              </p>
              <h3 className="font-headline-md text-headline-md text-on-surface leading-tight break-words">
                {result.mainPossibility.name}
              </h3>
            </div>
            {result.mainPossibility.likelihood && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full font-label-sm text-label-sm font-bold shrink-0 ${likelihoodBadgeClasses(
                  result.mainPossibility.likelihood
                )}`}
              >
                {result.mainPossibility.likelihood}
              </span>
            )}
          </div>

          {result.mainPossibility.explanation && (
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed break-words">
              {result.mainPossibility.explanation}
            </p>
          )}

          {result.mainPossibility.whyItMatches && (
            <div className="bg-surface-container rounded-lg p-space-sm space-y-1">
              <p className="font-label-sm text-label-sm text-primary font-semibold uppercase tracking-wider">
                Why we think so
              </p>
              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed break-words">
                {result.mainPossibility.whyItMatches}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 4. Other things it could be (collapsible) */}
      {result.otherPossibilities.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <button
            type="button"
            onClick={() => setOthersExpanded((prev) => !prev)}
            aria-expanded={othersExpanded}
            className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">
                list_alt
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Other things it could be
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-semibold shrink-0">
                {result.otherPossibilities.length}
              </span>
            </div>
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant shrink-0">
              {othersExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {othersExpanded && (
            <div className="mt-space-sm space-y-2 pt-2 border-t border-outline-variant/25">
              {result.otherPossibilities.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-surface-container rounded-lg p-space-sm space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-label-lg text-label-lg font-semibold text-on-surface break-words">
                      {item.name}
                    </p>
                    {item.likelihood && (
                      <span
                        className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold shrink-0 ${likelihoodBadgeClasses(
                          item.likelihood
                        )}`}
                      >
                        {item.likelihood}
                      </span>
                    )}
                  </div>
                  {item.explanation && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed break-words">
                      {item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 5. What to do right now */}
      {result.whatToDoNow.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <div className="flex items-center gap-2 mb-space-sm">
            <span className="material-symbols-outlined text-[20px] text-secondary">
              checklist
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              What to do right now
            </h3>
          </div>
          <ol className="space-y-2">
            {result.whatToDoNow.map((step, idx) => (
              <li
                key={idx}
                className="bg-surface-container rounded-lg p-space-sm flex items-start gap-space-sm font-body-sm text-body-sm text-on-surface leading-relaxed"
              >
                <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0 break-words">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 6. Foods that help / Food and care that help */}
      {result.foodsThatHelp.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <div className="flex items-center gap-2 mb-space-sm">
            <span className="material-symbols-outlined text-[20px] text-secondary">
              {isPlantLike ? 'eco' : 'restaurant'}
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              {isPlantLike ? 'Food and care that help' : 'Foods that help'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.foodsThatHelp.map((food, idx) => (
              <div
                key={`${food.name}-${idx}`}
                className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/25 flex flex-col min-w-0"
              >
                <FoodPhotoThumbnail name={food.name} isPlantLike={isPlantLike} />
                <div className="p-3 space-y-2 flex-1 min-w-0">
                  <p className="font-label-lg text-label-lg font-bold text-on-surface break-words">
                    {food.name}
                  </p>
                  {food.whyItHelps && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed break-words">
                      <span className="font-semibold text-on-surface">Why it helps: </span>
                      {food.whyItHelps}
                    </p>
                  )}
                  {food.howToGive && (
                    <p className="font-body-sm text-body-sm text-secondary leading-relaxed break-words">
                      <span className="font-semibold">
                        {isPlantLike ? 'How to use: ' : 'How to give: '}
                      </span>
                      {food.howToGive}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Foods to avoid / Things to avoid */}
      {result.foodsToAvoid.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <div className="flex items-center gap-2 mb-space-sm">
            <span className="material-symbols-outlined text-[20px] text-error">block</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              {isPlantLike ? 'Things to avoid' : 'Foods to avoid'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.foodsToAvoid.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-xl border-2 border-error/65 bg-error-container/15 p-3 flex items-start gap-2.5 min-w-0"
              >
                <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                  cancel
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-label-lg text-label-lg font-bold text-error break-words">
                    {item.name}
                  </p>
                  {item.why && (
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed break-words">
                      {item.why}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Water, rest and care */}
      {result.waterRestAndCare.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <div className="flex items-center gap-2 mb-space-sm">
            <span className="material-symbols-outlined text-[20px] text-primary">water_drop</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Water, rest and care
            </h3>
          </div>
          <ul className="space-y-2">
            {result.waterRestAndCare.map((item, idx) => (
              <li
                key={idx}
                className="bg-surface-container rounded-lg p-space-sm flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface leading-relaxed"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">
                  check_circle
                </span>
                <span className="flex-1 min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 9. Warning signs to watch */}
      {result.warningSigns.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <div className="flex items-center gap-2 mb-space-sm">
            <span className="material-symbols-outlined text-[20px] text-tertiary">
              warning
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Warning signs to watch
            </h3>
          </div>
          <ul className="space-y-2">
            {result.warningSigns.map((sign, idx) => (
              <li
                key={idx}
                className="bg-tertiary-container/10 rounded-lg p-space-sm flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface leading-relaxed"
              >
                <span
                  className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
                <span className="flex-1 min-w-0 break-words">{sign}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 10. How long it may take to get better */}
      {result.howLongToRecover && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">schedule</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              How long it may take to get better
            </h3>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed break-words">
            {result.howLongToRecover}
          </p>
        </section>
      )}

      {/* 11. How to prevent it next time */}
      {result.prevention.length > 0 && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm">
          <div className="flex items-center gap-2 mb-space-sm">
            <span className="material-symbols-outlined text-[20px] text-primary">shield</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              How to prevent it next time
            </h3>
          </div>
          <ul className="space-y-2">
            {result.prevention.map((item, idx) => (
              <li
                key={idx}
                className="bg-surface-container rounded-lg p-space-sm flex items-start gap-2.5 font-body-sm text-body-sm text-on-surface leading-relaxed"
              >
                <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                  verified
                </span>
                <span className="flex-1 min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 12. When to see a vet or expert & Questions to ask */}
      {hasExpertCard && (
        <section className="bg-surface-container-low rounded-xl p-3.5 sm:p-space-md shadow-sm space-y-3">
          {result.whenToSeeExpert && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-tertiary">
                  medical_services
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  When to see a vet or expert
                </h3>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed break-words">
                {result.whenToSeeExpert}
              </p>
            </div>
          )}

          {result.questionsToAskExpert.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-outline-variant/25">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-secondary">
                  help
                </span>
                <h4 className="font-label-lg text-label-lg font-bold text-on-surface">
                  Questions to ask
                </h4>
              </div>
              <ul className="space-y-1.5">
                {result.questionsToAskExpert.map((q, idx) => (
                  <li
                    key={idx}
                    className="bg-surface-container rounded-lg p-space-sm flex items-start gap-2 font-body-sm text-body-sm text-on-surface leading-relaxed"
                  >
                    <span className="font-bold text-secondary shrink-0">?</span>
                    <span className="flex-1 min-w-0 break-words">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Always-shown Disclaimer at the bottom */}
      <div className="bg-surface-container rounded-xl p-3 text-center">
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          This is general information, not a vet or doctor&apos;s advice. Do not give medicine without asking a vet.
        </p>
      </div>
    </div>
  );
};
