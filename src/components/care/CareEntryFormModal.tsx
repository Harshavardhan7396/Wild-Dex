import React, { useState, useEffect, useRef } from 'react';
import {
  CareEntry,
  CareEntryInput,
  CareEntryType,
  CareKind,
  CareMeasurementUnit,
  createCareEntry,
  getEntryTypeMeta,
  getEntryTypesForKind,
  todayLocalYmd,
  updateCareEntry,
} from '../../services/careService';

interface CareEntryFormModalProps {
  isOpen: boolean;
  subjectId: string;
  subjectKind: CareKind;
  subjectName: string;
  entryToEdit: CareEntry | null;
  onClose: () => void;
  onSaved: (saved: CareEntry, mode: 'add' | 'edit') => void;
}

export const CareEntryFormModal: React.FC<CareEntryFormModalProps> = ({
  isOpen,
  subjectId,
  subjectKind,
  subjectName,
  entryToEdit,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(entryToEdit);
  const typeOptions = getEntryTypesForKind(subjectKind);
  const defaultType = typeOptions[0]?.id || 'note';

  const [entryType, setEntryType] = useState<CareEntryType>(defaultType);
  const [entryDate, setEntryDate] = useState<string>(todayLocalYmd());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [unit, setUnit] = useState<CareMeasurementUnit>('kg');

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (entryToEdit) {
      setEntryType(entryToEdit.entryType);
      setEntryDate(entryToEdit.entryDate || todayLocalYmd());
      setTitle(entryToEdit.title);
      setNotes(entryToEdit.notes || '');
      setValueInput(
        entryToEdit.value !== null && entryToEdit.value !== undefined
          ? String(entryToEdit.value)
          : ''
      );
      if (entryToEdit.unit) {
        setUnit(entryToEdit.unit);
      } else {
        const meta = getEntryTypeMeta(subjectKind, entryToEdit.entryType);
        setUnit(meta.defaultUnit || (subjectKind === 'pet' ? 'kg' : 'cm'));
      }
      setPhotoDataUrl(null);
      setExistingPhotoUrl(entryToEdit.photoUrl || '');
      setRemoveExistingPhoto(false);
    } else {
      const initialType = typeOptions[0]?.id || 'note';
      const meta = getEntryTypeMeta(subjectKind, initialType);
      setEntryType(initialType);
      setEntryDate(todayLocalYmd());
      setTitle('');
      setNotes('');
      setValueInput('');
      setUnit(meta.defaultUnit || (subjectKind === 'pet' ? 'kg' : 'cm'));
      setPhotoDataUrl(null);
      setExistingPhotoUrl('');
      setRemoveExistingPhoto(false);
    }

    setPhotoError(null);
    setValidationError(null);
    setSaving(false);
    setSaveError(null);
  }, [isOpen, entryToEdit, subjectKind]);

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

  if (!isOpen) return null;

  const selectedMeta = getEntryTypeMeta(subjectKind, entryType);

  const handleSelectType = (nextType: CareEntryType) => {
    setEntryType(nextType);
    const meta = getEntryTypeMeta(subjectKind, nextType);
    if (meta.defaultUnit) {
      setUnit(meta.defaultUnit);
    } else if (subjectKind === 'pet' && unit === 'cm') {
      setUnit('kg');
    } else if (subjectKind !== 'pet' && unit === 'lb') {
      setUnit('cm');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file (JPG, PNG, or WebP).');
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
      setPhotoError('Could not open that photo.');
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

  const allowedUnits: CareMeasurementUnit[] =
    selectedMeta.allowedUnits ||
    (subjectKind === 'pet' ? ['kg', 'lb'] : ['cm', 'kg']);

  const valueLabel =
    selectedMeta.valueLabel ||
    (subjectKind === 'pet'
      ? 'Weight / value (optional)'
      : 'Height / harvest (optional)');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setSaveError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setValidationError('Please enter a short title for this entry.');
      return;
    }

    let parsedValue: number | null = null;
    if (valueInput.trim() !== '') {
      const num = Number(valueInput.trim());
      if (!Number.isFinite(num) || num < 0) {
        setValidationError('Please enter a valid positive number.');
        return;
      }
      parsedValue = num;
    }

    const payload: CareEntryInput = {
      entryType,
      entryDate: entryDate || todayLocalYmd(),
      title: cleanTitle,
      notes: notes.trim(),
      value: parsedValue,
      unit: parsedValue !== null ? unit : '',
      photoDataUrl,
      removeExistingPhoto,
    };

    setSaving(true);
    try {
      if (entryToEdit) {
        const updated = await updateCareEntry(entryToEdit, payload);
        onSaved(updated, 'edit');
      } else {
        const created = await createCareEntry(subjectId, payload);
        onSaved(created, 'add');
      }
      onClose();
    } catch (err: any) {
      setSaveError(
        err?.message || 'Could not save this diary entry. Please retry.'
      );
    } finally {
      setSaving(false);
    }
  };

  const activePhotoPreview =
    photoDataUrl || (!removeExistingPhoto ? existingPhotoUrl : '');

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit diary entry' : `Add entry for ${subjectName}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold truncate">
              {isEdit ? 'Edit entry' : 'Add diary entry'}
            </h2>
            <p className="text-xs text-on-surface-variant truncate mt-0.5">
              For {subjectName}
            </p>
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

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
        >
          {/* Type Chooser */}
          <div>
            <span className="block font-label-md text-label-md text-on-surface mb-2">
              Entry type
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {typeOptions.map((opt) => {
                const selected = entryType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSelectType(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 min-h-[44px] ${
                      selected
                        ? 'bg-secondary-container/50 border-primary ring-1 ring-primary text-primary font-semibold'
                        : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[18px] shrink-0"
                      aria-hidden="true"
                    >
                      {opt.icon}
                    </span>
                    <span className="text-xs leading-tight truncate">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="care-entry-date"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Date
              </label>
              <input
                id="care-entry-date"
                type="date"
                value={entryDate}
                max={todayLocalYmd()}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="care-entry-title"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Title <span className="text-error">*</span>
              </label>
              <input
                id="care-entry-title"
                type="text"
                value={title}
                maxLength={180}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder={`e.g. ${selectedMeta.label}`}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Optional Measurement Value + Unit */}
          <div>
            <label
              htmlFor="care-entry-value"
              className="block font-label-md text-label-md text-on-surface mb-1.5"
            >
              {valueLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="care-entry-value"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={valueInput}
                onChange={(e) => {
                  setValueInput(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="0.0"
                className="flex-1 min-w-0 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {allowedUnits.length === 1 ? (
                <div className="px-4 py-2.5 min-h-[44px] rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface font-label-md text-sm flex items-center justify-center shrink-0">
                  {allowedUnits[0]}
                </div>
              ) : (
                <div
                  className="flex items-center rounded-xl bg-surface-container-low border border-outline-variant/40 p-1 shrink-0"
                  role="group"
                  aria-label="Measurement unit"
                >
                  {allowedUnits.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold transition-colors ${
                        unit === u
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label
              htmlFor="care-entry-notes"
              className="block font-label-md text-label-md text-on-surface mb-1.5"
            >
              Notes (optional)
            </label>
            <textarea
              id="care-entry-notes"
              rows={3}
              maxLength={4000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened, vet advice, dose, or observations..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {/* Optional Photo */}
          <div>
            <span className="block font-label-md text-label-md text-on-surface mb-1.5">
              Photo (optional)
            </span>
            <input
              ref={fileInputRef}
              id="care-entry-photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {activePhotoPreview ? (
              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <img
                  src={activePhotoPreview}
                  alt="Entry photo preview"
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-surface-container"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                    {photoDataUrl ? 'New photo ready' : 'Current photo'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Saved privately in your diary
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label
                    htmlFor="care-entry-photo-input"
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
                htmlFor="care-entry-photo-input"
                className="w-full p-3.5 rounded-2xl border border-dashed border-outline-variant/70 bg-surface-container-low hover:bg-surface-container cursor-pointer flex items-center justify-center gap-2 min-h-[56px] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
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

          {validationError && (
            <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium">
              {validationError}
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 flex items-center justify-between gap-2">
              <span className="text-xs text-on-error-container font-medium">
                {saveError}
              </span>
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

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-outline-variant/25 bg-surface-container-low/70 flex items-center justify-between gap-2.5 shrink-0 pb-safe">
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
            <span>
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Save entry'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
