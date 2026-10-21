import React from 'react';
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

import { AuthProvider } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';

export default function App() {
  return (
    <AuthProvider>
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
  </AuthProvider>
);
}
