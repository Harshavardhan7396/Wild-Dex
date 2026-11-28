import React, { useState, useEffect, useCallback } from 'react';
import {
  CARE_KIND_META,
  CareEntry,
  CareSubject,
  createCareEntry,
  healthCategoryToCareKind,
  listCareSubjects,
  todayLocalYmd,
} from '../../services/careService';
import type { DetailedHealthResult } from '../health/HealthResultSection';
import { CareSubjectFormModal, CareSubjectPrefill } from './CareSubjectFormModal';

interface SaveHealthToCareModalProps {
  isOpen: boolean;
  healthResult: DetailedHealthResult;
  subjectCategory: string;
  subjectCommonName: string;
  subjectScientificName?: string;
  subjectTaxonId?: number;
  preselectedSubjectId?: string | null;
  symptoms: string[];
  duration: string;
  userNote: string;
  onClose: () => void;
  onSaved: (subject: CareSubject, entry: CareEntry) => void;
}

export const SaveHealthToCareModal: React.FC<SaveHealthToCareModalProps> = ({
  isOpen,
  healthResult,
  subjectCategory,
  subjectCommonName,
  subjectScientificName,
  subjectTaxonId,
  preselectedSubjectId,
  symptoms,
  duration,
  userNote,
  onClose,
  onSaved,
}) => {
  const [subjects, setSubjects] = useState<CareSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listCareSubjects();
      setSubjects(list);
      if (preselectedSubjectId && list.some((s) => s.id === preselectedSubjectId)) {
        setSelectedSubjectId(preselectedSubjectId);
      } else if (list.length > 0) {
        setSelectedSubjectId((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : list[0].id
        );
      } else {
        setSelectedSubjectId('');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load your pets and plants.');
    } finally {
      setLoading(false);
    }
  }, [preselectedSubjectId]);

  useEffect(() => {
    if (!isOpen) return;
    setSaveError(null);
    setSaving(false);
    setCreateOpen(false);
    loadSubjects();
  }, [isOpen, loadSubjects]);

  useEffect(() => {
    if (!isOpen || createOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, createOpen, saving, onClose]);

  if (!isOpen) return null;

  const buildEntryPayload = () => {
    const rawTitle =
      healthResult.mainPossibility?.name?.trim() ||
      `${subjectCommonName.trim() || 'Health'} check`;
    const title = rawTitle.slice(0, 180);

    const noteParts: string[] = [];
    if (symptoms.length > 0) {
      noteParts.push(`Symptoms: ${symptoms.join(', ')}`);
    }
    if (duration.trim()) {
      noteParts.push(`How long: ${duration.trim()}`);
    }
    if (userNote.trim()) {
      noteParts.push(`Note: ${userNote.trim()}`);
    }

    return {
      entryType: 'symptom' as const,
      entryDate: todayLocalYmd(),
      title,
      notes: noteParts.join('\n'),
      value: null,
      unit: '' as const,
      healthResult,
    };
  };

  const saveEntryForSubject = async (targetSubject: CareSubject) => {
    setSaving(true);
    setSaveError(null);
    try {
      const createdEntry = await createCareEntry(
        targetSubject.id,
        buildEntryPayload()
      );
      onSaved(targetSubject, createdEntry);
      onClose();
    } catch (err: any) {
      setSaveError(
        err?.message || 'Could not save this health check to the diary.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    if (saving) return;
    const target = subjects.find((s) => s.id === selectedSubjectId);
    if (!target) {
      setSaveError('Please choose a pet or plant, or create a new one.');
      return;
    }
    await saveEntryForSubject(target);
  };

  const handleNewSubjectSaved = async (saved: CareSubject) => {
    setSubjects((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
    setSelectedSubjectId(saved.id);
    setCreateOpen(false);
    await saveEntryForSubject(saved);
  };

  const prefillForNew: CareSubjectPrefill = {
    kind: healthCategoryToCareKind(subjectCategory),
    speciesCommon: subjectCommonName.trim(),
    speciesScientific: subjectScientificName?.trim() || '',
    inatTaxonId: subjectTaxonId ?? null,
  };

  const entryTitlePreview =
    healthResult.mainPossibility?.name?.trim() ||
    `${subjectCommonName.trim() || 'Health'} check`;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={() => {
          if (!saving) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Save to care diary"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[90dvh] bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold truncate">
                Save to care diary
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                {entryTitlePreview}
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <p className="font-body-sm text-sm text-on-surface-variant">
              Which pet or plant should we save this health check under?
            </p>

            {/* Loading Skeleton */}
            {loading && (
              <div className="space-y-2.5 animate-pulse" aria-label="Loading your pets and plants">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="h-16 rounded-2xl bg-surface-container-low border border-outline-variant/20"
                  />
                ))}
              </div>
            )}

            {/* Load Error */}
            {!loading && loadError && (
              <div className="p-4 rounded-2xl bg-error-container/25 border border-error/30 text-center space-y-2.5">
                <p className="text-xs text-on-error-container font-medium">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={loadSubjects}
                  className="px-4 py-1.5 min-h-[36px] rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Subject Picker List */}
            {!loading && !loadError && (
              <div className="space-y-2">
                {subjects.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-2">
                    <span
                      className="material-symbols-outlined text-[28px] text-primary"
                      aria-hidden="true"
                    >
                      pets
                    </span>
                    <p className="text-sm font-medium text-on-surface">
                      You have not added any pets or plants yet.
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Create one below with {subjectCommonName} prefilled.
                    </p>
                  </div>
                ) : (
                  subjects.map((subj) => {
                    const meta = CARE_KIND_META[subj.kind];
                    const selected = selectedSubjectId === subj.id;
                    const speciesLabel =
                      subj.speciesCommon || subj.speciesScientific || meta.label;
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setSelectedSubjectId(subj.id);
                          setSaveError(null);
                        }}
                        aria-pressed={selected}
                        className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all min-h-[60px] ${
                          selected
                            ? 'bg-secondary-container/45 border-primary ring-1 ring-primary shadow-sm'
                            : 'bg-surface-container-low border-outline-variant/30 hover:bg-surface-container'
                        }`}
                      >
                        {subj.photoUrl ? (
                          <img
                            src={subj.photoUrl}
                            alt={subj.name}
                            className="w-11 h-11 rounded-xl object-cover shrink-0 bg-surface-container"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-secondary-container/50 text-primary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[22px]">
                              {meta.icon}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-label-lg text-sm font-bold text-on-surface truncate">
                            {subj.name}
                          </p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {meta.label} · {speciesLabel}
                          </p>
                        </div>
                        <span
                          className={`material-symbols-outlined text-[20px] shrink-0 ${
                            selected ? 'text-primary' : 'text-outline-variant'
                          }`}
                        >
                          {selected ? 'radio_button_checked' : 'radio_button_unchecked'}
                        </span>
                      </button>
                    );
                  })
                )}

                {/* Create New Subject Action */}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setCreateOpen(true)}
                  className="w-full p-3 rounded-2xl border-2 border-dashed border-primary/40 text-primary hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 min-h-[52px] font-label-md text-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  <span>Create new</span>
                </button>
              </div>
            )}

            {saveError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 flex items-center justify-between gap-2">
                <span className="text-xs text-on-error-container font-medium">
                  {saveError}
                </span>
                {selectedSubjectId && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleConfirmSave}
                    className="px-3 py-1 rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40 shrink-0"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3.5 border-t border-outline-variant/25 bg-surface-container-low/70 flex items-center justify-end gap-2.5 shrink-0 pb-safe">
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
              disabled={saving || loading || !selectedSubjectId}
              onClick={handleConfirmSave}
              className="px-6 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 disabled:opacity-55 inline-flex items-center gap-2"
            >
              {saving && (
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
              )}
              <span>{saving ? 'Saving...' : 'Save to diary'}</span>
            </button>
          </div>
        </div>
      </div>

      <CareSubjectFormModal
        isOpen={createOpen}
        subjectToEdit={null}
        prefill={prefillForNew}
        onClose={() => setCreateOpen(false)}
        onSaved={(saved) => handleNewSubjectSaved(saved)}
      />
    </>
  );
};
