import React from 'react';
import { NavLink } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-outline-variant/30"
      aria-label="Bottom navigation"
    >
      <div className="relative flex items-center justify-around h-16 px-space-xs max-w-lg mx-auto">
        {/* Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                home
              </span>
              <span className="font-label-sm text-label-sm">Home</span>
            </>
          )}
        </NavLink>

        {/* Explore */}
        <NavLink
          to="/explore"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                explore
              </span>
              <span className="font-label-sm text-label-sm">Explore</span>
            </>
          )}
        </NavLink>

        {/* Center Raised AI Scanner Button */}
        <div className="relative -top-5 flex flex-col items-center shrink-0">
          <NavLink
            to="/scan"
            aria-label="Scan Wildlife Specimen with AI"
            className="relative flex items-center justify-center w-14 h-14 rounded-full bg-tertiary text-on-tertiary shadow-[0_10px_24px_-4px_rgba(113,27,0,0.38),0_0_16px_2px_rgba(156,244,156,0.65)] ring-4 ring-surface active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[28px]">document_scanner</span>
          </NavLink>
          <span className="font-label-sm text-label-sm text-tertiary font-bold mt-0.5">Scan</span>
        </div>

        {/* Collection */}
        <NavLink
          to="/collection"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                bookmarks
              </span>
              <span className="font-label-sm text-label-sm">Collection</span>
            </>
          )}
        </NavLink>

        {/* Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined text-[24px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                person
              </span>
              <span className="font-label-sm text-label-sm">Profile</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};
