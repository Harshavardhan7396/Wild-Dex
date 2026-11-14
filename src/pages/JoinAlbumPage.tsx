import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { acceptAlbumInvite } from '../services/sharedAlbumService';

export const JoinAlbumPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, setAuthModalOpen } = useAuth();

  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const promptedLoginRef = useRef(false);
  const attemptedKeyRef = useRef<string | null>(null);

  const attemptJoin = useCallback(async () => {
    if (!currentUser || !code.trim()) return;
    setStatus('joining');
    setErrorMessage(null);
    try {
      const albumId = await acceptAlbumInvite(code);
      try {
        sessionStorage.removeItem('wilddex_pending_join_code');
      } catch {}
      navigate(`/shared-collection/${albumId}`, { replace: true });
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Invite is invalid or expired');
    }
  }, [currentUser, code, navigate]);

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      if (code) {
        try {
          sessionStorage.setItem('wilddex_pending_join_code', code);
        } catch {}
      }
      if (!promptedLoginRef.current) {
        promptedLoginRef.current = true;
        setAuthModalOpen(true);
      }
      return;
    }

    const attemptKey = `${currentUser.id}:${code}`;
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;
    attemptJoin();
  }, [authLoading, currentUser, code, setAuthModalOpen, attemptJoin]);

  if (authLoading || status === 'joining') {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-md w-full rounded-2xl bg-surface-container-low border border-outline-variant/25 p-6 shadow-sm flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-primary animate-spin">
            progress_activity
          </span>
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            Joining shared album...
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Checking your invite link.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-md w-full rounded-2xl bg-surface-container-low border border-outline-variant/25 p-6 shadow-sm flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">folder_shared</span>
          </div>
          <h1 className="font-headline-sm text-headline-sm text-primary font-bold">
            Sign in to join this album
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Sign in or create an account first. We will bring you right back to this invite.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="mt-1 px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Sign In to Accept Invite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full rounded-2xl bg-surface-container-low border border-outline-variant/25 p-6 shadow-sm flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px]">link_off</span>
        </div>
        <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">
          {errorMessage || 'Invite is invalid or expired'}
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Ask the album owner to send you a fresh invite link.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          <button
            type="button"
            onClick={() => {
              attemptedKeyRef.current = null;
              attemptJoin();
            }}
            className="px-4 py-2 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
          >
            Retry
          </button>
          <Link
            to="/shared-collection"
            className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Go to Shared Collection
          </Link>
        </div>
      </div>
    </div>
  );
};
