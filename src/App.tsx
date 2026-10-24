import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { SpeciesDetailPage } from './pages/SpeciesDetailPage';
import { ScannerPage } from './pages/ScannerPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { LifecyclePage } from './pages/LifecyclePage';
import { HealthCheckerPage } from './pages/HealthCheckerPage';
import { CollectionPage } from './pages/CollectionPage';
import { ProfilePage } from './pages/ProfilePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { FeedPage } from './pages/FeedPage';
import { InviteFriendsPage } from './pages/InviteFriendsPage';
import { SharedCollectionPage } from './pages/SharedCollectionPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { SplashScreen } from './components/auth/SplashScreen';

function AppContent() {
  const { currentUser, loading: authLoading, isGuest } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [isExitingSplash, setIsExitingSplash] = useState(false);
  const mountTimeRef = useRef<number>(Date.now());

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

  // 3. User is signed in or continuing as guest -> full app experience
  return (
    <HashRouter>
      <AuthModal />
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
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/invite" element={<InviteFriendsPage />} />
          <Route path="/shared-collection" element={<SharedCollectionPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
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
