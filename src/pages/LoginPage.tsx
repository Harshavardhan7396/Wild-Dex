import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WildDexLogo } from '../components/common/WildDexLogo';

export const LoginPage: React.FC = () => {
  const { signUpWithEmail, signInWithEmail, continueAsGuest } = useAuth();

  // Mode: 'signup' (default) or 'signin'
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const validateForm = (): boolean => {
    setError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (mode === 'signup') {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        setError('Please choose a username.');
        return false;
      }
      // 3 to 20 characters, letters, numbers, underscores
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(trimmedUsername)) {
        setError(
          'Username must be between 3 and 20 characters and contain only letters, numbers, or underscores.'
        );
        return false;
      }

      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return false;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter your confirm password.');
        return false;
      }
    } else {
      if (!password) {
        setError('Please enter your password.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (mode === 'signup') {
        const result = await signUpWithEmail(email, password, username);
        if (result.user && !result.session) {
          setInfoMessage(
            'Account created successfully! Please check your email inbox to confirm your registration.'
          );
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials and try again.';
      if (msg.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email or password. Please double check and retry.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const collageImg =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC4hwOdR9hp5RHvj9IfjLwfa9xIxn2vjXW4hQZ9ZuP1PsyRffqhOrTrl4-JUSXrMQ1DspDaB1LcoZf3s2DWtol-04Jqmk86MWX_dGClszqQzoz9uFY4uuUoHjf0aglX2sok0f0xvmjFZuGJjBhyqaXyngGrNg59R-5tywDbOfWuMwnWE96ID9oueMxiMP1acV1qtRw5DrWaBHx4oI3ORnP-7FPTfMeGrF_BpnMXJmSl8TymzrfrPldAHg';

  const termsUrl = 'https://sites.google.com/view/wilddex-terms';
  const privacyUrl = 'https://sites.google.com/view/wilddex-privacy';

  return (
    <div className="min-h-screen w-full bg-[#FAF7F0] font-sans antialiased text-[#1b2a22] flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12">
      {/* Container: Responsive Single-Column on Mobile, Two-Column on Desktop (Stitch Design) */}
      <main className="w-full max-w-5xl bg-[#FDFBF7] rounded-[32px] sm:rounded-[36px] shadow-2xl border border-[#DFD5C2]/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
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
                <WildDexLogo className="w-full h-full" />
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
          <div className="relative z-10 max-w-md pt-24">
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
        <div className="lg:col-span-5 bg-[#FAF7F0] flex flex-col justify-between p-6 sm:p-8 md:p-10 overflow-y-auto">
          {/* Top Brand Header: Small Logo + Wordmark */}
          <div className="flex items-center justify-center lg:justify-start gap-2.5 pt-1">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1b4332] flex items-center justify-center shadow-sm ring-1 ring-[#40916c]/20 p-0.5">
              <WildDexLogo className="w-full h-full" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-[#1b4332]">
              Wild<span className="text-[#40916c]">Dex</span>
            </span>
          </div>

          {/* Mobile-Only Wildlife Image Card (Shown below lg) */}
          <div className="lg:hidden my-3 flex flex-col items-center">
            <div className="relative w-full max-w-[340px] aspect-[16/9] rounded-2xl overflow-hidden shadow-md border border-[#DFD5C2]/80 bg-[#F4EFE6]">
              <img
                src={collageImg}
                alt="Wildlife discovery collage"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#081c15]/60 to-transparent pointer-events-none" />
              <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#081c15]/75 backdrop-blur-md text-white text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#52b788] animate-pulse" />
                <span>1.2M+ Species Cataloged</span>
              </div>
            </div>
          </div>

          {/* Headings & Form */}
          <div className="my-auto py-2 flex flex-col items-center lg:items-start text-center lg:text-left w-full">
            <h1 className="font-extrabold text-2xl sm:text-[26px] text-[#081c15] tracking-tight">
              {mode === 'signup' ? 'Create an Account' : 'Welcome to WildDex'}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-stone-600 mt-1 leading-relaxed max-w-sm">
              {mode === 'signup'
                ? 'Sign up to catalog species and build your field collection.'
                : 'Sign in to access your personal collection and records.'}
            </p>

            {/* Mode Switcher Tabs */}
            <div className="w-full max-w-[340px] mt-4 p-1 rounded-full bg-[#EAE2D4]/70 flex items-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-full font-label-md text-xs font-bold transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-[#1b4332] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-1.5 rounded-full font-label-md text-xs font-bold transition-all ${
                  mode === 'signin'
                    ? 'bg-white text-[#1b4332] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="w-full max-w-[340px] mt-3.5 p-3 rounded-2xl bg-[#ffdad6] text-[#93000a] text-xs text-left flex items-start gap-2 border border-[#ba1a1a]/20 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px] text-[#ba1a1a] shrink-0 mt-0.5">
                  error
                </span>
                <span className="flex-1 leading-relaxed">{error}</span>
              </div>
            )}

            {/* Info / Confirmation Notification */}
            {infoMessage && (
              <div className="w-full max-w-[340px] mt-3.5 p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332] text-xs text-left flex items-start gap-2 border border-[#52b788]/30 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px] text-[#1b4332] shrink-0 mt-0.5">
                  check_circle
                </span>
                <span className="flex-1 leading-relaxed">{infoMessage}</span>
              </div>
            )}

            {/* Email & Password Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-[340px] mt-4 space-y-3">
              {/* Username Field (Sign-up only) */}
              {mode === 'signup' && (
                <div className="text-left">
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-stone-400 pointer-events-none">
                      person
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. naturalist_maya"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="w-full h-11 pl-10 pr-3 rounded-2xl bg-white border border-[#DFD5C2] text-stone-900 placeholder:text-stone-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1b4332]/40 focus:border-[#1b4332] shadow-xs transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 pl-1">
                    3 to 20 characters (letters, numbers, underscores)
                  </p>
                </div>
              )}

              {/* Email Field */}
              <div className="text-left">
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Email
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-stone-400 pointer-events-none">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="explorer@example.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full h-11 pl-10 pr-3 rounded-2xl bg-white border border-[#DFD5C2] text-stone-900 placeholder:text-stone-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1b4332]/40 focus:border-[#1b4332] shadow-xs transition-all"
                  />
                </div>
              </div>

              {/* Password Field with Show/Hide Eye Icon */}
              <div className="text-left">
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-stone-400 pointer-events-none">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-[#DFD5C2] text-stone-900 placeholder:text-stone-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1b4332]/40 focus:border-[#1b4332] shadow-xs transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="text-[10px] text-stone-500 mt-1 pl-1">At least 8 characters</p>
                )}
              </div>

              {/* Confirm Password Field (Sign-up only) */}
              {mode === 'signup' && (
                <div className="text-left">
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-stone-400 pointer-events-none">
                      lock_reset
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-[#DFD5C2] text-stone-900 placeholder:text-stone-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1b4332]/40 focus:border-[#1b4332] shadow-xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button with Loading State */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white active:scale-[0.98] transition-all rounded-full shadow-md font-label-lg font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>{mode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                )}
              </button>

              {/* Mode Toggle Switcher Text */}
              <div className="pt-1 text-center">
                {mode === 'signup' ? (
                  <p className="text-xs text-stone-600">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="font-bold text-[#1b4332] hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-stone-600">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="font-bold text-[#1b4332] hover:underline cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </p>
                )}
              </div>

              {/* Divider with "or" */}
              <div className="relative flex items-center justify-center pt-1">
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
                className="w-full py-2 text-center text-xs font-semibold text-[#2d6a4f] hover:text-[#081c15] active:scale-95 transition-all cursor-pointer"
              >
                Continue as guest
              </button>
            </form>

            {/* Desktop Quick Info Pill from Stitch template */}
            <div className="hidden lg:flex w-full max-w-[340px] mt-5 p-3 rounded-2xl bg-[#F4EFE6]/70 border border-[#DFD5C2] items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-xl bg-[#2d6a4f] text-white flex items-center justify-center shrink-0 text-sm">
                🌿
              </div>
              <div className="text-xs">
                <p className="font-semibold text-[#081c15]">Offline Species Identification</p>
                <p className="text-stone-500 text-[11px]">Local AI model runs even deep in backcountry trails.</p>
              </div>
            </div>
          </div>

          {/* Bottom Legal / Terms and Privacy */}
          <footer className="pt-3 border-t border-[#DFD5C2]/50 text-center lg:text-left">
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
