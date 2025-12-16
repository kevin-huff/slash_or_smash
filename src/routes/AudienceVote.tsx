import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ShowState } from '../api/control';
import { fetchShowStatePublic } from '../api/control';
import { submitAudienceVote } from '../api/audience';

const VOTE_LABELS: Record<number, string> = {
  1: 'Lump of Coal',
  2: 'Needs Frosting',
  3: 'On the Nice List',
  4: 'Festive Fire',
  5: 'North Pole Perfect',
};

function getStoredVoterId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('audienceVoterId');
}

function storeVoterId(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('audienceVoterId', id);
}

export function AudienceVote(): JSX.Element {
  const [state, setState] = useState<ShowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voterId, setVoterId] = useState<string | null>(() => getStoredVoterId());
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const snapshot = await fetchShowStatePublic();
      setState(snapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load show state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const interval = setInterval(() => void loadState(), 4000);
    return () => clearInterval(interval);
  }, [loadState]);

  const canVote = state?.stage === 'voting' && !!state.currentImage;

  const handleVote = async (score: number) => {
    if (!canVote || submitting) return;
    setSubmitting(score);
    setStatusMessage(null);
    try {
      const response = await submitAudienceVote(score, voterId ?? undefined);
      setVoterId(response.voterId);
      storeVoterId(response.voterId);
      setState((prev) =>
        prev
          ? {
              ...prev,
              audienceVotes: response.audienceVotes,
            }
          : prev
      );
      setStatusMessage('Thanks for voting! You can change your vote until the round locks.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setSubmitting(null);
    }
  };

  const stageLabel = useMemo(() => {
    if (!state) return 'Loading...';
    if (state.stage === 'voting') return 'Voting is open';
    if (state.stage === 'locked') return 'Votes locked';
    if (state.stage === 'results') return 'Results live';
    if (state.stage === 'ready') return 'Stand by';
    return 'Idle';
  }, [state]);

  const audienceAverage = state?.audienceVotes?.average ?? null;
  const audienceCount = state?.audienceVotes?.voteCount ?? 0;
  const audienceDistribution = state?.audienceVotes?.distribution ?? [];
  const activeImage = state?.currentImage ?? null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0e1c14] text-bone-100">
      <div className="pointer-events-none absolute inset-0 opacity-65" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-55 bg-[radial-gradient(70%_50%_at_20%_20%,rgba(200,55,70,0.18),rgba(10,24,16,0)),radial-gradient(70%_45%_at_80%_10%,rgba(247,215,116,0.2),rgba(10,24,16,0)),radial-gradient(90%_60%_at_50%_110%,rgba(34,120,78,0.3),rgba(10,24,16,0))]" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-frost">Chat Vote</p>
            <h1 className="mt-2 text-3xl font-semibold text-gold sm:text-4xl">Holiday Audience Voting</h1>
            <p className="mt-3 max-w-2xl text-sm text-frost">
              Cast a 1-5 rating while the round is live. You can change your vote until it locks.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-[#1a4b35] via-[#1f5e44] to-[#2b7a55] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#f6f3e4] transition hover:-translate-y-0.5"
          >
            🎄 Home
          </Link>
        </header>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-grave-800/70 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.65rem] uppercase tracking-[0.35em] text-frost">
                {stageLabel}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-frost">Current Image</p>
                <h2 className="mt-1 text-2xl font-semibold text-bone-100">
                  {activeImage ? activeImage.name : loading ? 'Loading…' : 'No active round'}
                </h2>
              </div>
              <p className="text-sm text-frost">
                {state?.stage === 'voting'
                  ? 'Pick a number below. Your vote updates instantly.'
                  : 'Voting opens when the round starts.'}
              </p>
              {error && <p className="rounded-xl border border-ember/50 bg-ember/15 px-4 py-2 text-sm text-[#ffe0e0]">{error}</p>}
              {statusMessage && <p className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-2 text-sm text-gold">{statusMessage}</p>}
            </div>

            <div className="flex-shrink-0">
              <div className="relative h-48 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#10271d]/70 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                {activeImage ? (
                  <>
                    <img src={activeImage.url} alt={activeImage.name} className="h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c1a14]/60 to-transparent" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-frost">Waiting for next round…</div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/5 px-6 py-6 sm:px-8">
            <p className="text-xs uppercase tracking-[0.35em] text-frost">Cast your vote</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((value) => {
                const disabled = !canVote;
                const isActive = submitting === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleVote(value)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-bone-100 transition ${
                      disabled
                        ? 'border-white/10 bg-white/5 opacity-60'
                        : 'border-white/15 bg-white/5 hover:-translate-y-0.5 hover:border-gold/50 hover:text-gold'
                    } ${isActive ? 'border-gold bg-gold/15 text-gold' : ''}`}
                  >
                    <span className="text-3xl font-semibold">{value}</span>
                    <span className="text-[0.7rem] uppercase tracking-[0.3em] text-frost text-center">{VOTE_LABELS[value]}</span>
                  </button>
                );
              })}
            </div>
            {!canVote && (
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-frost/80">
                Voting opens when the producer starts the round.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-sm sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-frost">Chat Score</p>
              <p className="text-3xl font-semibold text-gold">
                {audienceAverage !== null ? `🎅 ${audienceAverage.toFixed(2)}` : 'No chat votes yet'}
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-frost">
              {audienceCount} vote{audienceCount === 1 ? '' : 's'}
            </div>
          </div>
          {audienceDistribution.length === 5 && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {audienceDistribution.map((count, index) => {
                const percent = audienceCount > 0 ? Math.round((count / audienceCount) * 100) : 0;
                return (
                  <div key={index} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-[#0f241b]/70 px-2 py-3 text-center">
                    <span className="text-lg font-semibold text-bone-100">{index + 1}</span>
                    <span className="text-[0.65rem] uppercase tracking-[0.25em] text-frost">{VOTE_LABELS[index + 1]}</span>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d64545] via-[#f7d774] to-[#4fa387]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-[0.7rem] text-frost">{percent}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
