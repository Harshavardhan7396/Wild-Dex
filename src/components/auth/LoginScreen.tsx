import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signUpWithEmail, signInWithEmail, isConfigured } = useAuth();
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
    if (!isConfigured) {
      setError('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Please set your Supabase environment variables.');
      return;
    }

    if (!validate()) return;

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (mode === 'signup') {
        const result = await signUpWithEmail(email, password, username);
        if (result.user && !result.session) {
          setInfoMessage('Account created! Please check your email inbox to verify your account.');
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials and try again.';
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
    <div className="w-full max-w-md mx-auto my-auto flex flex-col items-center text-center p-6 sm:p-8">
      {/* Brand Icon */}
      <div className="w-16 h-16 rounded-3xl bg-primary-container text-on-primary flex items-center justify-center shadow-lg mb-4 ring-4 ring-primary-fixed/30 animate-in fade-in zoom-in duration-300">
        <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          forest
        </span>
      </div>

      <h1 className="font-headline-md text-headline-md text-primary font-bold tracking-tight">
        {mode === 'signup' ? 'Create an Account' : 'Welcome to WildDex'}
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed max-w-sm">
        {mode === 'signup'
          ? 'Sign up to catalog species and build your field collection.'
          : 'Sign in to access your personal collection and records.'}
      </p>

      {/* Mode Switcher */}
      <div className="w-full max-w-xs mt-4 p-1 rounded-full bg-surface-container flex items-center">
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
        <div className="w-full mt-4 p-3 rounded-2xl bg-error-container text-on-error-container text-left flex items-start gap-2 border border-error/30 shadow-sm animate-in fade-in">
          <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">error</span>
          <div className="flex-1 text-xs">
            <span className="font-bold block">Supabase Configuration Required</span>
            <span className="opacity-90">Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="w-full mt-3 p-3 rounded-2xl bg-error-container text-on-error-container text-xs text-left flex items-start gap-2 border border-error/20">
          <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
          <span className="flex-1 leading-relaxed">{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="w-full mt-3 p-3 rounded-2xl bg-secondary-container text-on-secondary-container text-xs text-left flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">check_circle</span>
          <span className="flex-1 leading-relaxed">{infoMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full mt-4 space-y-3 text-left">
        {mode === 'signup' && (
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Username
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-outline pointer-events-none">
                person
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. naturalist_maya"
                className="w-full h-11 pl-10 pr-3 rounded-2xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1 pl-1">
              3 to 20 characters (letters, numbers, underscores)
            </p>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Email
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-outline pointer-events-none">
              mail
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="explorer@example.com"
              className="w-full h-11 pl-10 pr-3 rounded-2xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-outline pointer-events-none">
              lock
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-11 pl-10 pr-10 rounded-2xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">
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
              <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-outline pointer-events-none">
                lock_reset
              </span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full h-11 pl-10 pr-10 rounded-2xl bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 mt-3 rounded-full bg-primary text-on-primary font-label-lg font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              <span>{mode === 'signup' ? 'Creating Account...' : 'Signing In...'}</span>
            </>
          ) : (
            <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
          )}
        </button>
      </form>
    </div>
  );
};
