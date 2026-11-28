import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { AskAuthorLink } from '../components/ask/AskAuthorLink';
import { AskQuestionFormModal } from '../components/ask/AskQuestionFormModal';
import { AskReportModal, AskReportTarget } from '../components/ask/AskReportModal';
import { AskSafetyNotice } from '../components/ask/AskSafetyNotice';
import {
  AskAnswer,
  AskQuestion,
  AskTaxonSuggestion,
  acceptAskAnswer,
  createAskAnswer,
  deleteAskAnswer,
  deleteAskQuestion,
  formatRelativeTime,
  getAskCategoryMeta,
  getAskQuestionById,
  listQuestionAnswers,
  reopenAskQuestion,
  searchAskSpecies,
  sortAskAnswers,
  toggleAnswerHelpfulVote,
} from '../services/askService';

export const AskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const initialStateQuestion = (location.state as { question?: AskQuestion } | null)
    ?.question;

  const [question, setQuestion] = useState<AskQuestion | null>(
    initialStateQuestion && initialStateQuestion.id === id
      ? initialStateQuestion
      : null
  );
  const [questionLoading, setQuestionLoading] = useState(!question);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Answers state
  const [answers, setAnswers] = useState<AskAnswer[]>([]);
  const [answersLoading, setAnswersLoading] = useState(true);
  const [answersError, setAnswersError] = useState<string | null>(null);

  // Question owner actions & menus
  const [questionMenuOpen, setQuestionMenuOpen] = useState(false);
  const [openAnswerMenuId, setOpenAnswerMenuId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [deleteQuestionError, setDeleteQuestionError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [questionActionError, setQuestionActionError] = useState<string | null>(null);

  // Answer interactions state
  const [voteBusyIds, setVoteBusyIds] = useState<Record<string, boolean>>({});
  const [acceptBusyId, setAcceptBusyId] = useState<string | null>(null);
  const [answerActionError, setAnswerActionError] = useState<string | null>(null);
  const [thankYouBanner, setThankYouBanner] = useState<string | null>(null);
  const [answerToDelete, setAnswerToDelete] = useState<AskAnswer | null>(null);
  const [deletingAnswer, setDeletingAnswer] = useState(false);
  const [deleteAnswerError, setDeleteAnswerError] = useState<string | null>(null);

  // Report modal state
  const [reportTarget, setReportTarget] = useState<AskReportTarget | null>(null);

  // "Suggest a name" form state
  const [speciesName, setSpeciesName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [speciesResults, setSpeciesResults] = useState<AskTaxonSuggestion[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [speciesSearchRetryTick, setSpeciesSearchRetryTick] = useState(0);
  const skipNextAutocompleteRef = useRef(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [submitAnswerError, setSubmitAnswerError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Close ⋯ menus when clicking outside or pressing Escape
  useEffect(() => {
    if (!questionMenuOpen && !openAnswerMenuId) return;
    const handleOutside = () => {
      setQuestionMenuOpen(false);
      setOpenAnswerMenuId(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuestionMenuOpen(false);
        setOpenAnswerMenuId(null);
      }
    };
    document.addEventListener('click', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [questionMenuOpen, openAnswerMenuId]);

  const loadAnswers = useCallback(
    async (questionId: string, acceptedId: string | null) => {
      setAnswersLoading(true);
      setAnswersError(null);
      try {
        const list = await listQuestionAnswers(questionId, acceptedId);
        setAnswers(list);
      } catch (err: any) {
        setAnswersError(err?.message || 'Could not load answers.');
      } finally {
        setAnswersLoading(false);
      }
    },
    []
  );

  const loadQuestionAndAnswers = useCallback(async () => {
    if (!currentUser || !id) {
      setQuestionLoading(false);
      setAnswersLoading(false);
      return;
    }

    setQuestionLoading((prev) => (question ? prev : true));
    setQuestionError(null);
    setQuestionActionError(null);
    try {
      const fetched = await getAskQuestionById(id);
      if (fetched) {
        setQuestion((prev) => ({
          ...fetched,
          answerCount:
            prev && prev.id === fetched.id && fetched.answerCount === 0
              ? prev.answerCount
              : fetched.answerCount,
        }));
        setPhotoBroken(false);
        await loadAnswers(fetched.id, fetched.acceptedAnswerId);
      } else {
        setQuestion(null);
        setAnswers([]);
        setAnswersLoading(false);
      }
    } catch (err: any) {
      setQuestionError(err?.message || 'Could not load this question.');
      setAnswersLoading(false);
    } finally {
      setQuestionLoading(false);
    }
  }, [currentUser?.id, id, loadAnswers]);

  useEffect(() => {
    loadQuestionAndAnswers();
  }, [loadQuestionAndAnswers]);

  // 300ms debounced iNaturalist autocomplete for "Suggest a name"
  useEffect(() => {
    if (!currentUser) return;
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const trimmed = speciesName.trim();
    if (!trimmed) {
      setSpeciesResults([]);
      setSpeciesLoading(false);
      setSpeciesError(null);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSpeciesLoading(true);
      setSpeciesError(null);
      try {
        const matches = await searchAskSpecies(trimmed, controller.signal);
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
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [speciesName, currentUser?.id, speciesSearchRetryTick]);

  // Escape closes lightbox or delete dialogs
  useEffect(() => {
    if (!lightboxOpen && !confirmDeleteOpen && !answerToDelete) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) setLightboxOpen(false);
        else if (confirmDeleteOpen && !deletingQuestion) {
          setConfirmDeleteOpen(false);
          setDeleteQuestionError(null);
        } else if (answerToDelete && !deletingAnswer) {
          setAnswerToDelete(null);
          setDeleteAnswerError(null);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    lightboxOpen,
    confirmDeleteOpen,
    deletingQuestion,
    answerToDelete,
    deletingAnswer,
  ]);

  const handlePickTaxon = (taxon: AskTaxonSuggestion) => {
    skipNextAutocompleteRef.current = true;
    setSpeciesName(taxon.commonName);
    setScientificName(taxon.scientificName);
    setSpeciesResults([]);
    setShowSuggestions(false);
    setSpeciesError(null);
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || submittingAnswer) return;

    setSubmitAnswerError(null);
    const trimmedName = speciesName.trim();
    const trimmedScientific = scientificName.trim();
    const trimmedExplanation = explanation.trim();

    if (!trimmedName) {
      setSubmitAnswerError('Please pick a species or type a name.');
      return;
    }
    if (trimmedExplanation.length > 800) {
      setSubmitAnswerError('Explanation must be 800 characters or fewer.');
      return;
    }

    setSubmittingAnswer(true);
    try {
      const created = await createAskAnswer({
        questionId: question.id,
        speciesName: trimmedName,
        scientificName: trimmedScientific,
        explanation: trimmedExplanation,
      });
      setAnswers((prev) =>
        sortAskAnswers([...prev, created], question.acceptedAnswerId)
      );
      setQuestion((prev) =>
        prev ? { ...prev, answerCount: prev.answerCount + 1 } : prev
      );
      skipNextAutocompleteRef.current = true;
      setSpeciesName('');
      setScientificName('');
      setExplanation('');
      setSpeciesResults([]);
      setShowSuggestions(false);
      setToast('Your suggestion has been posted.');
    } catch (err: any) {
      setSubmitAnswerError(err?.message || 'Could not post your answer.');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleToggleHelpful = async (answer: AskAnswer) => {
    if (!currentUser || currentUser.id === answer.authorId) return;
    if (voteBusyIds[answer.id]) return;

    setAnswerActionError(null);
    const wasVoted = answer.hasVoted;
    const prevCount = answer.helpfulCount;
    const nextVoted = !wasVoted;
    const nextCount = Math.max(0, prevCount + (nextVoted ? 1 : -1));

    // Optimistic instant update
    setVoteBusyIds((prev) => ({ ...prev, [answer.id]: true }));
    setAnswers((prev) =>
      prev.map((a) =>
        a.id === answer.id
          ? { ...a, hasVoted: nextVoted, helpfulCount: nextCount }
          : a
      )
    );

    try {
      await toggleAnswerHelpfulVote(answer.id, wasVoted);
    } catch (err: any) {
      // Roll back on error
      setAnswers((prev) =>
        prev.map((a) =>
          a.id === answer.id
            ? { ...a, hasVoted: wasVoted, helpfulCount: prevCount }
            : a
        )
      );
      setAnswerActionError(err?.message || 'Could not update helpful vote.');
    } finally {
      setVoteBusyIds((prev) => {
        const copy = { ...prev };
        delete copy[answer.id];
        return copy;
      });
    }
  };

  const handleAcceptAnswer = async (answer: AskAnswer) => {
    if (!question || !currentUser || currentUser.id !== question.authorId) return;
    if (currentUser.id === answer.authorId || acceptBusyId) return;

    setAnswerActionError(null);
    setAcceptBusyId(answer.id);
    try {
      await acceptAskAnswer(answer.id);
      setQuestion((prev) =>
        prev
          ? { ...prev, status: 'solved', acceptedAnswerId: answer.id }
          : prev
      );
      setAnswers((prev) => sortAskAnswers(prev, answer.id));
      setThankYouBanner(
        `Thank you for marking ${answer.speciesName} as the best answer! This question is now marked solved.`
      );
      setToast('Best answer saved. Thank you!');
    } catch (err: any) {
      setAnswerActionError(err?.message || 'Could not mark this as the best answer.');
    } finally {
      setAcceptBusyId(null);
    }
  };

  const handleReopenQuestion = async () => {
    if (!question || !currentUser || currentUser.id !== question.authorId) return;
    if (reopening) return;

    setQuestionActionError(null);
    setReopening(true);
    try {
      await reopenAskQuestion(question.id);
      setQuestion((prev) =>
        prev ? { ...prev, status: 'open', acceptedAnswerId: null } : prev
      );
      setAnswers((prev) => sortAskAnswers(prev, null));
      setThankYouBanner(null);
      setToast('Question reopened.');
    } catch (err: any) {
      setQuestionActionError(err?.message || 'Could not reopen this question.');
    } finally {
      setReopening(false);
    }
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!question || deletingQuestion) return;
    setDeletingQuestion(true);
    setDeleteQuestionError(null);
    try {
      await deleteAskQuestion(question);
      navigate('/ask', { replace: true });
    } catch (err: any) {
      setDeleteQuestionError(err?.message || 'Could not delete this question.');
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleConfirmDeleteAnswer = async () => {
    if (!answerToDelete || deletingAnswer) return;
    setDeletingAnswer(true);
    setDeleteAnswerError(null);
    try {
      await deleteAskAnswer(answerToDelete.id);
      const removedId = answerToDelete.id;
      setAnswers((prev) => prev.filter((a) => a.id !== removedId));
      setQuestion((prev) => {
        if (!prev) return prev;
        const wasAccepted = prev.acceptedAnswerId === removedId;
        return {
          ...prev,
          answerCount: Math.max(0, prev.answerCount - 1),
          acceptedAnswerId: wasAccepted ? null : prev.acceptedAnswerId,
        };
      });
      setAnswerToDelete(null);
      setToast('Answer deleted.');
    } catch (err: any) {
      setDeleteAnswerError(err?.message || 'Could not delete your answer.');
    } finally {
      setDeletingAnswer(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-4">
        <AuthPromptCard
          title="Sign in to view this question"
          description="Join the community to view identification questions, vote on helpful answers, and suggest what it is."
          icon="live_help"
        />
      </div>
    );
  }

  if (questionLoading) {
    return (
      <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-3 space-y-4 animate-pulse max-w-4xl">
        <div className="h-6 w-32 rounded-full bg-surface-container-high" />
        <div className="rounded-3xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden">
          <div className="aspect-[4/3] sm:aspect-[16/10] w-full bg-surface-container-high" />
          <div className="p-4 sm:p-6 space-y-3">
            <div className="h-6 w-24 rounded-full bg-surface-container-high" />
            <div className="h-7 w-3/4 rounded bg-surface-container-high" />
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-2/3 rounded bg-surface-container-high" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-4 space-y-3">
          <div className="h-5 w-40 rounded bg-surface-container-high" />
          <div className="h-16 w-full rounded-xl bg-surface-container-high" />
        </div>
      </div>
    );
  }

  if (questionError) {
    return (
      <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-3 space-y-4 max-w-4xl">
        <Link
          to="/ask"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline w-fit min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to Ask</span>
        </Link>

        <div className="p-6 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3 max-w-xl">
          <span className="material-symbols-outlined text-[32px] text-error" aria-hidden="true">
            error_outline
          </span>
          <p className="font-body-md text-body-md text-on-surface font-medium">
            {questionError}
          </p>
          <button
            type="button"
            onClick={loadQuestionAndAnswers}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-3 space-y-4 max-w-4xl">
        <Link
          to="/ask"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline w-fit min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to Ask</span>
        </Link>

        <div className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-3 max-w-xl">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant" aria-hidden="true">
            search_off
          </span>
          <p className="font-body-md text-on-surface font-medium">
            This question could not be found or was removed.
          </p>
          <Link
            to="/ask"
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md font-semibold inline-flex items-center"
          >
            See all questions
          </Link>
        </div>
      </div>
    );
  }

  const catMeta = getAskCategoryMeta(question.category);
  const isSolved = question.status === 'solved';
  const isAsker = currentUser.id === question.authorId;
  const displayedAnswerCount = answersLoading
    ? question.answerCount
    : Math.max(answers.length, question.answerCount);
  const answerLabel =
    displayedAnswerCount === 1
      ? '1 answer'
      : `${displayedAnswerCount} answers`;

  return (
    <div className="flex flex-col w-full min-w-0 px-3 sm:px-margin pb-12 pt-2 space-y-5 max-w-4xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          to="/ask"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to Ask</span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {isAsker && isSolved && (
            <button
              type="button"
              disabled={reopening}
              onClick={handleReopenQuestion}
              className="px-3.5 py-2 min-h-[40px] rounded-full bg-surface-container-low border border-outline-variant/40 hover:bg-surface-container text-primary font-label-md text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                refresh
              </span>
              <span>{reopening ? 'Reopening...' : 'Reopen'}</span>
            </button>
          )}

          {/* Question ⋯ menu */}
          <div className="relative">
            <button
              type="button"
              aria-label="Question actions"
              aria-expanded={questionMenuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setOpenAnswerMenuId(null);
                setQuestionMenuOpen((prev) => !prev);
              }}
              className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-surface-container-low border border-outline-variant/30 hover:bg-surface-container text-on-surface flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                more_horiz
              </span>
            </button>

            {questionMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-11 z-40 w-44 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl py-1"
              >
                {isAsker && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionMenuOpen(false);
                        setEditOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[42px] text-left font-label-md text-xs text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[17px] text-secondary" aria-hidden="true">
                        edit
                      </span>
                      <span>Edit question</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionMenuOpen(false);
                        setDeleteQuestionError(null);
                        setConfirmDeleteOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 min-h-[42px] text-left font-label-md text-xs text-error hover:bg-error-container/20 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                        delete
                      </span>
                      <span>Delete question</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setQuestionMenuOpen(false);
                    setReportTarget({
                      type: 'question',
                      id: question.id,
                      label: question.title,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 min-h-[42px] text-left font-label-md text-xs text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[17px] text-on-surface-variant" aria-hidden="true">
                    flag
                  </span>
                  <span>Report</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {questionActionError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3"
        >
          <span className="font-body-sm text-xs sm:text-sm text-on-error-container font-medium">
            {questionActionError}
          </span>
          <button
            type="button"
            onClick={() => setQuestionActionError(null)}
            className="text-xs font-semibold text-error shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Question Card */}
      <article className="rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm overflow-hidden">
        {/* Large Photo */}
        <div className="relative bg-surface-container">
          {question.photoUrl && !photoBroken ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="View larger photo"
              className="w-full block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={question.photoUrl}
                alt={question.title}
                referrerPolicy="no-referrer"
                onError={() => setPhotoBroken(true)}
                className="w-full max-h-[480px] object-cover block"
              />
            </button>
          ) : (
            <div className="w-full py-16 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[42px]" aria-hidden="true">
                {catMeta.icon}
              </span>
              <span className="font-body-sm text-sm">{catMeta.label}</span>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-3.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                isSolved
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container-high text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                {isSolved ? 'check_circle' : 'help'}
              </span>
              <span>{isSolved ? 'Solved' : 'Open'}</span>
            </span>

            <span className="text-xs font-medium text-secondary">
              {catMeta.label}
            </span>

            {question.placeLabel && (
              <>
                <span aria-hidden="true" className="text-xs text-on-surface-variant">
                  &middot;
                </span>
                <span className="text-xs text-on-surface-variant break-words">
                  {question.placeLabel}
                </span>
              </>
            )}
          </div>

          <h1 className="font-headline-md text-xl sm:text-headline-md text-on-surface font-bold break-words">
            {question.title}
          </h1>

          {question.description && (
            <p className="font-body-md text-sm sm:text-base text-on-surface-variant whitespace-pre-line break-words leading-relaxed">
              {question.description}
            </p>
          )}

          {/* Safety notice for Fungi, Reptile, or Plant */}
          <AskSafetyNotice category={question.category} />

          <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-2 flex-wrap">
            <AskAuthorLink author={question.author} sizeClass="w-8 h-8" />
            <div className="flex items-center gap-2 text-xs text-on-surface-variant tabular-nums">
              <span className="font-medium text-on-surface">{answerLabel}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{formatRelativeTime(question.createdAt)}</span>
            </div>
          </div>
        </div>
      </article>

      {/* Thank-you Banner after marking Best Answer */}
      {thankYouBanner && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-secondary-container/50 border border-secondary/30 text-on-secondary-container flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
              verified
            </span>
            <p className="font-body-sm text-xs sm:text-sm font-medium">
              {thankYouBanner}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setThankYouBanner(null)}
            aria-label="Dismiss thank-you message"
            className="text-xs font-semibold shrink-0 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Answers Section */}
      <section aria-labelledby="answers-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="answers-heading"
            className="font-headline-sm text-headline-sm text-on-surface font-bold"
          >
            Answers
          </h2>
          {!answersLoading && !answersError && (
            <span className="font-body-sm text-xs text-on-surface-variant tabular-nums">
              {answers.length} {answers.length === 1 ? 'suggestion' : 'suggestions'}
            </span>
          )}
        </div>

        {answerActionError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-3"
          >
            <span className="font-body-sm text-xs sm:text-sm text-on-error-container font-medium">
              {answerActionError}
            </span>
            <button
              type="button"
              onClick={() => setAnswerActionError(null)}
              className="text-xs font-semibold text-error shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {answersLoading && (
          <div className="space-y-3 animate-pulse" aria-label="Loading answers">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-surface-container-high" />
                    <div className="h-3.5 w-24 rounded bg-surface-container-high" />
                  </div>
                  <div className="h-3 w-12 rounded bg-surface-container-high" />
                </div>
                <div className="h-4 w-48 rounded bg-surface-container-high" />
                <div className="h-3.5 w-full rounded bg-surface-container-high" />
              </div>
            ))}
          </div>
        )}

        {/* Answers Error State with Retry */}
        {!answersLoading && answersError && (
          <div className="p-5 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-error" aria-hidden="true">
              error_outline
            </span>
            <p className="font-body-sm text-sm text-on-surface font-medium">
              {answersError}
            </p>
            <button
              type="button"
              onClick={() => loadAnswers(question.id, question.acceptedAnswerId)}
              className="px-5 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-md text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty Answers State */}
        {!answersLoading && !answersError && answers.length === 0 && (
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-1.5">
            <span className="material-symbols-outlined text-[30px] text-primary" aria-hidden="true">
              forum
            </span>
            <p className="font-body-md text-sm text-on-surface font-medium">
              No answers yet. Know what it is? Suggest a name!
            </p>
          </div>
        )}

        {/* Answer Cards */}
        {!answersLoading && !answersError && answers.length > 0 && (
          <div className="space-y-3">
            {answers.map((answer) => {
              const isOwnAnswer = currentUser.id === answer.authorId;
              const isAccepted =
                answer.isAccepted ||
                (Boolean(question.acceptedAnswerId) &&
                  question.acceptedAnswerId === answer.id);
              const isVoteBusy = Boolean(voteBusyIds[answer.id]);
              const isAcceptBusy = acceptBusyId === answer.id;
              const menuOpen = openAnswerMenuId === answer.id;

              return (
                <article
                  key={answer.id}
                  className={`p-4 rounded-2xl border shadow-sm space-y-2.5 min-w-0 ${
                    isAccepted
                      ? 'bg-secondary-container/25 border-secondary/45'
                      : 'bg-surface-container-lowest border-outline-variant/25'
                  }`}
                >
                  {/* Top Row: Best Answer badge (if accepted) + Author + Time + ⋯ menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-xs font-semibold shrink-0">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                            check_circle
                          </span>
                          <span>Best answer</span>
                        </span>
                      )}
                      <AskAuthorLink author={answer.author} />
                      <span className="text-xs text-on-surface-variant shrink-0">
                        &middot; {formatRelativeTime(answer.createdAt)}
                      </span>
                    </div>

                    {/* Answer ⋯ menu */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label="Answer actions"
                        aria-expanded={menuOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuestionMenuOpen(false);
                          setOpenAnswerMenuId((prev) =>
                            prev === answer.id ? null : answer.id
                          );
                        }}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full hover:bg-surface-container text-on-surface-variant flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          more_horiz
                        </span>
                      </button>

                      {menuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-10 z-40 w-40 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-xl py-1"
                        >
                          {isOwnAnswer && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenAnswerMenuId(null);
                                setDeleteAnswerError(null);
                                setAnswerToDelete(answer);
                              }}
                              className="w-full px-3.5 py-2.5 min-h-[40px] text-left font-label-md text-xs text-error hover:bg-error-container/20 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                                delete
                              </span>
                              <span>Delete answer</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenAnswerMenuId(null);
                              setReportTarget({
                                type: 'answer',
                                id: answer.id,
                                label: answer.speciesName,
                              });
                            }}
                            className="w-full px-3.5 py-2.5 min-h-[40px] text-left font-label-md text-xs text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">
                              flag
                            </span>
                            <span>Report</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Species Name & Italic Scientific Name */}
                  <div className="min-w-0">
                    <h3 className="font-headline-sm text-base text-on-surface font-bold break-words">
                      {answer.speciesName}
                    </h3>
                    {answer.scientificName && (
                      <p className="font-body-sm text-xs sm:text-sm italic text-on-surface-variant break-words">
                        {answer.scientificName}
                      </p>
                    )}
                  </div>

                  {/* Explanation */}
                  {answer.explanation && (
                    <p className="font-body-sm text-sm text-on-surface whitespace-pre-line break-words leading-relaxed">
                      {answer.explanation}
                    </p>
                  )}

                  {/* Footer Actions: Helpful (hidden on own answers), Mark as best (asker only, hidden on own answers), Delete (own answer) */}
                  <div className="pt-1.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isOwnAnswer ? (
                        <button
                          type="button"
                          disabled={isVoteBusy}
                          aria-pressed={answer.hasVoted}
                          onClick={() => handleToggleHelpful(answer)}
                          className={`px-3 py-1.5 min-h-[38px] rounded-full font-label-md text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors tabular-nums ${
                            answer.hasVoted
                              ? 'bg-primary text-on-primary border-primary shadow-sm'
                              : 'bg-surface-container-low text-on-surface-variant border-outline-variant/35 hover:bg-surface-container hover:text-on-surface'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                            thumb_up
                          </span>
                          <span>Helpful</span>
                          <span>({answer.helpfulCount})</span>
                        </button>
                      ) : (
                        <span className="text-xs text-on-surface-variant tabular-nums">
                          {answer.helpfulCount} helpful
                        </span>
                      )}

                      {isAsker && !isOwnAnswer && !isAccepted && (
                        <button
                          type="button"
                          disabled={Boolean(acceptBusyId)}
                          onClick={() => handleAcceptAnswer(answer)}
                          className="px-3.5 py-1.5 min-h-[38px] rounded-full bg-secondary-container/60 hover:bg-secondary-container text-on-secondary-container font-label-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                            verified
                          </span>
                          <span>
                            {isAcceptBusy ? 'Saving...' : 'Mark as best answer'}
                          </span>
                        </button>
                      )}
                    </div>

                    {isOwnAnswer && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteAnswerError(null);
                          setAnswerToDelete(answer);
                        }}
                        className="px-3 py-1.5 min-h-[38px] rounded-full text-error hover:bg-error-container/25 font-label-md text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                          delete
                        </span>
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* "Suggest a name" Form */}
      <section
        aria-labelledby="suggest-name-heading"
        className="rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm p-4 sm:p-6 space-y-4"
      >
        <div>
          <h2
            id="suggest-name-heading"
            className="font-headline-sm text-headline-sm text-primary font-bold"
          >
            Suggest a name
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
            Search iNaturalist or type your own species name.
          </p>
        </div>

        <form onSubmit={handleSubmitAnswer} className="space-y-3.5">
          {/* Species Name with 300ms iNaturalist autocomplete */}
          <div className="space-y-1.5 relative">
            <label
              htmlFor="answer-species-name"
              className="block font-label-md text-xs text-on-surface font-semibold"
            >
              Species name <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="answer-species-name"
                type="text"
                value={speciesName}
                onChange={(e) => {
                  setSpeciesName(e.target.value);
                  setSubmitAnswerError(null);
                }}
                onFocus={() => {
                  if (speciesResults.length > 0) setShowSuggestions(true);
                }}
                maxLength={160}
                placeholder="Search species or type your own..."
                className="w-full px-3.5 py-2.5 pr-10 min-h-[44px] rounded-xl bg-surface border border-outline-variant/50 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {speciesLoading && (
                <span
                  className="material-symbols-outlined text-[18px] text-primary animate-spin absolute right-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                >
                  progress_activity
                </span>
              )}
            </div>

            {speciesError && (
              <div className="flex items-center justify-between gap-2 text-xs text-error">
                <span>{speciesError}</span>
                <button
                  type="button"
                  onClick={() => setSpeciesSearchRetryTick((t) => t + 1)}
                  className="font-semibold underline shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {showSuggestions && speciesResults.length > 0 && (
              <div className="rounded-2xl bg-surface border border-outline-variant/40 shadow-lg max-h-60 overflow-y-auto divide-y divide-outline-variant/20">
                {speciesResults.map((taxon) => (
                  <button
                    key={taxon.id}
                    type="button"
                    onClick={() => handlePickTaxon(taxon)}
                    className="w-full px-3 py-2.5 min-h-[44px] text-left hover:bg-surface-container-low flex items-center gap-2.5 transition-colors"
                  >
                    {taxon.photoUrl ? (
                      <img
                        src={taxon.photoUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-lg object-cover shrink-0 bg-surface-container"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                          eco
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-xs sm:text-sm text-on-surface font-semibold truncate">
                        {taxon.commonName}
                      </p>
                      {taxon.scientificName && (
                        <p className="font-body-sm text-xs italic text-on-surface-variant truncate">
                          {taxon.scientificName}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-surface-container-low"
                >
                  Use &ldquo;{speciesName.trim()}&rdquo; as typed
                </button>
              </div>
            )}
          </div>

          {/* Scientific Name (optional / auto-filled) */}
          <div className="space-y-1.5">
            <label
              htmlFor="answer-scientific-name"
              className="block font-label-md text-xs text-on-surface font-semibold"
            >
              Scientific name (optional)
            </label>
            <input
              id="answer-scientific-name"
              type="text"
              value={scientificName}
              onChange={(e) => setScientificName(e.target.value)}
              maxLength={160}
              placeholder="e.g., Cyanocitta stelleri"
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface border border-outline-variant/50 text-sm italic text-on-surface placeholder:not-italic placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="answer-explanation"
                className="font-label-md text-xs text-on-surface font-semibold"
              >
                Why do you think so?
              </label>
              <span className="font-body-sm text-[11px] text-on-surface-variant tabular-nums">
                {explanation.length}/800
              </span>
            </div>
            <textarea
              id="answer-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={800}
              rows={3}
              placeholder="Point out key markings, shape, habitat, or similar species..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/50 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {submitAnswerError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium"
            >
              {submitAnswerError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingAnswer}
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              {submittingAnswer && (
                <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                  progress_activity
                </span>
              )}
              <span>{submittingAnswer ? 'Posting...' : 'Post suggestion'}</span>
            </button>
          </div>
        </form>

        {/* Ask the AI scanner hint under the form */}
        <div className="pt-3 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
            Not sure? Try the AI scanner too. It can be wrong, so check with others.
          </p>
          <Link
            to="/scan"
            className="w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-full bg-surface-container-low border border-outline-variant/40 text-tertiary font-label-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-surface-container shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              document_scanner
            </span>
            <span>Ask the AI scanner</span>
          </Link>
        </div>
      </section>

      {/* Edit Question Modal */}
      <AskQuestionFormModal
        isOpen={editOpen}
        questionToEdit={question}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setQuestion((prev) =>
            prev
              ? {
                  ...updated,
                  answerCount: prev.answerCount,
                  author: prev.author.username ? prev.author : updated.author,
                }
              : updated
          );
          setToast('Question updated.');
        }}
      />

      {/* Delete Question Confirmation Dialog */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!deletingQuestion) {
              setConfirmDeleteOpen(false);
              setDeleteQuestionError(null);
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
                  This will remove &ldquo;{question.title}&rdquo; and its photo permanently.
                </p>
              </div>
            </div>

            {deleteQuestionError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium">
                {deleteQuestionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingQuestion}
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setDeleteQuestionError(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingQuestion}
                onClick={handleConfirmDeleteQuestion}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {deletingQuestion && (
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                    progress_activity
                  </span>
                )}
                <span>{deletingQuestion ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Own Answer Confirmation Dialog */}
      {answerToDelete && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!deletingAnswer) {
              setAnswerToDelete(null);
              setDeleteAnswerError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete answer"
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
                  Delete your answer?
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 break-words">
                  Remove your suggestion &ldquo;{answerToDelete.speciesName}&rdquo;?
                </p>
              </div>
            </div>

            {deleteAnswerError && (
              <div className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium">
                {deleteAnswerError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingAnswer}
                onClick={() => {
                  setAnswerToDelete(null);
                  setDeleteAnswerError(null);
                }}
                className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md font-semibold hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAnswer}
                onClick={handleConfirmDeleteAnswer}
                className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {deletingAnswer && (
                  <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                    progress_activity
                  </span>
                )}
                <span>{deletingAnswer ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <AskReportModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmitted={(msg) => setToast(msg)}
      />

      {/* Photo Lightbox */}
      {lightboxOpen && question.photoUrl && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close photo"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              close
            </span>
          </button>
          <img
            src={question.photoUrl}
            alt={question.title}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-2xl object-contain"
          />
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
