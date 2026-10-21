import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<'weekly' | 'alltime'>('weekly');
  const [leagueFilter, setLeagueFilter] = useState<'regional' | 'global'>('regional');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const rankings = [
    { rank: 1, name: 'Dr. Aris Thorne', xp: 3420, species: 89, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ', badge: 'Apex Naturalist' },
    { rank: 2, name: 'Sarah Jenkins', xp: 2890, species: 74, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ', badge: 'Flora Scout' },
    { rank: 3, name: 'Leo Brooks', xp: 2410, species: 62, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ', badge: 'Slug Whisperer' },
    { rank: 4, name: 'Maya Brooks (You)', xp: 2150, species: 48, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ', isCurrentUser: true, badge: 'Level 4 Explorer' },
    { rank: 5, name: 'Elena Vance', xp: 1980, species: 41, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ', badge: 'Canopy Rigger' },
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

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <span className="font-headline-sm text-headline-sm text-primary font-bold">BioBlitz League</span>
        <div className="w-10"></div>
      </div>

      {/* Active Weekly Challenge Hero Card */}
      <div className="p-space-md rounded-2xl bg-primary text-on-primary shadow-lg flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary-container text-[20px]">emoji_events</span>
            <span className="font-label-sm text-label-sm uppercase font-bold text-secondary-container tracking-wider">
              Weekly Field Expedition
            </span>
          </div>
          <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-on-primary/20 text-on-primary font-medium">
            3d 14h left
          </span>
        </div>

        <div>
          <h2 className="font-headline-md text-headline-md font-bold leading-tight">
            Arthropod Blitz: Find 5 Insects
          </h2>
          <p className="font-body-sm text-body-sm text-on-primary-container mt-1">
            Find and scan 5 bugs or pollinators this week to earn +500 points and a special badge!
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between font-label-sm text-label-sm">
            <span>Current Progress</span>
            <span className="font-bold">3 / 5 Found (60%)</span>
          </div>
          <div className="h-2 w-full bg-on-primary/20 rounded-full overflow-hidden flex">
            <div className="h-full bg-secondary-container rounded-full" style={{ width: '60%' }}></div>
          </div>
        </div>

        <button
          onClick={() => navigate('/scan')}
          className="w-full h-11 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform mt-1"
        >
          <span className="material-symbols-outlined text-[18px]">document_scanner</span>
          <span>Scan Next Bug</span>
        </button>
      </div>

      {/* Leaderboard Segmented Filters */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-surface-container-low p-1 rounded-full flex-1">
          <button
            onClick={() => setTimeFilter('weekly')}
            className={`flex-1 py-1.5 rounded-full font-label-md text-label-md transition-all ${
              timeFilter === 'weekly' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeFilter('alltime')}
            className={`flex-1 py-1.5 rounded-full font-label-md text-label-md transition-all ${
              timeFilter === 'alltime' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            All-Time
          </button>
        </div>

        <div className="flex bg-surface-container-low p-1 rounded-full">
          <button
            onClick={() => setLeagueFilter('regional')}
            className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
              leagueFilter === 'regional' ? 'bg-surface-container-lowest text-secondary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            PNW
          </button>
          <button
            onClick={() => setLeagueFilter('global')}
            className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all ${
              leagueFilter === 'global' ? 'bg-surface-container-lowest text-secondary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            Global
          </button>
        </div>
      </div>

      {/* Podium (Top 3 Naturalists) */}
      <div className="pt-2 pb-1 grid grid-cols-3 gap-2 items-end text-center">
        {/* 2nd Place */}
        <div className="p-3 rounded-2xl bg-surface-container-low flex flex-col items-center gap-1 shadow-sm">
          <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center">
            2
          </span>
          <img alt="Sarah" src={rankings[1].avatar} className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-300" />
          <p className="font-label-md text-label-md font-bold text-on-surface truncate max-w-[80px]">Sarah</p>
          <span className="font-label-sm text-xs text-secondary font-semibold">2,890 XP</span>
        </div>

        {/* 1st Place */}
        <div className="p-3.5 rounded-2xl bg-secondary-container/40 flex flex-col items-center gap-1.5 shadow-md relative -top-2">
          <span className="w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-bold text-sm flex items-center justify-center shadow-sm">
            1
          </span>
          <img alt="Dr. Aris" src={rankings[0].avatar} className="w-14 h-14 rounded-full object-cover ring-3 ring-amber-400" />
          <p className="font-label-md text-label-md font-bold text-on-surface truncate max-w-[90px]">Dr. Aris</p>
          <span className="font-label-md text-sm text-secondary font-bold">3,420 XP</span>
        </div>

        {/* 3rd Place */}
        <div className="p-3 rounded-2xl bg-surface-container-low flex flex-col items-center gap-1 shadow-sm">
          <span className="w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center">
            3
          </span>
          <img alt="Leo" src={rankings[2].avatar} className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-700" />
          <p className="font-label-md text-label-md font-bold text-on-surface truncate max-w-[80px]">Leo</p>
          <span className="font-label-sm text-xs text-secondary font-semibold">2,410 XP</span>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-2">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Explorer Rankings</h3>
        {rankings.map((user) => (
          <div
            key={user.rank}
            className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
              user.isCurrentUser
                ? 'bg-primary-container/20 ring-2 ring-primary text-on-surface font-semibold'
                : 'hover:bg-surface-container'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 text-center font-bold text-sm text-on-surface-variant">
                #{user.rank}
              </span>
              <img alt={user.name} src={user.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="truncate">
                <p className="font-label-md text-label-md font-bold truncate">
                  {user.name}
                </p>
                <p className="font-body-sm text-[11px] text-on-surface-variant">
                  {user.species} discoveries • {user.badge}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-headline-sm text-sm font-bold text-secondary">
                {user.xp}
              </span>
              <span className="block text-[10px] text-on-surface-variant font-medium">XP</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
