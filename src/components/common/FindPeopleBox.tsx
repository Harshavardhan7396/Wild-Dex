import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PersonSearchResult,
  searchPeople,
} from '../../services/publicProfileService';

interface FindPeopleBoxProps {
  className?: string;
}

export const FindPeopleBox: React.FC<FindPeopleBoxProps> = ({ className = '' }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  // 300ms debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const people = await searchPeople(q);
      setResults(people);
    } catch (err: any) {
      setError(err?.message || 'Could not search people.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!debouncedQuery) return;
    let active = true;

    const execute = async () => {
      setLoading(true);
      setError(null);
      try {
        const people = await searchPeople(debouncedQuery);
        if (active) setResults(people);
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Could not search people.');
          setResults([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    execute();
    return () => {
      active = false;
    };
  }, [debouncedQuery, retryCounter]);

  const handleRetry = () => {
    if (debouncedQuery) {
      setRetryCounter((c) => c + 1);
    } else if (query.trim()) {
      runSearch(query.trim());
    }
  };

  return (
    <div
      className={`p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col gap-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="find-people-input"
          className="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">
            person_search
          </span>
          <span>Find people</span>
        </label>
        {query.trim() && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDebouncedQuery('');
              setResults([]);
              setError(null);
            }}
            className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          search
        </span>
        <input
          id="find-people-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username..."
          className="w-full pl-9 pr-3 py-2 rounded-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 border border-outline-variant/30 font-body-sm text-body-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex flex-col gap-2 pt-1" aria-label="Searching people">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container animate-pulse"
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-high shrink-0" />
              <div className="h-3.5 w-32 rounded bg-surface-container-high" />
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry */}
      {!loading && error && (
        <div className="p-2.5 rounded-xl bg-error-container/25 border border-error/30 flex items-center justify-between gap-2">
          <span className="font-body-sm text-xs text-error">{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-xs font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search Results */}
      {!loading && !error && debouncedQuery && (
        results.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant px-1 py-1">
            No people found matching &ldquo;{debouncedQuery}&rdquo;.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
            {results.map((person) => {
              const initial = (person.username || person.displayName || 'E')
                .charAt(0)
                .toUpperCase();
              return (
                <li key={person.id || person.username}>
                  <Link
                    to={`/u/${encodeURIComponent(person.username)}`}
                    className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {person.avatarUrl ? (
                        <img
                          src={person.avatarUrl}
                          alt={person.username}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-outline-variant/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shrink-0">
                          {initial}
                        </div>
                      )}
                      <span className="font-label-md text-label-md font-semibold text-on-surface truncate">
                        {person.username}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                      chevron_right
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
};
