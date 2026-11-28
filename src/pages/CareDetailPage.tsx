import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { CareSubjectFormModal } from '../components/care/CareSubjectFormModal';
import { CareEntryFormModal } from '../components/care/CareEntryFormModal';
import { CareReminderFormModal } from '../components/care/CareReminderFormModal';
import { WeightTrendChart } from '../components/care/WeightTrendChart';
import { GrowthGalleryView } from '../components/care/GrowthGalleryView';
import { HealthResultSection } from '../components/health/HealthResultSection';
import {
  CARE_ENTRIES_PAGE_SIZE,
  CARE_KIND_META,
  CARE_REMINDERS_REFRESH_EVENT,
  CareEntry,
  CareReminder,
  CareSubject,
  archiveCareSubject,
  careKindToHealthCategory,
  completeCareReminder,
  deleteCareEntry,
  deleteCareReminder,
  deleteCareSubject,
  formatCareAge,
  formatEntryDate,
  formatMonthHeading,
  getCareSubjectById,
  getEntryTypeMeta,
  getReminderStatus,
  getReminderTypeMeta,
  listCareEntriesByType,
  listCareEntriesPage,
  listCareReminders,
  snoozeCareReminder,
} from '../services/careService';

type DetailTab = 'timeline' | 'reminders' | 'details';
type TimelineMode = 'list' | 'gallery';

function sortEntriesNewestFirst(list: CareEntry[]): CareEntry[] {
  return [...list].sort((a, b) => {
    if (a.entryDate !== b.entryDate) {
      return a.entryDate < b.entryDate ? 1 : -1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function sortRemindersByDue(list: CareReminder[]): CareReminder[] {
  return [...list].sort((a, b) => {
    if (a.nextDue !== b.nextDue) {
      return a.nextDue < b.nextDue ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function isReminderDueOrOverdue(reminder: CareReminder): boolean {
  if (!reminder.active) return false;
  const { status } = getReminderStatus(reminder.nextDue);
  return status === 'overdue' || status === 'today';
}

export const CareDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [subject, setSubject] = useState<CareSubject | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(true);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectPhotoBroken, setSubjectPhotoBroken] = useState(false);

  const [activeTab, setActiveTab] = useState<DetailTab>('timeline');
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('list');

  // Timeline entries (paginated, 20 per page)
  const [entries, setEntries] = useState<CareEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesPage, setEntriesPage] = useState(0);
  const [hasMoreEntries, setHasMoreEntries] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Specialized type histories (complete lists for chart & gallery)
  const [weightEntries, setWeightEntries] = useState<CareEntry[]>([]);
  const [growthEntries, setGrowthEntries] = useState<CareEntry[]>([]);

  // Reminders state
  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState<CareReminder | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<CareReminder | null>(null);
  const [deletingReminder, setDeletingReminder] = useState(false);
  const [deleteReminderError, setDeleteReminderError] = useState<string | null>(null);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);
  const [reminderActionError, setReminderActionError] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);

  // Modals & Lightbox
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<CareEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<CareEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

  const [subjectToDelete, setSubjectToDelete] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(false);
  const [deleteSubjectError, setDeleteSubjectError] = useState<string | null>(null);
  const [archivingSubject, setArchivingSubject] = useState(false);

  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [healthResultModalEntry, setHealthResultModalEntry] =
    useState<CareEntry | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadSpecialHistories = useCallback(
    async (subjectId: string, kind: CareSubject['kind']) => {
      try {
        if (kind === 'pet') {
          const weights = await listCareEntriesByType(subjectId, 'weight');
          setWeightEntries(weights);
          setGrowthEntries([]);
        } else {
          const growths = await listCareEntriesByType(subjectId, 'growth_photo');
          setGrowthEntries(growths);
          setWeightEntries([]);
        }
      } catch {
        // Non-blocking: timeline still renders cleanly
      }
    },
    []
  );

  const loadTimeline = useCallback(
    async (subjectId: string) => {
      setEntriesLoading(true);
      setEntriesError(null);
      setLoadMoreError(null);
      try {
        const res = await listCareEntriesPage(subjectId, 0, CARE_ENTRIES_PAGE_SIZE);
        setEntries(res.entries);
        setHasMoreEntries(res.hasMore);
        setEntriesPage(0);
      } catch (err: any) {
        setEntriesError(
          err?.message || 'Could not load diary entries. Please try again.'
        );
      } finally {
        setEntriesLoading(false);
      }
    },
    []
  );

  const loadReminders = useCallback(async (subjectId: string) => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const list = sortRemindersByDue(await listCareReminders(subjectId));
      setReminders(list);
      const anyDue = list.some(isReminderDueOrOverdue);
      setSubject((prev) => (prev ? { ...prev, hasDueReminder: anyDue } : prev));
    } catch (err: any) {
      setRemindersError(err?.message || 'Could not load reminders.');
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!currentUser || !id) {
      setSubjectLoading(false);
      return;
    }

    setSubjectLoading(true);
    setSubjectError(null);
    setSubjectPhotoBroken(false);

    try {
      const found = await getCareSubjectById(id);
      setSubject(found);
      if (found) {
        await Promise.all([
          loadTimeline(found.id),
          loadSpecialHistories(found.id, found.kind),
          loadReminders(found.id).catch(() => {}),
        ]);
      }
    } catch (err: any) {
      setSubjectError(err?.message || 'Could not load this care diary.');
    } finally {
      setSubjectLoading(false);
    }
  }, [currentUser?.id, id, loadTimeline, loadSpecialHistories, loadReminders]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!subject?.id) return;
    const handleRefresh = () => {
      loadReminders(subject.id).catch(() => {});
    };
    window.addEventListener(CARE_REMINDERS_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(CARE_REMINDERS_REFRESH_EVENT, handleRefresh);
    };
  }, [subject?.id, loadReminders]);

  // Escape key closes lightbox or stored health result viewer
  useEffect(() => {
    if (!lightboxPhoto && !healthResultModalEntry) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (healthResultModalEntry) {
          setHealthResultModalEntry(null);
        } else if (lightboxPhoto) {
          setLightboxPhoto(null);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxPhoto, healthResultModalEntry]);

  const handleLoadMore = async () => {
    if (!subject || loadingMore || !hasMoreEntries) return;
    const nextPage = entriesPage + 1;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await listCareEntriesPage(
        subject.id,
        nextPage,
        CARE_ENTRIES_PAGE_SIZE
      );
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const merged = [...prev, ...res.entries.filter((e) => !seen.has(e.id))];
        return sortEntriesNewestFirst(merged);
      });
      setHasMoreEntries(res.hasMore);
      setEntriesPage(nextPage);
    } catch (err: any) {
      setLoadMoreError(err?.message || 'Could not load older entries.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleEntrySaved = async (saved: CareEntry, mode: 'add' | 'edit') => {
    if (mode === 'add') {
      setEntries((prev) => sortEntriesNewestFirst([saved, ...prev]));
      showToast('Diary entry added.');
    } else {
      setEntries((prev) =>
        sortEntriesNewestFirst(
          prev.map((item) => (item.id === saved.id ? saved : item))
        )
      );
      showToast('Diary entry updated.');
    }

    if (subject) {
      await loadSpecialHistories(subject.id, subject.kind);
    }
  };

  const handleConfirmDeleteEntry = async () => {
    if (!entryToDelete || deletingEntry) return;
    setDeletingEntry(true);
    setDeleteEntryError(null);
    try {
      await deleteCareEntry(entryToDelete);
      const removedId = entryToDelete.id;
      setEntries((prev) => prev.filter((item) => item.id !== removedId));
      setWeightEntries((prev) => prev.filter((item) => item.id !== removedId));
      setGrowthEntries((prev) => prev.filter((item) => item.id !== removedId));
      setEntryToDelete(null);
      showToast('Entry deleted.');
    } catch (err: any) {
      setDeleteEntryError(
        err?.message || 'Could not delete entry. Please try again.'
      );
    } finally {
      setDeletingEntry(false);
    }
  };

  const handleSubjectSaved = (updated: CareSubject) => {
    setSubject(updated);
    setSubjectPhotoBroken(false);
    showToast(`Updated ${updated.name}.`);
    loadSpecialHistories(updated.id, updated.kind);
  };

  const handleArchiveSubject = async () => {
    if (!subject || archivingSubject) return;
    setArchivingSubject(true);
    try {
      await archiveCareSubject(subject.id);
      navigate('/care', { replace: true });
    } catch (err: any) {
      showToast(err?.message || 'Could not archive right now.');
    } finally {
      setArchivingSubject(false);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!subject || deletingSubject) return;
    setDeletingSubject(true);
    setDeleteSubjectError(null);
    try {
      await deleteCareSubject(subject);
      navigate('/care', { replace: true });
    } catch (err: any) {
      setDeleteSubjectError(
        err?.message || 'Could not delete right now. Please try again.'
      );
    } finally {
      setDeletingSubject(false);
    }
  };

  const handleReminderSaved = (saved: CareReminder, mode: 'add' | 'edit') => {
    setReminderActionError(null);
    setReminders((prev) => {
      const next =
        mode === 'add'
          ? sortRemindersByDue([...prev, saved])
          : sortRemindersByDue(prev.map((r) => (r.id === saved.id ? saved : r)));
      setSubject((curr) =>
        curr ? { ...curr, hasDueReminder: next.some(isReminderDueOrOverdue) } : curr
      );
      return next;
    });
    showToast(mode === 'add' ? 'Reminder added.' : 'Reminder updated.');
  };

  const handleCompleteReminder = async (reminder: CareReminder) => {
    if (!subject || busyReminderId) return;
    setBusyReminderId(reminder.id);
    setReminderActionError(null);
    try {
      await completeCareReminder(reminder.id);
      await Promise.all([
        loadReminders(subject.id),
        loadTimeline(subject.id),
        loadSpecialHistories(subject.id, subject.kind),
      ]);
      showToast(
        reminder.repeatDays
          ? `Done! Logged "${reminder.title}" and scheduled next reminder.`
          : `Done! Logged "${reminder.title}" to diary.`
      );
    } catch (err: any) {
      setReminderActionError({
        message: err?.message || 'Could not mark reminder done.',
        retry: () => handleCompleteReminder(reminder),
      });
    } finally {
      setBusyReminderId(null);
    }
  };

  const handleSnoozeReminder = async (reminder: CareReminder) => {
    if (!subject || busyReminderId) return;
    setBusyReminderId(reminder.id);
    setReminderActionError(null);
    try {
      const updated = await snoozeCareReminder(reminder, 1);
      setReminders((prev) => {
        const next = sortRemindersByDue(
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
        setSubject((curr) =>
          curr ? { ...curr, hasDueReminder: next.some(isReminderDueOrOverdue) } : curr
        );
        return next;
      });
      showToast(`Snoozed "${reminder.title}" by 1 day.`);
    } catch (err: any) {
      setReminderActionError({
        message: err?.message || 'Could not snooze reminder.',
        retry: () => handleSnoozeReminder(reminder),
      });
    } finally {
      setBusyReminderId(null);
    }
  };

  const handleConfirmDeleteReminder = async () => {
    if (!reminderToDelete || deletingReminder) return;
    setDeletingReminder(true);
    setDeleteReminderError(null);
    try {
      await deleteCareReminder(reminderToDelete.id);
      const removedId = reminderToDelete.id;
      setReminders((prev) => {
        const next = prev.filter((r) => r.id !== removedId);
        setSubject((curr) =>
          curr ? { ...curr, hasDueReminder: next.some(isReminderDueOrOverdue) } : curr
        );
        return next;
      });
      setReminderToDelete(null);
      showToast('Reminder deleted.');
    } catch (err: any) {
      setDeleteReminderError(
        err?.message || 'Could not delete reminder. Please try again.'
      );
    } finally {
      setDeletingReminder(false);
    }
  };

  const handleExportDiary = () => {
    try {
      window.print();
    } catch {
      showToast('Could not open print dialog.');
    }
  };

  // Group timeline entries by month preserving newest-first order
  const groupedEntries = useMemo(() => {
    const groups: { month: string; items: CareEntry[] }[] = [];
    for (const entry of entries) {
      const month = formatMonthHeading(entry.entryDate);
      const last = groups[groups.length - 1];
      if (last && last.month === month) {
        last.items.push(entry);
      } else {
        groups.push({ month, items: [entry] });
      }
    }
    return groups;
  }, [entries]);

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to view this care diary"
          description="Care diaries are private to your account. Sign in to view or add entries."
          icon="lock"
        />
      </div>
    );
  }

  if (subjectLoading) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-3 space-y-4 animate-pulse">
        <div className="h-5 w-28 rounded bg-surface-container-high" />
        <div className="p-4 rounded-3xl bg-surface-container-low flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-surface-container-high shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 rounded bg-surface-container-high" />
            <div className="h-4 w-32 rounded bg-surface-container-high" />
            <div className="h-3.5 w-24 rounded bg-surface-container-high" />
          </div>
        </div>
        <div className="h-11 w-full rounded-2xl bg-surface-container-high" />
        <div className="h-32 w-full rounded-2xl bg-surface-container-high" />
      </div>
    );
  }

  if (subjectError) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4 space-y-4">
        <Link
          to="/care"
          className="inline-flex items-center gap-1.5 text-primary font-label-md font-semibold w-fit"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to My Care</span>
        </Link>
        <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-error">
            error_outline
          </span>
          <p className="font-body-md text-on-surface font-medium">{subjectError}</p>
          <button
            type="button"
            onClick={loadAll}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4 space-y-4">
        <Link
          to="/care"
          className="inline-flex items-center gap-1.5 text-primary font-label-md font-semibold w-fit"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to My Care</span>
        </Link>
        <div className="p-8 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center space-y-3">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
            yard
          </span>
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Care diary not found
          </h1>
          <p className="text-sm text-on-surface-variant">
            It may have been deleted or belongs to a different account.
          </p>
          <Link
            to="/care"
            className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold"
          >
            Go to My Care
          </Link>
        </div>
      </div>
    );
  }

  const meta = CARE_KIND_META[subject.kind];
  const ageText = formatCareAge(subject.kind, subject.startedOn);
  const speciesLabel = subject.speciesCommon || subject.speciesScientific || '';
  const showSubjectPhoto = Boolean(subject.photoUrl) && !subjectPhotoBroken;

  return (
    <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-24 pt-2 space-y-4">
      {/* Top Bar: Back + Privacy Note + Export Diary */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <Link
          to="/care"
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] -ml-2 rounded-full text-primary hover:bg-surface-container font-label-md text-sm font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>My Care</span>
        </Link>

        <button
          type="button"
          onClick={handleExportDiary}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-label-md text-xs font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
            print
          </span>
          <span>Export diary</span>
        </button>
      </div>

      {/* Private Diary Notice */}
      <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px] text-primary shrink-0" aria-hidden="true">
          lock
        </span>
        <span>This diary is private. Only you can see it.</span>
      </div>

      {/* Subject Header Card */}
      <section className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm print-avoid-break">
        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
          {showSubjectPhoto ? (
            <button
              type="button"
              onClick={() =>
                setLightboxPhoto({
                  url: subject.photoUrl,
                  title: subject.name,
                  subtitle: speciesLabel || meta.label,
                })
              }
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`View photo of ${subject.name}`}
            >
              <img
                src={subject.photoUrl}
                alt={subject.name}
                onError={() => setSubjectPhotoBroken(true)}
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[38px]">
                {meta.icon}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="font-headline-md text-xl sm:text-headline-md text-on-surface font-bold truncate">
                    {subject.name}
                  </h1>
                  {subject.hasDueReminder && (
                    <span
                      className="w-2.5 h-2.5 rounded-full bg-error shrink-0 no-print"
                      title="Reminder due or overdue"
                      aria-label="Reminder due or overdue"
                    />
                  )}
                </div>

                <p className="font-body-md text-sm text-on-surface-variant truncate mt-0.5">
                  {speciesLabel || meta.label}
                </p>
                {subject.speciesScientific &&
                  subject.speciesCommon &&
                  subject.speciesScientific.toLowerCase() !==
                    subject.speciesCommon.toLowerCase() && (
                    <p className="text-xs italic text-on-surface-variant/85 truncate">
                      {subject.speciesScientific}
                    </p>
                  )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-on-surface-variant">
                  <span className="font-semibold text-secondary">{meta.label}</span>
                  {ageText && <span>· {ageText}</span>}
                  {subject.kind === 'pet' &&
                    subject.sex &&
                    subject.sex !== 'unknown' && (
                      <span className="capitalize">· {subject.sex}</span>
                    )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditSubjectOpen(true)}
                className="no-print inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-label-md text-xs font-semibold shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  edit
                </span>
                <span>Edit</span>
              </button>
            </div>
          </div>
        </div>

        {subject.kind === 'pet' && (
          <div className="no-print mt-3.5 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/safety/pet-poison-foods"
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-full bg-error-container/45 hover:bg-error-container/70 text-on-error-container border border-error/30 font-label-md text-xs font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-[17px] text-error" aria-hidden="true">
                health_and_safety
              </span>
              <span>Foods dangerous for pets</span>
            </Link>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Care diary sections"
        className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/25 no-print"
      >
        {(
          [
            { id: 'timeline', label: 'Timeline' },
            { id: 'reminders', label: 'Reminders' },
            { id: 'details', label: 'Details' },
          ] as { id: DetailTab; label: string }[]
        ).map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-2 min-h-[42px] rounded-xl font-label-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                selected
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'reminders' && subject.hasDueReminder && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    selected ? 'bg-error-container' : 'bg-error'
                  }`}
                  aria-label="Due reminder"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-4 no-print">
          {/* Weight Line Chart (Pets or any weight entries) */}
          {weightEntries.length > 0 && (
            <WeightTrendChart entries={weightEntries} />
          )}

          {/* Growth Gallery View Toggle (when Growth photo entries exist) */}
          {growthEntries.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setTimelineMode('list')}
                  className={`px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-semibold transition-colors ${
                    timelineMode === 'list'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  All entries
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineMode('gallery')}
                  className={`px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-1 ${
                    timelineMode === 'gallery'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    compare
                  </span>
                  <span>Growth gallery</span>
                </button>
              </div>
            </div>
          )}

          {timelineMode === 'gallery' && growthEntries.length > 0 ? (
            <GrowthGalleryView
              entries={growthEntries}
              onEnlargePhoto={(entry) =>
                setLightboxPhoto({
                  url: entry.photoUrl,
                  title: entry.title,
                  subtitle: formatEntryDate(entry.entryDate),
                })
              }
            />
          ) : (
            <>
              {/* Timeline Loading Skeletons */}
              {entriesLoading && (
                <div className="space-y-3 animate-pulse" aria-label="Loading entries">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 w-40 rounded bg-surface-container-high" />
                          <div className="h-3 w-24 rounded bg-surface-container-high" />
                        </div>
                      </div>
                      <div className="h-3.5 w-full rounded bg-surface-container-high" />
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline Error */}
              {!entriesLoading && entriesError && (
                <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[30px] text-error">
                    error_outline
                  </span>
                  <p className="text-sm text-on-surface font-medium">
                    {entriesError}
                  </p>
                  <button
                    type="button"
                    onClick={() => loadTimeline(subject.id)}
                    className="px-5 py-2 min-h-[40px] rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Timeline Empty State */}
              {!entriesLoading && !entriesError && entries.length === 0 && (
                <div className="p-7 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[30px]" aria-hidden="true">
                      edit_note
                    </span>
                  </div>
                  <p className="font-body-md text-sm text-on-surface font-medium max-w-xs">
                    No care entries yet for {subject.name}. Tap "Add entry" to log your first update.
                  </p>
                </div>
              )}

              {/* Grouped by Month Timeline */}
              {!entriesLoading && !entriesError && groupedEntries.length > 0 && (
                <div className="space-y-5">
                  {groupedEntries.map((group) => (
                    <div key={group.month} className="space-y-2.5">
                      <h2 className="font-label-md text-xs uppercase tracking-wider text-on-surface-variant font-bold px-1">
                        {group.month}
                      </h2>

                      <div className="space-y-2.5">
                        {group.items.map((entry) => {
                          const tMeta = getEntryTypeMeta(
                            subject.kind,
                            entry.entryType
                          );
                          return (
                            <article
                              key={entry.id}
                              className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2.5 min-w-0">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div
                                    className="w-10 h-10 rounded-xl bg-secondary-container/45 text-primary flex items-center justify-center shrink-0 mt-0.5"
                                    aria-hidden="true"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">
                                      {tMeta.icon}
                                    </span>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <h3 className="font-label-lg text-[15px] font-bold text-on-surface break-words">
                                        {entry.title}
                                      </h3>
                                      {entry.value !== null && entry.unit && (
                                        <span className="px-2 py-0.5 rounded-full bg-secondary-container/50 text-primary text-[11px] font-semibold">
                                          {entry.value} {entry.unit}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-on-surface-variant mt-0.5">
                                      {tMeta.label} · {formatEntryDate(entry.entryDate)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    aria-label={`Edit ${entry.title}`}
                                    onClick={() => {
                                      setEntryToEdit(entry);
                                      setEntryFormOpen(true);
                                    }}
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      edit
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete ${entry.title}`}
                                    onClick={() => {
                                      setDeleteEntryError(null);
                                      setEntryToDelete(entry);
                                    }}
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container/25 hover:text-error"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      delete
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {entry.notes && (
                                <p className="font-body-sm text-sm text-on-surface/90 whitespace-pre-line break-words pl-[52px]">
                                  {entry.notes}
                                </p>
                              )}

                              {entry.photoUrl && (
                                <div className="pl-[52px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxPhoto({
                                        url: entry.photoUrl,
                                        title: entry.title,
                                        subtitle: `${tMeta.label} · ${formatEntryDate(
                                          entry.entryDate
                                        )}`,
                                      })
                                    }
                                    className="group relative rounded-2xl overflow-hidden border border-outline-variant/25 bg-surface-container block max-w-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    aria-label={`Enlarge photo for ${entry.title}`}
                                  >
                                    <img
                                      src={entry.photoUrl}
                                      alt={entry.title}
                                      className="w-full max-h-56 object-cover group-hover:scale-[1.02] transition-transform"
                                    />
                                  </button>
                                </div>
                              )}

                              {entry.healthResult && (
                                <div className="pl-[52px] pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setHealthResultModalEntry(entry)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full bg-secondary-container/60 hover:bg-secondary-container text-on-secondary-container font-label-md text-xs font-semibold transition-colors"
                                  >
                                    <span
                                      className="material-symbols-outlined text-[17px]"
                                      aria-hidden="true"
                                    >
                                      stethoscope
                                    </span>
                                    <span>View health result</span>
                                  </button>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Load More Error */}
                  {loadMoreError && (
                    <div className="p-3 rounded-xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-2">
                      <span className="text-xs text-on-error-container">
                        {loadMoreError}
                      </span>
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        className="px-3 py-1 rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Load More Button */}
                  {hasMoreEntries && (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        disabled={loadingMore}
                        onClick={handleLoadMore}
                        className="px-6 py-2.5 min-h-[44px] rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-primary font-label-md text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        {loadingMore && (
                          <span className="material-symbols-outlined text-[18px] animate-spin">
                            progress_activity
                          </span>
                        )}
                        <span>{loadingMore ? 'Loading...' : 'Load more'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="space-y-4 no-print">
          {/* Header Row + Add Reminder Button */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                Active reminders
              </h2>
              <p className="text-xs text-on-surface-variant">
                Sorted by next due date
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReminderToEdit(null);
                setReminderFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-xs sm:text-sm font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add_alarm
              </span>
              <span>Add reminder</span>
            </button>
          </div>

          {/* Required In-App Notification Notice */}
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface-variant">
            <span
              className="material-symbols-outlined text-[17px] text-primary shrink-0 mt-0.5"
              aria-hidden="true"
            >
              notifications_active
            </span>
            <span>
              Reminders show when you open WildDex. Notifications are coming later.
            </span>
          </div>

          {/* Action Error Banner with Retry */}
          {reminderActionError && (
            <div className="p-3.5 rounded-2xl bg-error-container/25 border border-error/35 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="material-symbols-outlined text-[18px] text-error shrink-0">
                  error_outline
                </span>
                <span className="text-xs text-on-error-container font-medium">
                  {reminderActionError.message}
                </span>
              </div>
              {reminderActionError.retry && (
                <button
                  type="button"
                  onClick={reminderActionError.retry}
                  className="px-3.5 py-1.5 min-h-[36px] rounded-full bg-surface text-primary text-xs font-semibold border border-outline-variant/40 shrink-0"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Reminders Loading Skeletons */}
          {remindersLoading && (
            <div className="space-y-3 animate-pulse" aria-label="Loading reminders">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-40 rounded bg-surface-container-high" />
                        <div className="h-3 w-28 rounded bg-surface-container-high" />
                      </div>
                    </div>
                    <div className="h-6 w-16 rounded-full bg-surface-container-high" />
                  </div>
                  <div className="h-9 w-full rounded-full bg-surface-container-high" />
                </div>
              ))}
            </div>
          )}

          {/* Reminders Load Error with Retry */}
          {!remindersLoading && remindersError && (
            <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[30px] text-error">
                error_outline
              </span>
              <p className="text-sm text-on-surface font-medium">{remindersError}</p>
              <button
                type="button"
                onClick={() => loadReminders(subject.id)}
                className="px-5 py-2 min-h-[42px] rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm"
              >
                Retry
              </button>
            </div>
          )}

          {/* Reminders Empty State */}
          {!remindersLoading && !remindersError && reminders.length === 0 && (
            <div className="p-7 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[30px]" aria-hidden="true">
                  alarm
                </span>
              </div>
              <div className="space-y-1 max-w-xs">
                <p className="font-label-lg text-sm font-bold text-on-surface">
                  No active reminders yet
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Add a care reminder for {subject.name} to keep track of watering, feeding, vet visits, or checkups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReminderToEdit(null);
                  setReminderFormOpen(true);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm"
              >
                Add reminder
              </button>
            </div>
          )}

          {/* Active Reminders List */}
          {!remindersLoading && !remindersError && reminders.length > 0 && (
            <div className="space-y-3">
              {reminders.map((rem) => {
                const { status, label } = getReminderStatus(rem.nextDue);
                const tMeta = getReminderTypeMeta(rem.kind);
                const isBusy = busyReminderId === rem.id;

                const statusStyles =
                  status === 'overdue'
                    ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/35'
                    : status === 'today'
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35'
                    : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35';

                return (
                  <article
                    key={rem.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2.5 min-w-0">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl bg-secondary-container/45 text-primary flex items-center justify-center shrink-0 mt-0.5"
                          aria-hidden="true"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {tMeta.icon}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-label-lg text-[15px] font-bold text-on-surface break-words">
                              {rem.title}
                            </h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide shrink-0 ${statusStyles}`}
                            >
                              {label}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {tMeta.label} · Due {formatEntryDate(rem.nextDue)}
                            {rem.repeatDays
                              ? ` · Repeats every ${rem.repeatDays} ${
                                  rem.repeatDays === 1 ? 'day' : 'days'
                                }`
                              : ' · One-time'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Mark done, Snooze (1 day), Edit, Delete */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/15">
                      <button
                        type="button"
                        disabled={Boolean(busyReminderId)}
                        onClick={() => handleCompleteReminder(rem)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-60"
                      >
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            isBusy ? 'animate-spin' : ''
                          }`}
                          aria-hidden="true"
                        >
                          {isBusy ? 'progress_activity' : 'check_circle'}
                        </span>
                        <span>{isBusy ? 'Updating...' : 'Mark done'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(busyReminderId)}
                        onClick={() => handleSnoozeReminder(rem)}
                        className="inline-flex items-center justify-center gap-1 px-3.5 py-2 min-h-[40px] rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-label-md text-xs font-semibold disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          snooze
                        </span>
                        <span>Snooze 1 day</span>
                      </button>

                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          disabled={Boolean(busyReminderId)}
                          aria-label={`Edit reminder ${rem.title}`}
                          onClick={() => {
                            setReminderToEdit(rem);
                            setReminderFormOpen(true);
                          }}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyReminderId)}
                          aria-label={`Delete reminder ${rem.title}`}
                          onClick={() => {
                            setDeleteReminderError(null);
                            setReminderToDelete(rem);
                          }}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container/25 hover:text-error disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DETAILS */}
      {activeTab === 'details' && (
        <div className="space-y-4 no-print">
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-3.5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
              <div>
                <dt className="text-xs text-on-surface-variant">Group</dt>
                <dd className="font-semibold text-on-surface mt-0.5">
                  {meta.label}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant">Species or breed</dt>
                <dd className="font-semibold text-on-surface mt-0.5">
                  {speciesLabel || 'Not specified'}
                </dd>
              </div>
              {subject.speciesScientific && (
                <div>
                  <dt className="text-xs text-on-surface-variant">
                    Scientific name
                  </dt>
                  <dd className="italic text-on-surface mt-0.5">
                    {subject.speciesScientific}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-on-surface-variant">
                  {meta.dateLabel}
                </dt>
                <dd className="font-semibold text-on-surface mt-0.5">
                  {subject.startedOn
                    ? `${formatEntryDate(subject.startedOn)}${
                        ageText ? ` (${ageText})` : ''
                      }`
                    : 'Not set'}
                </dd>
              </div>
              {subject.kind === 'pet' && (
                <div>
                  <dt className="text-xs text-on-surface-variant">Sex</dt>
                  <dd className="font-semibold text-on-surface capitalize mt-0.5">
                    {subject.sex || 'Not specified'}
                  </dd>
                </div>
              )}
            </dl>

            <div className="pt-3 border-t border-outline-variant/20">
              <h3 className="text-xs text-on-surface-variant mb-1">Notes</h3>
              <p className="text-sm text-on-surface whitespace-pre-line break-words">
                {subject.notes || 'No notes added yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setEditSubjectOpen(true)}
              className="flex-1 min-w-[100px] min-h-[44px] px-4 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">edit</span>
              <span>Edit details</span>
            </button>
            <button
              type="button"
              disabled={archivingSubject}
              onClick={handleArchiveSubject}
              className="flex-1 min-w-[100px] min-h-[44px] px-4 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface-variant font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[17px]">archive</span>
              <span>{archivingSubject ? 'Archiving...' : 'Archive'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteSubjectError(null);
                setSubjectToDelete(true);
              }}
              className="flex-1 min-w-[100px] min-h-[44px] px-4 rounded-full bg-error-container/25 hover:bg-error-container/40 text-error font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[17px]">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* CLEAN PRINTABLE DIARY REPORT (shown only during browser print / Export diary) */}
      <div className="hidden print:block space-y-4 pt-2">
        <div className="border-b border-gray-300 pb-3 space-y-1 text-sm">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            WildDex Private Care Diary · Printed{' '}
            {new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {subject.startedOn && (
            <p>
              <strong>{meta.dateLabel}:</strong>{' '}
              {formatEntryDate(subject.startedOn)}
              {ageText ? ` (${ageText})` : ''}
            </p>
          )}
          {subject.kind === 'pet' && subject.sex && (
            <p className="capitalize">
              <strong>Sex:</strong> {subject.sex}
            </p>
          )}
          {subject.notes && (
            <p>
              <strong>Notes:</strong> {subject.notes}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <h2 className="text-base font-bold">Care Entries ({entries.length})</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-600">No diary entries recorded.</p>
          ) : (
            entries.map((entry) => {
              const tMeta = getEntryTypeMeta(subject.kind, entry.entryType);
              return (
                <div
                  key={entry.id}
                  className="p-3 border border-gray-300 rounded-lg print-avoid-break space-y-1"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="font-semibold text-sm">
                      {entry.title}{' '}
                      <span className="font-normal text-gray-600">
                        ({tMeta.label}
                        {entry.value !== null && entry.unit
                          ? ` — ${entry.value} ${entry.unit}`
                          : ''}
                        )
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {formatEntryDate(entry.entryDate)}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-gray-800 whitespace-pre-line">
                      {entry.notes}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Add Entry Button */}
      <button
        type="button"
        onClick={() => {
          setEntryToEdit(null);
          setEntryFormOpen(true);
        }}
        className="no-print fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-full bg-primary text-on-primary font-label-lg text-sm font-bold shadow-lg hover:opacity-95 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          add
        </span>
        <span>Add entry</span>
      </button>

      {/* Modals */}
      <CareSubjectFormModal
        isOpen={editSubjectOpen}
        subjectToEdit={subject}
        onClose={() => setEditSubjectOpen(false)}
        onSaved={handleSubjectSaved}
      />

      <CareEntryFormModal
        isOpen={entryFormOpen}
        subjectId={subject.id}
        subjectKind={subject.kind}
        subjectName={subject.name}
        entryToEdit={entryToEdit}
        onClose={() => setEntryFormOpen(false)}
        onSaved={handleEntrySaved}
      />

      <CareReminderFormModal
        isOpen={reminderFormOpen}
        subjectId={subject.id}
        subjectKind={subject.kind}
        subjectName={subject.name}
        reminderToEdit={reminderToEdit}
        onClose={() => setReminderFormOpen(false)}
        onSaved={handleReminderSaved}
      />

      {/* Delete Reminder Confirmation */}
      {reminderToDelete && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          onClick={() => {
            if (!deletingReminder) {
              setReminderToDelete(null);
              setDeleteReminderError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Delete ${reminderToDelete.title}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl border border-outline-variant/30 space-y-4"
          >
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Delete this reminder?
              </h2>
              <p className="font-body-sm text-sm text-on-surface-variant mt-1">
                "{reminderToDelete.title}" will be removed. Your past diary entries stay saved.
              </p>
            </div>
            {deleteReminderError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 flex items-center justify-between gap-2 text-xs text-on-error-container">
                <span>{deleteReminderError}</span>
                <button
                  type="button"
                  disabled={deletingReminder}
                  onClick={handleConfirmDeleteReminder}
                  className="px-2.5 py-1 rounded-full bg-surface text-primary font-semibold border border-outline-variant/40 shrink-0"
                >
                  Retry
                </button>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingReminder}
                onClick={() => {
                  setReminderToDelete(null);
                  setDeleteReminderError(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingReminder}
                onClick={handleConfirmDeleteReminder}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md font-semibold"
              >
                {deletingReminder ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={lightboxPhoto.title}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full flex flex-col items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              aria-label="Close photo"
              className="self-end w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              className="max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="text-center text-white">
              <p className="font-semibold text-sm">{lightboxPhoto.title}</p>
              {lightboxPhoto.subtitle && (
                <p className="text-xs text-white/75 mt-0.5">
                  {lightboxPhoto.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Entry Confirmation */}
      {entryToDelete && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          onClick={() => {
            if (!deletingEntry) {
              setEntryToDelete(null);
              setDeleteEntryError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Delete ${entryToDelete.title}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl border border-outline-variant/30 space-y-4"
          >
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Delete this entry?
              </h2>
              <p className="font-body-sm text-sm text-on-surface-variant mt-1">
                "{entryToDelete.title}" and any attached photo will be permanently removed.
              </p>
            </div>
            {deleteEntryError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container">
                {deleteEntryError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingEntry}
                onClick={() => {
                  setEntryToDelete(null);
                  setDeleteEntryError(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingEntry}
                onClick={handleConfirmDeleteEntry}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md font-semibold"
              >
                {deletingEntry ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation */}
      {subjectToDelete && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print"
          onClick={() => {
            if (!deletingSubject) {
              setSubjectToDelete(false);
              setDeleteSubjectError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Delete ${subject.name}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl border border-outline-variant/30 space-y-4"
          >
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Delete {subject.name}?
              </h2>
              <p className="font-body-sm text-sm text-on-surface-variant mt-1">
                This will remove {subject.name}, all diary entries, and saved photos.
              </p>
            </div>
            {deleteSubjectError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container">
                {deleteSubjectError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingSubject}
                onClick={() => {
                  setSubjectToDelete(false);
                  setDeleteSubjectError(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingSubject}
                onClick={handleConfirmDeleteSubject}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md font-semibold"
              >
                {deletingSubject ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stored Health Result Modal */}
      {healthResultModalEntry?.healthResult && (
        <div
          className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
          onClick={() => setHealthResultModalEntry(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Health result for ${healthResultModalEntry.title}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[92dvh] bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold truncate">
                  {healthResultModalEntry.title}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                  {subject.name} · {formatEntryDate(healthResultModalEntry.entryDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHealthResultModalEntry(null)}
                aria-label="Close health result"
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              <div className="bg-tertiary-container/15 text-tertiary rounded-xl p-3 flex items-start gap-2.5 border border-tertiary/20">
                <span
                  className="material-symbols-outlined text-[20px] shrink-0 text-tertiary mt-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
                <p className="font-body-sm text-xs text-on-surface leading-relaxed">
                  This is general information, not a vet or doctor&apos;s advice.
                </p>
              </div>

              <HealthResultSection
                result={healthResultModalEntry.healthResult}
                subjectName={subject.name}
                subjectCategory={careKindToHealthCategory(subject.kind)}
                duration={
                  healthResultModalEntry.notes.match(/How long:\s*(.+)/i)?.[1]?.trim() ||
                  'Saved check'
                }
                onNotify={showToast}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-xs shadow-lg max-w-[90vw] truncate"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
