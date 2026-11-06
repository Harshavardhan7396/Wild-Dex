import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, signUpWithEmail, signInWithEmail, isConfigured } = useAuth();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const validate = (): boolean => {
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (mode === 'signup') {
      const cleanUsername = username.trim();
      if (!cleanUsername) {
        setError('Please choose a username.');
        return false;
      }
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(cleanUsername)) {
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
        setError('Passwords do not match.');
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
    if (!validate()) return;

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (mode === 'signup') {
        const result = await signUpWithEmail(email, password, username);
        if (result.user && !result.session) {
          setInfoMessage('Account created! Please check your email to verify your registration.');
        } else {
          setAuthModalOpen(false);
        }
      } else {
        await signInWithEmail(email, password);
        setAuthModalOpen(false);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please try again.';
      if (msg.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in.');
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email or password.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-3 text-center max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Tree Brand Icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-md">
          <span className="material-symbols-outlined text-[28px]">forest</span>
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
            {mode === 'signup' ? 'Create Your Account' : 'Sign In to WildDex'}
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-relaxed">
            {mode === 'signup'
              ? 'Join to catalog specimens, sync field albums, and track achievements.'
              : 'Sign in with your email and password to access your collection.'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="w-full p-1 rounded-full bg-surface-container flex items-center mt-1">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-1 rounded-full font-label-md text-xs font-bold transition-all ${
              mode === 'signup'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant'
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
            className={`flex-1 py-1 rounded-full font-label-md text-xs font-bold transition-all ${
              mode === 'signin'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant'
            }`}
          >
            Sign In
          </button>
        </div>

        {!isConfigured && (
          <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-xs text-left flex items-start gap-2 border border-error/20">
            <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">error</span>
            <span>
              Missing <strong>VITE_SUPABASE_URL</strong> or <strong>VITE_SUPABASE_ANON_KEY</strong>. Please configure your environment variables.
            </span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs text-left flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="p-2.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs text-left flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">check_circle</span>
            <span className="flex-1 leading-relaxed">{infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5 text-left pt-1">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Username
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. naturalist_maya"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                />
              </div>
              <p className="text-[10px] text-on-surface-variant mt-0.5 pl-1">
                3–20 characters (letters, numbers, underscores)
              </p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Email
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline pointer-events-none">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="explorer@example.com"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline pointer-events-none">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full h-10 pl-9 pr-9 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline pointer-events-none">
                  lock_reset
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full h-10 pl-9 pr-9 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-3 rounded-full bg-primary text-on-primary font-label-md font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
                <span>{mode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <span>{mode === 'signup' ? 'Sign Up' : 'Sign In'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
