import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UploadedImage } from '../../api/images';
import type { AudienceSummary, ShowState, ShowStage, TimerState, VoteSummaryItem } from '../../api/control';
import { fetchShowStatePublic } from '../../api/control';
import { JUDGE_ICON_MAP } from '../../constants/judges';

type OverlayStage = 'ready' | 'voting' | 'locked' | 'results';

const focusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-voting';

function SnowBackdrop(): JSX.Element {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 opacity-65" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-55 bg-[radial-gradient(70%_50%_at_20%_20%,rgba(200,55,70,0.18),rgba(10,24,16,0)),radial-gradient(70%_45%_at_80%_10%,rgba(247,215,116,0.2),rgba(10,24,16,0)),radial-gradient(90%_60%_at_50%_110%,rgba(34,120,78,0.32),rgba(10,24,16,0))]" />
    </>
  );
}

const STAGE_META: Record<
  OverlayStage,
  {
    label: string;
    chipTone: string;
    accent: string;
    railBorder: string;
  }
> = {
  ready: {
    label: 'Ready',
    chipTone: 'bg-status-ready/15 text-status-ready',
    accent: 'text-status-ready',
    railBorder: 'border-status-ready/30',
  },
  voting: {
    label: 'Voting',
    chipTone: 'bg-status-voting/15 text-status-voting',
    accent: 'text-status-voting',
    railBorder: 'border-status-voting/40',
  },
  locked: {
    label: 'Locked',
    chipTone: 'bg-status-locked/15 text-status-locked',
    accent: 'text-status-locked',
    railBorder: 'border-status-locked/40',
  },
  results: {
    label: 'Results',
    chipTone: 'bg-status-results/15 text-status-results',
    accent: 'text-status-results',
    railBorder: 'border-status-results/40',
  },
};

const DEV_STAGES: OverlayStage[] = ['ready', 'voting', 'locked', 'results'];

const voteColors = ['#D64545', '#E7683C', '#F7D774', '#4FA387', '#2B7A55'] as const;
const DEFAULT_TIMER_MS = 120000;

function formatTimerValue(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function StageChip({ stage }: { stage: OverlayStage }): JSX.Element {
  const meta = STAGE_META[stage];
  return (
    <span
      className={`inline-flex items-center gap-3 rounded-full border border-white/20 bg-night-900/95 px-5 py-3 text-xs font-semibold uppercase tracking-[0.4em] shadow-[0_0_30px_rgba(0,0,0,0.8),0_0_20px_rgba(247,215,116,0.25)] backdrop-blur-xl ${meta.chipTone}`}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
      {meta.label}
    </span>
  );
}

function VoteBars({ distribution, totalVotes }: { distribution: number[]; totalVotes: number }): JSX.Element {
  const maxCount = distribution.reduce((max, count) => (count > max ? count : max), 0);

  return (
    <div className="space-y-4">
      {distribution.map((count, index) => {
        const width = maxCount === 0 ? 0 : Math.max((count / maxCount) * 100, 6);
        const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
        return (
          <div key={index + 1} className="flex items-center gap-4">
            <span className="w-8 text-right text-sm font-semibold text-specter-300">{index + 1}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${voteColors[index]} 0%, ${voteColors[Math.min(index + 1, voteColors.length - 1)]} 95%)`,
                }}
              />
            </div>
            <div className="w-14 text-right text-sm font-semibold text-bone-100">{count}</div>
            <div className="w-12 text-right text-xs uppercase tracking-[0.2em] text-specter-300">{percent}%</div>
          </div>
        );
      })}
    </div>
  );
}

function ResultsTable({ votes, average }: { votes: VoteSummaryItem[]; average: number | null }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-night-900/70">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.35em] text-specter-300">
          <tr>
            <th className="px-5 py-3">Judge</th>
            <th className="px-5 py-3 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((vote, idx) => {
            const iconEmoji = vote.judgeIcon && JUDGE_ICON_MAP[vote.judgeIcon] ? JUDGE_ICON_MAP[vote.judgeIcon].emoji : '👤';
            const label = vote.judgeName ?? `Judge ${vote.judgeId.slice(0, 4).toUpperCase()}`;
            return (
              <tr key={vote.judgeId} className={idx % 2 === 0 ? 'bg-white/[0.03]' : undefined}>
                <td className="px-5 py-3 text-bone-100">
                  <span className="mr-2 text-lg" aria-hidden>
                    {iconEmoji}
                  </span>
                  {label}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-bone-100">{vote.score.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr className="bg-white/10 text-sm font-semibold uppercase tracking-[0.3em] text-bone-100">
            <td className="px-5 py-3">Average</td>
            <td className="px-5 py-3 text-right">{average !== null ? average.toFixed(2) : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReadyPanel({ nextImageName }: { nextImageName: string }): JSX.Element {
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="space-y-4">
        <h2 className="text-3xl font-semibold text-bone-100">Get Ready</h2>
        <p className="text-sm text-specter-300">
          Round starting soon
        </p>
      </div>
      <div className="space-y-3 text-sm text-specter-300">
        <div className="rounded-2xl border border-status-ready/40 bg-status-ready/10 px-4 py-3 text-status-ready uppercase tracking-[0.35em]">
          Standby
        </div>
        <div className="rounded-2xl border border-white/10 bg-night-900/60 px-4 py-3">
          Next: <span className="font-semibold text-bone-100">{nextImageName}</span>
        </div>
      </div>
    </div>
  );
}

function VotingPanel({ totalVotes, distribution, average, votes }: { totalVotes: number; distribution: number[]; average: number | null; votes: VoteSummaryItem[] }): JSX.Element {
  const votedJudges = votes.filter(v => v.score > 0);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Average</p>
          <p className="text-5xl font-semibold text-bone-100">{average !== null ? average.toFixed(2) : '—'}</p>
        </div>
        <div className="rounded-full border border-status-voting/40 bg-status-voting/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-status-voting">
          {totalVotes} votes
        </div>
      </div>
      <VoteBars distribution={distribution} totalVotes={totalVotes} />

      {votedJudges.length > 0 && (
        <div className="mt-auto space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Locked In</p>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {votedJudges.map((vote) => {
              const iconEmoji = vote.judgeIcon && JUDGE_ICON_MAP[vote.judgeIcon] ? JUDGE_ICON_MAP[vote.judgeIcon].emoji : '👤';
              const label = vote.judgeName ?? `Judge ${vote.judgeId.slice(0, 4).toUpperCase()}`;
              return (
                <div key={vote.judgeId} className="flex items-center gap-2 rounded-xl border border-status-voting/30 bg-status-voting/10 px-3 py-2 text-sm">
                  <span className="text-base" aria-hidden>{iconEmoji}</span>
                  <span className="font-semibold text-bone-100">{label}</span>
                  <span className="ml-auto text-xs uppercase tracking-[0.3em] text-status-voting">Locked in</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LockedPanel({ average, totalVotes, distribution }: { average: number | null; totalVotes: number; distribution: number[] }): JSX.Element {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Locked In</p>
          <p className="text-5xl font-semibold text-bone-100">{average !== null ? average.toFixed(2) : '—'}</p>
        </div>
        <div className="rounded-full border border-status-locked/40 bg-status-locked/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-status-locked">
          {totalVotes} votes
        </div>
      </div>
      <VoteBars distribution={distribution} totalVotes={totalVotes} />
      <div className="mt-auto space-y-3 text-xs uppercase tracking-[0.35em] text-specter-300">
        <div className="rounded-2xl border border-white/10 bg-night-900/60 px-4 py-3">Awaiting reveal</div>
      </div>
    </div>
  );
}

function ResultsPanel({ average, verdict, verdictTone, votes }: { average: number | null; verdict: string; verdictTone: string; votes: VoteSummaryItem[] }): JSX.Element {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Final Verdict</p>
          <p className={`text-5xl font-semibold ${verdictTone}`}>{verdict}</p>
        </div>
        <div className="rounded-full border border-status-results/40 bg-status-results/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-status-results">
          {average !== null ? average.toFixed(2) : '—'} avg
        </div>
      </div>
      {votes.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-night-900/70 px-5 py-6 text-center text-sm text-specter-300">
          No scores submitted yet.
        </div>
      ) : (
        <ResultsTable votes={votes} average={average} />
      )}
    </div>
  );
}

function AudiencePanel({ summary }: { summary: AudienceSummary | null | undefined }): JSX.Element {
  if (!summary) {
    return (
      <div className="rounded-2xl border border-white/10 bg-night-900/60 px-4 py-3 text-sm text-specter-300">
        Chat votes will appear here once the round starts.
      </div>
    );
  }

  const total = summary.voteCount;

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-night-900/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-specter-300">Chat Score</p>
          <p className="text-3xl font-semibold text-gold">{summary.average !== null ? `🎅 ${summary.average.toFixed(2)}` : 'No votes yet'}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[0.65rem] uppercase tracking-[0.3em] text-specter-300">
          {total} vote{total === 1 ? '' : 's'}
        </div>
      </div>
      {summary.distribution.length === 5 && (
        <div className="grid grid-cols-5 gap-2">
          {summary.distribution.map((count, index) => {
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={index} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-night-900/70 px-2 py-2">
                <span className="text-lg font-semibold text-bone-100">{index + 1}</span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#d64545] via-[#f7d774] to-[#4fa387]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[0.65rem] text-specter-300">{percent}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OverlayUnified(): JSX.Element {
  const [searchParams] = useSearchParams();
  const debug = searchParams.get('debug') === '1';

  const [showState, setShowState] = useState<ShowState | null>(null);
  const [showStateError, setShowStateError] = useState<string | null>(null);
  const prevStageRef = useRef<ShowStage | null>(null);

  // Audio refs
  const voteStartAudioRef = useRef<HTMLAudioElement | null>(null);
  const voteEndAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    voteStartAudioRef.current = new Audio('/audio/vote_start.mp3');
    voteEndAudioRef.current = new Audio('/audio/vote_end.mp3');

    return () => {
      voteStartAudioRef.current = null;
      voteEndAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const state = await fetchShowStatePublic();
        if (!cancelled) {
          setShowState(state);
          setShowStateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setShowStateError(error instanceof Error ? error.message : 'Failed to load show state.');
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

  // Detect stage transitions and play audio
  useEffect(() => {
    if (!showState) return;

    const currentStage = showState.stage;
    const prevStage = prevStageRef.current;

    // Play vote_start when voting stage starts
    if (prevStage && prevStage !== 'voting' && currentStage === 'voting') {
      console.log('[Overlay] Stage transition: entering voting stage, playing vote_start');
      voteStartAudioRef.current?.play().catch(err => console.error('Failed to play vote_start:', err));
    }

    // Play vote_end when locking votes (voting -> locked)
    if (prevStage === 'voting' && currentStage === 'locked') {
      console.log('[Overlay] Stage transition: locking votes, playing vote_end');
      voteEndAudioRef.current?.play().catch(err => console.error('Failed to play vote_end:', err));
    }

    prevStageRef.current = currentStage;
  }, [showState]);

  const stageFromServer: ShowStage = showState?.stage ?? 'idle';
  const derivedStage: OverlayStage = stageFromServer === 'idle' ? 'ready' : (stageFromServer as OverlayStage);
  const [stageOverride, setStageOverride] = useState<OverlayStage | null>(debug ? 'ready' : null);
  const stage: OverlayStage = debug && stageOverride ? stageOverride : derivedStage;
  const timer: TimerState =
    showState?.timer ?? ({ status: 'idle', durationMs: DEFAULT_TIMER_MS, remainingMs: DEFAULT_TIMER_MS, updatedAt: 0, targetTs: null } satisfies TimerState);
  const [displayRemainingMs, setDisplayRemainingMs] = useState(timer.remainingMs);

  useEffect(() => {
    setDisplayRemainingMs(timer.remainingMs);
    if (timer.status !== 'running') {
      return;
    }
    let animationFrame: number;
    const startRemaining = timer.remainingMs;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
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

  const voteSummary = showState?.currentVotes ?? null;
  const totalVotes = voteSummary?.judgeCount ?? 0;
  const distribution = voteSummary?.distribution ?? [0, 0, 0, 0, 0];
  const finalAverage = voteSummary?.average ?? null;
  const verdict = finalAverage === null ? 'Pending' : finalAverage >= 2.5 ? 'Smash' : 'Slash';
  const verdictTone =
    verdict === 'Smash' ? 'text-status-voting' : verdict === 'Pending' ? 'text-specter-300' : 'text-status-results';
  const resultsVotes = useMemo(() => {
    if (!voteSummary) {
      return [] as VoteSummaryItem[];
    }
    return [...voteSummary.votes].sort((a, b) => b.score - a.score || (a.judgeName ?? '').localeCompare(b.judgeName ?? ''));
  }, [voteSummary]);

  const timerValue = formatTimerValue(displayRemainingMs);
  const showGrace = stage === 'voting' && timer.status === 'running' && displayRemainingMs > 0 && displayRemainingMs <= 3000;
  const timerCaption =
    timer.status === 'running'
      ? 'Voting window'
      : timer.status === 'paused'
        ? 'Timer paused'
        : timer.status === 'completed'
          ? stage === 'locked'
            ? 'Reveal incoming'
            : 'Timer complete'
          : 'On deck';

  const timerTone =
    timer.status === 'running'
      ? displayRemainingMs <= 5000
        ? 'text-status-results'
        : 'text-status-voting'
      : timer.status === 'paused'
        ? 'text-status-locked'
        : timer.status === 'completed'
          ? 'text-status-results'
          : 'text-status-ready';

  const meta = STAGE_META[stage];
  const activeImage: UploadedImage | null = showState?.currentImage ?? null;
  const showVotingPanel = showState?.showOverlayVoting ?? false;

  // Debug logging
  useEffect(() => {
    console.log('[Overlay] showState.showOverlayVoting:', showState?.showOverlayVoting, 'showVotingPanel:', showVotingPanel);
  }, [showState?.showOverlayVoting, showVotingPanel]);

  const nextImageName = showState?.queue[0]?.image.name ?? 'Awaiting upload';

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-transparent text-bone-100">
      {/* Transparent background for OBS */}
      <SnowBackdrop />

      <div className="relative mx-auto flex h-full w-full max-w-[1920px] flex-col px-6 py-6 lg:px-16 lg:py-12">
        <div className="pointer-events-none absolute left-6 top-6 sm:left-12 sm:top-10 z-10">
          <StageChip stage={stage} />
        </div>

        <div className={`relative grid flex-1 items-stretch gap-6 ${showVotingPanel ? 'grid-cols-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
          <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-night-900/90 shadow-[0_0_60px_rgba(247,215,116,0.2)] backdrop-blur-xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_35%,rgba(247,215,116,0.1),transparent_70%)]" />
            <div className="relative flex h-full items-center justify-center px-10 py-12">
              <div className="absolute inset-10 overflow-hidden rounded-[2rem] border border-white/10 bg-night-900/80 shadow-[inset_0_0_40px_rgba(247,215,116,0.12)] backdrop-blur-sm">
                <div className="relative h-full w-full">
                  {activeImage ? (
                    activeImage.type === 'link' ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 text-center text-bone-100">
                        <div className="text-8xl">🔗</div>
                        <div className="text-4xl font-semibold text-witchlight-500 underline decoration-witchlight-500/50 underline-offset-8">
                          {activeImage.url}
                        </div>
                        <p className="text-xl uppercase tracking-[0.35em] text-specter-300">External Link</p>
                      </div>
                    ) : (
                      <>
                        <img
                          src={activeImage.url}
                          alt={activeImage.name}
                          className="h-full w-full object-contain"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(214,69,69,0.12),transparent_80%)]" />
                      </>
                    )
                  ) : (
                    <>
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(247,215,116,0.12),transparent_70%)]" />
                      <div className="relative flex h-full w-full items-center justify-center">
                        <span className="text-lg uppercase tracking-[0.5em] text-specter-300/70">
                          {showStateError ? 'Upload failed — retry from control' : 'Upload art from control to preview here'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Timer bar positioned over the image section */}
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-[85%]">
              <div className="relative flex items-center justify-between gap-2 rounded-full border border-gold/40 bg-gradient-to-r from-[#1a4b35]/90 via-[#2b7a55]/90 to-[#d64545]/90 px-6 py-3 shadow-[0_0_60px_rgba(247,215,116,0.35),0_0_40px_rgba(214,69,69,0.3)] backdrop-blur-xl">
                <div className="flex-shrink-0 text-xs uppercase tracking-[0.35em] text-specter-300">{timerCaption}</div>
                <div className={`flex-shrink-0 font-mono text-4xl font-semibold ${timerTone}`}>{timerValue}</div>
                {showGrace && stage === 'voting' ? (
                  <div className="flex-shrink-0 rounded-full border border-status-locked/40 bg-status-locked/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-status-locked">
                    Grace +3s
                  </div>
                ) : (
                  <div className="flex-shrink-0 rounded-full border border-white/10 bg-night-900/60 px-4 py-2 text-xs uppercase tracking-[0.35em] text-specter-300">
                    {activeImage ? activeImage.name : 'No image'}
                  </div>
                )}
              </div>
            </div>
          </section>

          {showVotingPanel && (
            <aside
              className={`relative flex flex-col justify-between gap-6 rounded-[2.5rem] border ${meta.railBorder} bg-night-900/90 p-6 backdrop-blur-xl shadow-[0_0_50px_rgba(214,69,69,0.2)]`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(247,215,116,0.1),transparent_60%)]" />
              <div className="space-y-4">
                {stage === 'ready' && <ReadyPanel nextImageName={activeImage?.name ?? nextImageName} />}
                {stage === 'voting' && <VotingPanel distribution={distribution} totalVotes={totalVotes} average={finalAverage} votes={voteSummary?.votes ?? []} />}
                {stage === 'locked' && <LockedPanel average={finalAverage} totalVotes={totalVotes} distribution={distribution} />}
                {stage === 'results' && (
                  <ResultsPanel average={finalAverage} verdict={verdict} verdictTone={verdictTone} votes={resultsVotes} />
                )}
              </div>
              <AudiencePanel summary={showState?.audienceVotes} />
            </aside>
          )}
        </div>
      </div>

      {debug ? (
        <div className="pointer-events-auto absolute left-1/2 top-4 z-20 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full border border-white/10 bg-night-900/85 px-4 py-3 text-xs uppercase tracking-[0.35em] text-specter-300 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          {DEV_STAGES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setStageOverride(candidate)}
              className={`rounded-full px-4 py-2 font-semibold transition ${(stageOverride ?? derivedStage) === candidate
                  ? 'border border-gold bg-gold/15 text-gold'
                  : 'border border-white/10 text-specter-300 hover:border-gold/50 hover:text-gold'
                } ${focusVisible}`}
            >
              {candidate}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStageOverride(null)}
            className={`rounded-full border border-white/10 px-4 py-2 font-semibold text-specter-300 transition hover:border-specter-300/60 hover:text-bone-100 ${focusVisible}`}
          >
            Live feed
          </button>
        </div>
      ) : null}
    </main>
  );
}
