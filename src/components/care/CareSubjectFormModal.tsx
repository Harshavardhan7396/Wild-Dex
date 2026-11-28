import React, { useState, useEffect, useRef } from 'react';
import {
  CARE_KIND_META,
  CareKind,
  CareSex,
  CareSubject,
  CareSubjectInput,
  TaxonSuggestion,
  createCareSubject,
  searchCareSpecies,
  updateCareSubject,
} from '../../services/careService';

export interface CareSubjectPrefill {
  kind?: CareKind;
  name?: string;
  speciesCommon?: string;
  speciesScientific?: string;
  inatTaxonId?: number | null;
  notes?: string;
}

interface CareSubjectFormModalProps {
  isOpen: boolean;
  subjectToEdit: CareSubject | null;
  prefill?: CareSubjectPrefill | null;
  onClose: () => void;
  onSaved: (saved: CareSubject, mode: 'add' | 'edit') => void;
}

const KIND_ORDER: CareKind[] = ['pet', 'plant', 'crop', 'tree'];

function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const CareSubjectFormModal: React.FC<CareSubjectFormModalProps> = ({
  isOpen,
  subjectToEdit,
  prefill,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(subjectToEdit);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form fields
  const [kind, setKind] = useState<CareKind>('pet');
  const [name, setName] = useState('');
  const [speciesInput, setSpeciesInput] = useState('');
  const [speciesScientific, setSpeciesScientific] = useState('');
  const [inatTaxonId, setInatTaxonId] = useState<number | null>(null);
  const [startedOn, setStartedOn] = useState('');
  const [sex, setSex] = useState<CareSex>('');
  const [notes, setNotes] = useState('');

  // Photo state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Species iNaturalist autocomplete state
  const [speciesResults, setSpeciesResults] = useState<TaxonSuggestion[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchRetryTick, setSearchRetryTick] = useState(0);
  const skipNextAutocompleteRef = useRef(false);

  // Validation & submit state
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize / reset state when modal opens or target subject changes
  useEffect(() => {
    if (!isOpen) return;

    if (subjectToEdit) {
      setKind(subjectToEdit.kind);
      setName(subjectToEdit.name);
      const displaySpecies =
        subjectToEdit.speciesCommon || subjectToEdit.speciesScientific || '';
      skipNextAutocompleteRef.current = true;
      setSpeciesInput(displaySpecies);
      setSpeciesScientific(subjectToEdit.speciesScientific || '');
      setInatTaxonId(subjectToEdit.inatTaxonId);
      setStartedOn(subjectToEdit.startedOn || '');
      setSex(subjectToEdit.kind === 'pet' ? subjectToEdit.sex : '');
      setNotes(subjectToEdit.notes || '');
      setPhotoDataUrl(null);
      setExistingPhotoUrl(subjectToEdit.photoUrl || '');
      setRemoveExistingPhoto(false);
    } else {
      const prefilledSpecies =
        prefill?.speciesCommon?.trim() || prefill?.speciesScientific?.trim() || '';
      setStep(1);
      setKind(prefill?.kind || 'pet');
      setName(prefill?.name || '');
      skipNextAutocompleteRef.current = Boolean(prefilledSpecies);
      setSpeciesInput(prefilledSpecies);
      setSpeciesScientific(prefill?.speciesScientific?.trim() || '');
      setInatTaxonId(prefill?.inatTaxonId ?? null);
      setStartedOn('');
      setSex('');
      setNotes(prefill?.notes || '');
      setPhotoDataUrl(null);
      setExistingPhotoUrl('');
      setRemoveExistingPhoto(false);
    }

    setSpeciesResults([]);
    setSpeciesLoading(false);
    setSpeciesError(null);
    setShowSuggestions(false);
    setPhotoError(null);
    setStepError(null);
    setSaving(false);
    setSaveError(null);
  }, [isOpen, subjectToEdit, prefill]);

  // Escape key closes modal when not actively saving
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, saving, onClose]);

  // 300ms debounced iNaturalist taxa autocomplete
  useEffect(() => {
    if (!isOpen) return;
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const trimmed = speciesInput.trim();
    if (!trimmed) {
      setSpeciesResults([]);
      setSpeciesLoading(false);
      setSpeciesError(null);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSpeciesLoading(true);
      setSpeciesError(null);
      try {
        const matches = await searchCareSpecies(trimmed, controller.signal);
        setSpeciesResults(matches);
        setShowSuggestions(true);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setSpeciesResults([]);
        setSpeciesError(err?.message || 'Could not search species right now.');
      } finally {
        setSpeciesLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [speciesInput, isOpen, searchRetryTick]);

  if (!isOpen) return null;

  const handleSelectKind = (nextKind: CareKind) => {
    setKind(nextKind);
    if (nextKind !== 'pet') {
      setSex('');
    }
    setStepError(null);
  };

  const handleSpeciesTextChange = (value: string) => {
    setSpeciesInput(value);
    setSpeciesScientific('');
    setInatTaxonId(null);
    if (!value.trim()) {
      setShowSuggestions(false);
    }
  };

  const handlePickTaxon = (taxon: TaxonSuggestion) => {
    skipNextAutocompleteRef.current = true;
    setSpeciesInput(taxon.commonName);
    setSpeciesScientific(taxon.scientificName);
    setInatTaxonId(taxon.id);
    setSpeciesResults([]);
    setShowSuggestions(false);
    setSpeciesError(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a photo file (JPG, PNG, or WebP).');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoDataUrl(reader.result);
          setRemoveExistingPhoto(false);
        } else {
          setPhotoError('Could not read that photo. Please try another.');
        }
      };
      reader.onerror = () => {
        setPhotoError('Could not read that photo. Please try another.');
      };
      reader.readAsDataURL(file);
    } catch {
      setPhotoError('Could not open that photo. Please try another.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl(null);
    setExistingPhotoUrl('');
    setRemoveExistingPhoto(true);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNextStep = () => {
    setStepError(null);
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!name.trim()) {
        setStepError('Please give it a name before continuing.');
        return;
      }
      setShowSuggestions(false);
      setStep(3);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStepError(null);
    setSaveError(null);

    if (!name.trim()) {
      setStepError('Please enter a name.');
      if (!isEdit) setStep(2);
      return;
    }

    const payload: CareSubjectInput = {
      kind,
      name: name.trim(),
      speciesCommon: speciesInput.trim(),
      speciesScientific: speciesScientific.trim(),
      inatTaxonId,
      startedOn: startedOn.trim() || null,
      sex: kind === 'pet' ? sex : '',
      notes: notes.trim(),
      photoDataUrl,
      removeExistingPhoto,
    };

    setSaving(true);
    try {
      if (subjectToEdit) {
        const updated = await updateCareSubject(subjectToEdit, payload);
        onSaved(updated, 'edit');
      } else {
        const created = await createCareSubject(payload);
        onSaved(created, 'add');
      }
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const activePhotoPreview = photoDataUrl || (!removeExistingPhoto ? existingPhotoUrl : '');
  const kindMeta = CARE_KIND_META[kind];
  const maxDate = todayLocalYmd();

  const renderKindSelector = () => (
    <div className="space-y-3">
      <div>
        <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
          {isEdit ? 'Kind' : 'What are you adding?'}
        </h3>
        {!isEdit && (
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Pick a group to tailor your care diary fields.
          </p>
        )}
        {!isEdit && (prefill?.speciesCommon || prefill?.speciesScientific) && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/45 text-primary text-xs font-medium max-w-full">
            <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
              eco
            </span>
            <span className="truncate">
              Species prefilled: {prefill.speciesCommon || prefill.speciesScientific}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {KIND_ORDER.map((k) => {
          const meta = CARE_KIND_META[k];
          const selected = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => handleSelectKind(k)}
              aria-pressed={selected}
              className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-2 min-h-[104px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected
                  ? 'bg-secondary-container/45 border-primary ring-1 ring-primary shadow-sm'
                  : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  {meta.icon}
                </span>
              </div>
              <div>
                <div className="font-label-lg text-label-lg font-bold text-on-surface">
                  {meta.label}
                </div>
                <p className="font-body-sm text-[11px] text-on-surface-variant leading-snug mt-0.5">
                  {meta.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderNameAndSpecies = () => (
    <div className="space-y-4">
      {!isEdit && (
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
            Name and species
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Give your {kindMeta.label.toLowerCase()} a name and look up its species, or type your own.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="care-name-input"
          className="block font-label-md text-label-md text-on-surface mb-1.5"
        >
          Name <span className="text-error">*</span>
        </label>
        <input
          id="care-name-input"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (stepError) setStepError(null);
          }}
          maxLength={120}
          placeholder={
            kind === 'pet'
              ? 'e.g. Milo, Bella'
              : kind === 'crop'
              ? 'e.g. Patio Tomatoes'
              : kind === 'tree'
              ? 'e.g. Backyard Apple Tree'
              : 'e.g. Kitchen Basil'
          }
          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="relative">
        <label
          htmlFor="care-species-input"
          className="block font-label-md text-label-md text-on-surface mb-1.5"
        >
          Species or breed (optional)
        </label>
        <div className="relative">
          <span
            className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            id="care-species-input"
            type="text"
            value={speciesInput}
            onChange={(e) => handleSpeciesTextChange(e.target.value)}
            onFocus={() => {
              if (speciesResults.length > 0) setShowSuggestions(true);
            }}
            maxLength={180}
            placeholder="Search species or type your own..."
            className="w-full pl-9 pr-10 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {speciesLoading ? (
            <span
              className="material-symbols-outlined text-[18px] text-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Searching species"
            >
              progress_activity
            </span>
          ) : (
            speciesInput.trim().length > 0 && (
              <button
                type="button"
                aria-label="Clear species"
                onClick={() => handleSpeciesTextChange('')}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )
          )}
        </div>

        {inatTaxonId && speciesScientific && (
          <p className="mt-1.5 text-xs text-primary font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              check_circle
            </span>
            <span className="truncate">Matched: {speciesScientific}</span>
          </p>
        )}

        {speciesError && (
          <div className="mt-2 p-2.5 rounded-xl bg-error-container/30 border border-error/30 flex items-center justify-between gap-2">
            <span className="text-xs text-on-error-container">{speciesError}</span>
            <button
              type="button"
              onClick={() => setSearchRetryTick((t) => t + 1)}
              className="px-3 py-1 rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {showSuggestions && speciesResults.length > 0 && (
          <div
            role="listbox"
            aria-label="Species suggestions"
            className="mt-2 max-h-56 overflow-y-auto rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-lg divide-y divide-outline-variant/15"
          >
            {speciesResults.map((taxon) => (
              <button
                key={taxon.id}
                type="button"
                role="option"
                aria-selected={inatTaxonId === taxon.id}
                onClick={() => handlePickTaxon(taxon)}
                className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-surface-container-low active:bg-surface-container transition-colors min-h-[48px]"
              >
                {taxon.photoUrl ? (
                  <img
                    src={taxon.photoUrl}
                    alt={taxon.commonName}
                    className="w-9 h-9 rounded-lg object-cover shrink-0 bg-surface-container"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-secondary-container/40 text-secondary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {kindMeta.icon}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {taxon.commonName}
                  </div>
                  {taxon.scientificName && (
                    <div className="text-xs italic text-on-surface-variant truncate">
                      {taxon.scientificName}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {!speciesLoading &&
          !speciesError &&
          showSuggestions &&
          speciesInput.trim().length > 0 &&
          speciesResults.length === 0 && (
            <p className="mt-1.5 text-xs text-on-surface-variant">
              No close matches found — your typed name "{speciesInput.trim()}" will be saved as written.
            </p>
          )}
      </div>
    </div>
  );

  const renderDetailsPhotoNotes = () => (
    <div className="space-y-4">
      {!isEdit && (
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
            Details, photo & notes
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Everything on this step is optional — you can add or update it anytime.
          </p>
        </div>
      )}

      <div className={`grid gap-3 ${kind === 'pet' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <label
            htmlFor="care-date-input"
            className="block font-label-md text-label-md text-on-surface mb-1.5"
          >
            {kindMeta.dateLabel} (optional)
          </label>
          <input
            id="care-date-input"
            type="date"
            value={startedOn}
            max={maxDate}
            onChange={(e) => setStartedOn(e.target.value)}
            className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {kind === 'pet' && (
          <div>
            <label
              htmlFor="care-sex-select"
              className="block font-label-md text-label-md text-on-surface mb-1.5"
            >
              Sex (optional)
            </label>
            <select
              id="care-sex-select"
              value={sex}
              onChange={(e) => setSex(e.target.value as CareSex)}
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        )}
      </div>

      {/* Photo Upload */}
      <div>
        <span className="block font-label-md text-label-md text-on-surface mb-1.5">
          Photo (optional)
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="hidden"
          id="care-photo-input"
        />

        {activePhotoPreview ? (
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <img
              src={activePhotoPreview}
              alt={name || 'Preview'}
              className="w-16 h-16 rounded-xl object-cover shrink-0 bg-surface-container"
            />
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {photoDataUrl ? 'New photo ready' : 'Current photo'}
              </p>
              <p className="text-xs text-on-surface-variant">
                Saved privately in your care diary
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <label
                htmlFor="care-photo-input"
                className="px-3 py-1.5 min-h-[36px] inline-flex items-center rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40 cursor-pointer hover:bg-surface-container"
              >
                Change
              </label>
              <button
                type="button"
                onClick={handleRemovePhoto}
                aria-label="Remove photo"
                className="w-9 h-9 flex items-center justify-center rounded-full text-error hover:bg-error-container/20"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="care-photo-input"
            className="w-full p-4 rounded-2xl border border-dashed border-outline-variant/70 bg-surface-container-low hover:bg-surface-container cursor-pointer flex items-center justify-center gap-2.5 min-h-[64px] transition-colors"
          >
            <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">
              add_a_photo
            </span>
            <span className="font-label-md text-label-md text-primary font-semibold">
              Add a photo
            </span>
          </label>
        )}

        {photoError && (
          <p className="mt-1.5 text-xs text-error font-medium">{photoError}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="care-notes-input"
          className="block font-label-md text-label-md text-on-surface mb-1.5"
        >
          Notes (optional)
        </label>
        <textarea
          id="care-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Feeding schedule, watering needs, sunny spot, or favorite treats..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
        />
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit ${subjectToEdit?.name}` : 'Add pet or plant'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold truncate">
              {isEdit ? `Edit ${subjectToEdit?.name}` : 'Add pet or plant'}
            </h2>
            {!isEdit && (
              <p className="text-xs text-on-surface-variant mt-0.5">
                Step {step} of 3
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* 3-Step Progress Bar (Add Mode) */}
        {!isEdit && (
          <div className="px-4 sm:px-6 pt-3 flex items-center gap-2 shrink-0" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step >= n ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              />
            ))}
          </div>
        )}

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5"
        >
          {isEdit ? (
            <>
              {renderKindSelector()}
              {renderNameAndSpecies()}
              {renderDetailsPhotoNotes()}
            </>
          ) : (
            <>
              {step === 1 && renderKindSelector()}
              {step === 2 && renderNameAndSpecies()}
              {step === 3 && renderDetailsPhotoNotes()}
            </>
          )}

          {stepError && (
            <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium">
              {stepError}
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 flex items-center justify-between gap-2">
              <span className="text-xs text-on-error-container font-medium">{saveError}</span>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit()}
                className="px-3 py-1 rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40 shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </form>

        {/* Modal Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-outline-variant/25 bg-surface-container-low/70 flex items-center justify-between gap-2.5 shrink-0 pb-safe">
          {isEdit ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit()}
                className="px-6 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {saving && (
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                )}
                <span>{saving ? 'Saving...' : 'Save changes'}</span>
              </button>
            </>
          ) : (
            <>
              {step > 1 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setStepError(null);
                    setStep((s) => (s === 3 ? 2 : 1));
                  }}
                  className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold hover:bg-surface-container disabled:opacity-50"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold hover:bg-surface-container"
                >
                  Cancel
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 inline-flex items-center gap-1.5"
                >
                  <span>Next</span>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    arrow_forward
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit()}
                  className="px-6 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {saving && (
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                  )}
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
