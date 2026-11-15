import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PUBLIC_SITE_URL } from '../services/sharedAlbumService';
import {
  CompareFilterType,
  CompareSpeciesDetail,
  ConservationLabel,
  QUICK_PICKS,
  TaxonSearchItem,
  fetchCompareTaxonById,
  resolveQuickPickTaxonId,
  searchTaxaForCompare,
} from '../services/compareService';

type CompareTabId =
  | 'all'
  | 'body_size'
  | 'where_lives'
  | 'teeth_bite'
  | 'what_eats'
  | 'height'
  | 'leaves_flowers'
  | 'where_grows'
  | 'uses';

const FILTER_CHIPS: { id: CompareFilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Animalia', label: 'Animals' },
  { id: 'Plantae', label: 'Plants' },
  { id: 'Fungi', label: 'Fungi' },
  { id: 'Insecta', label: 'Insects' },
  { id: 'Aves', label: 'Birds' },
];

function conservationBadgeClasses(label: ConservationLabel): string {
  switch (label) {
    case 'In Danger':
      return 'bg-error text-on-error';
    case 'At Risk':
      return 'bg-amber-500 text-amber-950';
    case 'Common':
      return 'bg-secondary text-on-secondary';
    default:
      return 'bg-inverse-surface/80 text-inverse-on-surface';
  }
}

export const ComparisonPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const paramA = searchParams.get('a') || '';
  const paramB = searchParams.get('b') || '';

  const [specimenA, setSpecimenA] = useState<CompareSpeciesDetail | null>(null);
  const [specimenB, setSpecimenB] = useState<CompareSpeciesDetail | null>(null);
  const [loadingA, setLoadingA] = useState<boolean>(false);
  const [loadingB, setLoadingB] = useState<boolean>(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CompareTabId>('all');
  const [pickingFor, setPickingFor] = useState<'A' | 'B' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Picker modal state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<CompareFilterType>('all');
  const [searchResults, setSearchResults] = useState<TaxonSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quickPickBusy, setQuickPickBusy] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Load first-time example (Tiger & Leopard via iNaturalist) only when neither ?a= nor ?b= is set on initial mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!searchParams.has('a') && !searchParams.has('b')) {
      let cancelled = false;
      setLoadingA(true);
      setLoadingB(true);
      Promise.all([
        resolveQuickPickTaxonId('Panthera tigris'),
        resolveQuickPickTaxonId('Panthera pardus'),
      ])
        .then(([tigerId, leopardId]) => {
          if (cancelled) return;
          setSearchParams({ a: String(tigerId), b: String(leopardId) }, { replace: true });
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Failed to load first-time compare example:', err);
          setLoadingA(false);
          setLoadingB(false);
          setErrorA('Could not load initial example. Pick a species to compare.');
          setErrorB('Could not load initial example. Pick a species to compare.');
        });
      return () => {
        cancelled = true;
      };
    }
  }, [searchParams, setSearchParams]);

  // Fetch Slot A whenever ?a= changes
  const loadSlotA = useCallback(async (idStr: string) => {
    if (!idStr) {
      setSpecimenA(null);
      setErrorA(null);
      setLoadingA(false);
      return;
    }
    setLoadingA(true);
    setErrorA(null);
    try {
      const data = await fetchCompareTaxonById(idStr);
      setSpecimenA(data);
    } catch (err: any) {
      setSpecimenA(null);
      setErrorA(err?.message || 'Could not load species details.');
    } finally {
      setLoadingA(false);
    }
  }, []);

  // Fetch Slot B whenever ?b= changes
  const loadSlotB = useCallback(async (idStr: string) => {
    if (!idStr) {
      setSpecimenB(null);
      setErrorB(null);
      setLoadingB(false);
      return;
    }
    setLoadingB(true);
    setErrorB(null);
    try {
      const data = await fetchCompareTaxonById(idStr);
      setSpecimenB(data);
    } catch (err: any) {
      setSpecimenB(null);
      setErrorB(err?.message || 'Could not load species details.');
    } finally {
      setLoadingB(false);
    }
  }, []);

  useEffect(() => {
    loadSlotA(paramA);
  }, [paramA, loadSlotA]);

  useEffect(() => {
    loadSlotB(paramB);
  }, [paramB, loadSlotB]);

  // Debounced (300ms) iNaturalist autocomplete inside picker
  const runSearch = useCallback(async (q: string, filter: CompareFilterType) => {
    const clean = q.trim();
    if (!clean) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const items = await searchTaxaForCompare(clean, filter);
      setSearchResults(items);
    } catch (err: any) {
      setSearchError(err?.message || 'Could not search iNaturalist right now.');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pickingFor) return;
    const timer = window.setTimeout(() => {
      runSearch(searchQuery, filterType);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pickingFor, searchQuery, filterType, runSearch]);

  const openPicker = (slot: 'A' | 'B') => {
    setPickingFor(slot);
    setSearchQuery('');
    setFilterType('all');
    setSearchResults([]);
    setSearchError(null);
  };

  const applyTaxonIdToSlot = (slot: 'A' | 'B', taxonId: number, displayName: string) => {
    const next = new URLSearchParams(searchParams);
    if (slot === 'A') {
      next.set('a', String(taxonId));
    } else {
      next.set('b', String(taxonId));
    }
    setSearchParams(next);
    setPickingFor(null);
    showToast(`Loaded ${displayName}`);
  };

  const handleSelectQuickPick = async (label: string, query: string) => {
    if (!pickingFor || quickPickBusy) return;
    setQuickPickBusy(label);
    setSearchError(null);
    try {
      const id = await resolveQuickPickTaxonId(query);
      applyTaxonIdToSlot(pickingFor, id, label);
    } catch (err: any) {
      setSearchError(err?.message || `Could not load ${label}.`);
    } finally {
      setQuickPickBusy(null);
    }
  };

  const handleClearSlot = (slot: 'A' | 'B') => {
    const next = new URLSearchParams(searchParams);
    if (slot === 'A') {
      next.set('a', '');
    } else {
      next.set('b', '');
    }
    setSearchParams(next);
  };

  const handleSwap = () => {
    const next = new URLSearchParams();
    next.set('a', paramB);
    next.set('b', paramA);
    setSearchParams(next);
    showToast('Swapped order');
  };

  const handleShareUrl = async () => {
    const query = searchParams.toString();
    const shareUrl = query ? `${PUBLIC_SITE_URL}/#/compare?${query}` : `${PUBLIC_SITE_URL}/#/compare`;
    const title =
      specimenA && specimenB
        ? `Compare ${specimenA.commonName} vs ${specimenB.commonName} on WildDex`
        : 'Compare Species on WildDex';

    const copyUrl = async () => {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(shareUrl);
          return true;
        }
        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(input);
        return ok;
      } catch {
        return false;
      }
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: shareUrl });
        await copyUrl();
        showToast('Comparison link shared!');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    const copied = await copyUrl();
    showToast(copied ? 'Comparison link copied!' : 'Copy the URL from your address bar to share.');
  };

  // Determine which tabs apply to the currently chosen types
  const {
    hasAnimal,
    hasToothedAnimal,
    hasPlant,
    hasPlantOrFungi,
    visibleTabs,
  } = useMemo(() => {
    const specs = [specimenA, specimenB].filter(Boolean) as CompareSpeciesDetail[];
    const anyAnimal = specs.some(
      (s) => s.categoryKind !== 'plant' && s.categoryKind !== 'fungi'
    );
    const anyToothed = specs.some((s) => s.categoryKind === 'toothed_animal');
    const anyPlant = specs.some((s) => s.categoryKind === 'plant');
    const anyPlantOrFungi = specs.some(
      (s) => s.categoryKind === 'plant' || s.categoryKind === 'fungi'
    );

    const tabs: { id: CompareTabId; label: string }[] = [{ id: 'all', label: 'All Info' }];

    if (anyAnimal || specs.length === 0) {
      tabs.push({ id: 'body_size', label: 'Body Size' });
      tabs.push({ id: 'where_lives', label: 'Where It Lives' });
      if (anyToothed || specs.length === 0) {
        tabs.push({ id: 'teeth_bite', label: 'Teeth & Bite' });
      }
      tabs.push({ id: 'what_eats', label: 'What It Eats' });
    }

    if (anyPlantOrFungi) {
      tabs.push({ id: 'height', label: 'Height' });
      if (anyPlant) {
        tabs.push({ id: 'leaves_flowers', label: 'Leaves and Flowers' });
      }
      tabs.push({ id: 'where_grows', label: 'Where It Grows' });
      tabs.push({ id: 'uses', label: 'Uses' });
    }

    return {
      hasAnimal: anyAnimal,
      hasToothedAnimal: anyToothed,
      hasPlant: anyPlant,
      hasPlantOrFungi: anyPlantOrFungi,
      visibleTabs: tabs,
    };
  }, [specimenA, specimenB]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab('all');
    }
  }, [visibleTabs, activeTab]);

  const shouldShowSection = (sectionId: CompareTabId) =>
    activeTab === 'all' || activeTab === sectionId;

  const renderSlotCard = (
    slot: 'A' | 'B',
    specimen: CompareSpeciesDetail | null,
    isLoading: boolean,
    error: string | null,
    paramId: string
  ) => {
    const slotNumber = slot === 'A' ? '1' : '2';

    if (isLoading) {
      return (
        <div
          className="flex flex-col rounded-xl bg-surface-container-lowest overflow-hidden shadow-sm animate-pulse"
          aria-label={`Loading species ${slotNumber}`}
        >
          <div className="w-full aspect-[4/3] bg-surface-container-high" />
          <div className="p-3 space-y-2 bg-surface-container-low">
            <div className="h-5 w-36 rounded bg-surface-container-high" />
            <div className="h-3.5 w-28 rounded bg-surface-container-high" />
            <div className="h-3 w-40 rounded bg-surface-container-high" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col justify-between rounded-xl bg-error-container/25 border border-error/30 p-4 text-center gap-3">
          <div className="space-y-1.5 my-auto py-4">
            <span className="material-symbols-outlined text-[30px] text-error">error_outline</span>
            <p className="font-body-sm text-body-sm text-on-surface font-medium">{error}</p>
          </div>
          <div className="flex items-center justify-center gap-2 no-print">
            {paramId && (
              <button
                type="button"
                onClick={() => (slot === 'A' ? loadSlotA(paramId) : loadSlotB(paramId))}
                className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => openPicker(slot)}
              className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface font-label-sm font-semibold"
            >
              Change
            </button>
          </div>
        </div>
      );
    }

    if (!specimen) {
      return (
        <button
          type="button"
          onClick={() => openPicker(slot)}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant hover:border-primary bg-surface-container-low min-h-[240px] p-5 text-center gap-2.5 transition-colors no-print"
        >
          <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">add_circle</span>
          </div>
          <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Pick Species {slotNumber}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[220px]">
            Search any animal, plant, bird, insect, or fungus to compare.
          </p>
        </button>
      );
    }

    return (
      <div className="flex flex-col rounded-xl bg-surface-container-lowest overflow-hidden shadow-sm border border-outline-variant/15 print-avoid-break">
        <div className="relative w-full aspect-[4/3] bg-surface-container overflow-hidden">
          {specimen.photoUrl ? (
            <img
              className="w-full h-full object-cover"
              alt={specimen.commonName}
              src={specimen.photoUrl}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px]">eco</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 via-transparent to-black/25 pointer-events-none" />

          <span
            className={`absolute top-2 left-2 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold shadow ${conservationBadgeClasses(
              specimen.conservationLabel
            )}`}
          >
            {specimen.conservationLabel}
          </span>

          <div className="absolute top-2 right-2 flex items-center gap-1 no-print">
            <button
              type="button"
              onClick={() => openPicker(slot)}
              className="px-2.5 py-1 rounded-full bg-inverse-surface/80 backdrop-blur-md text-surface text-[11px] font-bold hover:bg-inverse-surface"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => handleClearSlot(slot)}
              aria-label={`Clear species ${slotNumber}`}
              className="w-6 h-6 rounded-full bg-inverse-surface/80 backdrop-blur-md text-surface flex items-center justify-center hover:bg-inverse-surface"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>

          <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-inverse-on-surface opacity-90 truncate">
              Species {slotNumber}
            </span>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                slot === 'A' ? 'bg-secondary-container' : 'bg-primary-fixed'
              }`}
            />
          </div>
        </div>

        <div className="p-3 flex flex-col flex-1 justify-between bg-surface-container-low">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight leading-tight">
              {specimen.commonName}
            </h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
              <span className="text-[10px] font-medium text-on-surface-variant/70 mr-1">
                Science name:
              </span>
              <span className="italic">{specimen.scientificName}</span>
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-tertiary shrink-0">
                category
              </span>
              <span className="truncate">{specimen.taxonomyLine}</span>
            </span>
            <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
              {specimen.observationsCount !== null
                ? `${specimen.observationsCount.toLocaleString()} sightings`
                : 'Sightings: Not available'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderComparisonRow = (params: {
    sectionId: CompareTabId;
    title: string;
    icon: string;
    badge?: string;
    valueA: string;
    valueB: string;
  }) => {
    const { sectionId, title, icon, badge, valueA, valueB } = params;
    const isVisibleOnScreen = shouldShowSection(sectionId);

    return (
      <div
        key={sectionId + title}
        className={`bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-outline-variant/15 space-y-2.5 print-avoid-break ${
          isVisibleOnScreen ? '' : 'hidden print:block'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[15px]">{icon}</span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold shrink-0">
              {badge}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
          <div className="p-3 rounded-lg bg-surface-container-low flex flex-col justify-between gap-1">
            <span className="font-label-sm text-label-sm text-primary font-bold truncate">
              {specimenA?.commonName || 'Species 1'}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed break-words">
              {specimenA ? valueA : 'Not available'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-secondary-container/25 flex flex-col justify-between gap-1">
            <span className="font-label-sm text-label-sm text-secondary font-bold truncate">
              {specimenB?.commonName || 'Species 2'}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface leading-relaxed break-words">
              {specimenB ? valueB : 'Not available'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-28 print:pb-4 pt-2 space-y-space-md">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2 max-w-[90vw] no-print">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
            verified
          </span>
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Print-Only Report Header */}
      <div className="hidden print:block border-b border-outline-variant pb-3">
        <h1 className="font-headline-md text-headline-md font-bold text-primary">
          WildDex Species Comparison Report
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {specimenA?.commonName || 'Species 1'} vs {specimenB?.commonName || 'Species 2'} •{' '}
          {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shadow-sm">
          <span
            className="material-symbols-outlined text-[16px] text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            balance
          </span>
          <span>Compare Species</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareUrl}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md active:scale-95 transition-transform shadow-sm"
          >
            <span className="material-symbols-outlined text-[17px]">share</span>
            <span>Share</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md active:scale-95 transition-transform shadow-sm"
            type="button"
            onClick={handleSwap}
          >
            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
            <span>Swap</span>
          </button>
        </div>
      </div>

      {/* Specimen Dual Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm items-stretch">
        {renderSlotCard('A', specimenA, loadingA, errorA, paramA)}
        {renderSlotCard('B', specimenB, loadingB, errorB, paramB)}
      </div>

      {/* Empty State when neither slot has a loaded species */}
      {!loadingA && !loadingB && !specimenA && !specimenB && !errorA && !errorB && (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-2.5 no-print">
          <span className="material-symbols-outlined text-[34px] text-primary">compare_arrows</span>
          <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Pick two species to compare
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            Choose any two animals, plants, birds, insects, or fungi to compare real facts side by side.
          </p>
          <button
            type="button"
            onClick={() => openPicker('A')}
            className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Pick First Species
          </button>
        </div>
      )}

      {/* Dynamic Category Filter Tabs */}
      {(specimenA || specimenB) && (
        <div className="relative no-print">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:overflow-x-auto no-scrollbar py-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md shadow-sm active:scale-95 transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Real Comparison Matrix Cards */}
      {(specimenA || specimenB) && (
        <div className="flex flex-col space-y-3">
          {/* Wikipedia Summary (All Info) */}
          {renderComparisonRow({
            sectionId: 'all',
            title: 'Summary',
            icon: 'menu_book',
            badge: 'Overview',
            valueA: specimenA?.wikipediaSummary || 'Not available',
            valueB: specimenB?.wikipediaSummary || 'Not available',
          })}

          {/* Animal Sections */}
          {hasAnimal && (
            <>
              {renderComparisonRow({
                sectionId: 'body_size',
                title: 'Adult Weight',
                icon: 'scale',
                badge: 'Body Size',
                valueA: specimenA?.facts.adultWeight || 'Not available',
                valueB: specimenB?.facts.adultWeight || 'Not available',
              })}

              {renderComparisonRow({
                sectionId: 'body_size',
                title: 'Body Size & Length',
                icon: 'straighten',
                badge: 'Body Size',
                valueA: specimenA?.facts.bodySize || 'Not available',
                valueB: specimenB?.facts.bodySize || 'Not available',
              })}

              {renderComparisonRow({
                sectionId: 'where_lives',
                title: 'Where It Lives',
                icon: 'pin_drop',
                badge: 'Habitat',
                valueA: specimenA?.facts.whereItLives || 'Not available',
                valueB: specimenB?.facts.whereItLives || 'Not available',
              })}

              {hasToothedAnimal &&
                renderComparisonRow({
                  sectionId: 'teeth_bite',
                  title: 'Teeth & Bite',
                  icon: 'dentistry',
                  badge: 'Dentition',
                  valueA: specimenA?.facts.teethAndBite || 'Not available',
                  valueB: specimenB?.facts.teethAndBite || 'Not available',
                })}

              {renderComparisonRow({
                sectionId: 'what_eats',
                title: 'What It Eats',
                icon: 'restaurant',
                badge: 'Diet',
                valueA: specimenA?.facts.whatItEats || 'Not available',
                valueB: specimenB?.facts.whatItEats || 'Not available',
              })}
            </>
          )}

          {/* Plant & Fungi Sections */}
          {hasPlantOrFungi && (
            <>
              {renderComparisonRow({
                sectionId: 'height',
                title: 'Height',
                icon: 'height',
                badge: 'Growth',
                valueA: specimenA?.facts.plantHeight || 'Not available',
                valueB: specimenB?.facts.plantHeight || 'Not available',
              })}

              {hasPlant &&
                renderComparisonRow({
                  sectionId: 'leaves_flowers',
                  title: 'Leaves and Flowers',
                  icon: 'local_florist',
                  badge: 'Botany',
                  valueA: specimenA?.facts.leavesAndFlowers || 'Not available',
                  valueB: specimenB?.facts.leavesAndFlowers || 'Not available',
                })}

              {renderComparisonRow({
                sectionId: 'where_grows',
                title: 'Where It Grows',
                icon: 'forest',
                badge: 'Habitat',
                valueA: specimenA?.facts.whereItGrows || 'Not available',
                valueB: specimenB?.facts.whereItGrows || 'Not available',
              })}

              {renderComparisonRow({
                sectionId: 'uses',
                title: 'Uses',
                icon: 'eco',
                badge: 'Uses',
                valueA: specimenA?.facts.uses || 'Not available',
                valueB: specimenB?.facts.uses || 'Not available',
              })}
            </>
          )}
        </div>
      )}

      {/* Search & Autocomplete Picker Modal */}
      {pickingFor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label={`Choose Species ${pickingFor === 'A' ? '1' : '2'}`}
        >
          <div className="w-full max-w-md rounded-3xl bg-surface p-4 sm:p-5 shadow-2xl border border-outline-variant/25 flex flex-col gap-3 max-h-[88vh]">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Pick Species {pickingFor === 'A' ? '1' : '2'}
              </h3>
              <button
                type="button"
                onClick={() => setPickingFor(null)}
                aria-label="Close picker"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Debounced Search Input */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[18px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any animal, plant, bird, insect, fungus..."
                className="w-full h-11 pl-9 pr-9 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/70 border border-outline-variant/30 font-body-md text-body-md focus:outline-none focus:border-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Type Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilterType(chip.id)}
                  className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold transition-colors ${
                    filterType === chip.id
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Quick Picks */}
            <div className="space-y-1">
              <span className="font-label-sm text-[11px] text-on-surface-variant font-semibold">
                Quick picks
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PICKS.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    disabled={Boolean(quickPickBusy)}
                    onClick={() => handleSelectQuickPick(qp.label, qp.query)}
                    className="px-2.5 py-1 rounded-full bg-secondary-container/60 text-on-secondary-container font-label-sm text-[11px] font-semibold hover:bg-secondary-container transition-colors disabled:opacity-50"
                  >
                    {quickPickBusy === qp.label ? `${qp.label}...` : qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Autocomplete Results Area */}
            <div className="flex-1 min-h-[180px] overflow-y-auto pr-1 flex flex-col gap-1.5">
              {searchLoading ? (
                <div className="space-y-2 animate-pulse" aria-label="Searching species">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-surface-container-low">
                      <div className="w-12 h-12 rounded-lg bg-surface-container-high shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-32 rounded bg-surface-container-high" />
                        <div className="h-3 w-24 rounded bg-surface-container-high" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchError ? (
                <div className="p-4 rounded-xl bg-error-container/25 text-center flex flex-col items-center gap-2">
                  <p className="font-body-sm text-error">{searchError}</p>
                  <button
                    type="button"
                    onClick={() => runSearch(searchQuery, filterType)}
                    className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : !searchQuery.trim() ? (
                <div className="py-8 text-center text-on-surface-variant font-body-sm">
                  Type a name above or tap one of the quick picks.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant font-body-sm">
                  No matching species found for "{searchQuery}".
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      applyTaxonIdToSlot(pickingFor, item.id, item.commonName)
                    }
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors text-left w-full"
                  >
                    {item.photoUrl ? (
                      <img
                        alt={item.commonName}
                        src={item.photoUrl}
                        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-surface-container"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">eco</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-label-md font-bold text-on-surface truncate">
                        {item.commonName}
                      </p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">
                        {item.scientificName}
                      </p>
                      {item.iconicTaxon && (
                        <span className="text-[10px] text-secondary font-semibold">
                          {item.iconicTaxon}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Sticky Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl px-margin py-3 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)] border-t border-outline-variant/30 no-print">
        <div className="max-w-md mx-auto flex items-center gap-space-sm">
          <button
            className="flex-1 h-12 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            onClick={() => window.print()}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            <span>Export Report (PDF)</span>
          </button>
          <button
            aria-label="Share comparison"
            className="h-12 w-12 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface flex items-center justify-center active:scale-90 transition-transform shadow-sm shrink-0"
            onClick={handleShareUrl}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">share</span>
          </button>
        </div>
      </div>
    </div>
  );
};
