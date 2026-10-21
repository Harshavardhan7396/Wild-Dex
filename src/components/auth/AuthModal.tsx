import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-center">
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
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-md">
          <span className="material-symbols-outlined text-[32px]">forest</span>
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
            Sign in to WildDex
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant mt-1.5 leading-relaxed">
            Connect with Google to catalog specimens into your personal Cloud Dex, organize field albums, and track biodiversity achievements.
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs text-left flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2 pt-1">
          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
            className="w-full py-3 px-4 rounded-full bg-primary text-on-primary font-label-lg font-bold flex items-center justify-center gap-3 shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
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
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          <p className="font-label-sm text-[11px] text-outline text-center">
            By signing in, your field discoveries and species logs will sync securely across your devices.
          </p>
        </div>
      </div>
    </div>
  );
};
