import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  isExiting?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isExiting = false }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [stage, setStage] = useState(0); // 0 = logo, 1 = wordmark, 2 = tagline & bar
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setStage(2);
      setProgress(100);
      return;
    }

    // Phase 1: Logo immediately starts fading in
    setStage(0);

    // Phase 2: Wordmark fades in after 400ms
    const t1 = setTimeout(() => {
      setStage(1);
    }, 400);

    // Phase 3: Tagline and loading bar fade in after 800ms
    const t2 = setTimeout(() => {
      setStage(2);
    }, 800);

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return 96;
        const inc = Math.floor(Math.random() * 8) + 4;
        return Math.min(96, prev + inc);
      });
    }, 150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(progressInterval);
    };
  }, [prefersReducedMotion]);

  const logoUrl =
    'https://lh3.googleusercontent.com/aida/AEtjO1XWQm038pDedq78nXFB7mnJRppOQcmQjE8--gIYVIlNhli39pxsV8VKjjPXVF6xg_BL4lbadHXwpDRfL0dNx2ncwOKCOTxcXnHsPkQH_2H8haYHl6i9E-IrdpxAkHnMTSbrqzAV7C4_AuzN1ZNGXK7Kt43CIRtco2kz6MN15UZAdVxbLdXQFgq4FmUiLb6RsnQRS4OW4QvR20ANuxkkNIBCgRR1OfQP-L3tID2xbUMqJDrtJWa0hDZk6KFJ';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading WildDex"
      className={`fixed inset-0 z-[100] min-h-screen bg-gradient-to-b from-[#0B2319] via-[#0E2C20] to-[#071710] flex flex-col items-center justify-between px-6 pt-16 pb-10 select-none overflow-hidden transition-opacity duration-300 ${
        isExiting && !prefersReducedMotion ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Background Lighting & Organic Wildlife Rings */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div
          className={`w-[440px] h-[440px] rounded-full bg-[#40916c]/20 blur-[90px] ${
            !prefersReducedMotion ? 'animate-pulse' : ''
          }`}
        />
        <div className="absolute w-[280px] h-[280px] rounded-full bg-emerald-400/15 blur-[60px]" />

        {/* Subtle organic contour curves from Stitch source */}
        <svg
          className="absolute w-full h-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 400 800"
          fill="none"
          stroke="currentColor"
        >
          <path d="M-50,200 C100,160 300,280 450,220" strokeWidth="1.5" />
          <path d="M-50,400 C150,340 250,460 450,390" strokeWidth="1.5" />
          <path d="M-50,600 C120,550 280,670 450,610" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Top Sub-Header / Status Bar */}
      <header className="w-full flex justify-between items-center z-10 opacity-70 max-w-sm">
        <span className="text-[11px] font-medium tracking-widest text-[#b7e4c7]/80 uppercase">
          Offline Ready • v2.4
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full bg-[#52b788] ${
              !prefersReducedMotion ? 'animate-ping' : ''
            }`}
          />
          <span className="text-[11px] font-medium text-[#b7e4c7]/80">Bio-Mesh Online</span>
        </div>
      </header>

      {/* Center Hero Section: Brand Logo, Soft Glow, Wordmark */}
      <section className="flex flex-col items-center text-center my-auto z-10 px-4">
        {/* Glow + Logo Emblem Container */}
        <div
          className={`relative flex items-center justify-center mb-6 transition-all duration-700 ${
            prefersReducedMotion
              ? 'opacity-100 scale-100'
              : stage >= 0
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95'
          }`}
        >
          {/* Soft circular aura behind the logo */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#40916c]/30 to-emerald-300/25 blur-2xl" />
          <div className="absolute -inset-2 rounded-full border border-[#52b788]/20" />

          {/* Rendered Vector Logo Emblem */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center p-1 bg-[#132a13]/60 rounded-full backdrop-blur-md shadow-2xl ring-1 ring-[#52b788]/30">
            <img
              src={logoUrl}
              alt="WildDex Logo Emblem"
              className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>

        {/* WildDex Wordmark & Biological Subtitle Indicator */}
        <div
          className={`flex flex-col items-center transition-all duration-700 ${
            prefersReducedMotion
              ? 'opacity-100 translate-y-0'
              : stage >= 1
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          }`}
        >
          <h1 className="font-extrabold text-4xl sm:text-5xl tracking-tight text-white mb-2 drop-shadow-sm font-sans">
            Wild<span className="text-[#52b788]">Dex</span>
          </h1>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#132a13]/70 border border-[#40916c]/40 backdrop-blur-sm">
            <svg
              className="w-3.5 h-3.5 text-[#52b788]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-semibold text-[#d8f3dc] tracking-wide uppercase">
              AI Field Naturalist
            </span>
          </div>
        </div>
      </section>

      {/* Bottom Section: Tagline & Sleek Loading Bar */}
      <footer
        className={`w-full flex flex-col items-center z-10 max-w-xs space-y-5 transition-all duration-700 ${
          prefersReducedMotion
            ? 'opacity-100 translate-y-0'
            : stage >= 2
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}
      >
        <p className="text-sm sm:text-base font-medium text-[#d8f3dc]/90 tracking-wide text-center">
          Discover every species on Earth
        </p>

        {/* Thin Loading Bar */}
        <div className="w-full space-y-2">
          <div className="w-full h-1.5 bg-[#132a13]/90 rounded-full overflow-hidden p-[1px] border border-[#40916c]/30 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#40916c] via-[#52b788] to-emerald-300 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(116,198,157,0.7)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#b7e4c7]/70 font-medium px-1">
            <span>Loading Cascadia Biome</span>
            <span className="font-mono">{progress}%</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
