import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export const AppLayout: React.FC = () => {
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
