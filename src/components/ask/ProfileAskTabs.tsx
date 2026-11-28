import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AskQuestion,
  ProfileAskAnswer,
  formatRelativeTime,
  getAskCategoryMeta,
} from '../../services/askService';

interface ProfileQuestionsTabProps {
  questions: AskQuestion[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const ProfileQuestionsTab: React.FC<ProfileQuestionsTabProps> = ({
  questions,
  loading,
  error,
  onRetry,
}) => {
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse" aria-label="Loading questions">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-surface-container-low border border-outline-variant/20 overflow-hidden"
          >
            <div className="aspect-[4/3] w-full bg-surface-container-high" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 rounded bg-surface-container-high" />
              <div className="h-3.5 w-20 rounded-full bg-surface-container-high" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5">
        <p className="font-body-sm text-sm text-error font-medium">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-sm text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
        <p className="font-body-md text-sm text-on-surface-variant">
          No questions asked yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {questions.map((q) => {
        const isSolved = q.status === 'solved';
        const catMeta = getAskCategoryMeta(q.category);
        const showPhoto = Boolean(q.photoUrl) && !brokenIds[q.id];

        return (
          <Link
            key={q.id}
            to={`/ask/${encodeURIComponent(q.id)}`}
            state={{ question: q }}
            className="rounded-2xl bg-surface-container-low border border-outline-variant/25 shadow-sm overflow-hidden flex flex-col group hover:border-primary/40 transition-colors min-w-0"
          >
            <div className="relative aspect-[4/3] w-full bg-surface-container overflow-hidden">
              {showPhoto ? (
                <img
                  src={q.photoUrl}
                  alt={q.title}
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenIds((prev) => ({ ...prev, [q.id]: true }))}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
                    {catMeta.icon}
                  </span>
                </div>
              )}

              <span
                className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm ${
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

            <div className="p-3 space-y-1 min-w-0">
              <h3 className="font-label-md text-sm text-on-surface group-hover:text-primary font-bold line-clamp-2 break-words transition-colors">
                {q.title}
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                {catMeta.label} &middot; {formatRelativeTime(q.createdAt)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

interface ProfileAnswersTabProps {
  answers: ProfileAskAnswer[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const ProfileAnswersTab: React.FC<ProfileAnswersTabProps> = ({
  answers,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse" aria-label="Loading answers">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-2"
          >
            <div className="h-4 w-44 rounded bg-surface-container-high" />
            <div className="h-3.5 w-32 rounded bg-surface-container-high" />
            <div className="h-3.5 w-full rounded bg-surface-container-high" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5">
        <p className="font-body-sm text-sm text-error font-medium">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 min-h-[40px] rounded-full bg-primary text-on-primary font-label-sm text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (answers.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center">
        <p className="font-body-md text-sm text-on-surface-variant">
          No answers given yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {answers.map((ans) => (
        <Link
          key={ans.id}
          to={`/ask/${encodeURIComponent(ans.questionId)}`}
          className="block p-3.5 sm:p-4 rounded-2xl bg-surface-container-low border border-outline-variant/25 shadow-sm hover:border-primary/40 transition-colors space-y-2 min-w-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-label-md text-sm text-on-surface font-bold break-words">
                  {ans.speciesName}
                </h3>
                {ans.isAccepted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-on-secondary text-[11px] font-semibold shrink-0">
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                      check_circle
                    </span>
                    <span>Best answer</span>
                  </span>
                )}
              </div>
              {ans.scientificName && (
                <p className="font-body-sm text-xs italic text-on-surface-variant break-words">
                  {ans.scientificName}
                </p>
              )}
            </div>
            <span className="font-body-sm text-xs text-on-surface-variant shrink-0">
              {formatRelativeTime(ans.createdAt)}
            </span>
          </div>

          {ans.explanation && (
            <p className="font-body-sm text-xs sm:text-sm text-on-surface line-clamp-2 break-words">
              {ans.explanation}
            </p>
          )}

          <div className="pt-2 border-t border-outline-variant/20 flex items-center gap-2.5 min-w-0">
            {ans.questionPhotoUrl && (
              <img
                src={ans.questionPhotoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-cover shrink-0 bg-surface-container"
              />
            )}
            <span className="font-body-sm text-xs text-primary font-medium truncate">
              {ans.questionTitle}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};
