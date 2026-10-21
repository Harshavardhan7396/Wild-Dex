import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import {
  FirebaseCollectionItem,
  getFirebaseUserCollection,
} from '../services/firebaseCollectionService';

export const ProfilePage: React.FC = () => {
  const { currentUser, userProfile, logout, setAuthModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'sightings' | 'badges' | 'taxonomy'>('sightings');
  const [userSpecimens, setUserSpecimens] = useState<FirebaseCollectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      getFirebaseUserCollection(currentUser.uid)
        .then((items) => setUserSpecimens(items))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  const totalLogged = userSpecimens.length;
  const rareLogged = userSpecimens.filter((s) => s.rarity !== 'Common').length;

  const badges = [
    {
      name: 'First Specimen',
      desc: 'Identified first wild organism',
      icon: 'camera_alt',
      date: 'Earned',
      unlocked: totalLogged >= 1,
    },
    {
      name: 'Endangered Sighting',
      desc: 'Verified IUCN Red List record',
      icon: 'emergency',
      date: 'Earned',
      unlocked: rareLogged >= 1,
    },
    {
      name: 'Arthropod Scout',
      desc: 'Documented 5+ insect taxa',
      icon: 'bug_report',
      date: 'Earned',
      unlocked: userSpecimens.filter((s) => s.category === 'insects').length >= 5,
    },
    {
      name: 'Avian Watcher',
      desc: 'Cataloged 3+ bird species',
      icon: 'flutter',
      date: 'Earned',
      unlocked: userSpecimens.filter((s) => s.category === 'birds').length >= 3,
    },
    {
      name: 'Cloud Dex Master',
      desc: 'Logged 10+ cloud observations',
      icon: 'cloud_done',
      date: 'Earned',
      unlocked: totalLogged >= 10,
    },
    {
      name: 'BioBlitz Champion',
      desc: 'Cataloged a Legendary tier species',
      icon: 'emoji_events',
      date: 'Locked',
      unlocked: userSpecimens.some((s) => s.rarity === 'Legendary'),
    },
  ];

  const taxonomyCoverage = [
    {
      label: 'Insects',
      count: userSpecimens.filter((s) => s.category === 'insects').length,
      total: 20,
      color: 'bg-secondary',
    },
    {
      label: 'Birds',
      count: userSpecimens.filter((s) => s.category === 'birds').length,
      total: 20,
      color: 'bg-primary',
    },
    {
      label: 'Plants & Flora',
      count: userSpecimens.filter((s) => s.category === 'plants').length,
      total: 20,
      color: 'bg-secondary-container',
    },
    {
      label: 'Fungi & Mycota',
      count: userSpecimens.filter((s) => s.category === 'fungi').length,
      total: 10,
      color: 'bg-tertiary',
    },
    {
      label: 'Mammals',
      count: userSpecimens.filter((s) => s.category === 'mammals').length,
      total: 15,
      color: 'bg-primary',
    },
    {
      label: 'Marine & Aquatic',
      count: userSpecimens.filter((s) => s.category === 'marine' || s.category === 'amphibians').length,
      total: 15,
      color: 'bg-secondary',
    },
  ];

  return (
    <div className="flex flex-col w-full px-margin pb-12 pt-2 space-y-space-md">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <span className="font-headline-sm text-headline-sm text-primary font-bold">Naturalist Profile</span>
        <div className="flex items-center gap-2">
          {currentUser && (
            <button
              onClick={() => {
                logout();
                showToast('Signed out successfully.');
              }}
              title="Sign Out"
              className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign Out</span>
            </button>
          )}
          <Link
            to="/invite"
            aria-label="Invite friends"
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>
        </div>
      </div>

      {/* Auth Protection Prompt if not signed in */}
      {!currentUser ? (
        <AuthPromptCard
          title="Sign in with Google to View Your Naturalist Profile"
          description="Access your field credentials, expedition rankings, level badges, and personal observation records across all your devices."
          icon="account_circle"
        />
      ) : (
        /* Profile Bio Card */
        <div className="p-space-md rounded-3xl bg-surface-container-high shadow-sm flex flex-col gap-3 border border-outline-variant/20">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {currentUser.photoURL ? (
                <img
                  alt={currentUser.displayName || 'Explorer'}
                  src={currentUser.photoURL}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-primary-fixed shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center ring-4 ring-primary-fixed shadow-md">
                  <span className="material-symbols-outlined text-[32px]">person</span>
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-secondary ring-2 ring-surface"></span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                  {currentUser.displayName || userProfile?.displayName || 'Wild Explorer'}
                </h1>
                <span className="material-symbols-outlined text-[18px] text-secondary">verified</span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                {userProfile?.location || 'Field Observer'} • {currentUser.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px] font-bold capitalize">
                  {userProfile?.experienceLevel || 'Enthusiast'} Level
                </span>
                <span className="font-label-sm text-[11px] text-secondary font-semibold">
                  {totalLogged * 150 + 200} XP
                </span>
              </div>
            </div>
          </div>

          <p className="font-body-sm text-body-sm text-on-surface-variant italic">
            "{userProfile?.bio || 'Documenting native biodiversity, seasonal phenology, and wild ecological corridors.'}"
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-outline-variant/30 text-center">
            <div className="p-2 rounded-2xl bg-surface-container-lowest">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                {totalLogged}
              </span>
              <p className="font-label-sm text-[10px] text-on-surface-variant">Taxa Logged</p>
            </div>
            <div className="p-2 rounded-2xl bg-surface-container-lowest">
              <span className="font-headline-sm text-headline-sm text-secondary font-bold">
                {rareLogged}
              </span>
              <p className="font-label-sm text-[10px] text-on-surface-variant">Rare Finds</p>
            </div>
            <div className="p-2 rounded-2xl bg-surface-container-lowest">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {badges.filter((b) => b.unlocked).length}
              </span>
              <p className="font-label-sm text-[10px] text-on-surface-variant">Badges</p>
            </div>
            <div className="p-2 rounded-2xl bg-surface-container-lowest">
              <span className="font-headline-sm text-headline-sm text-amber-600 font-bold">
                {userSpecimens.filter((s) => s.rarity === 'Legendary').length}
              </span>
              <p className="font-label-sm text-[10px] text-on-surface-variant">Legendary</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Navigation Hub */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/leaderboard"
          className="p-3 rounded-2xl bg-surface-container flex items-center justify-between hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-[22px]">leaderboard</span>
            <span className="font-label-md text-label-md font-bold text-on-surface">Leaderboard</span>
          </div>
          <span className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
        </Link>
        <Link
          to="/collection"
          className="p-3 rounded-2xl bg-surface-container flex items-center justify-between hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">collections_bookmark</span>
            <span className="font-label-md text-label-md font-bold text-on-surface">My Dex</span>
          </div>
          <span className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>
        </Link>
      </div>

      {/* Segmented Detail Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-full">
        {(['sightings', 'badges', 'taxonomy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-full font-label-md text-label-md capitalize transition-all ${
              activeTab === tab
                ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                : 'text-on-surface-variant'
            }`}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Sightings */}
      {activeTab === 'sightings' && (
        <div className="flex flex-col gap-2">
          {userSpecimens.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {userSpecimens.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-surface-container-low overflow-hidden border border-outline-variant/30 shadow-sm"
                >
                  <img src={item.photoUrl} alt={item.commonName} className="w-full aspect-square object-cover" />
                  <div className="p-2">
                    <p className="font-label-md font-bold text-xs truncate text-on-surface">{item.commonName}</p>
                    <p className="text-[10px] text-on-surface-variant italic truncate">{item.scientificName}</p>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        item.rarity === 'Legendary'
                          ? 'bg-amber-500/20 text-amber-700'
                          : item.rarity === 'Rare'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {item.rarity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-xs text-on-surface-variant">
              No recent field sightings logged yet.
            </p>
          )}
        </div>
      )}

      {/* Tab 2: Badges */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-2 gap-3">
          {badges.map((b, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-2xl flex flex-col gap-2 ${
                b.unlocked ? 'bg-surface-container-low shadow-sm border border-primary/20' : 'bg-surface-container opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    b.unlocked ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{b.icon}</span>
                </div>
                {b.unlocked && (
                  <span className="material-symbols-outlined text-[18px] text-secondary">verified</span>
                )}
              </div>
              <div>
                <h4 className="font-label-md text-label-md font-bold text-on-surface">{b.name}</h4>
                <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5">{b.desc}</p>
                <span className="inline-block mt-1 font-label-sm text-[10px] text-outline font-medium">
                  {b.unlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Taxonomy Coverage */}
      {activeTab === 'taxonomy' && (
        <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Taxonomic Distribution</h3>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">
              {totalLogged} Recorded Specimen(s)
            </span>
          </div>

          <div className="space-y-2.5">
            {taxonomyCoverage.map((item, idx) => {
              const pct = Math.min(100, Math.round((item.count / item.total) * 100));
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between font-label-sm text-label-sm text-on-surface">
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-on-surface-variant">
                      {item.count} / {item.total} logged ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden flex">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(item.count > 0 ? 5 : 0, pct)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
