import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { CareSubjectFormModal } from '../components/care/CareSubjectFormModal';
import {
  CARE_KIND_META,
  CareKind,
  CareSubject,
  archiveCareSubject,
  deleteCareSubject,
  formatCareAge,
  listCareSubjects,
} from '../services/careService';

type CareFilter = 'all' | CareKind;

const FILTER_OPTIONS: { id: CareFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pet', label: 'Pets' },
  { id: 'plant', label: 'Plants' },
  { id: 'crop', label: 'Crops' },
  { id: 'tree', label: 'Trees' },
];

export const CarePage: React.FC = () => {
  const { currentUser } = useAuth();

  const [subjects, setSubjects] = useState<CareSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CareFilter>('all');

  // Add / Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<CareSubject | null>(null);

  // Archive & Delete confirmation state
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<CareSubject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Broken image fallback tracking by subject id
  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadSubjects = useCallback(async () => {
    if (!currentUser) {
      setSubjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const items = await listCareSubjects();
      setSubjects(items);
      setBrokenPhotoIds({});
    } catch (err: any) {
      setError(err?.message || 'Could not load your care list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  // Close delete confirm dialog on Escape
  useEffect(() => {
    if (!subjectToDelete) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        setSubjectToDelete(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [subjectToDelete, deleting]);

  const filteredSubjects = useMemo(() => {
    if (filter === 'all') return subjects;
    return subjects.filter((item) => item.kind === filter);
  }, [subjects, filter]);

  const countsByKind = useMemo(() => {
    const counts: Record<CareFilter, number> = {
      all: subjects.length,
      pet: 0,
      plant: 0,
      crop: 0,
      tree: 0,
    };
    for (const item of subjects) {
      counts[item.kind] += 1;
    }
    return counts;
  }, [subjects]);

  const handleOpenAdd = () => {
    setSubjectToEdit(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (subject: CareSubject) => {
    setSubjectToEdit(subject);
    setFormOpen(true);
  };

  const handleFormSaved = (saved: CareSubject, mode: 'add' | 'edit') => {
    if (mode === 'add') {
      setSubjects((prev) => [saved, ...prev]);
      showToast(`Added ${saved.name} to My Care.`);
    } else {
      setSubjects((prev) =>
        prev.map((item) => (item.id === saved.id ? saved : item))
      );
      setBrokenPhotoIds((prev) => {
        const next = { ...prev };
        delete next[saved.id];
        return next;
      });
      showToast(`Updated ${saved.name}.`);
    }
  };

  const handleArchive = async (subject: CareSubject) => {
    if (archivingId) return;
    setArchivingId(subject.id);
    try {
      await archiveCareSubject(subject.id);
      setSubjects((prev) => prev.filter((item) => item.id !== subject.id));
      showToast(`Archived ${subject.name}.`);
    } catch (err: any) {
      showToast(err?.message || `Could not archive ${subject.name}.`);
    } finally {
      setArchivingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCareSubject(subjectToDelete);
      const removedName = subjectToDelete.name;
      setSubjects((prev) => prev.filter((item) => item.id !== subjectToDelete.id));
      setSubjectToDelete(null);
      showToast(`Deleted ${removedName}.`);
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete right now. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to open My Care"
          description="Keep a care diary for your pets, plants, crops, and trees. Sign in or create a free account to get started."
          icon="yard"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-headline-sm text-headline-sm text-primary font-bold">
            My Care
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Track your pets, plants, crops, and trees in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          <span>Add pet or plant</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter care entries"
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.id;
          const count = countsByKind[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(opt.id)}
              className={`px-3.5 py-2 min-h-[38px] rounded-full font-label-md text-label-md transition-colors inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
              }`}
            >
              <span>{opt.label}</span>
              {!loading && subjects.length > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    active
                      ? 'bg-on-primary/20 text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-pulse"
          aria-label="Loading My Care"
        >
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-[72px] h-[72px] rounded-2xl bg-surface-container-high shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-28 rounded bg-surface-container-high" />
                  <div className="h-3.5 w-36 rounded bg-surface-container-high" />
                  <div className="h-3 w-24 rounded bg-surface-container-high" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-9 flex-1 rounded-full bg-surface-container-high" />
                <div className="h-9 flex-1 rounded-full bg-surface-container-high" />
                <div className="h-9 flex-1 rounded-full bg-surface-container-high" />
              </div>
            </div>
          ))}
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
          <button
            type="button"
            onClick={loadSubjects}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State (No entries yet) */}
      {!loading && !error && subjects.length === 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3.5">
          <div className="w-16 h-16 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[34px]" aria-hidden="true">
              yard
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface font-medium max-w-sm">
            Add your first pet or plant to start a care diary
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-1 px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add
            </span>
            <span>Add pet or plant</span>
          </button>
        </div>
      )}

      {/* Filtered Empty State */}
      {!loading && !error && subjects.length > 0 && filteredSubjects.length === 0 && (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center flex flex-col items-center gap-3">
          <p className="font-body-md text-body-md text-on-surface-variant">
            No {FILTER_OPTIONS.find((f) => f.id === filter)?.label.toLowerCase()} added yet.
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="px-4 py-2 min-h-[40px] rounded-full bg-surface border border-outline-variant/40 text-primary font-label-md font-semibold"
          >
            Show all
          </button>
        </div>
      )}

      {/* Subject Cards */}
      {!loading && !error && filteredSubjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSubjects.map((subject) => {
            const meta = CARE_KIND_META[subject.kind];
            const ageText = formatCareAge(subject.kind, subject.startedOn);
            const speciesText =
              subject.speciesCommon || subject.speciesScientific || '';
            const showPhoto = Boolean(subject.photoUrl) && !brokenPhotoIds[subject.id];
            const isArchiving = archivingId === subject.id;

            return (
              <article
                key={subject.id}
                className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm flex flex-col justify-between gap-3 min-w-0"
              >
                <Link
                  to={`/care/${subject.id}`}
                  className="block space-y-3 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Photo or Kind Icon */}
                    {showPhoto ? (
                      <img
                        src={subject.photoUrl}
                        alt={subject.name}
                        onError={() =>
                          setBrokenPhotoIds((prev) => ({ ...prev, [subject.id]: true }))
                        }
                        className="w-[72px] h-[72px] rounded-2xl object-cover shrink-0 bg-surface-container"
                      />
                    ) : (
                      <div
                        className="w-[72px] h-[72px] rounded-2xl bg-secondary-container/40 text-primary flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined text-[32px]">
                          {meta.icon}
                        </span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <h2 className="font-headline-sm text-[17px] leading-snug text-on-surface group-hover:text-primary font-bold truncate transition-colors">
                          {subject.name}
                        </h2>
                        {subject.hasDueReminder && (
                          <span
                            className="w-2.5 h-2.5 rounded-full bg-error shrink-0 ring-2 ring-error/20"
                            title="Reminder due or overdue"
                            aria-label="Reminder due or overdue"
                          />
                        )}
                      </div>

                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                        {speciesText || meta.label}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-on-surface-variant">
                        {speciesText && (
                          <span className="font-medium text-secondary">{meta.label}</span>
                        )}
                        {ageText && (
                          <span>
                            {speciesText ? `· ${ageText}` : ageText}
                          </span>
                        )}
                        {subject.kind === 'pet' &&
                          subject.sex &&
                          subject.sex !== 'unknown' && (
                            <span className="capitalize">· {subject.sex}</span>
                          )}
                      </div>
                    </div>
                  </div>

                  {subject.notes && (
                    <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 break-words">
                      {subject.notes}
                    </p>
                  )}
                </Link>

                {/* Card Actions */}
                <div className="pt-2 border-t border-outline-variant/20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(subject)}
                    className="flex-1 min-h-[40px] px-2.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      edit
                    </span>
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    disabled={isArchiving}
                    onClick={() => handleArchive(subject)}
                    className="flex-1 min-h-[40px] px-2.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-sm text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      archive
                    </span>
                    <span>{isArchiving ? 'Saving...' : 'Archive'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setSubjectToDelete(subject);
                    }}
                    className="flex-1 min-h-[40px] px-2.5 rounded-full bg-error-container/20 hover:bg-error-container/35 text-error font-label-sm text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      delete
                    </span>
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 3-Step Add / Edit Modal */}
      <CareSubjectFormModal
        isOpen={formOpen}
        subjectToEdit={subjectToEdit}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
      />

      {/* Delete Confirmation Dialog */}
      {subjectToDelete && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!deleting) {
              setSubjectToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Delete ${subjectToDelete.name}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl border border-outline-variant/30 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  delete_forever
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Delete {subjectToDelete.name}?
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  This will remove {subjectToDelete.name} and any saved photos from your care diary.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setSubjectToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {deleting && (
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                )}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-xs shadow-lg max-w-[90vw] truncate"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
