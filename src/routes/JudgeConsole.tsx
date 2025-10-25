import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UploadedImage } from '../api/images';
import type { ShowStage, ShowState, TimerState } from '../api/control';
import { fetchShowState } from '../api/control';
import { activateJudge, fetchJudgeProfile, pingJudge, submitJudgeVote, type JudgeProfile } from '../api/judges';
import { JUDGE_ICON_MAP, JUDGE_ICON_OPTIONS } from '../constants/judges';

type JudgeStage = 'ready' | 'voting' | 'locked' | 'results';

const STAGES: Record<
  JudgeStage,
  {
    label: string;
    headline: string;
    description: string;
    statusBar: string;
    accent: string;
    light: string;
  }
> = {
  ready: {
    label: 'Ready',
    headline: 'Sit tight, host is teeing up the round.',
    description:
      'Preview the art while the producer cues the overlay. Voting will unlock the instant the countdown begins.',
    statusBar: 'bg-status-ready/10 text-status-ready',
    accent: 'text-status-ready',
    light: 'bg-status-ready/15',
  },
  voting: {
    label: 'Voting',
    headline: 'Lock in your rating from 1 (Not it) to 5 (Certified Hot).',
    description:
      'Feel free to adjust up until the timer hits zero. Your vote saves instantly and confirms with a glow.',
    statusBar: 'bg-status-voting/10 text-status-voting',
    accent: 'text-status-voting',
    light: 'bg-status-voting/15',
  },
  locked: {
    label: 'Locked',
    headline: 'Votes closed while the producer reveals the scores.',
    description:
      'You will see your last submitted score below. If the round reopens, the interface will unlock automatically.',
    statusBar: 'bg-status-locked/10 text-status-locked',
    accent: 'text-status-locked',
    light: 'bg-status-locked/15',
  },
  results: {
    label: 'Results',
    headline: 'Round results are on air.',
    description:
      'Watch the stream for the big reveal. Next round will appear here as soon as the producer arms it.',
    statusBar: 'bg-status-results/10 text-status-results',
    accent: 'text-status-results',
    light: 'bg-status-results/15',
  },
};

const focusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-voting';

const primaryButton =
  'rounded-full bg-witchlight-500 px-5 py-2 font-semibold text-night-900 shadow-[0_10px_30px_rgba(126,75,255,0.35)] transition hover:bg-witchlight-500/90 active:translate-y-[1px] ' +
  focusVisible;

const VOTE_LABELS: Record<number, string> = {
  1: 'Not it',
  2: 'Warm-ish',
  3: 'Spooky good',
  4: 'Scorching',
  5: 'Certified Hot',
};
const DEFAULT_TIMER_MS = 120000;

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatTimerValue(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function StateChip({ stage }: { stage: JudgeStage }): JSX.Element {
  const meta = STAGES[stage];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] ${meta.statusBar}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function VoteButton({
  value,
  selected,
  disabled,
  onSelect,
}: {
  value: number;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: number) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={`flex flex-col items-center gap-3 rounded-3xl border px-4 py-5 transition ${
        selected
          ? 'border-status-voting bg-status-voting/10 text-status-voting shadow-[0_12px_30px_rgba(19,226,161,0.25)]'
          : 'border-white/10 bg-night-900/60 text-bone-100 hover:border-witchlight-500/40 hover:bg-night-900/80 hover:text-witchlight-500'
      } ${disabled ? 'opacity-60 grayscale' : ''} ${focusVisible}`}
    >
      <span className="text-4xl font-semibold">{value}</span>
      <span className="text-xs uppercase tracking-[0.3em] text-specter-300">{VOTE_LABELS[value]}</span>
    </button>
  );
}

export function JudgeConsole(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('token') ?? window.localStorage.getItem('judgeToken');
  });
  const [profile, setProfile] = useState<JudgeProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [iconChoice, setIconChoice] = useState<string>(JUDGE_ICON_OPTIONS[0].id);
  const [isActivatingJudge, setIsActivatingJudge] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [showState, setShowState] = useState<ShowState | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [showStateError, setShowStateError] = useState<string | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const paramToken = searchParams.get('token');
    if (paramToken) {
      setToken(paramToken);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('judgeToken', paramToken);
      }
      return;
    }
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('judgeToken');
      if (stored) {
        setToken(stored);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') {
      return;
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('show-state');
    } catch (error) {
      console.warn('BroadcastChannel unavailable', error);
      return;
    }

    broadcastRef.current = channel;
    return () => {
      channel?.close();
      broadcastRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (token && typeof window !== 'undefined') {
      window.localStorage.setItem('judgeToken', token);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }
    const currentToken = token;
    let cancelled = false;
    async function loadProfile() {
      setIsLoadingProfile(true);
      try {
        const data = await fetchJudgeProfile(currentToken);
        if (!cancelled) {
          setProfile(data);
          setProfileError(null);
          if (data.status !== 'active') {
            setNameInput(data.name ?? '');
            setIconChoice(data.icon && JUDGE_ICON_MAP[data.icon] ? data.icon : JUDGE_ICON_OPTIONS[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setProfileError(error instanceof Error ? error.message : 'Failed to load judge profile.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingState(true);
      try {
        const state = await fetchShowState();
        if (!cancelled) {
          setShowState(state);
          setShowStateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setShowStateError(error instanceof Error ? error.message : 'Failed to load show state.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingState(false);
        }
      }
    }

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const stageFromServer: ShowStage = showState?.stage ?? 'idle';
  const stage: JudgeStage = stageFromServer === 'idle' ? 'ready' : (stageFromServer as JudgeStage);
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const timer: TimerState = showState?.timer ?? {
    status: 'idle',
    durationMs: DEFAULT_TIMER_MS,
    remainingMs: DEFAULT_TIMER_MS,
    updatedAt: 0,
    targetTs: null,
  };
  const [displayRemainingMs, setDisplayRemainingMs] = useState(timer.remainingMs);
  const activeImage: UploadedImage | null = showState?.currentImage ?? null;
  const voteSummary = showState?.currentVotes ?? null;

  const stageMeta = STAGES[stage];

  const timerDisplay = useMemo(() => formatTimerValue(displayRemainingMs), [displayRemainingMs]);

  const needsProfileSetup = profile?.status !== 'active';
  const displayIcon = profile?.icon && JUDGE_ICON_MAP[profile.icon] ? JUDGE_ICON_MAP[profile.icon].emoji : '👤';
  const displayName = profile?.name ?? 'Judge';

  const handleActivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setActivationError('Name is required.');
      return;
    }
    setActivationError(null);
    setIsActivatingJudge(true);
    try {
      const updated = await activateJudge(token, trimmedName, iconChoice);
      setProfile(updated);
      broadcastRef.current?.postMessage({ type: 'state-update' });
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : 'Failed to activate judge.');
    } finally {
      setIsActivatingJudge(false);
    }
  };

  useEffect(() => {
    setDisplayRemainingMs(timer.remainingMs);
    if (timer.status !== 'running') {
      return;
    }
    let animationFrame: number;
    const startRemaining = timer.remainingMs;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const nextRemaining = Math.max(startRemaining - elapsed, 0);
      setDisplayRemainingMs(nextRemaining);
      if (nextRemaining > 0) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [timer.status, timer.remainingMs, timer.updatedAt]);

  useEffect(() => {
    if (stage !== 'voting') {
      setVoteError(null);
    }
  }, [stage]);

  const handleVote = async (value: number) => {
    if (!token || profile?.status !== 'active' || stage !== 'voting') {
      return;
    }
    setSelectedVote(value);
    setVoteError(null);
    try {
      const summary = await submitJudgeVote(token, value);
      broadcastRef.current?.postMessage({ type: 'vote-summary', summary });
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : 'Failed to submit vote.');
    }
  };

  useEffect(() => {
    if (!profile) {
      return;
    }
    if (!voteSummary) {
      if (stage === 'voting') {
        setSelectedVote(null);
      }
      return;
    }
    const match = voteSummary.votes.find((vote) => vote.judgeId === profile.id);
    if (match) {
      setSelectedVote(match.score);
    } else if (stage === 'voting') {
      setSelectedVote(null);
    }
  }, [voteSummary, profile, stage]);

  useEffect(() => {
    if (!token || profile?.status !== 'active') {
      return;
    }
    let cancelled = false;
    const sendPing = async () => {
      try {
        await pingJudge(token);
      } catch {
        // ignore ping errors for now
      }
    };

    void sendPing();
    const interval = window.setInterval(() => {
      if (!cancelled) {
        void sendPing();
      }
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, profile?.status]);

  const roundHeading = useMemo(() => {
    if (activeImage) {
      return `${activeImage.id.slice(0, 8).toUpperCase()} • ${activeImage.name}`;
    }
    if (isLoadingState) {
      return 'Loading artwork…';
    }
    return 'Awaiting upload';
  }, [activeImage, isLoadingState]);

  const roundSubheading = activeImage
    ? `${activeImage.mimeType.replace('image/', '').toUpperCase()} • ${formatBytes(activeImage.size)}`
    : null;

  const placeholderMessage = !activeImage
    ? isLoadingState
      ? 'Loading image library…'
      : 'Upload art from producer control to preview here.'
    : null;

  const footerLabel = useMemo(() => {
    if (stage === 'ready') {
      return 'Waiting for producer to start voting…';
    }
    if (stage === 'voting') {
      return selectedVote
        ? `You rated this a ${selectedVote} — tap another number to change before lock.`
        : 'Pick a number from 1 to 5 before the timer runs out.';
    }
    if (stage === 'locked') {
      return selectedVote
        ? `Votes locked. Your submitted score: ${selectedVote}.`
        : 'Votes locked. No score submitted.';
    }
    return 'Results on stream. Stand by for next round.';
  }, [stage, selectedVote]);

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-900 text-bone-100">
        <div className="rounded-3xl border border-white/10 bg-night-900/70 px-6 py-8 text-center">
          <p className="text-2xl font-semibold">Invite Required</p>
          <p className="mt-3 text-sm text-specter-300">
            Ask the producer to share your invite link. Visit it on this device to claim your judge seat.
          </p>
        </div>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-900 text-bone-100">
        <div className="rounded-3xl border border-white/10 bg-night-900/70 px-6 py-8 text-center">
          <p className="text-2xl font-semibold">Unable to load invite</p>
          <p className="mt-3 text-sm text-status-results">{profileError}</p>
          <button
            type="button"
            className={`${focusVisible} mt-4 rounded-full border border-witchlight-500 px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-witchlight-500 transition hover:bg-witchlight-500/10`}
            onClick={() => {
              setProfileError(null);
              setProfile(null);
            }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (isLoadingProfile && !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-900 text-bone-100">
        <div className="rounded-3xl border border-white/10 bg-night-900/70 px-6 py-8 text-center">
          <p className="text-2xl font-semibold">Loading your invite…</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-900 text-bone-100">
        <div className="rounded-3xl border border-white/10 bg-night-900/70 px-6 py-8 text-center">
          <p className="text-2xl font-semibold">Invite not found</p>
          <p className="mt-3 text-sm text-specter-300">Double-check your link or ask the producer for a new invite.</p>
        </div>
      </main>
    );
  }

  if (needsProfileSetup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-900 text-bone-100 px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night-900/80 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
          <h1 className="text-2xl font-semibold text-bone-100 sm:text-3xl">Claim your judge seat</h1>
          <p className="mt-2 text-sm text-specter-300">
            Choose a display name and avatar. You can change this later by reopening your invite link.
          </p>
          <form className="mt-6 space-y-5" onSubmit={handleActivate}>
            <div>
              <label className="text-xs uppercase tracking-[0.35em] text-specter-300">Display Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className={`${focusVisible} mt-2 w-full rounded-2xl border border-white/10 bg-night-900/70 px-4 py-3 text-sm text-bone-100 placeholder:text-specter-300`}
                placeholder="e.g. Judge Nova"
                maxLength={48}
                required
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Choose Avatar</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {JUDGE_ICON_OPTIONS.map((icon) => {
                  const isActive = iconChoice === icon.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => setIconChoice(icon.id)}
                      className={`${
                        isActive ? 'border-witchlight-500 bg-witchlight-500/10 text-witchlight-500' : 'border-white/10 text-bone-100 hover:border-witchlight-500/40'
                      } ${focusVisible} flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold`}
                    >
                      <span className="text-2xl" aria-hidden>
                        {icon.emoji}
                      </span>
                      <span className="text-xs uppercase tracking-[0.35em]">{icon.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {activationError && (
              <p className="rounded-2xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-xs text-status-results">
                {activationError}
              </p>
            )}
            <button
              type="submit"
              className={`${primaryButton} w-full ${isActivatingJudge ? 'cursor-not-allowed opacity-70' : ''}`}
              disabled={isActivatingJudge}
            >
              {isActivatingJudge ? 'Saving…' : 'Join as Judge'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-night-900 text-bone-100">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-10 sm:px-8">
        <header className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {displayIcon}
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Judge</p>
                  <p className="text-lg font-semibold text-bone-100">{displayName}</p>
                </div>
              </div>
              <StateChip stage={stage} />
            </div>
            
            {voteSummary && (
              <div className="rounded-2xl border border-white/5 bg-night-900/40 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Round Average</p>
                <p className="mt-1 text-2xl font-semibold text-bone-100">
                  {voteSummary.average !== null ? voteSummary.average.toFixed(2) : '—'}
                </p>
              </div>
            )}

            <div className="space-y-3 text-center">
              <h1 className={`text-2xl font-semibold sm:text-3xl ${stageMeta.accent}`}>{stageMeta.headline}</h1>
              <p className="text-sm text-specter-300">{stageMeta.description}</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Round</p>
              <p className="text-lg font-semibold text-bone-100">{roundHeading}</p>
              {roundSubheading && (
                <p className="mt-1 text-xs uppercase tracking-[0.35em] text-specter-300">{roundSubheading}</p>
              )}
            </div>
            <div
              className={`flex flex-col items-center rounded-2xl border border-white/10 px-4 py-3 font-mono text-2xl font-semibold ${stageMeta.light}`}
            >
              <span>{timerDisplay}</span>
              <span className="mt-1 text-xs uppercase tracking-[0.35em] text-specter-300">Countdown</span>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/5 bg-night-900/70">
            {activeImage ? (
              <div className="relative aspect-[4/3] w-full">
                <img src={activeImage.url} alt={activeImage.name} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(126,75,255,0.25),rgba(10,10,18,0)_85%)]" />
              </div>
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-specter-300">
                <span>{placeholderMessage}</span>
                {showStateError && (
                  <span className="text-xs uppercase tracking-[0.35em] text-status-results">{showStateError}</span>
                )}
              </div>
            )}
          </div>
          {showStateError && activeImage && (
            <p className="mt-3 text-xs uppercase tracking-[0.35em] text-status-results">{showStateError}</p>
          )}
        </section>

        <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-bone-100">Rate this entry</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] ${stageMeta.statusBar}`}>
              {stageMeta.label}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((value) => (
              <VoteButton
                key={value}
                value={value}
                selected={selectedVote === value}
                disabled={stage !== 'voting'}
                onSelect={handleVote}
              />
            ))}
          </div>

          {voteError && (
            <p className="mt-3 text-xs uppercase tracking-[0.35em] text-status-results">{voteError}</p>
          )}
        </section>
      </div>

      <footer className="sticky bottom-0 border-t border-white/5 bg-night-900/95 px-6 py-4 shadow-[0_-12px_30px_rgba(10,10,18,0.65)] sm:px-8">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs uppercase tracking-[0.4em] text-specter-300">Your Status</div>
          <div className="text-sm text-bone-100">{footerLabel}</div>
        </div>
      </footer>
    </main>
  );
}
