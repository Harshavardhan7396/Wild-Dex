import React from 'react';

export const SafetyEmergencyBanner: React.FC = () => {
  return (
    <section
      aria-label="In an emergency"
      className="p-4 sm:p-5 rounded-2xl bg-error-container/50 border border-error/45 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-error text-on-error flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            emergency
          </span>
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="font-headline-sm text-base sm:text-lg text-on-error-container font-bold">
            In an emergency
          </h2>
          <p className="font-body-md text-sm text-on-error-container leading-relaxed">
            If someone has trouble breathing, is unconscious, or has a severe reaction, call your local emergency number now (112 in India, 911 in the US, 999 in the UK).
          </p>
        </div>
      </div>

      <a
        href="tel:112"
        className="no-print w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-full bg-error text-on-error font-label-md text-sm font-bold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          call
        </span>
        <span>Call 112</span>
      </a>
    </section>
  );
};

export const SafetyDisclaimerFooter: React.FC = () => {
  return (
    <aside
      aria-label="General safety notice"
      className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30"
    >
      <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant leading-relaxed">
        This guide is general information, not medical or veterinary advice. Identification by an app can be wrong. Always contact a doctor, a vet or a poison centre.
      </p>
    </aside>
  );
};
