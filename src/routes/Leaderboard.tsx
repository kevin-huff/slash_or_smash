import { useMemo, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { LeaderboardEntry } from '../api/images';
import { fetchLeaderboard } from '../api/images';
import { JUDGE_ICON_MAP } from '../constants/judges';

interface DerivedRow {
  rank: number;
  entry: LeaderboardEntry;
  timeLabel: string;
  sizeLabel: string;
  scoreLabel: string;
  hasScore: boolean;
  chatScoreLabel: string;
  hasChatScore: boolean;
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
      const chatScoreLabel = entry.audienceAverage !== null
        ? `🎅 ${entry.audienceAverage.toFixed(2)}`
        : 'No chat votes yet';

      return {
        rank: index + 1,
        entry,
        timeLabel: `${formatUploadTime(entry.image.uploadedAt)} • ${formatRelativeTime(entry.image.uploadedAt)}`,
        sizeLabel: `${formatBytes(entry.image.size)} • ${entry.image.mimeType.replace('image/', '').toUpperCase()}`,
        scoreLabel,
        hasScore: entry.average !== null,
        chatScoreLabel,
        hasChatScore: entry.audienceAverage !== null,
      };
    });
  }, [leaderboard]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0e1c14] text-[#f6f3e4]">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0b2419] to-[#0a1510]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-60 bg-[radial-gradient(70%_50%_at_20%_20%,rgba(200,55,70,0.18),rgba(10,24,16,0)),radial-gradient(65%_45%_at_80%_12%,rgba(245,214,123,0.18),rgba(10,24,16,0)),radial-gradient(80%_60%_at_50%_120%,rgba(34,120,78,0.32),rgba(10,24,16,0))]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(255,255,255,0.12),rgba(12,26,18,0))]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <header className="mb-12">
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-[#1a4b35] via-[#1f5e44] to-[#2b7a55] px-5 py-2.5 text-xs uppercase tracking-[0.35em] text-[#f6f3e4] shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(0,0,0,0.45)]"
            >
              <span aria-hidden className="text-base">🎄</span>
              Back to Home
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.45em] text-[#c8e0d0]">North Pole Edition</p>
              <h1 className="mt-2 text-5xl font-semibold text-[#f7d774] sm:text-6xl">Holiday Leaderboard</h1>
              <p className="mt-4 max-w-2xl text-base text-[#c8e0d0]">
                Live rankings wrapped in Christmas cheer. Scores sparkle from judge votes (1-5 scale).
                Images without votes are nestled near the hearth.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 text-xs uppercase tracking-[0.35em] text-[#c8e0d0]">
              {error ? (
                <span className="rounded-full border border-[#d64545]/50 bg-[#d64545]/15 px-5 py-3 text-[#ffe0e0]">
                  Snowed In
                </span>
              ) : (
                <span className="rounded-full border border-[#f7d774]/30 bg-[#f7d774]/10 px-5 py-3 text-[#f7d774]">
                  {loading && leaderboard.length === 0 ? 'Loading…' : `${rows.length} On The List`}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-5 py-3">
                Auto-refresh 10s
              </span>
            </div>
          </div>
        </header>

        {error && leaderboard.length === 0 ? (
          <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#123427]/80 via-[#0f241b]/85 to-[#0c1a14]/85 px-8 py-16 text-center shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <p className="text-3xl font-semibold text-[#f6f3e4]">Failed to load leaderboard</p>
            <p className="mt-4 text-[#c8e0d0]">{error}</p>
            <button
              onClick={() => void loadLeaderboard()}
              className="mt-8 rounded-full border border-[#d64545]/50 bg-gradient-to-r from-[#d64545] to-[#e7683c] px-8 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#f6f3e4] shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:brightness-110"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#123427]/80 via-[#0f241b]/85 to-[#0c1a14]/85 px-8 py-16 text-center shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <p className="text-3xl font-semibold text-[#f6f3e4]">No submissions yet</p>
            <p className="mt-4 text-[#c8e0d0]">
              Upload images from the control dashboard to populate the nice list.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <article
                key={row.entry.image.id}
                className={`group relative overflow-hidden rounded-[2rem] border backdrop-blur-sm transition-all duration-200 ${row.rank === 1
                    ? 'border-[#f7d774]/70 bg-gradient-to-br from-[#2f3c20]/70 via-[#1d2e23]/85 to-[#18261d]/90 shadow-[0_0_60px_rgba(247,215,116,0.25)]'
                    : row.rank === 2
                      ? 'border-[#d64545]/60 bg-gradient-to-br from-[#361a1a]/70 via-[#2b1313]/80 to-[#1c0d0d]/85 shadow-[0_20px_60px_rgba(214,69,69,0.35)]'
                      : row.rank === 3
                        ? 'border-[#4fa387]/60 bg-gradient-to-br from-[#143225]/70 via-[#0f2a1f]/80 to-[#0d2018]/85 shadow-[0_20px_60px_rgba(79,163,135,0.35)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
              >
                <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl font-bold sm:h-20 sm:w-20 sm:text-3xl ${row.rank === 1
                          ? 'border-[#f7d774]/70 bg-[#f7d774]/20 text-[#f7d774]'
                          : row.rank === 2
                            ? 'border-[#d64545]/70 bg-[#d64545]/20 text-[#ffdede]'
                            : row.rank === 3
                              ? 'border-[#4fa387]/70 bg-[#1d4b39]/60 text-[#b7f4d0]'
                              : 'border-white/25 bg-white/5 text-[#f6f3e4]'
                        }`}
                    >
                      #{row.rank}
                    </div>
                  </div>

                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#10271d]/70 sm:h-28 sm:w-28">
                      {row.entry.image.type === 'link' ? (
                        <div className="flex h-full w-full items-center justify-center text-5xl bg-[#10271d]">
                          🔗
                        </div>
                      ) : (
                        <img
                          src={row.entry.image.url}
                          alt={row.entry.image.name}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c1a14]/60 to-transparent" />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div>
                      <h2 className="truncate text-2xl font-semibold text-[#f6f3e4] sm:text-3xl">
                        {row.entry.image.name}
                      </h2>
                      <p className="mt-1 text-sm uppercase tracking-[0.3em] text-[#c8e0d0]">
                        {row.timeLabel}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <div className="flex flex-col items-end gap-4">
                      {row.hasScore ? (
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-[#c8e0d0]">Score</p>
                          <p
                            className={`mt-1 text-5xl font-bold ${row.rank === 1
                                ? 'text-[#f7d774]'
                                : row.rank === 2
                                  ? 'text-[#ff8c7a]'
                                  : row.rank === 3
                                    ? 'text-[#b7f4d0]'
                                    : 'text-[#f6f3e4]'
                              }`}
                          >
                            {row.scoreLabel}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.35em] text-[#c8e0d0]">
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
                                      className="w-full rounded-full bg-gradient-to-t from-[#f7d774] via-[#d64545] to-[#b72c2c] transition-all"
                                      style={{
                                        height: `${row.entry.voteCount > 0
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
                          <p className="text-xs uppercase tracking-[0.35em] text-[#c8e0d0]">Status</p>
                          <p className="mt-1 text-lg font-semibold text-[#c8e0d0]">Not Judged</p>
                        </div>
                      )}

                      <div className="w-full min-w-[14rem] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-[#c8e0d0]">Chat Score</p>
                          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[#c8e0d0]">
                            {row.entry.audienceVoteCount} vote{row.entry.audienceVoteCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="mt-1 text-2xl font-bold text-[#f7d774]">{row.chatScoreLabel}</p>
                        {row.entry.audienceDistribution.length === 5 ? (
                          <div className="mt-3 flex gap-1">
                            {row.entry.audienceDistribution.map((count, index) => (
                              <div
                                key={index}
                                className="group/bar relative"
                                title={`Chat ${index + 1} stars: ${count} vote${count === 1 ? '' : 's'}`}
                              >
                                <div className="h-6 w-2 rounded-full bg-white/10">
                                  <div
                                    className="w-full rounded-full bg-gradient-to-t from-[#d64545] via-[#f7d774] to-[#4fa387] transition-all"
                                    style={{
                                      height: `${row.entry.audienceVoteCount > 0
                                          ? Math.max((count / row.entry.audienceVoteCount) * 100, count > 0 ? 10 : 0)
                                          : 0
                                        }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[#c8e0d0]/70">No chat votes yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Judge Votes Section */}
                {row.entry.votes && row.entry.votes.length > 0 && (
                  <div className="border-t border-white/10 px-6 py-4 sm:px-8">
                    <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[#c8e0d0]">Judge Votes</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {row.entry.votes.map((vote) => {
                        const iconEmoji = vote.judgeIcon && JUDGE_ICON_MAP[vote.judgeIcon]
                          ? JUDGE_ICON_MAP[vote.judgeIcon].emoji
                          : '👤';
                        const label = vote.judgeName ?? `Judge ${vote.judgeId.slice(0, 4).toUpperCase()}`;

                        return (
                          <div
                            key={vote.judgeId}
                            className="flex items-center gap-2 rounded-xl border border-[#2c6b49]/40 bg-[#113524]/70 px-3 py-2 text-[#f6f3e4]"
                          >
                            <span className="text-lg" aria-hidden>{iconEmoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">{label}</p>
                              <p className="text-xs text-[#f7d774]">★ {vote.score.toFixed(2)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <footer className="mt-12 space-y-6 text-center">
          {/* Social Links */}
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 backdrop-blur-sm">
            <h3 className="mb-4 text-sm uppercase tracking-[0.35em] text-[#c8e0d0]">Spread Cheer with Skooty Puff Jr</h3>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://www.twitch.tv/skooty_puff_jr"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-[#f6f3e4] transition hover:-translate-y-0.5 hover:border-[#f7d774]/60 hover:bg-white/10 hover:text-[#f7d774]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                </svg>
                Twitch
              </a>
              <a
                href="https://www.instagram.com/skooty.puff.jr"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-[#f6f3e4] transition hover:-translate-y-0.5 hover:border-[#f7d774]/60 hover:bg-white/10 hover:text-[#f7d774]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                Instagram
              </a>
              <a
                href="https://discord.com/invite/X5evxgRwKz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-[#f6f3e4] transition hover:-translate-y-0.5 hover:border-[#f7d774]/60 hover:bg-white/10 hover:text-[#f7d774]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
              <a
                href="https://streamlabs.com/skootypuffjr/tip"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-[#f6f3e4] transition hover:-translate-y-0.5 hover:border-[#f7d774]/60 hover:bg-white/10 hover:text-[#f7d774]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tip
              </a>
              <a
                href="https://turnmyswagon.shop/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.3em] text-[#f6f3e4] transition hover:-translate-y-0.5 hover:border-[#f7d774]/60 hover:bg-white/10 hover:text-[#f7d774]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Shop
              </a>
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.35em] text-[#c8e0d0]">
            Rankings update automatically • A {' '}
            <a href="https://www.twitch.tv/zilchgnu" className="text-[#f7d774] hover:underline">
              KevNet.Cloud
            </a>{' '} Creation
          </p>
        </footer>
      </div>
    </div>
  );
}
