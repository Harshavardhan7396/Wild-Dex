import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ActiveChallenge,
  LeaderboardEntry,
  fetchActiveChallenge,
  fetchChallengeProgressCount,
  fetchLeaderboard,
  formatCountdown,
} from '../services/challengeService';

const TOP_LIST_LIMIT = 10;

const AvatarCircle: React.FC<{
  avatarUrl?: string;
  name: string;
  sizeClass?: string;
  ringClass?: string;
}> = ({ avatarUrl, name, sizeClass = 'w-9 h-9', ringClass = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name.trim().charAt(0) || 'E').toUpperCase();

  if (avatarUrl && !imgFailed) {
    return (
      <img
        alt={name}
        src={avatarUrl}
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 bg-surface-container ${ringClass}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeClass} rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center shrink-0 select-none ${ringClass}`}
    >
      {initial}
    </div>
  );
};

export const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, setAuthModalOpen } = useAuth();

  const [timeFilter, setTimeFilter] = useState<'weekly' | 'alltime'>('weekly');
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [myProgress, setMyProgress] = useState<number>(0);
  const [challengeLoading, setChallengeLoading] = useState<boolean>(true);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [boardLoading, setBoardLoading] = useState<boolean>(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Live countdown tick every second when an active challenge is shown
  useEffect(() => {
    if (!challenge) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge?.id, challenge?.endsAt]);

  const loadChallengeAndProgress = useCallback(async (): Promise<ActiveChallenge | null> => {
    setChallengeLoading(true);
    setChallengeError(null);
    try {
      const active = await fetchActiveChallenge();
      setChallenge(active);

      if (active && currentUser) {
        try {
          const count = await fetchChallengeProgressCount({
            userId: currentUser.id,
            category: active.category,
            startsAt: active.startsAt,
          });
          setMyProgress(count);
        } catch (progressErr: any) {
          console.error('Could not load challenge progress:', progressErr);
          setMyProgress(0);
        }
      } else {
        setMyProgress(0);
      }

      return active;
    } catch (err: any) {
      setChallengeError(err?.message || 'Could not load the weekly challenge.');
      return null;
    } finally {
      setChallengeLoading(false);
    }
  }, [currentUser]);

  const loadRankings = useCallback(
    async (mode: 'weekly' | 'alltime', activeChallenge: ActiveChallenge | null) => {
      setBoardLoading(true);
      setBoardError(null);
      try {
        const list = await fetchLeaderboard({
          mode,
          startsAt: activeChallenge?.startsAt,
          category: activeChallenge?.category,
        });
        setRankings(list);
      } catch (err: any) {
        setBoardError(err?.message || 'Could not load the rankings.');
      } finally {
        setBoardLoading(false);
      }
    },
    []
  );

  // Initial load of challenge + progress + initial leaderboard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await loadChallengeAndProgress();
      if (cancelled) return;
      await loadRankings(timeFilter, active);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload leaderboard when switching between This Week and All-Time
  const handleSelectTimeFilter = async (next: 'weekly' | 'alltime') => {
    setTimeFilter(next);
    await loadRankings(next, challenge);
  };

  const handleRetryChallenge = async () => {
    const active = await loadChallengeAndProgress();
    await loadRankings(timeFilter, active);
  };

  const handleRetryBoard = async () => {
    await loadRankings(timeFilter, challenge);
  };

  const topRankings = useMemo(() => rankings.slice(0, TOP_LIST_LIMIT), [rankings]);
  const myEntry = useMemo(
    () => (currentUser ? rankings.find((r) => r.userId === currentUser.id) || null : null),
    [rankings, currentUser]
  );
  const myRowOutsideTop = useMemo(() => {
    if (!myEntry) return null;
    const isInTop = topRankings.some((r) => r.userId === myEntry.userId);
    return isInTop ? null : myEntry;
  }, [myEntry, topRankings]);

  const targetCount = challenge?.target ?? 1;
  const progressRatio = Math.min(100, Math.round((myProgress / Math.max(1, targetCount)) * 100));
  const isChallengeComplete = Boolean(challenge && myProgress >= challenge.target);

  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-2 space-y-space-md">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-headline-sm text-primary font-bold">
          Weekly Challenge
        </h1>
        <div className="w-10" />
      </div>

      {/* Active Weekly Challenge Section */}
      {challengeLoading ? (
        <div
          className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 space-y-3 animate-pulse"
          aria-label="Loading weekly challenge"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-surface-container-high" />
            <div className="h-5 w-24 rounded-full bg-surface-container-high" />
          </div>
          <div className="h-6 w-2/3 rounded bg-surface-container-high" />
          <div className="h-4 w-full rounded bg-surface-container-high" />
          <div className="h-2.5 w-full rounded-full bg-surface-container-high" />
          <div className="h-11 w-full rounded-full bg-surface-container-high" />
        </div>
      ) : challengeError ? (
        <div className="p-5 rounded-2xl bg-error-container/30 border border-error/30 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[30px] text-error">error_outline</span>
          <p className="font-body-md text-body-md text-on-surface font-medium">{challengeError}</p>
          <button
            type="button"
            onClick={handleRetryChallenge}
            className="px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : !challenge ? (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center flex flex-col items-center gap-2.5 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[26px]">event_busy</span>
          </div>
          <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
            No challenge this week. Check back soon.
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            You can still scan wildlife and plants to climb the All-Time leaderboard.
          </p>
          <button
            type="button"
            onClick={() => navigate('/scan')}
            className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary font-label-md font-semibold shadow-sm active:scale-95 transition-transform"
          >
            Scan Next
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-space-md rounded-2xl bg-primary text-on-primary shadow-lg flex flex-col gap-3 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-secondary-container text-[20px] shrink-0">
                emoji_events
              </span>
              <span className="font-label-sm text-label-sm uppercase font-bold text-secondary-container tracking-wider">
                +{challenge.points} points
              </span>
            </div>
            <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-on-primary/20 text-on-primary font-medium shrink-0">
              {formatCountdown(challenge.endsAt, nowMs)}
            </span>
          </div>

          <div>
            <h2 className="font-headline-md text-headline-md font-bold leading-tight">
              {challenge.title}
            </h2>
            {challenge.description && (
              <p className="font-body-sm text-body-sm text-on-primary-container mt-1">
                {challenge.description}
              </p>
            )}
          </div>

          {/* My Progress */}
          {currentUser ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-label-sm text-label-sm">
                <span>Your Progress</span>
                <span className="font-bold">
                  {myProgress} / {challenge.target}
                </span>
              </div>
              <div className="h-2.5 w-full bg-on-primary/20 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-secondary-container rounded-full transition-all duration-300"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>

              {isChallengeComplete && (
                <div className="mt-2 p-2.5 rounded-xl bg-secondary-container text-on-secondary-container flex items-center gap-2 font-label-md font-bold">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <span>
                    Challenge complete! You earned {challenge.points} points.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-on-primary/10 flex flex-wrap items-center justify-between gap-2">
              <span className="font-body-sm text-body-sm">
                Sign in to track your progress toward {challenge.target} finds.
              </span>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-bold shrink-0"
              >
                Sign In
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/scan')}
            className="w-full h-11 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform mt-1"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            <span>Scan Next</span>
          </button>
        </div>
      )}

      {/* Time Filter Tabs: This Week / All-Time */}
      <div className="flex bg-surface-container-low p-1 rounded-full w-full">
        <button
          type="button"
          onClick={() => handleSelectTimeFilter('weekly')}
          className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${
            timeFilter === 'weekly'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          This Week
        </button>
        <button
          type="button"
          onClick={() => handleSelectTimeFilter('alltime')}
          className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${
            timeFilter === 'alltime'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All-Time
        </button>
      </div>

      {/* Public Profile Note */}
      <div className="px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-body-sm">
        <div className="flex items-center gap-2 text-on-surface-variant min-w-0">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0">info</span>
          <span>
            Only people with a public profile appear here.
            {currentUser && userProfile?.isPublic === false && (
              <span className="ml-1 font-semibold text-on-surface">
                Your profile is currently private.
              </span>
            )}
          </span>
        </div>
        <Link
          to="/settings"
          className="font-label-md text-primary font-semibold hover:underline shrink-0"
        >
          Open Settings
        </Link>
      </div>

      {/* Leaderboard List */}
      <div className="p-3 sm:p-space-md rounded-2xl bg-surface-container-low border border-outline-variant/15 shadow-sm flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 pb-1">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
            {timeFilter === 'weekly' ? 'This Week’s Rankings' : 'All-Time Rankings'}
          </h3>
          {challenge?.category && timeFilter === 'weekly' && (
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm capitalize">
              {challenge.category}
            </span>
          )}
        </div>

        {boardLoading ? (
          <div className="flex flex-col gap-2 animate-pulse" aria-label="Loading rankings">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-container/60"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-6 h-4 rounded bg-surface-container-high" />
                  <div className="w-9 h-9 rounded-full bg-surface-container-high" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-32 rounded bg-surface-container-high" />
                    <div className="h-3 w-24 rounded bg-surface-container-high" />
                  </div>
                </div>
                <div className="h-4 w-14 rounded bg-surface-container-high" />
              </div>
            ))}
          </div>
        ) : boardError ? (
          <div className="p-5 rounded-xl bg-error-container/25 border border-error/30 text-center flex flex-col items-center gap-2.5">
            <p className="font-body-sm text-body-sm text-error font-medium">{boardError}</p>
            <button
              type="button"
              onClick={handleRetryBoard}
              className="px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : topRankings.length === 0 ? (
          <div className="p-6 text-center text-on-surface-variant flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[28px] text-primary">leaderboard</span>
            <p className="font-body-md text-body-md font-medium text-on-surface">
              No public rankings yet for this period.
            </p>
            <p className="font-body-sm text-body-sm">
              Scan a sighting with a public profile to be first on the board!
            </p>
          </div>
        ) : (
          <>
            {topRankings.map((entry) => {
              const isMe = Boolean(currentUser && entry.userId === currentUser.id);
              return (
                <div
                  key={`${entry.userId}-${entry.rank}`}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl transition-all ${
                    isMe
                      ? 'bg-primary-container/30 ring-2 ring-primary text-on-surface font-semibold'
                      : 'hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <span className="w-7 text-center font-bold text-sm text-on-surface-variant shrink-0">
                      #{entry.rank}
                    </span>
                    <AvatarCircle
                      avatarUrl={entry.avatarUrl}
                      name={entry.displayName || entry.username}
                      sizeClass="w-9 h-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md font-bold truncate">
                        {entry.username}
                        {isMe ? ' (You)' : ''}
                      </p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        {entry.speciesCount}{' '}
                        {entry.speciesCount === 1 ? 'species' : 'species'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-headline-sm text-sm font-bold text-secondary">
                      {entry.scansCount}
                    </span>
                    <span className="block text-[10px] text-on-surface-variant font-medium">
                      {entry.scansCount === 1 ? 'scan' : 'scans'}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Current user's rank below top list if outside top rows */}
            {myRowOutsideTop && (
              <div className="pt-2 mt-1 border-t border-outline-variant/25">
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-1.5 px-1">
                  Your Rank
                </p>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-primary-container/30 ring-2 ring-primary text-on-surface font-semibold">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <span className="w-7 text-center font-bold text-sm text-primary shrink-0">
                      #{myRowOutsideTop.rank}
                    </span>
                    <AvatarCircle
                      avatarUrl={myRowOutsideTop.avatarUrl}
                      name={myRowOutsideTop.displayName || myRowOutsideTop.username}
                      sizeClass="w-9 h-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md font-bold truncate">
                        {myRowOutsideTop.username} (You)
                      </p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        {myRowOutsideTop.speciesCount} species
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-headline-sm text-sm font-bold text-secondary">
                      {myRowOutsideTop.scansCount}
                    </span>
                    <span className="block text-[10px] text-on-surface-variant font-medium">
                      {myRowOutsideTop.scansCount === 1 ? 'scan' : 'scans'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
