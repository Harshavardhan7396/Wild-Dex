import React from 'react';
import { ASK_SAFETY_NOTICE, requiresAskSafetyNotice } from '../../services/askService';

interface AskSafetyNoticeProps {
  category?: string | null;
  className?: string;
}

export const AskSafetyNotice: React.FC<AskSafetyNoticeProps> = ({
  category,
  className = '',
}) => {
  if (!requiresAskSafetyNotice(category)) return null;

  return (
    <div
      role="note"
      className={`rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 p-3.5 flex items-start gap-2.5 ${className}`}
    >
      <span
        className="material-symbols-outlined text-[20px] text-amber-700 shrink-0 mt-0.5"
        aria-hidden="true"
      >
        warning
      </span>
      <p className="font-body-sm text-xs sm:text-sm leading-relaxed font-medium">
        {ASK_SAFETY_NOTICE}
      </p>
    </div>
  );
};
