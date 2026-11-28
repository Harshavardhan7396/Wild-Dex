import React, { useState, useEffect } from 'react';
import {
  CARE_REMINDER_TYPES,
  CareKind,
  CareReminder,
  CareReminderInput,
  CareReminderType,
  createCareReminder,
  todayLocalYmd,
  updateCareReminder,
} from '../../services/careService';

interface CareReminderFormModalProps {
  isOpen: boolean;
  subjectId: string;
  subjectKind: CareKind;
  subjectName: string;
  reminderToEdit: CareReminder | null;
  onClose: () => void;
  onSaved: (saved: CareReminder, mode: 'add' | 'edit') => void;
}

type RepeatChoice = '' | '1' | '2' | '3' | '7' | '14' | '30' | 'custom';

const STANDARD_REPEAT_OPTIONS: { value: RepeatChoice; label: string }[] = [
  { value: '', label: 'Never' },
  { value: '1', label: 'Every 1 day' },
  { value: '2', label: 'Every 2 days' },
  { value: '3', label: 'Every 3 days' },
  { value: '7', label: 'Every 7 days' },
  { value: '14', label: 'Every 14 days' },
  { value: '30', label: 'Every 30 days' },
  { value: 'custom', label: 'Custom days' },
];

const PRESET_STANDARD_VALUES = new Set(['1', '2', '3', '7', '14', '30']);

export const CareReminderFormModal: React.FC<CareReminderFormModalProps> = ({
  isOpen,
  subjectId,
  subjectKind,
  subjectName,
  reminderToEdit,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(reminderToEdit);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CareReminderType>(
    subjectKind === 'pet' ? 'feeding' : 'watering'
  );
  const [nextDue, setNextDue] = useState(todayLocalYmd());
  const [repeatChoice, setRepeatChoice] = useState<RepeatChoice>('');
  const [customDays, setCustomDays] = useState('365');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (reminderToEdit) {
      setTitle(reminderToEdit.title);
      setKind(reminderToEdit.kind);
      setNextDue(reminderToEdit.nextDue || todayLocalYmd());
      if (reminderToEdit.repeatDays === null || reminderToEdit.repeatDays === undefined) {
        setRepeatChoice('');
        setCustomDays('365');
      } else {
        const asStr = String(reminderToEdit.repeatDays);
        if (PRESET_STANDARD_VALUES.has(asStr)) {
          setRepeatChoice(asStr as RepeatChoice);
          setCustomDays('365');
        } else {
          setRepeatChoice('custom');
          setCustomDays(asStr);
        }
      }
    } else {
      setTitle('');
      setKind(subjectKind === 'pet' ? 'feeding' : 'watering');
      setNextDue(todayLocalYmd());
      setRepeatChoice('');
      setCustomDays(subjectKind === 'pet' ? '365' : '5');
    }

    setValidationError(null);
    setSaving(false);
    setSaveError(null);
  }, [isOpen, reminderToEdit, subjectKind]);

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

  const applyPetPreset = () => {
    setTitle('Vaccination');
    setKind('vaccination');
    setRepeatChoice('custom');
    setCustomDays('365');
    setValidationError(null);
  };

  const applyPlantPreset = () => {
    setTitle('Water');
    setKind('watering');
    setRepeatChoice('3');
    setValidationError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setSaveError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setValidationError('Please enter a reminder title.');
      return;
    }

    if (!nextDue) {
      setValidationError('Please pick a due date.');
      return;
    }

    let repeatDays: number | null = null;
    if (repeatChoice === 'custom') {
      const parsed = Number(customDays.trim());
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 730) {
        setValidationError('Custom repeat days must be a whole number from 1 to 730.');
        return;
      }
      repeatDays = parsed;
    } else if (repeatChoice !== '') {
      repeatDays = Number(repeatChoice);
    }

    const payload: CareReminderInput = {
      title: cleanTitle,
      kind,
      nextDue,
      repeatDays,
    };

    setSaving(true);
    try {
      if (reminderToEdit) {
        const updated = await updateCareReminder(reminderToEdit.id, payload);
        onSaved(updated, 'edit');
      } else {
        const created = await createCareReminder(subjectId, payload);
        onSaved(created, 'add');
      }
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save reminder. Please retry.');
    } finally {
      setSaving(false);
    }
  };

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
        aria-label={isEdit ? 'Edit reminder' : `Add reminder for ${subjectName}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold truncate">
              {isEdit ? 'Edit reminder' : 'Add reminder'}
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

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
        >
          {/* Quick Preset */}
          {!isEdit && (
            <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-on-surface-variant">
                Quick preset:
              </span>
              {subjectKind === 'pet' ? (
                <button
                  type="button"
                  onClick={applyPetPreset}
                  className="px-3.5 py-2 min-h-[38px] rounded-full bg-secondary-container/60 hover:bg-secondary-container text-primary text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    vaccines
                  </span>
                  <span>Vaccination every 365 days</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyPlantPreset}
                  className="px-3.5 py-2 min-h-[38px] rounded-full bg-secondary-container/60 hover:bg-secondary-container text-primary text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    water_drop
                  </span>
                  <span>Water every 3 days</span>
                </button>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label
              htmlFor="care-reminder-title"
              className="block font-label-md text-label-md text-on-surface mb-1.5"
            >
              Title <span className="text-error">*</span>
            </label>
            <input
              id="care-reminder-title"
              type="text"
              value={title}
              maxLength={180}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder={
                subjectKind === 'pet'
                  ? 'e.g. Monthly flea chew, Annual vaccination'
                  : 'e.g. Deep watering, Liquid fertilizer'
              }
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Type */}
          <div>
            <span className="block font-label-md text-label-md text-on-surface mb-2">
              Type
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CARE_REMINDER_TYPES.map((opt) => {
                const selected = kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setKind(opt.id)}
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

          {/* First Due Date & Repeat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="care-reminder-due"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                {isEdit ? 'Due date' : 'First due date'}
              </label>
              <input
                id="care-reminder-due"
                type="date"
                value={nextDue}
                onChange={(e) => {
                  setNextDue(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="care-reminder-repeat"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Repeat
              </label>
              <select
                id="care-reminder-repeat"
                value={repeatChoice}
                onChange={(e) => {
                  setRepeatChoice(e.target.value as RepeatChoice);
                  if (validationError) setValidationError(null);
                }}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {STANDARD_REPEAT_OPTIONS.map((opt) => (
                  <option key={opt.value || 'never'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Days (1 to 730) */}
          {repeatChoice === 'custom' && (
            <div>
              <label
                htmlFor="care-reminder-custom-days"
                className="block font-label-md text-label-md text-on-surface mb-1.5"
              >
                Repeat every how many days? (1 to 730)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="care-reminder-custom-days"
                  type="number"
                  min={1}
                  max={730}
                  step={1}
                  inputMode="numeric"
                  value={customDays}
                  onChange={(e) => {
                    setCustomDays(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-low border border-outline-variant/50 text-on-surface text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-on-surface-variant shrink-0">
                  days
                </span>
              </div>
            </div>
          )}

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
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Save reminder'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
