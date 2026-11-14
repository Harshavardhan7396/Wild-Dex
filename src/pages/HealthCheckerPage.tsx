import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InfoTooltip } from '../components/common/InfoTooltip';
import {
  HealthSpeciesPickerModal,
  HealthSubjectChoice,
  HEALTH_CATEGORIES,
} from '../components/health/HealthSpeciesPickerModal';
import { getSymptomsForType } from '../data/symptoms';
import {
  HealthResultSection,
  DetailedHealthResult,
  SeriousnessLevel,
  LikelihoodWord,
  MainPossibility,
  OtherPossibility,
  FoodHelpItem,
  FoodAvoidItem,
} from '../components/health/HealthResultSection';

import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'wilddex_health_subject';

const DEFAULT_SUBJECT: HealthSubjectChoice = {
  category: 'Pet',
  commonName: 'Dog',
  scientificName: 'Canis familiaris',
  isCustom: false,
};

type DurationOption = 'today' | '2-3 days' | 'a week or more';

const HEALTH_LOADING_STEPS = [
  'Reading what you noticed...',
  'Looking for possible causes...',
  'Finding foods that help...',
] as const;

function toCleanString(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(raw)) {
    const joined = raw
      .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
      .map((v) => v.trim())
      .join(' ');
    return joined || undefined;
  }
  return undefined;
}

function normalizeSeriousness(raw: unknown, emergencyFlag: boolean): SeriousnessLevel | undefined {
  if (typeof raw === 'string' && raw.trim()) {
    const lower = raw.trim().toLowerCase();
    if (
      lower.includes('high') ||
      lower.includes('urgent') ||
      lower.includes('critical') ||
      lower.includes('severe') ||
      lower.includes('emergency')
    ) {
      return 'High';
    }
    if (lower.includes('medium') || lower.includes('moderate')) {
      return 'Medium';
    }
    if (lower.includes('low') || lower.includes('mild')) {
      return 'Low';
    }
  }
  if (emergencyFlag) return 'High';
  return undefined;
}

function normalizeLikelihood(raw: unknown): LikelihoodWord | undefined {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    if (raw <= 1) {
      if (raw >= 0.7) return 'Likely';
      if (raw >= 0.35) return 'Possible';
      return 'Unlikely';
    }
    if (raw >= 70) return 'Likely';
    if (raw >= 35) return 'Possible';
    return 'Unlikely';
  }
  if (typeof raw === 'string' && raw.trim()) {
    const lower = raw.trim().toLowerCase();
    const numMatch = lower.match(/\d+/);
    if (lower.includes('%') && numMatch) {
      const pct = Number(numMatch[0]);
      if (pct >= 70) return 'Likely';
      if (pct >= 35) return 'Possible';
      return 'Unlikely';
    }
    if (lower.includes('unlikely') || lower.includes('low') || lower.includes('rare')) {
      return 'Unlikely';
    }
    if (lower.includes('likely') || lower.includes('high') || lower.includes('probable') || lower.includes('very')) {
      return 'Likely';
    }
    if (lower.includes('possible') || lower.includes('moderate') || lower.includes('medium') || lower.includes('maybe')) {
      return 'Possible';
    }
    return 'Possible';
  }
  return undefined;
}

function toStringList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const head = [obj.title, obj.name, obj.step, obj.action, obj.label, obj.question]
            .find((v) => typeof v === 'string' && v.trim());
          const body = [obj.description, obj.text, obj.detail, obj.details, obj.note, obj.notes]
            .find((v) => typeof v === 'string' && v.trim());
          if (typeof head === 'string' && typeof body === 'string') {
            return `${head.trim()}: ${body.trim()}`;
          }
          if (typeof head === 'string') return head.trim();
          if (typeof body === 'string') return body.trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [trimmed];
  }
  return [];
}

function parseMainPossibility(raw: unknown): MainPossibility | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name } : undefined;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const name = toCleanString(obj.name ?? obj.title ?? obj.possibility ?? obj.condition ?? obj.label);
    if (!name) return undefined;
    return {
      name,
      explanation: toCleanString(obj.explanation ?? obj.description ?? obj.summary ?? obj.detail),
      whyItMatches: toCleanString(obj.whyItMatches ?? obj.why_it_matches ?? obj.reason),
      likelihood: normalizeLikelihood(obj.likelihood ?? obj.probability ?? obj.confidence),
    };
  }
  return undefined;
}

function parseOtherPossibilities(raw: unknown): OtherPossibility[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item): OtherPossibility | null => {
        if (typeof item === 'string') {
          const name = item.trim();
          return name ? { name } : null;
        }
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const name = toCleanString(obj.name ?? obj.title ?? obj.possibility ?? obj.condition ?? obj.label);
          if (!name) return null;
          return {
            name,
            explanation: toCleanString(obj.explanation ?? obj.description ?? obj.whyItMatches ?? obj.reason ?? obj.detail ?? obj.note),
            likelihood: normalizeLikelihood(obj.likelihood ?? obj.probability ?? obj.confidence),
          };
        }
        return null;
      })
      .filter((item): item is OtherPossibility => item !== null);
  }
  if (typeof raw === 'string') {
    return toStringList(raw).map((name) => ({ name }));
  }
  return [];
}

function parseFoodsThatHelp(raw: unknown): FoodHelpItem[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      return toStringList(raw).map((name) => ({ name }));
    }
    return [];
  }
  return raw
    .map((item): FoodHelpItem | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = toCleanString(obj.name ?? obj.title ?? obj.food ?? obj.item);
        if (!name) return null;
        return {
          name,
          whyItHelps: toCleanString(obj.whyItHelps ?? obj.why_it_helps ?? obj.benefit ?? obj.why ?? obj.description),
          howToGive: toCleanString(obj.howToGive ?? obj.how_to_give ?? obj.serving ?? obj.instructions ?? obj.howToUse),
        };
      }
      return null;
    })
    .filter((item): item is FoodHelpItem => item !== null);
}

function parseFoodsToAvoid(raw: unknown): FoodAvoidItem[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      return toStringList(raw).map((name) => ({ name }));
    }
    return [];
  }
  return raw
    .map((item): FoodAvoidItem | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = toCleanString(obj.name ?? obj.title ?? obj.food ?? obj.item);
        if (!name) return null;
        return {
          name,
          why: toCleanString(obj.why ?? obj.reason ?? obj.risk ?? obj.description),
        };
      }
      return null;
    })
    .filter((item): item is FoodAvoidItem => item !== null);
}

function parseHealthResponse(rawData: any): DetailedHealthResult {
  const payload = rawData?.data && typeof rawData.data === 'object' ? rawData.data : rawData;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unexpected response from health check.');
  }

  const emergency = Boolean(
    payload.emergency ?? payload.isEmergency ?? payload.is_emergency
  );

  const seriousness = normalizeSeriousness(
    payload.seriousness ??
      payload.severity ??
      payload.howSeriousIsIt ??
      payload.how_serious_is_it,
    emergency
  );

  return {
    simpleSummary: toCleanString(payload.simpleSummary ?? payload.simple_summary ?? payload.summary),
    mainPossibility: parseMainPossibility(
      payload.mainPossibility ??
        payload.main_possibility ??
        payload.primaryPossibility ??
        payload.mostLikely
    ),
    otherPossibilities: parseOtherPossibilities(
      payload.otherPossibilities ?? payload.other_possibilities ?? payload.alternatives
    ),
    seriousness,
    seriousnessReason: toCleanString(payload.seriousnessReason ?? payload.seriousness_reason),
    emergency,
    warningSigns: toStringList(payload.warningSigns ?? payload.warning_signs),
    whatToDoNow: toStringList(payload.whatToDoNow ?? payload.what_to_do_now ?? payload.careSteps),
    foodsThatHelp: parseFoodsThatHelp(
      payload.foodsThatHelp ?? payload.foods_that_help ?? payload.foodsOrCareThatHelp
    ),
    foodsToAvoid: parseFoodsToAvoid(
      payload.foodsToAvoid ?? payload.foods_to_avoid ?? payload.thingsToAvoid
    ),
    waterRestAndCare: toStringList(
      payload.waterRestAndCare ?? payload.water_rest_and_care ?? payload.supportiveCare
    ),
    howLongToRecover: toCleanString(payload.howLongToRecover ?? payload.how_long_to_recover),
    prevention: toStringList(payload.prevention ?? payload.preventionTips),
    whenToSeeExpert: toCleanString(
      payload.whenToSeeExpert ?? payload.when_to_see_expert ?? payload.whenToSeeVet
    ),
    questionsToAskExpert: toStringList(
      payload.questionsToAskExpert ?? payload.questions_to_ask_expert ?? payload.questionsToAsk
    ),
  };
}

function readInitialSubject(searchParams: URLSearchParams): HealthSubjectChoice {
  const urlName = searchParams.get('name');
  if (urlName && urlName.trim()) {
    const taxonRaw = searchParams.get('taxonId');
    return {
      category: searchParams.get('cat') || 'Pet',
      commonName: urlName.trim(),
      scientificName: searchParams.get('sci') || undefined,
      photoUrl: searchParams.get('photo') || undefined,
      taxonId: taxonRaw ? Number(taxonRaw) : undefined,
      isCustom: searchParams.get('custom') === '1',
    };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as HealthSubjectChoice;
      if (parsed && parsed.commonName) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read saved health subject:', err);
  }

  return DEFAULT_SUBJECT;
}

export const HealthCheckerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [otherSymptom, setOtherSymptom] = useState('');
  const [duration, setDuration] = useState<DurationOption>('today');
  const [note, setNote] = useState('');
  const [healthResult, setHealthResult] = useState<DetailedHealthResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<HealthSubjectChoice>(() =>
    readInitialSubject(searchParams)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<{ url: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const typeSymptoms = getSymptomsForType(activeSubject.category);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const syncSubjectToUrlAndStorage = (choice: HealthSubjectChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (err) {
      console.warn('Could not persist health subject to localStorage:', err);
    }

    const nextParams = new URLSearchParams();
    nextParams.set('cat', choice.category);
    nextParams.set('name', choice.commonName);
    if (choice.scientificName) nextParams.set('sci', choice.scientificName);
    if (choice.photoUrl) nextParams.set('photo', choice.photoUrl);
    if (choice.taxonId) nextParams.set('taxonId', String(choice.taxonId));
    if (choice.isCustom) nextParams.set('custom', '1');
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    // Ensure URL stays in sync if restored from localStorage or default
    if (!searchParams.get('name') && activeSubject.commonName) {
      syncSubjectToUrlAndStorage(activeSubject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedPhoto?.url) {
        URL.revokeObjectURL(uploadedPhoto.url);
      }
    };
  }, [uploadedPhoto]);

  useEffect(() => {
    if (!isChecking) {
      setLoadingStepIndex(0);
      return;
    }

    setLoadingStepIndex(0);
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % HEALTH_LOADING_STEPS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isChecking]);

  const handleSelectSubject = (choice: HealthSubjectChoice) => {
    setActiveSubject(choice);
    setSelectedSymptoms([]);
    setSearchInput('');
    setActiveFilter('');
    setOtherSymptom('');
    setDuration('today');
    setNote('');
    setHealthResult(null);
    setCheckError(null);
    syncSubjectToUrlAndStorage(choice);
    setPickerOpen(false);
    showToast(`Switched to: ${choice.commonName}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedPhoto?.url) {
      URL.revokeObjectURL(uploadedPhoto.url);
    }
    const objectUrl = URL.createObjectURL(file);
    setUploadedPhoto({ url: objectUrl, name: file.name });
    showToast('Photo attached');
  };

  const handleRemovePhoto = () => {
    if (uploadedPhoto?.url) {
      URL.revokeObjectURL(uploadedPhoto.url);
    }
    setUploadedPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const subjectIcon =
    HEALTH_CATEGORIES.find((c) => c.id === activeSubject.category)?.icon || 'pets';
  const subjectDisplayName = activeSubject.scientificName
    ? `${activeSubject.commonName} (${activeSubject.scientificName})`
    : activeSubject.commonName;

  const toggleSymptom = (name: string) => {
    setHealthResult(null);
    setCheckError(null);
    if (selectedSymptoms.includes(name)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== name));
    } else {
      setSelectedSymptoms([...selectedSymptoms, name]);
      showToast(`Added sign: ${name}`);
    }
  };

  const addCustomSymptom = (rawLabel: string, clearSearch = false) => {
    const cleaned = rawLabel.trim();
    if (!cleaned) return;
    setHealthResult(null);
    setCheckError(null);
    const alreadyExists = selectedSymptoms.some(
      (s) => s.toLowerCase() === cleaned.toLowerCase()
    );
    if (!alreadyExists) {
      setSelectedSymptoms([...selectedSymptoms, cleaned]);
      showToast(`Added sign: ${cleaned}`);
    }
    if (clearSearch) {
      setSearchInput('');
      setActiveFilter('');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilter(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveFilter('');
  };

  const handleAddOtherSymptom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherSymptom.trim()) return;
    addCustomSymptom(otherSymptom, false);
    setOtherSymptom('');
  };

  const extractErrorFromResponse = async (errObj: any, fallbackData?: any): Promise<string> => {
    let parsedBody: any = null;
    if (errObj?.context) {
      try {
        const ctx = typeof errObj.context.clone === 'function' ? errObj.context.clone() : errObj.context;
        parsedBody = await ctx.json();
      } catch {
        try {
          const ctx = typeof errObj.context.clone === 'function' ? errObj.context.clone() : errObj.context;
          parsedBody = await ctx.text();
        } catch {
          parsedBody = null;
        }
      }
    } else if (fallbackData) {
      parsedBody = fallbackData;
    }

    let message = '';
    if (parsedBody && typeof parsedBody === 'object') {
      message = parsedBody.error || parsedBody.message || '';
    } else if (typeof parsedBody === 'string') {
      try {
        const parsedJson = JSON.parse(parsedBody);
        message = parsedJson.error || parsedJson.message || parsedBody;
      } catch {
        message = parsedBody;
      }
    }

    if (!message && fallbackData?.error) {
      message = typeof fallbackData.error === 'string' ? fallbackData.error : JSON.stringify(fallbackData.error);
    }

    return message || errObj?.message || 'Could not complete the health check. Please try again.';
  };

  const handleCheckNow = async () => {
    if (selectedSymptoms.length === 0 || isChecking) return;

    setIsChecking(true);
    setCheckError(null);

    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => abortController.abort(), 50000);

    try {
      const invokeResult = await supabase.functions.invoke('health', {
        body: {
          type: activeSubject.category,
          name: subjectDisplayName,
          symptoms: selectedSymptoms,
          duration,
          notes: note.trim(),
        },
        timeout: 50000,
        signal: abortController.signal,
      } as any);

      const { data, error } = invokeResult;

      if (error || data?.error) {
        console.error('Health check failed:', { error, data });
        const message = await extractErrorFromResponse(error, data);
        setCheckError(message);
        return;
      }

      const parsed = parseHealthResponse(data);
      setHealthResult(parsed);
      showToast('Health check ready');
    } catch (err: any) {
      console.error('Health check unexpected error:', err);
      if (err?.name === 'AbortError' || abortController.signal.aborted) {
        setCheckError('The health check took too long and timed out. Please try again.');
      } else {
        const message = await extractErrorFromResponse(err);
        setCheckError(message);
      }
    } finally {
      clearTimeout(timeoutTimer);
      setIsChecking(false);
    }
  };

  const normalizedFilter = activeFilter.trim().toLowerCase();
  const filteredAvailableSymptoms = typeSymptoms.filter(
    (s) =>
      !selectedSymptoms.includes(s.label) &&
      (!normalizedFilter || s.label.toLowerCase().includes(normalizedFilter))
  );
  const hasAnyFilterMatch =
    !normalizedFilter ||
    typeSymptoms.some((s) => s.label.toLowerCase().includes(normalizedFilter)) ||
    selectedSymptoms.some((s) => s.toLowerCase().includes(normalizedFilter));

  const isStep1Done = Boolean(activeSubject.category && activeSubject.commonName) && !pickerOpen;
  const isStep2Active = isStep1Done && !healthResult;
  const isStep3Active = Boolean(healthResult);

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Informational Warning Banner */}
      <div className="px-3 sm:px-margin pt-space-sm pb-space-xs">
        <div className="bg-tertiary-container/15 text-tertiary rounded-xl p-3 sm:p-space-md shadow-sm flex items-start gap-space-sm">
          <span
            className="material-symbols-outlined text-[22px] shrink-0 text-tertiary mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-label-md font-semibold text-tertiary uppercase tracking-wider">
              Health Help Notice
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
              This is general information, not a vet or doctor&apos;s advice. Do not give medicine without asking a vet.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostic Flow Stepper */}
      <div className="px-3 sm:px-margin py-space-sm">
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-sm">
          <div className="flex items-start justify-between relative mb-space-sm gap-1">
            <div className="absolute left-6 right-6 top-4 h-1 bg-surface-container-highest z-0"></div>
            <div
              className={`absolute left-6 top-4 h-1 bg-secondary z-0 transition-all duration-300 ${
                isStep3Active ? 'right-6' : isStep1Done ? 'w-1/2' : 'w-0'
              }`}
            ></div>
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all ${
                  isStep1Done
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-primary text-on-primary ring-4 ring-primary-fixed-dim/40'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isStep1Done ? 'check' : 'pets'}
                </span>
              </div>
              <span
                className={`font-label-sm text-[10px] sm:text-label-sm font-semibold mt-1 ${
                  isStep1Done ? 'text-secondary' : 'text-primary'
                }`}
              >
                Animal or Plant
              </span>
            </div>
            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all ${
                  isStep3Active
                    ? 'bg-secondary text-on-secondary'
                    : isStep2Active
                    ? 'bg-primary text-on-primary ring-4 ring-primary-fixed-dim/40'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isStep3Active ? 'check' : 'stethoscope'}
                </span>
              </div>
              <span
                className={`font-label-sm text-[10px] sm:text-label-sm font-semibold mt-1 ${
                  isStep3Active
                    ? 'text-secondary'
                    : isStep2Active
                    ? 'text-primary'
                    : 'text-on-surface-variant'
                }`}
              >
                What You Notice
              </span>
            </div>
            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isStep3Active
                    ? 'bg-primary text-on-primary ring-4 ring-primary-fixed-dim/40 shadow-sm'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <span className="font-label-md text-label-md font-bold">3</span>
              </div>
              <span
                className={`font-label-sm text-[10px] sm:text-label-sm mt-1 ${
                  isStep3Active ? 'font-semibold text-primary' : 'text-on-surface-variant'
                }`}
              >
                How Serious Is It?
              </span>
            </div>
          </div>

          {/* Current Subject Strip */}
          <div className="bg-surface-container rounded-lg p-space-sm flex flex-wrap sm:flex-nowrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm min-w-0">
              {activeSubject.photoUrl ? (
                <img
                  src={activeSubject.photoUrl}
                  alt={activeSubject.commonName}
                  className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-outline-variant/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-secondary-container/40 flex items-center justify-center shrink-0 text-secondary">
                  <span className="material-symbols-outlined text-[20px]">{subjectIcon}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Selected {activeSubject.category}
                </p>
                <p className="font-label-lg text-label-lg text-on-surface truncate">
                  {subjectDisplayName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-space-md py-1.5 min-h-[40px] rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm hover:bg-surface-container-high transition-colors active:scale-95 shrink-0"
              type="button"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      {/* Full Species Picker Modal */}
      <HealthSpeciesPickerModal
        isOpen={pickerOpen}
        currentChoice={activeSubject}
        onSelect={handleSelectSubject}
        onClose={() => setPickerOpen(false)}
      />

      {/* Symptom Input & Photo Diagnostics */}
      <div className="px-3 sm:px-margin py-space-xs">
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-space-sm">
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">What You Notice</h2>
              <InfoTooltip text="Pick any signs or behaviors you see so we can suggest possible reasons." />
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold bg-secondary-container/40 px-2.5 py-0.5 rounded-full">
              {selectedSymptoms.length} Selected
            </span>
          </div>

          {/* Search Bar with Search & Clear (X) buttons */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 mb-space-sm">
            <div className="relative flex-1 min-w-0">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                className="w-full min-w-0 min-h-[44px] bg-surface-container pl-10 pr-10 py-2 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-inner"
                placeholder={`Search ${activeSubject.category.toLowerCase()} signs...`}
                type="text"
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchInput(val);
                  setActiveFilter(val);
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-95 active:scale-95 transition-all shrink-0"
            >
              Search
            </button>
          </form>

          {/* Interactive Symptom Chips */}
          <div className="flex flex-wrap gap-1.5 mb-space-md">
            {selectedSymptoms.map((symp) => {
              const matchedOption = typeSymptoms.find((s) => s.label === symp);
              return (
                <button
                  key={symp}
                  onClick={() => toggleSymptom(symp)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm active:scale-95"
                  type="button"
                >
                  <span>{matchedOption?.icon || '✓'}</span>
                  <span>{symp}</span>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              );
            })}

            {filteredAvailableSymptoms.map((s) => (
              <button
                key={s.label}
                onClick={() => toggleSymptom(s.label)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors active:scale-95"
                type="button"
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* No Match State with Add Own Symptom */}
          {normalizedFilter && !hasAnyFilterMatch && (
            <div className="mb-space-md p-3 rounded-xl bg-surface-container flex flex-wrap items-center justify-between gap-2">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No match. Add it as your own
              </p>
              <button
                type="button"
                onClick={() => addCustomSymptom(activeFilter, true)}
                className="px-3.5 py-1.5 min-h-[40px] rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold hover:opacity-95 active:scale-95 shrink-0"
              >
                Add &quot;{activeFilter.trim()}&quot;
              </button>
            </div>
          )}

          {/* Other (type it), How long?, and Optional Note */}
          <div className="space-y-3 mb-space-md pt-2 border-t border-outline-variant/20">
            <form onSubmit={handleAddOtherSymptom} className="space-y-1.5">
              <label
                htmlFor="health-other-symptom"
                className="block font-label-sm text-label-sm font-semibold text-on-surface-variant"
              >
                Other (type it)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="health-other-symptom"
                  type="text"
                  value={otherSymptom}
                  onChange={(e) => setOtherSymptom(e.target.value)}
                  placeholder="Type anything else you notice..."
                  className="flex-1 min-w-0 min-h-[44px] bg-surface-container px-4 py-2 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!otherSymptom.trim()}
                  className="px-4 min-h-[44px] rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold disabled:opacity-50 active:scale-95 shrink-0"
                >
                  Add
                </button>
              </div>
            </form>

            <div className="space-y-1.5">
              <span className="block font-label-sm text-label-sm font-semibold text-on-surface-variant">
                How long?
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: '2-3 days', label: '2-3 days' },
                    { id: 'a week or more', label: 'A week or more' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDuration(opt.id)}
                    className={`px-3.5 py-1.5 min-h-[40px] rounded-full font-label-md text-label-md transition-colors active:scale-95 ${
                      duration === opt.id
                        ? 'bg-secondary text-on-secondary font-semibold shadow-sm'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="health-optional-note"
                className="block font-label-sm text-label-sm font-semibold text-on-surface-variant"
              >
                Note (optional)
              </label>
              <textarea
                id="health-optional-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any extra details (optional)..."
                className="w-full min-w-0 bg-surface-container px-4 py-2.5 rounded-2xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-inner resize-none"
              />
            </div>
          </div>

          {/* Optional User Photo Upload */}
          <div className="space-y-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="health-photo-upload"
            />
            {!uploadedPhoto ? (
              <label
                htmlFor="health-photo-upload"
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold cursor-pointer transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">add_a_photo</span>
                <span>Add a photo (optional)</span>
              </label>
            ) : (
              <div className="bg-surface-container rounded-lg p-space-sm flex flex-wrap sm:flex-nowrap items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm min-w-0 flex-1">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 shadow-sm bg-surface-container-high">
                    <img
                      className="w-full h-full object-cover"
                      alt={`Uploaded check photo: ${uploadedPhoto.name}`}
                      src={uploadedPhoto.url}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md font-semibold text-on-surface">
                      Your Photo
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {uploadedPhoto.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3 py-1.5 min-h-[40px] rounded-full bg-surface-container-highest text-on-surface-variant hover:text-error font-label-sm text-label-sm font-semibold shrink-0"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          {/* Check Now CTA */}
          <div className="pt-space-md">
            <button
              type="button"
              disabled={selectedSymptoms.length === 0 || isChecking}
              onClick={handleCheckNow}
              className="w-full min-h-[48px] rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isChecking ? 'hourglass_top' : 'stethoscope'}
              </span>
              <span>{isChecking ? HEALTH_LOADING_STEPS[loadingStepIndex] : 'Check Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Diagnostic Assessment (Step 3) */}
      {(isChecking || checkError || healthResult) && (
        <div className="px-3 sm:px-margin py-space-sm">
          {isChecking && (
            <div
              role="status"
              aria-live="polite"
              className="bg-surface-container-low rounded-xl p-4 sm:p-space-md shadow-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center shrink-0 animate-pulse">
                  <span className="material-symbols-outlined text-[22px]">stethoscope</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    {HEALTH_LOADING_STEPS[loadingStepIndex]}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Checking {activeSubject.commonName} ({selectedSymptoms.length}{' '}
                    {selectedSymptoms.length === 1 ? 'sign' : 'signs'})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {HEALTH_LOADING_STEPS.map((step, idx) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      idx <= loadingStepIndex ? 'bg-secondary' : 'bg-surface-container-highest'
                    }`}
                  />
                ))}
              </div>
              <div className="space-y-2 pt-1 animate-pulse">
                <div className="h-4 bg-surface-container-high rounded w-3/4"></div>
                <div className="h-3 bg-surface-container-high rounded w-full"></div>
                <div className="h-3 bg-surface-container-high rounded w-5/6"></div>
              </div>
            </div>
          )}

          {!isChecking && checkError && (
            <div className="bg-error-container/25 border border-error/40 rounded-xl p-4 sm:p-space-md shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[22px] text-error shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg text-label-lg font-semibold text-error">
                    Health Check Failed
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface mt-1 break-words">
                    {checkError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheckNow}
                className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-full bg-error text-on-error font-label-md text-label-md font-semibold hover:opacity-95 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Retry</span>
              </button>
            </div>
          )}

          {!isChecking && !checkError && healthResult && (
            <HealthResultSection
              result={healthResult}
              subjectName={subjectDisplayName}
              subjectCategory={activeSubject.category}
              duration={duration}
              onNotify={showToast}
            />
          )}
        </div>
      )}

      {/* Urgent Action & Vet Assistance Locator */}
      <div className="px-3 sm:px-margin pt-space-xs pb-space-lg">
        <div className="bg-primary text-on-primary rounded-xl p-3 sm:p-space-md shadow-lg relative overflow-hidden">
          <div className="flex items-start gap-space-sm mb-space-sm">
            <div className="w-10 h-10 rounded-full bg-on-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px] text-primary-fixed">local_hospital</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-headline-sm text-headline-sm text-on-primary">Need Clinical Care?</h4>
              <p className="font-body-sm text-body-sm text-on-primary-container mt-0.5">
                Connect immediately with regional wildlife rehabilitators or emergency veterinary clinics.
              </p>
            </div>
          </div>

          <div className="bg-on-primary/10 rounded-lg p-space-sm mb-space-md flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-secondary-container shrink-0">near_me</span>
              <span className="font-label-md text-label-md text-on-primary">Pacific Northwest Regional Grid</span>
            </div>
            <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold shrink-0">
              3 Open Nearby (4.2 mi)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href="https://www.google.com/maps/search/emergency+veterinarian+clinic+near+me"
              target="_blank"
              rel="noreferrer noopener"
              className="w-full min-h-[48px] rounded-full bg-tertiary-container text-on-tertiary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md hover:bg-tertiary transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">location_on</span>
              <span>Find Nearby Certified Clinics</span>
            </a>
            <button
              onClick={() => showToast('Generated Diagnostic Dossier PDF for veterinarian review')}
              className="w-full min-h-[44px] rounded-full bg-on-primary/15 text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-on-primary/25 transition-colors active:scale-95"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
              <span>Export Diagnostic PDF to Vet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
