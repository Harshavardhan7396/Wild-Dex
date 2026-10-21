import React, { useState } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
  iconSize?: number;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  className = '',
  iconSize = 14,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(!open);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="What does this mean?"
        title="What does this mean?"
        className="inline-flex items-center justify-center text-outline hover:text-primary transition-colors p-0.5 rounded-full hover:bg-surface-container active:scale-95 cursor-pointer"
      >
        <span
          className="material-symbols-outlined leading-none"
          style={{ fontSize: `${iconSize}px` }}
        >
          info
        </span>
      </button>

      {open && (
        <span
          role="tooltip"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 sm:w-56 p-2 rounded-xl bg-inverse-surface text-inverse-on-surface text-[11px] leading-tight shadow-xl z-50 text-center font-normal pointer-events-auto"
        >
          <span className="block font-bold text-primary-fixed mb-0.5">What does this mean?</span>
          <span>{text}</span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-inverse-surface"></span>
        </span>
      )}
    </span>
  );
};
