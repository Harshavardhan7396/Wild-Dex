import React, { useEffect, useState } from 'react';
import { ASK_REPORT_REASONS, submitAskReport } from '../../services/askService';

export interface AskReportTarget {
  type: 'question' | 'answer';
  id: string;
  label: string;
}

interface AskReportModalProps {
  target: AskReportTarget | null;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

export const AskReportModal: React.FC<AskReportModalProps> = ({
  target,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState(ASK_REPORT_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setReason(ASK_REPORT_REASONS[0]);
    setSubmitting(false);
    setError(null);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [target, submitting, onClose]);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitAskReport({
        targetType: target.type,
        targetId: target.id,
        reason,
      });
      onClose();
      onSubmitted('Thanks, we will review this.');
    } catch (err: any) {
      setError(err?.message || 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        aria-label={`Report ${target.type}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl border border-outline-variant/30 shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Report {target.type === 'question' ? 'question' : 'answer'}
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5 truncate">
              {target.label}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close report dialog"
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="font-label-md text-xs text-on-surface font-semibold mb-1">
              Why are you reporting this?
            </legend>
            {ASK_REPORT_REASONS.map((opt) => {
              const checked = reason === opt;
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer min-h-[44px] transition-colors ${
                    checked
                      ? 'bg-primary-container/15 border-primary text-on-surface'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <input
                    type="radio"
                    name="ask-report-reason"
                    value={opt}
                    checked={checked}
                    onChange={() => setReason(opt)}
                    className="accent-primary w-4 h-4 shrink-0"
                  />
                  <span className="font-body-sm text-sm text-on-surface font-medium">
                    {opt}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium"
            >
              {error}
            </div>
          )}

          <div className="pt-1 pb-safe flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md text-sm font-semibold hover:bg-surface-container disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-error text-on-error font-label-md text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {submitting && (
                <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                  progress_activity
                </span>
              )}
              <span>{submitting ? 'Sending...' : 'Submit report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
