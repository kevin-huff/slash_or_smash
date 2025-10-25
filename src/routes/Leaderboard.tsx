import { useMemo, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { LeaderboardEntry } from '../api/images';
import { fetchLeaderboard } from '../api/images';

interface DerivedRow {
  rank: number;
  entry: LeaderboardEntry;
  timeLabel: string;
  sizeLabel: string;
  scoreLabel: string;
  hasScore: boolean;
}

function formatUploadTime(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return formatter.format(new Date(timestamp));
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.round(deltaMs / 60000);
  if (Math.abs(deltaMinutes) < 1) {
    return 'Just now';
  }
  if (Math.abs(deltaMinutes) < 60) {
    const minutes = Math.abs(deltaMinutes);
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    const hours = Math.abs(deltaHours);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const deltaDays = Math.round(deltaHours / 24);
  return `${Math.abs(deltaDays)} day${Math.abs(deltaDays) === 1 ? '' : 's'} ago`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function Leaderboard(): JSX.Element {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
    const interval = setInterval(() => {
      void loadLeaderboard();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  const rows = useMemo<DerivedRow[]>(() => {
    return leaderboard.map((entry, index) => {
      const scoreLabel = entry.average !== null 
        ? `★ ${entry.average.toFixed(2)}` 
        : 'No votes yet';
      
      return {
        rank: index + 1,
        entry,
        timeLabel: `${formatUploadTime(entry.image.uploadedAt)} • ${formatRelativeTime(entry.image.uploadedAt)}`,
        sizeLabel: `${formatBytes(entry.image.size)} • ${entry.image.mimeType.replace('image/', '').toUpperCase()}`,
        scoreLabel,
        hasScore: entry.average !== null,
      };
    });
  }, [leaderboard]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-night-900 text-bone-100">
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen" style={{ backgroundImage: "url('/images/starfield.png')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-night-900 via-night-900/80 to-[#17182A]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen motion-reduce:opacity-12" style={{ backgroundImage: "url('/images/fog.png')", backgroundPosition: 'center', backgroundSize: 'cover' }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_65%_30%,rgba(255,75,145,0.18),rgba(10,10,18,0)_75%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <header className="mb-12">
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-night-900/60 px-5 py-2.5 text-xs uppercase tracking-[0.35em] text-specter-300 transition hover:border-white/20 hover:text-bone-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.45em] text-specter-300">Slash or Smash</p>
              <h1 className="mt-2 text-5xl font-semibold text-status-results sm:text-6xl">Leaderboard</h1>
              <p className="mt-4 max-w-2xl text-base text-specter-300">
                Live rankings of all submissions. Scores are calculated from judge votes (1-5 scale). 
                Images without votes appear at the bottom.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 text-xs uppercase tracking-[0.35em] text-specter-300">
              {error ? (
                <span className="rounded-full border border-status-results/40 bg-status-results/10 px-5 py-3 text-status-results">
                  Error
                </span>
              ) : (
                <span className="rounded-full border border-white/10 px-5 py-3">
                  {loading && leaderboard.length === 0 ? 'Loading…' : `${rows.length} Total`}
                </span>
              )}
              <span className="rounded-full border border-white/10 px-5 py-3">
                Auto-refresh 10s
              </span>
            </div>
          </div>
        </header>

        {error && leaderboard.length === 0 ? (
          <div className="rounded-[2.5rem] border border-white/10 bg-night-900/80 px-8 py-16 text-center shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <p className="text-3xl font-semibold text-bone-100">Failed to load leaderboard</p>
            <p className="mt-4 text-specter-300">{error}</p>
            <button
              onClick={() => void loadLeaderboard()}
              className="mt-8 rounded-full border border-white/10 bg-witchlight-500 px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-bone-100 transition hover:bg-witchlight-500/90"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[2.5rem] border border-white/10 bg-night-900/80 px-8 py-16 text-center shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <p className="text-3xl font-semibold text-bone-100">No submissions yet</p>
            <p className="mt-4 text-specter-300">
              Upload images from the control dashboard to populate the leaderboard.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <article
                key={row.entry.image.id}
                className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-200 ${
                  row.rank === 1
                    ? 'border-status-results/60 bg-gradient-to-br from-status-results/10 via-night-900/90 to-night-900/90 shadow-[0_0_60px_rgba(255,75,145,0.2)]'
                    : row.rank === 2
                    ? 'border-witchlight-500/40 bg-night-900/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                    : row.rank === 3
                    ? 'border-specter-300/30 bg-night-900/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                    : 'border-white/10 bg-night-900/80 hover:border-white/20 hover:bg-night-900/90'
                }`}
              >
                <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl font-bold sm:h-20 sm:w-20 sm:text-3xl ${
                        row.rank === 1
                          ? 'border-status-results/60 bg-status-results/20 text-status-results'
                          : row.rank === 2
                          ? 'border-witchlight-500/60 bg-witchlight-500/20 text-witchlight-500'
                          : row.rank === 3
                          ? 'border-specter-300/60 bg-specter-300/20 text-specter-300'
                          : 'border-white/20 bg-night-900/60 text-bone-100'
                      }`}
                    >
                      #{row.rank}
                    </div>
                  </div>

                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/10 bg-night-900/60 sm:h-28 sm:w-28">
                      <img
                        src={row.entry.image.url}
                        alt={row.entry.image.name}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-900/40 to-transparent" />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div>
                      <h2 className="truncate text-2xl font-semibold text-bone-100 sm:text-3xl">
                        {row.entry.image.name}
                      </h2>
                      <p className="mt-1 text-sm uppercase tracking-[0.3em] text-specter-300">
                        {row.timeLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-specter-300">
                      <span className="rounded-full border border-white/10 bg-night-900/60 px-3 py-1.5">
                        ID: {row.entry.image.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="rounded-full border border-white/10 bg-night-900/60 px-3 py-1.5">
                        {row.sizeLabel}
                      </span>
                      <span className="rounded-full border border-white/10 bg-night-900/60 px-3 py-1.5">
                        {row.entry.image.status}
                      </span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    {row.hasScore ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Score</p>
                        <p
                          className={`mt-1 text-5xl font-bold ${
                            row.rank === 1
                              ? 'text-status-results'
                              : row.rank === 2
                              ? 'text-witchlight-500'
                              : row.rank === 3
                              ? 'text-specter-300'
                              : 'text-bone-100'
                          }`}
                        >
                          {row.scoreLabel}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.35em] text-specter-300">
                          {row.entry.voteCount} vote{row.entry.voteCount === 1 ? '' : 's'}
                        </p>
                        {row.entry.distribution.length === 5 && (
                          <div className="mt-3 flex gap-1">
                            {row.entry.distribution.map((count, index) => (
                              <div
                                key={index}
                                className="group/bar relative"
                                title={`${index + 1} stars: ${count} vote${count === 1 ? '' : 's'}`}
                              >
                                <div className="h-8 w-2 rounded-full bg-white/10">
                                  <div
                                    className="w-full rounded-full bg-gradient-to-t from-witchlight-500 to-specter-300 transition-all"
                                    style={{
                                      height: `${
                                        row.entry.voteCount > 0
                                          ? Math.max((count / row.entry.voteCount) * 100, count > 0 ? 10 : 0)
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Status</p>
                        <p className="mt-1 text-lg font-semibold text-specter-300">Not Judged</p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-xs uppercase tracking-[0.35em] text-specter-300">
          <p>
            Rankings update automatically • Visit{' '}
            <a href="/control" className="text-witchlight-500 hover:underline">
              Control Dashboard
            </a>{' '}
            to manage show
          </p>
        </footer>
      </div>
    </div>
  );
}
