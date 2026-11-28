import React, { useEffect, useRef, useState } from 'react';
import {
  InatTaxonSuggestion,
  SightingRecord,
  addPastSighting,
  searchInatTaxa,
  todayLocalYmd,
} from '../../services/lifeListService';

export interface PastSightingPrefill {
  speciesName?: string;
  scientificName?: string;
  category?: string;
}

interface AddPastSightingModalProps {
  isOpen: boolean;
  prefill?: PastSightingPrefill | null;
  onClose: () => void;
  onSaved: (sighting: SightingRecord) => void;
}

const CATEGORY_CHOICES: { value: string; label: string }[] = [
  { value: 'birds', label: 'Birds' },
  { value: 'mammals', label: 'Mammals' },
  { value: 'reptiles', label: 'Reptiles' },
  { value: 'amphibians', label: 'Amphibians' },
  { value: 'insects', label: 'Insects' },
  { value: 'marine', label: 'Marine' },
  { value: 'plants', label: 'Plants' },
  { value: 'fungi', label: 'Fungi' },
  { value: 'animals', label: 'Animals' },
  { value: 'other', label: 'Other' },
];

export const AddPastSightingModal: React.FC<AddPastSightingModalProps> = ({
  isOpen,
  prefill = null,
  onClose,
  onSaved,
}) => {
  const [speciesInput, setSpeciesInput] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [category, setCategory] = useState('other');
  const [seenOn, setSeenOn] = useState(todayLocalYmd());
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<InatTaxonSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchRetryTick, setSearchRetryTick] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skipNextAutocompleteRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const initialName = prefill?.speciesName?.trim() || '';
    skipNextAutocompleteRef.current = Boolean(initialName);
    setSpeciesInput(initialName);
    setScientificName(prefill?.scientificName?.trim() || '');
    setCategory(prefill?.category?.trim() || 'other');
    setSeenOn(todayLocalYmd());
    setNotes('');
    setPhotoDataUrl(null);
    setPhotoError(null);
    setSuggestions([]);
    setSearchLoading(false);
    setSearchError(null);
    setShowSuggestions(false);
    setSubmitting(false);
    setSubmitError(null);
  }, [isOpen, prefill]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, submitting, onClose]);

  // 300ms debounced iNaturalist taxa autocomplete
  useEffect(() => {
    if (!isOpen) return;
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const trimmed = speciesInput.trim();
    if (!trimmed) {
      setSuggestions([]);
      setSearchLoading(false);
      setSearchError(null);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const matches = await searchInatTaxa(trimmed, controller.signal);
        setSuggestions(matches);
        setShowSuggestions(true);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setSuggestions([]);
        setSearchError(err?.message || 'Could not search species right now.');
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [speciesInput, isOpen, searchRetryTick]);

  if (!isOpen) return null;

  const handleSelectSuggestion = (item: InatTaxonSuggestion) => {
    skipNextAutocompleteRef.current = true;
    setSpeciesInput(item.commonName);
    setScientificName(item.scientificName);
    setCategory(item.category || 'other');
    setShowSuggestions(false);
    setSearchError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setPhotoError('Could not read this photo. Please try another.');
    };
    reader.readAsDataURL(file);
  };

  const submitForm = async () => {
    if (submitting) return;

    const cleanName = speciesInput.trim();
    if (!cleanName) {
      setSubmitError('Please enter or pick a species name.');
      return;
    }

    const today = todayLocalYmd();
    if (!seenOn) {
      setSubmitError('Please choose the date you saw it.');
      return;
    }
    if (seenOn > today) {
      setSubmitError('Date seen cannot be in the future.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const saved = await addPastSighting({
        speciesName: cleanName,
        scientificName,
        category,
        seenOn,
        notes,
        photoDataUrl,
      });
      onSaved(saved);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not save this sighting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a past sighting"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-surface shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Add a past sighting
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Log a species you saw on an earlier day
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close dialog"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Species search with iNaturalist autocomplete */}
          <div className="space-y-1.5 relative">
            <label
              htmlFor="past-sighting-species"
              className="block font-label-md text-xs font-semibold text-on-surface"
            >
              Species name <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="past-sighting-species"
                type="text"
                value={speciesInput}
                onChange={(e) => {
                  setSpeciesInput(e.target.value);
                  setScientificName('');
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Search species or type your own..."
                autoComplete="off"
                className="w-full min-h-[44px] px-3.5 pr-10 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
              {searchLoading && (
                <span
                  className="material-symbols-outlined text-[18px] text-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                >
                  progress_activity
                </span>
              )}
            </div>

            {scientificName && (
              <p className="font-body-sm text-xs text-on-surface-variant italic">
                {scientificName}
              </p>
            )}

            {searchError && (
              <div className="p-2.5 rounded-xl bg-error-container/25 border border-error/30 text-xs text-on-error-container flex items-center justify-between gap-2">
                <span>{searchError}</span>
                <button
                  type="button"
                  onClick={() => setSearchRetryTick((t) => t + 1)}
                  className="px-2.5 py-1 rounded-full bg-surface text-primary font-semibold border border-outline-variant/40 shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {showSuggestions && suggestions.length > 0 && (
              <div className="mt-1 rounded-2xl bg-surface-container-lowest border border-outline-variant/35 shadow-lg max-h-56 overflow-y-auto divide-y divide-outline-variant/15">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-3 py-2.5 min-h-[44px] flex items-center gap-3 hover:bg-surface-container transition-colors"
                  >
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.commonName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-lg object-cover shrink-0 bg-surface-container"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-secondary-container/40 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          nature
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-xs font-semibold text-on-surface truncate">
                        {item.commonName}
                      </p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">
                        {item.scientificName} · <span className="not-italic capitalize">{item.category}</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date seen & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="past-sighting-date"
                className="block font-label-md text-xs font-semibold text-on-surface"
              >
                Date seen <span className="text-error">*</span>
              </label>
              <input
                id="past-sighting-date"
                type="date"
                max={todayLocalYmd()}
                value={seenOn}
                onChange={(e) => setSeenOn(e.target.value)}
                required
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="past-sighting-category"
                className="block font-label-md text-xs font-semibold text-on-surface"
              >
                Category
              </label>
              <select
                id="past-sighting-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                {CATEGORY_CHOICES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Photo */}
          <div className="space-y-1.5">
            <span className="block font-label-md text-xs font-semibold text-on-surface">
              Photo (optional)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {photoDataUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container aspect-[16/9]">
                <img
                  src={photoDataUrl}
                  alt="Selected sighting"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2.5 right-2.5 px-3 py-1.5 min-h-[36px] rounded-full bg-surface/90 text-on-surface font-label-sm text-xs font-semibold shadow-sm inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    delete
                  </span>
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[56px] px-4 py-3 rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
                  add_a_photo
                </span>
                <span>Choose a photo</span>
              </button>
            )}
            {photoError && (
              <p className="text-xs text-error font-medium">{photoError}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="past-sighting-notes"
                className="block font-label-md text-xs font-semibold text-on-surface"
              >
                Notes (optional)
              </label>
              <span className="text-[11px] text-on-surface-variant tabular-nums">
                {notes.length} / 1000
              </span>
            </div>
            <textarea
              id="past-sighting-notes"
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
              placeholder="Where you noticed it, weather, or what it was doing..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Submit Error with Retry */}
          {submitError && (
            <div className="p-3 rounded-xl bg-error-container/30 border border-error/35 text-xs text-on-error-container flex items-center justify-between gap-2">
              <span>{submitError}</span>
              <button
                type="button"
                disabled={submitting}
                onClick={submitForm}
                className="px-3 py-1 rounded-full bg-surface text-primary font-semibold border border-outline-variant/40 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 rounded-full bg-surface-container text-on-surface font-label-md text-sm font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] px-4 rounded-full bg-primary text-on-primary font-label-md text-sm font-semibold shadow-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              {submitting && (
                <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                  progress_activity
                </span>
              )}
              <span>{submitting ? 'Saving...' : 'Save sighting'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
