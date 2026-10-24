import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../contexts/AuthContext';
import { LoginScreen } from '../auth/LoginScreen';

export const AppLayout: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="bg-surface text-on-surface font-body-md min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              forest
            </span>
          </div>
          <span className="font-label-md text-on-surface-variant">Connecting to WildDex...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="bg-surface text-on-surface font-body-md antialiased min-h-screen flex flex-col selection:bg-secondary-container">
        <Header />
        <main className="flex-1 w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto bg-surface pt-16 md:pt-20 pb-16 flex flex-col items-center justify-center transition-all">
          <LoginScreen />
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface font-body-md antialiased min-h-screen flex flex-col selection:bg-secondary-container">
      <Header />
      <main className="flex-1 w-full max-w-lg md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto bg-surface pt-16 md:pt-20 pb-28 md:pb-16 flex flex-col transition-all">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
