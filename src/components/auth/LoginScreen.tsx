import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, isConfigured } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!isConfigured) {
      setError('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Please set your Supabase environment variables.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(err?.message || 'Sign in with Google failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-auto flex flex-col items-center text-center p-6 sm:p-8">
      {/* Brand Icon */}
      <div className="w-20 h-20 rounded-3xl bg-primary-container text-on-primary flex items-center justify-center shadow-lg mb-6 ring-4 ring-primary-fixed/30 animate-in fade-in zoom-in duration-300">
        <span className="material-symbols-outlined text-[42px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          forest
        </span>
      </div>

      <h1 className="font-headline-md text-headline-md text-primary font-bold tracking-tight">
        Welcome to WildDex
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed max-w-sm">
        Your pocket field naturalist. Identify wild species, maintain your personal collection, and discover local biodiversity.
      </p>

      {/* Configuration Error Alert if Supabase env vars are missing */}
      {!isConfigured && (
        <div className="w-full mt-6 p-4 rounded-2xl bg-error-container text-on-error-container text-left flex items-start gap-3 border border-error/30 shadow-sm animate-in fade-in">
          <span className="material-symbols-outlined text-[24px] text-error shrink-0 mt-0.5">error</span>
          <div className="flex-1">
            <h4 className="font-label-md font-bold text-error">Supabase Configuration Required</h4>
            <p className="font-body-sm text-xs mt-1 text-on-error-container/90 leading-relaxed">
              Missing <code className="px-1 py-0.5 rounded bg-black/10 font-mono text-[11px]">VITE_SUPABASE_URL</code> or{' '}
              <code className="px-1 py-0.5 rounded bg-black/10 font-mono text-[11px]">VITE_SUPABASE_ANON_KEY</code>.
              Please add these variables to your environment to enable real authentication and collection sync.
            </p>
          </div>
        </div>
      )}

      {/* Runtime Sign-In Error */}
      {error && (
        <div className="w-full mt-4 p-3 rounded-2xl bg-error-container text-on-error-container text-xs text-left flex items-center gap-2 border border-error/20">
          <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Google Sign In Call to Action */}
      <div className="w-full mt-8 space-y-3">
        <button
          onClick={handleSignIn}
          disabled={loading}
          type="button"
          className="w-full py-3.5 px-6 rounded-full bg-primary text-on-primary font-label-lg font-bold flex items-center justify-center gap-3 shadow-lg hover:opacity-95 active:scale-98 transition-all disabled:opacity-50"
        >
          {loading ? (
            <span className="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#ffffff"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#acf4a4"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#ffdbd1"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#ffffff"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{loading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
        </button>

        <p className="font-label-sm text-[11px] text-on-surface-variant">
          Sign in securely to catalog species and sync your collection across devices.
        </p>
      </div>

      {/* Feature Badges */}
      <div className="grid grid-cols-3 gap-2 w-full mt-10 pt-6 border-t border-outline-variant/30 text-center">
        <div className="p-3 rounded-2xl bg-surface-container-low flex flex-col items-center gap-1.5">
          <span className="material-symbols-outlined text-[22px] text-primary">photo_camera</span>
          <span className="font-label-sm text-[11px] font-semibold text-on-surface">AI Scanner</span>
        </div>
        <div className="p-3 rounded-2xl bg-surface-container-low flex flex-col items-center gap-1.5">
          <span className="material-symbols-outlined text-[22px] text-secondary">collections_bookmark</span>
          <span className="font-label-sm text-[11px] font-semibold text-on-surface">My Collection</span>
        </div>
        <div className="p-3 rounded-2xl bg-surface-container-low flex flex-col items-center gap-1.5">
          <span className="material-symbols-outlined text-[22px] text-tertiary">emoji_events</span>
          <span className="font-label-sm text-[11px] font-semibold text-on-surface">Achievements</span>
        </div>
      </div>
    </div>
  );
};
