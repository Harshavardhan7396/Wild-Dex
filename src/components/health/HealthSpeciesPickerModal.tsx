import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface HealthSubjectChoice {
  category: string;
  commonName: string;
  scientificName?: string;
  photoUrl?: string;
  taxonId?: number;
  isCustom?: boolean;
}

export const HEALTH_CATEGORIES: Array<{ id: string; label: string; icon: string }> = [
  { id: 'Pet', label: 'Pet', icon: 'pets' },
  { id: 'Farm animal', label: 'Farm animal', icon: 'agriculture' },
  { id: 'Wild animal', label: 'Wild animal', icon: 'forest' },
  { id: 'Bird', label: 'Bird', icon: 'flutter' },
  { id: 'Fish', label: 'Fish', icon: 'water' },
  { id: 'Reptile', label: 'Reptile', icon: 'cruelty_free' },
  { id: 'Insect', label: 'Insect', icon: 'bug_report' },
  { id: 'Plant', label: 'Plant', icon: 'local_florist' },
  { id: 'Tree', label: 'Tree', icon: 'park' },
  { id: 'Crop', label: 'Crop', icon: 'grass' },
  { id: 'Fungi', label: 'Fungi', icon: 'psychiatry' },
];

export const QUICK_PICK_SPECIES: HealthSubjectChoice[] = [
  { category: 'Pet', commonName: 'Dog', scientificName: 'Canis familiaris' },
  { category: 'Pet', commonName: 'Cat', scientificName: 'Felis catus' },
  { category: 'Farm animal', commonName: 'Cow', scientificName: 'Bos taurus' },
  { category: 'Farm animal', commonName: 'Goat', scientificName: 'Capra hircus' },
  { category: 'Farm animal', commonName: 'Chicken', scientificName: 'Gallus gallus domesticus' },
  { category: 'Farm animal', commonName: 'Horse', scientificName: 'Equus caballus' },
  { category: 'Pet', commonName: 'Rabbit', scientificName: 'Oryctolagus cuniculus' },
  { category: 'Bird', commonName: 'Parrot', scientificName: 'Psittaciformes' },
  { category: 'Crop', commonName: 'Tomato', scientificName: 'Solanum lycopersicum' },
  { category: 'Crop', commonName: 'Rice', scientificName: 'Oryza sativa' },
  { category: 'Plant', commonName: 'Rose', scientificName: 'Rosa' },
  { category: 'Tree', commonName: 'Mango tree', scientificName: 'Mangifera indica' },
];

interface INatTaxonResult {
  id: number;
  name: string;
  preferred_common_name?: string;
  default_photo?: {
    square_url?: string;
    medium_url?: string;
  } | null;
}

interface HealthSpeciesPickerModalProps {
  isOpen: boolean;
  currentChoice: HealthSubjectChoice;
  onSelect: (choice: HealthSubjectChoice) => void;
  onClose: () => void;
}

export const HealthSpeciesPickerModal: React.FC<HealthSpeciesPickerModalProps> = ({
  isOpen,
  currentChoice,
  onSelect,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>(currentChoice.category || 'Pet');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<INatTaxonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  // Sync modal state whenever opened so the current choice is preselected
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedCategory(currentChoice.category || 'Pet');
    setQuery('');
    setResults([]);
    setErrorMsg(null);
    setHasSearched(false);
    setShowCustomInput(Boolean(currentChoice.isCustom));
    setCustomName(currentChoice.isCustom ? currentChoice.commonName : '');
  }, [isOpen, currentChoice]);

  // Close on Escape key & lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const fetchTaxaAutocomplete = useCallback(async (searchText: string) => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      setErrorMsg(null);
      setHasSearched(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(trimmed)}&per_page=12`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Search service returned status ${response.status}`);
      }

      const data = await response.json();
      const taxa: INatTaxonResult[] = Array.isArray(data?.results) ? data.results : [];
      setResults(taxa);
      setHasSearched(true);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('iNaturalist autocomplete error:', err);
      setErrorMsg('Could not load species matches. Please check your connection and try again.');
      setResults([]);
      setHasSearched(true);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debounced autocomplete (300ms) while on Step 2
  useEffect(() => {
    if (!isOpen || step !== 2) return;

    const trimmed = query.trim();
    if (!trimmed) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults([]);
      setIsLoading(false);
      setErrorMsg(null);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const timer = setTimeout(() => {
      fetchTaxaAutocomplete(trimmed);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [query, step, isOpen, fetchTaxaAutocomplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleCategoryClick = (catId: string) => {
    setSelectedCategory(catId);
    setStep(2);
  };

  const handleSelectQuickChip = (chip: HealthSubjectChoice) => {
    onSelect({
      category: chip.category,
      commonName: chip.commonName,
      scientificName: chip.scientificName,
      isCustom: false,
    });
  };

  const handleSelectTaxon = (taxon: INatTaxonResult) => {
    const common = taxon.preferred_common_name || taxon.name;
    onSelect({
      category: selectedCategory,
      commonName: common,
      scientificName: taxon.name,
      photoUrl: taxon.default_photo?.square_url || taxon.default_photo?.medium_url || undefined,
      taxonId: taxon.id,
      isCustom: false,
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customName.trim();
    if (!cleaned) return;
    onSelect({
      category: selectedCategory,
      commonName: cleaned,
      isCustom: true,
    });
  };

  const getCategoryIcon = (catId: string) => {
    return HEALTH_CATEGORIES.find((c) => c.id === catId)?.icon || 'pets';
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-species-picker-title"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] rounded-3xl bg-surface shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3 sm:p-4 border-b border-outline-variant/20 flex items-center justify-between gap-2 bg-surface-container-low shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                aria-label="Back to category list"
                className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
            )}
            <div className="min-w-0">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold block">
                Step {step} of 2
              </span>
              <h2
                id="health-species-picker-title"
                className="font-headline-sm text-headline-sm text-on-surface font-bold truncate"
              >
                {step === 1 ? 'What do you want to check?' : `Find your ${selectedCategory}`}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close species picker"
            className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-4">
          {step === 1 ? (
            <>
              {/* Current Preselected Summary */}
              {currentChoice.commonName && (
                <div className="p-3 rounded-2xl bg-surface-container flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary-container/60 text-on-secondary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {getCategoryIcon(currentChoice.category)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-label-sm text-[11px] text-on-surface-variant block">
                        Currently selected ({currentChoice.category})
                      </span>
                      <span className="font-label-md text-label-md font-bold text-on-surface truncate block">
                        {currentChoice.commonName}
                        {currentChoice.scientificName ? ` (${currentChoice.scientificName})` : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-3 py-1.5 min-h-[40px] rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold shrink-0 hover:opacity-95 active:scale-95 transition-all"
                  >
                    Search in {selectedCategory}
                  </button>
                </div>
              )}

              {/* Step 1: Big Category Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {HEALTH_CATEGORIES.map((cat) => {
                  const isPreselected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryClick(cat.id)}
                      className={`p-3.5 min-h-[84px] rounded-2xl flex flex-col items-start justify-between gap-2 text-left transition-all active:scale-95 ${
                        isPreselected
                          ? 'bg-secondary-container/50 ring-2 ring-primary text-on-surface shadow-sm'
                          : 'bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isPreselected
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-high text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px]">{cat.icon}</span>
                        </div>
                        {isPreselected && (
                          <span className="material-symbols-outlined text-[18px] text-primary">
                            check_circle
                          </span>
                        )}
                      </div>
                      <span className="font-label-lg text-label-lg font-bold leading-tight">
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Search Box */}
              <div className="space-y-2">
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[20px] text-on-surface-variant pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search common or science name (e.g. Dog, Rosa, Mango)..."
                    aria-label="Search species by common or science name"
                    autoFocus
                    className="w-full min-w-0 min-h-[44px] bg-surface-container pl-10 pr-10 py-2.5 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Category: <strong className="text-primary">{selectedCategory}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                  >
                    Change type
                  </button>
                </div>
              </div>

              {/* Autocomplete Results Area */}
              {query.trim().length > 0 && (
                <div className="space-y-2">
                  <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold px-1">
                    Matching Species
                  </p>

                  {/* Loading Skeletons */}
                  {isLoading && (
                    <div className="space-y-2" aria-label="Loading species results">
                      {[1, 2, 3, 4].map((idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low animate-pulse"
                        >
                          <div className="w-12 h-12 rounded-xl bg-surface-container-high shrink-0" />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                            <div className="h-3 w-1/2 rounded bg-surface-container-highest" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error State with Retry */}
                  {!isLoading && errorMsg && (
                    <div className="p-4 rounded-2xl bg-error-container/30 border border-error/20 text-center space-y-2.5">
                      <div className="flex items-center justify-center gap-2 text-error">
                        <span className="material-symbols-outlined text-[20px]">wifi_off</span>
                        <span className="font-label-md text-label-md font-semibold">{errorMsg}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchTaxaAutocomplete(query)}
                        className="px-4 py-2 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold hover:opacity-95 active:scale-95 transition-all"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Empty State */}
                  {!isLoading && !errorMsg && hasSearched && results.length === 0 && (
                    <div className="p-4 rounded-2xl bg-surface-container-low text-center space-y-1.5">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                        search_off
                      </span>
                      <p className="font-label-md text-label-md text-on-surface font-semibold">
                        No match, try another name
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Or tap &quot;Not sure? Type your own name&quot; below to continue.
                      </p>
                    </div>
                  )}

                  {/* iNaturalist Results */}
                  {!isLoading && !errorMsg && results.length > 0 && (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                      {results.map((item) => {
                        const common = item.preferred_common_name || item.name;
                        const photo =
                          item.default_photo?.square_url || item.default_photo?.medium_url;
                        const isSelected =
                          !currentChoice.isCustom &&
                          (currentChoice.taxonId === item.id ||
                            currentChoice.scientificName?.toLowerCase() === item.name.toLowerCase());

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectTaxon(item)}
                            className={`w-full min-h-[56px] p-2 rounded-2xl flex items-center gap-3 text-left transition-colors active:scale-[0.99] ${
                              isSelected
                                ? 'bg-secondary-container/50 ring-2 ring-primary'
                                : 'bg-surface-container-low hover:bg-surface-container'
                            }`}
                          >
                            {photo ? (
                              <img
                                src={photo}
                                alt={common}
                                className="w-12 h-12 rounded-xl object-cover bg-surface-container-high shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[22px]">
                                  {getCategoryIcon(selectedCategory)}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                                {common}
                              </p>
                              <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
                                {item.name}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
                                check_circle
                              </span>
                            ) : (
                              <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
                                chevron_right
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Quick-Pick Chips for Common Choices */}
              <div className="space-y-2">
                <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold px-1">
                  Common Choices
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PICK_SPECIES.map((chip) => {
                    const isChipSelected =
                      !currentChoice.isCustom &&
                      (currentChoice.commonName.toLowerCase() === chip.commonName.toLowerCase() ||
                        (chip.scientificName &&
                          currentChoice.scientificName?.toLowerCase() ===
                            chip.scientificName.toLowerCase()));
                    return (
                      <button
                        key={chip.commonName}
                        type="button"
                        onClick={() => handleSelectQuickChip(chip)}
                        className={`px-3.5 py-2 min-h-[44px] rounded-full font-label-md text-label-md font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                          isChipSelected
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {getCategoryIcon(chip.category)}
                        </span>
                        <span>{chip.commonName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Free-text fallback: "Not sure? Type your own name" */}
              <div className="pt-2 border-t border-outline-variant/20 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput((prev) => !prev);
                    setTimeout(() => customInputRef.current?.focus(), 50);
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between gap-2 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">
                      edit
                    </span>
                    <span className="font-label-md text-label-md font-semibold text-primary">
                      Not sure? Type your own name
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                    {showCustomInput ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showCustomInput && (
                  <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row gap-2">
                    <input
                      ref={customInputRef}
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Spotted garden lizard, Backyard fern..."
                      aria-label="Enter custom plant or animal name"
                      className="flex-1 min-w-0 min-h-[44px] bg-surface-container px-4 py-2 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!customName.trim()}
                      className="px-5 py-2 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold disabled:opacity-50 hover:opacity-95 active:scale-95 transition-all shrink-0"
                    >
                      Continue
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
