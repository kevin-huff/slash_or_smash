import { useMemo, useEffect, useState, useCallback } from 'react';
import type { LeaderboardEntry } from '../../api/images';
import { fetchLeaderboard } from '../../api/images';

interface DerivedRow {
  rank: number;
  entry: LeaderboardEntry;
  scoreLabel: string;
  hasScore: boolean;
}

export function OverlayLeaderboard(): JSX.Element {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const SnowBackdrop = () => (
    <>
      <div className="pointer-events-none absolute inset-0 opacity-65" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-55 bg-[radial-gradient(70%_50%_at_20%_20%,rgba(200,55,70,0.18),rgba(10,24,16,0)),radial-gradient(70%_45%_at_80%_10%,rgba(247,215,116,0.2),rgba(10,24,16,0)),radial-gradient(90%_60%_at_50%_110%,rgba(34,120,78,0.3),rgba(10,24,16,0))]" />
    </>
  );

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      // Silent fail for overlay
      console.error('Failed to load leaderboard:', err);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
    const interval = setInterval(() => {
      void loadLeaderboard();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  const rows = useMemo<DerivedRow[]>(() => {
    return leaderboard.slice(0, 5).map((entry, index) => {
      const scoreLabel = entry.average !== null 
        ? `★ ${entry.average.toFixed(2)}` 
        : 'No votes yet';
      
      return {
        rank: index + 1,
        entry,
        scoreLabel,
        hasScore: entry.average !== null,
      };
    });
  }, [leaderboard]);

  const topRow = rows[0];

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-transparent text-bone-100">
      <SnowBackdrop />

      <div className="relative z-10 flex h-screen w-full max-w-[1920px] flex-col gap-6 px-8 py-6">
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="relative flex flex-col gap-4 overflow-hidden rounded-[2.5rem] border border-white/10 bg-night-900/90 p-6 shadow-[0_0_60px_rgba(247,215,116,0.2)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(247,215,116,0.08),transparent_50%)]" />
            {topRow ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 flex-shrink-0 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/60 bg-gold/15 text-xl font-bold text-gold shadow-[0_0_15px_rgba(247,215,116,0.35)]">
                        #1
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Top Entry</p>
                        <h2 className="text-2xl font-semibold text-bone-100 sm:text-3xl">{topRow.entry.image.name}</h2>
                      </div>
                    </div>
                  </div>
                  {topRow.hasScore && (
                    <div className="rounded-xl border border-white/10 bg-night-900/60 px-5 py-3 text-right backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Score</p>
                      <p className="text-4xl font-semibold text-bone-100">{topRow.scoreLabel}</p>
                      <p className="text-xs uppercase tracking-[0.35em] text-specter-300">
                        {topRow.entry.voteCount} vote{topRow.entry.voteCount === 1 ? '' : 's'}
                      </p>
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left">
                        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-specter-300">Chat Score</p>
                        <p className="text-xl font-semibold text-gold">
                          {topRow.entry.audienceAverage !== null ? `🎅 ${topRow.entry.audienceAverage.toFixed(2)}` : 'No chat votes'}
                        </p>
                        <p className="text-[0.65rem] uppercase tracking-[0.25em] text-specter-300">
                          {topRow.entry.audienceVoteCount} vote{topRow.entry.audienceVoteCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative z-10 flex-1 min-h-0 overflow-hidden rounded-[2rem] border border-white/10 bg-night-900/80 shadow-[inset_0_0_40px_rgba(247,215,116,0.12)] backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(214,69,69,0.1),transparent_70%)]" />
                  <div className="relative flex h-full items-center justify-center p-4">
                    <img
                      src={topRow.entry.image.url}
                      alt={topRow.entry.image.name}
                      className="relative z-10 max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
                <p className="text-4xl font-semibold text-bone-100">No submissions yet</p>
              </div>
            )}
          </section>

          <aside className="relative flex flex-col gap-4 overflow-hidden rounded-[2.5rem] border border-white/10 bg-night-900/90 p-5 shadow-[0_0_50px_rgba(214,69,69,0.2)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(247,215,116,0.08),transparent_60%)]" />
            <h2 className="text-xl font-semibold text-bone-100 uppercase tracking-[0.35em] flex-shrink-0 relative z-10">Top 5</h2>
            <ul className="flex flex-1 flex-col gap-3 min-h-0 justify-evenly relative z-10">
              {rows.map((row) => (
                <li
                  key={row.entry.image.id}
                  className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
                    row.rank === 1
                      ? 'border-gold/50 bg-gold/10 text-bone-100 shadow-[0_0_20px_rgba(247,215,116,0.25)]'
                      : 'border-white/10 bg-night-900/70 text-specter-300 backdrop-blur-sm'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-night-900/80 text-xl font-semibold text-bone-100">
                      #{row.rank}
                    </span>
                    <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-night-900/60">
                      <img
                        src={row.entry.image.url}
                        alt={row.entry.image.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold text-bone-100">{row.entry.image.name}</p>
                      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-specter-300">
                        Chat {row.entry.audienceAverage !== null ? `🎅 ${row.entry.audienceAverage.toFixed(2)}` : 'No chat votes'}
                      </p>
                    </div>
                  </div>
                  {row.hasScore && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-2xl font-bold text-bone-100">{row.scoreLabel}</p>
                    </div>
                  )}
                </li>
              ))}
              {rows.length === 0 && (
                <li className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-white/20 bg-night-900/40 px-4 py-5 text-center text-sm text-specter-300">
                  No entries yet
                </li>
              )}
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
