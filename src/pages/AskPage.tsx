import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { AskAuthorLink } from '../components/ask/AskAuthorLink';
import { AskQuestionFormModal } from '../components/ask/AskQuestionFormModal';
import {
  ASK_CATEGORIES,
  AskCategory,
  AskFeedTab,
  AskQuestion,
  deleteAskQuestion,
  formatRelativeTime,
  getAskCategoryMeta,
  listQuestions,
} from '../services/askService';

const TABS: { id: AskFeedTab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'solved', label: 'Solved' },
  { id: 'mine', label: 'My questions' },
];

type CategoryFilter = 'all' | AskCategory;

const CATEGORY_CHIPS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...ASK_CATEGORIES.map((c) => ({ id: c.id, label: c.chipLabel })),
];

export const AskPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AskFeedTab>('open');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  const [questions, setQuestions] = useState<AskQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Record<string, boolean>>({});

  // Create / Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<AskQuestion | null>(null);

  // Delete confirmation state
  const [questionToDelete, setQuestionToDelete] = useState<AskQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loadFeed = useCallback(async () => {
    if (!currentUser) {
      setQuestions([]);
      setLoading(false);
      setError(null);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    try {
      const res = await listQuestions({
        tab: activeTab,
        category: selectedCategory,
        offset: 0,
      });
      setQuestions(res.questions);
      setHasMore(res.hasMore);
      setBrokenPhotoIds({});
    } catch (err: any) {
      setError(err?.message || 'Could not load questions right now.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, activeTab, selectedCategory]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Escape closes delete dialog
  useEffect(() => {
    if (!questionToDelete) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        setQuestionToDelete(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [questionToDelete, deleting]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !currentUser) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await listQuestions({
        tab: activeTab,
        category: selectedCategory,
        offset: questions.length,
      });
      setQuestions((prev) => {
        const seen = new Set(prev.map((q) => q.id));
        const next = res.questions.filter((q) => !seen.has(q.id));
        return [...prev, ...next];
      });
      setHasMore(res.hasMore);
    } catch (err: any) {
      setLoadMoreError(err?.message || 'Could not load more questions.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenCreate = () => {
    setQuestionToEdit(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (question: AskQuestion) => {
    setQuestionToEdit(question);
    setFormOpen(true);
  };

  const handleFormSaved = (saved: AskQuestion, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      if (
        (activeTab === 'open' || activeTab === 'mine') &&
        (selectedCategory === 'all' || selectedCategory === saved.category)
      ) {
        setQuestions((prev) => [saved, ...prev.filter((q) => q.id !== saved.id)]);
      } else {
        setActiveTab('open');
        setSelectedCategory('all');
      }
      setToast('Your question has been posted.');
    } else {
      setQuestions((prev) => {
        const matchesCategory =
          selectedCategory === 'all' || selectedCategory === saved.category;
        if (!matchesCategory) {
          return prev.filter((q) => q.id !== saved.id);
        }
        return prev.map((q) =>
          q.id === saved.id
            ? { ...saved, answerCount: q.answerCount, author: q.author.username ? q.author : saved.author }
            : q
        );
      });
      setToast('Question updated.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAskQuestion(questionToDelete);
      const removedId = questionToDelete.id;
      setQuestions((prev) => prev.filter((q) => q.id !== removedId));
      setQuestionToDelete(null);
      setToast('Question deleted.');
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete this question.');
    } finally {
      setDeleting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to ask the community"
          description="Post a photo of a plant, animal, bird, insect, or mushroom and get help identifying what you saw."
          icon="live_help"
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
            Ask the community
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Share a photo and ask &ldquo;What is this?&rdquo; to get help identifying it.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all shrink-0 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add_a_photo
          </span>
          <span>Ask a question</span>
        </button>
      </div>

      {/* Status Tabs: Open, Solved, My questions */}
      <div
        role="tablist"
        aria-label="Filter questions by status"
        className="flex items-center gap-1 p-1 rounded-2xl bg-surface-container-low border border-outline-variant/25 overflow-x-auto no-scrollbar"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit px-3 py-2 min-h-[40px] rounded-xl font-label-md text-xs sm:text-sm whitespace-nowrap transition-colors ${
                active
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category Chips */}
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5"
        role="group"
        aria-label="Filter questions by category"
      >
        {CATEGORY_CHIPS.map((chip) => {
          const active = selectedCategory === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(chip.id)}
              className={`px-3.5 py-2 min-h-[38px] rounded-full font-label-md text-xs whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-secondary text-on-secondary font-semibold shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse"
          aria-label="Loading questions"
        >
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden"
            >
              <div className="aspect-[4/3] w-full bg-surface-container-high" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-20 rounded-full bg-surface-container-high" />
                <div className="h-5 w-4/5 rounded bg-surface-container-high" />
                <div className="h-3.5 w-1/2 rounded bg-surface-container-high" />
                <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-surface-container-high" />
                    <div className="h-3.5 w-24 rounded bg-surface-container-high" />
                  </div>
                  <div className="h-3.5 w-14 rounded bg-surface-container-high" />
                </div>
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
            onClick={loadFeed}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && questions.length === 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3.5">
          <div className="w-16 h-16 rounded-2xl bg-secondary-container/45 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[34px]" aria-hidden="true">
              live_help
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface font-medium max-w-sm">
            No questions yet. Ask the first one!
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-1 px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm hover:opacity-95 inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              add_a_photo
            </span>
            <span>Ask a question</span>
          </button>
        </div>
      )}

      {/* Question Cards Grid */}
      {!loading && !error && questions.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((question) => {
              const catMeta = getAskCategoryMeta(question.category);
              const isSolved = question.status === 'solved';
              const isOwner = currentUser.id === question.authorId;
              const showPhoto =
                Boolean(question.photoUrl) && !brokenPhotoIds[question.id];
              const answerLabel =
                question.answerCount === 1
                  ? '1 answer'
                  : `${question.answerCount} answers`;

              return (
                <article
                  key={question.id}
                  className="rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm overflow-hidden flex flex-col min-w-0"
                >
                  {/* Clickable Photo + Body */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      navigate(`/ask/${encodeURIComponent(question.id)}`, {
                        state: { question },
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/ask/${encodeURIComponent(question.id)}`, {
                          state: { question },
                        });
                      }
                    }}
                    className="flex-1 flex flex-col cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
                      {showPhoto ? (
                        <img
                          src={question.photoUrl}
                          alt={question.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenPhotoIds((prev) => ({
                              ...prev,
                              [question.id]: true,
                            }))
                          }
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-on-surface-variant bg-surface-container">
                          <span className="material-symbols-outlined text-[36px]" aria-hidden="true">
                            {catMeta.icon}
                          </span>
                          <span className="font-body-sm text-xs">{catMeta.label}</span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <span
                        className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${
                          isSolved
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface/95 text-on-surface border border-outline-variant/40'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                          {isSolved ? 'check_circle' : 'help'}
                        </span>
                        <span>{isSolved ? 'Solved' : 'Open'}</span>
                      </span>
                    </div>

                    <div className="p-3.5 sm:p-4 flex-1 flex flex-col gap-2 min-w-0">
                      <h2 className="font-headline-sm text-base sm:text-[17px] leading-snug text-on-surface group-hover:text-primary font-bold line-clamp-2 break-words transition-colors">
                        {question.title}
                      </h2>

                      {/* Unboxed Metadata: category · place_label */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-on-surface-variant min-w-0">
                        <span className="font-medium text-secondary">{catMeta.label}</span>
                        {question.placeLabel && (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <span className="truncate max-w-full">{question.placeLabel}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-auto pt-2.5 border-t border-outline-variant/20 flex items-center justify-between gap-2 flex-wrap">
                        <AskAuthorLink author={question.author} />

                        <div className="flex items-center gap-2 text-xs text-on-surface-variant shrink-0 tabular-nums">
                          <span className="font-medium text-on-surface">{answerLabel}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{formatRelativeTime(question.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Owner Actions */}
                  {isOwner && (
                    <div className="px-3.5 pb-3 pt-1 flex items-center gap-2 border-t border-outline-variant/15">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(question)}
                        className="flex-1 min-h-[40px] px-3 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          edit
                        </span>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setQuestionToDelete(question);
                        }}
                        className="flex-1 min-h-[40px] px-3 rounded-full bg-error-container/20 hover:bg-error-container/35 text-error font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                          delete
                        </span>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Load more error with Retry */}
          {loadMoreError && (
            <div className="p-4 rounded-2xl bg-error-container/25 border border-error/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="font-body-sm text-sm text-on-surface font-medium">
                {loadMoreError}
              </p>
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-full bg-surface-container-low border border-outline-variant/40 text-primary font-label-md text-sm font-semibold hover:bg-surface-container disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {loadingMore && (
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                    progress_activity
                  </span>
                )}
                <span>{loadingMore ? 'Loading more...' : 'Load more'}</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Ask / Edit Modal */}
      <AskQuestionFormModal
        isOpen={formOpen}
        questionToEdit={questionToEdit}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
      />

      {/* Delete Confirmation Dialog */}
      {questionToDelete && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!deleting) {
              setQuestionToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete question"
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
                  Delete this question?
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 break-words">
                  This will remove &ldquo;{questionToDelete.title}&rdquo; and its photo permanently.
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
                  setQuestionToDelete(null);
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
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
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
