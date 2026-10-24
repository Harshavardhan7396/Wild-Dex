import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, continueAsGuest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(
          err?.message ||
            'Could not sign in with Google. Please check your network connection and retry.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const logoUrl =
    'https://lh3.googleusercontent.com/aida/AEtjO1XWQm038pDedq78nXFB7mnJRppOQcmQjE8--gIYVIlNhli39pxsV8VKjjPXVF6xg_BL4lbadHXwpDRfL0dNx2ncwOKCOTxcXnHsPkQH_2H8haYHl6i9E-IrdpxAkHnMTSbrqzAV7C4_AuzN1ZNGXK7Kt43CIRtco2kz6MN15UZAdVxbLdXQFgq4FmUiLb6RsnQRS4OW4QvR20ANuxkkNIBCgRR1OfQP-L3tID2xbUMqJDrtJWa0hDZk6KFJ';

  const collageImg =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC4hwOdR9hp5RHvj9IfjLwfa9xIxn2vjXW4hQZ9ZuP1PsyRffqhOrTrl4-JUSXrMQ1DspDaB1LcoZf3s2DWtol-04Jqmk86MWX_dGClszqQzoz9uFY4uuUoHjf0aglX2sok0f0xvmjFZuGJjBhyqaXyngGrNg59R-5tywDbOfWuMwnWE96ID9oueMxiMP1acV1qtRw5DrWaBHx4oI3ORnP-7FPTfMeGrF_BpnMXJmSl8TymzrfrPldAHg';

  // Replaceable Google Sites links requested by user
  const termsUrl = 'https://sites.google.com/view/wilddex-terms';
  const privacyUrl = 'https://sites.google.com/view/wilddex-privacy';

  return (
    <div className="min-h-screen w-full bg-[#FAF7F0] font-sans antialiased text-[#1b2a22] flex items-center justify-center p-4 sm:p-6 md:p-10 lg:p-12">
      {/* Container: Responsive Single-Column on Mobile, Two-Column on Desktop (from Stitch Design) */}
      <main className="w-full max-w-5xl bg-[#FDFBF7] rounded-[32px] sm:rounded-[36px] shadow-2xl border border-[#DFD5C2]/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        {/* DESKTOP-ONLY LEFT COLUMN (Wildlife Collage Atmosphere: 7 cols) */}
        <div className="relative hidden lg:flex lg:col-span-7 bg-[#081c15] overflow-hidden flex-col justify-between p-10 xl:p-12">
          {/* Background Collage Imagery */}
          <img
            src={collageImg}
            alt="WildDex wildlife collage with tiger, butterfly and scarlet macaw"
            className="absolute inset-0 w-full h-full object-cover opacity-85 hover:scale-105 transition-transform duration-1000 ease-out"
          />
          {/* Rich Forest Green Ambient Vignette & Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#081c15] via-[#081c15]/40 to-[#1b4332]/40" />

          {/* Top Overlay Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#081c15]/75 backdrop-blur-md border border-white/15 text-white shadow-sm">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-[#2d6a4f] flex items-center justify-center p-0.5">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-semibold text-xs tracking-wider uppercase text-[#d8f3dc]">
                WildDex Explorer
              </span>
            </div>
            <span className="text-xs font-medium text-emerald-200/90 bg-[#1b4332]/60 backdrop-blur-sm px-3 py-1 rounded-full border border-[#52b788]/30">
              ● Global BioBlitz Active
            </span>
          </div>

          {/* Bottom Overlay Quote & Statistics */}
          <div className="relative z-10 max-w-md pt-32">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#74c69d] mb-2">
              <span>Biodiversity Archive</span>
              <span>•</span>
              <span>160 Biomes</span>
            </div>
            <h2 className="font-bold text-3xl xl:text-4xl text-white tracking-tight leading-tight">
              Every creature has a story. Begin yours.
            </h2>
            <p className="text-[#d8f3dc]/80 text-sm mt-3 leading-relaxed">
              Join over 45,000 field naturalists and biologists documenting species, tracking
              migrations, and safeguarding biodiversity.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN (Mobile Centered + Desktop Auth Card: 5 cols) */}
        <div className="lg:col-span-5 bg-[#FAF7F0] flex flex-col justify-between p-6 sm:p-10 md:p-12">
          {/* Top Brand Header: Small Logo + Wordmark */}
          <div className="flex items-center justify-center lg:justify-start gap-2.5 pt-1">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1b4332] flex items-center justify-center shadow-sm ring-1 ring-[#40916c]/20">
              <img src={logoUrl} alt="WildDex Icon" className="w-full h-full object-contain p-0.5" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-[#1b4332]">
              Wild<span className="text-[#40916c]">Dex</span>
            </span>
          </div>

          {/* Mobile-Only Wildlife Image Card (Shown below lg) */}
          <div className="lg:hidden my-4 flex flex-col items-center">
            <div className="relative w-full max-w-[340px] aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-[#DFD5C2]/80 bg-[#F4EFE6]">
              <img
                src={collageImg}
                alt="Wildlife discovery collage with tiger, butterfly, and scarlet macaw"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#081c15]/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#081c15]/75 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#52b788] animate-pulse" />
                <span>1.2M+ Species Cataloged</span>
              </div>
            </div>
          </div>

          {/* Headings & Form Actions */}
          <div className="my-auto py-2 sm:py-6 flex flex-col items-center lg:items-start text-center lg:text-left">
            <h1 className="font-extrabold text-2xl sm:text-3xl text-[#081c15] tracking-tight">
              Welcome to WildDex
            </h1>
            <p className="text-sm font-medium text-stone-600 mt-1.5 leading-relaxed max-w-sm">
              Identify wild species and build your collection.
            </p>

            {/* Error Notification with Retry */}
            {error && (
              <div className="w-full max-w-[340px] mt-4 p-3 rounded-2xl bg-[#ffdad6] text-[#93000a] text-xs text-left flex flex-col gap-2 border border-[#ba1a1a]/20 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#ba1a1a] shrink-0 mt-0.5">
                    error
                  </span>
                  <span className="flex-1">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="self-end px-3 py-1 rounded-full bg-[#ba1a1a] text-white font-bold text-[11px] hover:opacity-90 active:scale-95 transition-all"
                >
                  Retry Sign-In
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full max-w-[340px] mt-6 space-y-3.5">
              {/* Large Rounded Button: "Continue with Google" */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 bg-white hover:bg-stone-50 active:scale-[0.98] transition-all rounded-full border border-stone-300 shadow-sm flex items-center justify-center gap-3 px-5 group cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[20px] text-stone-700 animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span className="text-sm font-semibold text-stone-800 tracking-wide group-hover:text-stone-950">
                  {loading ? 'Connecting with Google...' : 'Continue with Google'}
                </span>
              </button>

              {/* Divider with "or" */}
              <div className="relative flex items-center justify-center my-1">
                <div className="border-t border-stone-300 w-full" />
                <span className="bg-[#FAF7F0] px-3 text-xs font-medium text-stone-500 uppercase tracking-widest">
                  or
                </span>
                <div className="border-t border-stone-300 w-full" />
              </div>

              {/* Secondary Button: "Continue as guest" */}
              <button
                type="button"
                onClick={continueAsGuest}
                className="w-full py-2.5 text-center text-sm font-semibold text-[#2d6a4f] hover:text-[#081c15] active:scale-95 transition-all cursor-pointer"
              >
                Continue as guest
              </button>
            </div>

            {/* Desktop Quick Info Pill from Stitch template */}
            <div className="hidden lg:flex w-full max-w-[340px] mt-6 p-3 rounded-2xl bg-[#F4EFE6]/70 border border-[#DFD5C2] items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-xl bg-[#2d6a4f] text-white flex items-center justify-center shrink-0 text-sm">
                🌿
              </div>
              <div className="text-xs">
                <p className="font-semibold text-[#081c15]">Offline Species Identification</p>
                <p className="text-stone-500">Local AI model runs even deep in backcountry trails.</p>
              </div>
            </div>
          </div>

          {/* Bottom Legal / Terms and Privacy */}
          <footer className="pt-4 border-t border-[#DFD5C2]/50 text-center lg:text-left">
            <p className="text-[11px] leading-relaxed text-stone-500 max-w-[320px] mx-auto lg:mx-0">
              By continuing you agree to our{' '}
              <a
                href={termsUrl}
                target="_blank"
                rel="noreferrer noopener"
                title="[paste your Google Sites links here]"
                className="underline text-stone-700 hover:text-[#1b4332] font-medium"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href={privacyUrl}
                target="_blank"
                rel="noreferrer noopener"
                title="[paste your Google Sites links here]"
                className="underline text-stone-700 hover:text-[#1b4332] font-medium"
              >
                Privacy Policy
              </a>
              .
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};
