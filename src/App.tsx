import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';

const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const SpeciesDetailPage = lazy(() => import('./pages/SpeciesDetailPage').then((m) => ({ default: m.SpeciesDetailPage })));
const ScannerPage = lazy(() => import('./pages/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const ComparisonPage = lazy(() => import('./pages/ComparisonPage').then((m) => ({ default: m.ComparisonPage })));
const LifecyclePage = lazy(() => import('./pages/LifecyclePage').then((m) => ({ default: m.LifecyclePage })));
const HealthCheckerPage = lazy(() => import('./pages/HealthCheckerPage').then((m) => ({ default: m.HealthCheckerPage })));
const CollectionPage = lazy(() => import('./pages/CollectionPage').then((m) => ({ default: m.CollectionPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const FeedPage = lazy(() => import('./pages/FeedPage').then((m) => ({ default: m.FeedPage })));
const InviteFriendsPage = lazy(() => import('./pages/InviteFriendsPage').then((m) => ({ default: m.InviteFriendsPage })));
const SharedCollectionPage = lazy(() => import('./pages/SharedCollectionPage').then((m) => ({ default: m.SharedCollectionPage })));
const JoinAlbumPage = lazy(() => import('./pages/JoinAlbumPage').then((m) => ({ default: m.JoinAlbumPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const CarePage = lazy(() => import('./pages/CarePage').then((m) => ({ default: m.CarePage })));
const CareDetailPage = lazy(() => import('./pages/CareDetailPage').then((m) => ({ default: m.CareDetailPage })));
const AskPage = lazy(() => import('./pages/AskPage').then((m) => ({ default: m.AskPage })));
const AskDetailPage = lazy(() => import('./pages/AskDetailPage').then((m) => ({ default: m.AskDetailPage })));
const LifeListPage = lazy(() => import('./pages/LifeListPage').then((m) => ({ default: m.LifeListPage })));
const LifeListDetailPage = lazy(() => import('./pages/LifeListDetailPage').then((m) => ({ default: m.LifeListDetailPage })));
const YearReviewPage = lazy(() => import('./pages/YearReviewPage').then((m) => ({ default: m.YearReviewPage })));
const SafetyPage = lazy(() => import('./pages/SafetyPage').then((m) => ({ default: m.SafetyPage })));
const SafetyDetailPage = lazy(() => import('./pages/SafetyDetailPage').then((m) => ({ default: m.SafetyDetailPage })));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { SplashScreen } from './components/auth/SplashScreen';

function PendingInviteRedirect({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    let pendingCode = '';
    try {
      pendingCode = sessionStorage.getItem('wilddex_pending_join_code') || '';
    } catch {}

    if (pendingCode && !location.pathname.startsWith('/join/')) {
      navigate(`/join/${encodeURIComponent(pendingCode)}`, { replace: true });
    }
  }, [enabled, location.pathname, navigate]);

  return null;
}

function AppContent() {
  const { currentUser, userProfile, loading: authLoading, isGuest } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [isExitingSplash, setIsExitingSplash] = useState(false);
  const mountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savePendingJoinCodeFromHash = () => {
      const match = window.location.hash.match(/^#\/join\/([^/?#]+)/);
      if (match?.[1]) {
        try {
          sessionStorage.setItem('wilddex_pending_join_code', decodeURIComponent(match[1]));
        } catch {}
      }
    };
    savePendingJoinCodeFromHash();
    window.addEventListener('hashchange', savePendingJoinCodeFromHash);
    return () => window.removeEventListener('hashchange', savePendingJoinCodeFromHash);
  }, []);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Minimum 2000ms, maximum 3000ms
    const MIN_SPLASH_TIME = prefersReducedMotion ? 400 : 2000;
    const MAX_SPLASH_TIME = 3000;

    let exitTimeout: NodeJS.Timeout | null = null;
    let minTimer: NodeJS.Timeout | null = null;
    let maxTimer: NodeJS.Timeout | null = null;

    const dismissSplash = () => {
      if (prefersReducedMotion) {
        setShowSplash(false);
      } else {
        setIsExitingSplash(true);
        exitTimeout = setTimeout(() => {
          setShowSplash(false);
        }, 300);
      }
    };

    // Hard ceiling: dismiss after 3 seconds maximum
    maxTimer = setTimeout(() => {
      dismissSplash();
    }, MAX_SPLASH_TIME);

    // Keep visible until Supabase session check finishes, with minimum 2 seconds
    if (!authLoading) {
      const elapsed = Date.now() - mountTimeRef.current;
      const waitRemaining = Math.max(0, MIN_SPLASH_TIME - elapsed);
      minTimer = setTimeout(() => {
        dismissSplash();
      }, waitRemaining);
    }

    return () => {
      if (minTimer) clearTimeout(minTimer);
      if (maxTimer) clearTimeout(maxTimer);
      if (exitTimeout) clearTimeout(exitTimeout);
    };
  }, [authLoading]);

  // 1. Show Splash on fresh page load (with smooth exit fade)
  if (showSplash) {
    return <SplashScreen isExiting={isExitingSplash} />;
  }

  // 2. If nobody is signed in after splash and user has not chosen guest mode, show LoginPage
  if (!currentUser && !isGuest) {
    return <LoginPage />;
  }

  // 3. Wait briefly if signed-in user's profile is still resolving
  if (currentUser && !userProfile) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-primary font-label-lg text-label-lg">
          <span className="material-symbols-outlined text-[24px] animate-spin">
            progress_activity
          </span>
          <span>Loading your profile...</span>
        </div>
      </div>
    );
  }

  // 4. After sign-up or sign-in, if profiles.onboarding_done is false, show full-screen onboarding flow
  if (currentUser && userProfile && !userProfile.onboardingCompleted) {
    return (
      <HashRouter>
        <OnboardingPage fullScreen />
      </HashRouter>
    );
  }

  // 5. User is signed in with onboarding done (or continuing as guest) -> full app experience
  return (
    <HashRouter>
      <PendingInviteRedirect enabled={Boolean(currentUser && userProfile?.onboardingCompleted)} />
      <AuthModal />
      <Suspense
        fallback={
          <div className="min-h-screen bg-surface flex items-center justify-center p-6">
            <div className="flex items-center gap-2.5 text-primary font-label-md">
              <span className="material-symbols-outlined text-[22px] animate-spin">
                progress_activity
              </span>
              <span>Loading...</span>
            </div>
          </div>
        }
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/species/:id" element={<SpeciesDetailPage />} />
            <Route path="/scan" element={<ScannerPage />} />
            <Route path="/compare" element={<ComparisonPage />} />
            <Route path="/lifecycle" element={<LifecyclePage />} />
            <Route path="/health" element={<HealthCheckerPage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/life-list" element={<LifeListPage />} />
            <Route path="/life-list/:itemId" element={<LifeListDetailPage />} />
            <Route path="/year-review" element={<YearReviewPage />} />
            <Route path="/care" element={<CarePage />} />
            <Route path="/care/:id" element={<CareDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/u/:username" element={<PublicProfilePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<ChatPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/ask/:id" element={<AskDetailPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/safety/:slug" element={<SafetyDetailPage />} />
            <Route path="/invite" element={<InviteFriendsPage />} />
            <Route path="/shared-collection" element={<SharedCollectionPage />} />
            <Route path="/shared-collection/:albumId" element={<SharedCollectionPage />} />
            <Route path="/join/:code" element={<JoinAlbumPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
