import type { ChangeEvent, DragEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UploadedImage } from '../api/images';
import { uploadImages, updateImageName, createLink } from '../api/images';
import {
  lockCurrentRound,
  pauseTimer,
  removeQueueItem,
  reopenRound,
  resetShow,
  resumeTimer,
  showCurrentResults,
  startNextRound,
  toggleOverlayVoting,
  updateVote,
  deleteVote,
  deleteAllVotes,
  clearAll,
  fetchSettings,
  updateSettings,
  type ShowStage,
  type ShowState,
  type TimerState,
  type VoteSummary,
  type VoteSummaryItem,
  type AppSettings,
  extendTimer,
  updateQueueOrder,
} from '../api/control';
import { TwitchIntegration } from '../components/TwitchIntegration';
import { createJudge, disableJudge, listJudges, type JudgeSummary } from '../api/judges';
import { JUDGE_ICON_MAP } from '../constants/judges';
import { useImageLibrary } from '../hooks/useImageLibrary';
import { useShowState } from '../hooks/useShowState';
import { logout } from '../api/auth';

const focusVisible =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-voting';

type ControlState = 'idle' | 'ready' | 'voting' | 'locked' | 'results';
type SceneRoute = ControlState | 'leaderboard';

const STATE_META: Record<
  ControlState,
  { label: string; text: string; ring: string; badge: string; dot: string }
> = {
  idle: {
    label: 'Idle',
    text: 'text-specter-300',
    ring: 'ring-white/10',
    badge: 'bg-night-900/60',
    dot: 'bg-specter-300',
  },
  ready: {
    label: 'Ready',
    text: 'text-status-ready',
    ring: 'ring-status-ready/40',
    badge: 'bg-status-ready/10',
    dot: 'bg-status-ready',
  },
  voting: {
    label: 'Voting',
    text: 'text-status-voting',
    ring: 'ring-status-voting/40',
    badge: 'bg-status-voting/10',
    dot: 'bg-status-voting',
  },
  locked: {
    label: 'Locked',
    text: 'text-status-locked',
    ring: 'ring-status-locked/40',
    badge: 'bg-status-locked/10',
    dot: 'bg-status-locked',
  },
  results: {
    label: 'Results',
    text: 'text-status-results',
    ring: 'ring-status-results/40',
    badge: 'bg-status-results/10',
    dot: 'bg-status-results',
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatUploadTimestamp(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return formatter.format(new Date(timestamp));
}

function formatTimerValue(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function mergeUploadLists(existing: UploadedImage[], incoming: UploadedImage[]): UploadedImage[] {
  const seen = new Set<string>();
  const merged: UploadedImage[] = [];

  for (const image of [...incoming, ...existing]) {
    if (seen.has(image.id)) {
      continue;
    }
    seen.add(image.id);
    merged.push(image);
  }

  return merged.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, 50);
}

const sceneBar: Array<{ id: SceneRoute; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'ready', label: 'Ready' },
  { id: 'voting', label: 'Voting' },
  { id: 'locked', label: 'Locked' },
  { id: 'results', label: 'Results' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const DEFAULT_TIMER_MS = 120000;

type QueueEntry = ShowState['queue'][number];

function normalizeQueue(entries: QueueEntry[]): QueueEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    position: index + 1,
    ord: (index + 1) * 10,
  }));
}

function reorderQueueLocally(entries: QueueEntry[], sourceId: string, targetId: string): QueueEntry[] {
  if (sourceId === targetId) {
    return entries;
  }
  const next = [...entries];
  const sourceIndex = next.findIndex((entry) => entry.image.id === sourceId);
  const targetIndex = next.findIndex((entry) => entry.image.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return entries;
  }

  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return normalizeQueue(next);
}

function moveItemToEnd(entries: QueueEntry[], sourceId: string): QueueEntry[] {
  const next = [...entries];
  const sourceIndex = next.findIndex((entry) => entry.image.id === sourceId);
  if (sourceIndex === -1 || sourceIndex === next.length - 1) {
    return entries;
  }
  const [moved] = next.splice(sourceIndex, 1);
  next.push(moved);
  return normalizeQueue(next);
}

function isQueueDragEvent(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('application/x-queue-item');
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  ts: string;
  judgeId: string;
  score: number;
}

function StateChip({ state, subtle }: { state: ControlState; subtle?: boolean }): JSX.Element {
  const meta = STATE_META[state];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] ${meta.text} ${subtle ? meta.badge : `${meta.badge} ring-1 ${meta.ring}`
        }`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

const primaryButton =
  'rounded-full bg-gradient-to-r from-[#d64545] to-[#f7d774] px-5 py-2 font-semibold text-[#0b1712] shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition hover:brightness-110 active:translate-y-[1px] ' +
  focusVisible;
const secondaryButton =
  'rounded-full border border-white/20 bg-white/5 px-5 py-2 font-semibold text-bone-100 transition hover:border-gold/70 hover:text-gold ' +
  focusVisible;

function SnowBackdrop(): JSX.Element {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 opacity-55" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-45 bg-[radial-gradient(70%_50%_at_15%_15%,rgba(200,55,70,0.16),rgba(10,24,16,0)),radial-gradient(70%_45%_at_85%_10%,rgba(247,215,116,0.18),rgba(10,24,16,0)),radial-gradient(90%_60%_at_50%_110%,rgba(34,120,78,0.26),rgba(10,24,16,0))]" />
    </>
  );
}
export function ControlDashboard(): JSX.Element {
  const navigate = useNavigate();
  const {
    state: showState,
    loading: isLoadingShowState,
    error: showStateError,
    refresh: refreshShowState,
    setState: setShowState,
  } = useShowState({ pollInterval: 2000 });

  if (import.meta.env.DEV) {
    console.log('[ControlDashboard] showState updated', {
      hasShowState: !!showState,
      queueLength: showState?.queue?.length ?? 0,
      stage: showState?.stage,
    });
  }

  const stageFromServer: ShowStage = showState?.stage ?? 'idle';
  const controlStage = stageFromServer as ControlState;
  const activeScene: SceneRoute = controlStage;
  const activeImage = showState?.currentImage ?? null;
  const queueEntries = useMemo(() => {
    const queue = showState?.queue ?? [];
    if (import.meta.env.DEV) {
      console.log('[queueEntries] useMemo recalculating', {
        hasShowState: !!showState,
        queueFromState: showState?.queue?.length ?? 0,
        resultLength: queue.length,
      });
    }
    return queue;
  }, [showState]);
  const timer: TimerState = showState?.timer ?? {
    status: 'idle',
    durationMs: DEFAULT_TIMER_MS,
    remainingMs: DEFAULT_TIMER_MS,
    updatedAt: 0,
    targetTs: null,
  };
  const voteSummary: VoteSummary | null = showState?.currentVotes ?? null;
  const [serverQueue, setServerQueue] = useState<QueueEntry[]>([]);
  const [optimisticQueue, setOptimisticQueue] = useState<QueueEntry[] | null>(null);
  const currentQueue = optimisticQueue ?? serverQueue;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [queueActionError, setQueueActionError] = useState<string | null>(null);
  const dropHandledRef = useRef(false);
  const [displayRemainingMs, setDisplayRemainingMs] = useState(timer.remainingMs);
  const [judges, setJudges] = useState<JudgeSummary[]>([]);
  const [isLoadingJudges, setIsLoadingJudges] = useState(true);
  const [judgesError, setJudgesError] = useState<string | null>(null);
  const [isCreatingJudge, setIsCreatingJudge] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<JudgeSummary | null>(null);
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const voteDistribution = voteSummary?.distribution ?? [0, 0, 0, 0, 0];
  const voteAverage = voteSummary?.average ?? null;
  const votesByJudge = useMemo(() => {
    const map = new Map<string, VoteSummaryItem>();
    voteSummary?.votes.forEach((vote) => {
      map.set(vote.judgeId, vote);
    });
    return map;
  }, [voteSummary]);
  const distributionMax = voteDistribution.reduce((max, count) => (count > max ? count : max), 0);
  const MAX_BAR_HEIGHT = 96;
  const voteAuditTrail: AuditEntry[] = useMemo(() => {
    if (!voteSummary || voteSummary.votes.length === 0) {
      return [];
    }
    return [...voteSummary.votes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((vote) => {
        const name = vote.judgeName ?? `Judge ${vote.judgeId.slice(0, 4).toUpperCase()}`;
        return {
          id: `${vote.judgeId}-${vote.updatedAt}`,
          actor: name,
          action: `Scored ${vote.score}`,
          ts: new Date(vote.updatedAt).toLocaleTimeString(),
          judgeId: vote.judgeId,
          score: vote.score,
        } satisfies AuditEntry;
      });
  }, [voteSummary]);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounterRef = useRef(0);
  const {
    images: recentUploads,
    loading: isLoadingUploads,
    error: libraryError,
    setImages,
  } = useImageLibrary({ pollInterval: 15000 });
  const [isStageMutating, setIsStageMutating] = useState(false);
  const [stageActionError, setStageActionError] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageName, setEditingImageName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);
  const lastDragOverIdRef = useRef<string | null>(null);
  const dragEnterTimeoutRef = useRef<number | null>(null);
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);
  const [editingVoteScore, setEditingVoteScore] = useState<number>(3);
  const [isSavingVote, setIsSavingVote] = useState(false);
  const [voteActionError, setVoteActionError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ defaultTimerSeconds: 120, graceWindowSeconds: 3 });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [editingSettingKey, setEditingSettingKey] = useState<keyof AppSettings | null>(null);
  const [editingSettingValue, setEditingSettingValue] = useState<number>(0);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [addLinkError, setAddLinkError] = useState<string | null>(null);

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
    channel.onmessage = (event) => {
      const message = event.data;
      if (message?.type === 'vote-summary' && message.summary) {
        const summary = message.summary as VoteSummary;
        setShowState((prev) => {
          if (!prev) {
            return prev;
          }
          return { ...prev, currentVotes: summary };
        });
      } else {
        void refreshShowState();
      }
    };

    return () => {
      channel?.close();
      broadcastRef.current = null;
    };
  }, [refreshShowState, setShowState]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug('[control] queueEntries update', {
        stage: controlStage,
        queueLength: queueEntries.length,
        queueIds: queueEntries.map((entry) => entry.image.id),
        serverLength: serverQueue.length,
        optimisticLength: optimisticQueue?.length ?? 0,
      });
    }
  }, [queueEntries, serverQueue, optimisticQueue, controlStage]);
  useEffect(() => {
    setServerQueue(queueEntries);
    if (!draggingId && !isReordering) {
      setOptimisticQueue(null);
    }
  }, [queueEntries, draggingId, isReordering]);

  // Cleanup drag timeout on unmount
  useEffect(() => {
    return () => {
      if (dragEnterTimeoutRef.current) {
        clearTimeout(dragEnterTimeoutRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    async function loadJudges() {
      setIsLoadingJudges(true);
      try {
        const { judges: list } = await listJudges();
        if (!cancelled) {
          setJudges(list);
          setJudgesError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setJudgesError(error instanceof Error ? error.message : 'Failed to load judges.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingJudges(false);
        }
      }
    }

    void loadJudges();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const loadedSettings = await fetchSettings();
        if (!cancelled) {
          setSettings(loadedSettings);
          setSettingsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSettingsError(error instanceof Error ? error.message : 'Failed to load settings.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const processFiles = async (incoming: File[]) => {
    if (incoming.length === 0) {
      return;
    }

    setQueueActionError(null);
    setUploadError(null);
    const validFiles = incoming.filter((file) => ACCEPTED_TYPES.has(file.type));
    const invalidFiles = incoming.filter((file) => !ACCEPTED_TYPES.has(file.type));

    if (invalidFiles.length > 0) {
      const sample = invalidFiles.slice(0, 3).map((file) => file.name).join(', ');
      setUploadError(`Unsupported file type skipped: ${sample}${invalidFiles.length > 3 ? '…' : ''}`);
    } else {
      setUploadError(null);
    }

    if (validFiles.length === 0) {
      setUploadSuccess(null);
      return;
    }

    setIsUploading(true);
    setUploadSuccess(null);

    try {
      const uploadedImages = await uploadImages(validFiles);
      setImages((prev) => mergeUploadLists(prev, uploadedImages));
      setShowState((prev) => {
        const baseTimer = prev?.timer ?? timer;
        const baseState =
          prev ?? {
            stage: 'idle' as ShowStage,
            currentImage: null,
            queue: [] as Array<{
              position: number;
              ord: number;
              image: UploadedImage;
            }>,
            timer: baseTimer,
            currentVotes: null,
            audienceVotes: null,
            showOverlayVoting: false,
          };

        const currentMaxOrd = baseState.queue.reduce((max, entry) => Math.max(max, entry.ord), 0);
        const nextQueue = [...baseState.queue];
        uploadedImages.forEach((image, index) => {
          const nextOrd = currentMaxOrd + (index + 1) * 10;
          nextQueue.push({
            position: nextQueue.length + 1,
            ord: nextOrd,
            image,
          });
        });
        const normalizedQueue = nextQueue.map((entry, idx) => ({
          ...entry,
          position: idx + 1,
        }));
        return {
          ...baseState,
          queue: normalizedQueue,
          timer: baseTimer,
          currentVotes: baseState.currentVotes,
          audienceVotes: baseState.audienceVotes,
        };
      });
      broadcastStateUpdate();
      await refreshShowState();
      setUploadSuccess(
        uploadedImages.length === 1
          ? `Uploaded "${uploadedImages[0].name}".`
          : `Uploaded ${uploadedImages.length} images.`
      );
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!linkUrl.trim()) {
      setAddLinkError('URL is required.');
      return;
    }

    setIsAddingLink(true);
    setAddLinkError(null);

    try {
      const newImage = await createLink(linkUrl.trim(), linkName.trim() || undefined);

      // Update state similar to upload
      setShowState((prev) => {
        const baseTimer = prev?.timer ?? timer;
        const baseState =
          prev ?? {
            stage: 'idle' as ShowStage,
            currentImage: null,
            queue: [] as Array<{
              position: number;
              ord: number;
              image: UploadedImage;
            }>,
            timer: baseTimer,
            currentVotes: null,
            audienceVotes: null,
            showOverlayVoting: false,
          };

        const currentMaxOrd = baseState.queue.reduce((max, entry) => Math.max(max, entry.ord), 0);
        const nextOrd = currentMaxOrd + 10;
        const newQueue = [
          ...baseState.queue,
          { position: baseState.queue.length + 1, ord: nextOrd, image: newImage }
        ];
        // Normalize positions
        const normalizedQueue = newQueue.map((entry, idx) => ({ ...entry, position: idx + 1 }));

        return {
          ...baseState,
          queue: normalizedQueue,
        };
      });

      broadcastStateUpdate();
      await refreshShowState();

      setIsLinkModalOpen(false);
      setLinkUrl('');
      setLinkName('');
    } catch (error) {
      setAddLinkError(error instanceof Error ? error.message : 'Failed to create link.');
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleUploadButtonClick = () => {
    setUploadError(null);
    setUploadSuccess(null);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    await processFiles(Array.from(files));
    event.target.value = '';
  };

  const persistQueueOrder = async (nextQueue: QueueEntry[]) => {
    const ids = nextQueue.map((entry) => entry.image.id);
    const currentIds = serverQueue.map((entry) => entry.image.id);

    if (ids.length === currentIds.length && ids.every((id, index) => id === currentIds[index])) {
      return;
    }

    const previousQueue = currentQueue;
    setIsReordering(true);
    setQueueActionError(null);
    setOptimisticQueue(nextQueue);
    try {
      const state = await updateQueueOrder(ids);
      setShowState(state);
      setOptimisticQueue(null);
    } catch (error) {
      setQueueActionError(error instanceof Error ? error.message : 'Failed to save queue order.');
      setOptimisticQueue(previousQueue);
    } finally {
      setIsReordering(false);
    }
  };

  const handleRemoveFromQueue = async (imageId: string) => {
    if (isReordering) {
      return;
    }
    setQueueActionError(null);
    const previousQueue = currentQueue;
    const nextQueue = normalizeQueue(previousQueue.filter((entry) => entry.image.id !== imageId));
    setOptimisticQueue(nextQueue);
    setIsReordering(true);
    try {
      const state = await removeQueueItem(imageId);
      setShowState(state);
      setOptimisticQueue(null);
    } catch (error) {
      setQueueActionError(error instanceof Error ? error.message : 'Failed to remove image from queue.');
      setOptimisticQueue(previousQueue);
    } finally {
      setIsReordering(false);
    }
  };

  const handleStartEditImageName = (imageId: string, currentName: string) => {
    setEditingImageId(imageId);
    setEditingImageName(currentName);
  };

  const handleCancelEditImageName = () => {
    setEditingImageId(null);
    setEditingImageName('');
  };

  const handleSaveImageName = async (imageId: string) => {
    const trimmedName = editingImageName.trim();
    if (!trimmedName) {
      setQueueActionError('Image name cannot be empty');
      return;
    }

    setIsSavingName(true);
    setQueueActionError(null);
    try {
      const updatedImage = await updateImageName(imageId, trimmedName);

      // Update the queue optimistically
      setOptimisticQueue((prev) => {
        const queue = prev ?? serverQueue;
        return queue.map((entry) =>
          entry.image.id === imageId
            ? { ...entry, image: { ...entry.image, name: updatedImage.name } }
            : entry
        );
      });

      // Update recent uploads
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, name: updatedImage.name } : img))
      );

      setEditingImageId(null);
      setEditingImageName('');
    } catch (error) {
      setQueueActionError(error instanceof Error ? error.message : 'Failed to update image name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleItemDragStart = (event: DragEvent<HTMLLIElement>, imageId: string) => {
    if (isReordering) {
      event.preventDefault();
      return;
    }
    dropHandledRef.current = false;
    lastDragOverIdRef.current = null;
    setDraggingId(imageId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-queue-item', imageId);
    event.dataTransfer.setData('text/plain', imageId);
  };

  const handleItemDragEnter = (event: DragEvent<HTMLLIElement>, overId: string) => {
    if (isReordering || !draggingId || draggingId === overId || !isQueueDragEvent(event)) {
      return;
    }

    // Throttle rapid drag enters
    if (lastDragOverIdRef.current === overId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    lastDragOverIdRef.current = overId;

    // Debounce the reorder to reduce jank
    if (dragEnterTimeoutRef.current) {
      clearTimeout(dragEnterTimeoutRef.current);
    }

    dragEnterTimeoutRef.current = setTimeout(() => {
      setOptimisticQueue((prev) => reorderQueueLocally(prev ?? serverQueue, draggingId, overId));
      dragEnterTimeoutRef.current = null;
    }, 50);
  };

  const handleItemDragOver = (event: DragEvent<HTMLLIElement>) => {
    if (isReordering || !draggingId || !isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleItemDrop = async (event: DragEvent<HTMLLIElement>, overId: string) => {
    if (isReordering || !draggingId || !isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const next = reorderQueueLocally(currentQueue, draggingId, overId);
    setOptimisticQueue(next);
    dropHandledRef.current = true;
    setDraggingId(null);
    await persistQueueOrder(next);
  };

  const handleItemDragEnd = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // Clean up timeout if still pending
    if (dragEnterTimeoutRef.current) {
      clearTimeout(dragEnterTimeoutRef.current);
      dragEnterTimeoutRef.current = null;
    }

    if (!dropHandledRef.current) {
      setOptimisticQueue(null);
    }
    setDraggingId(null);
    lastDragOverIdRef.current = null;
    dropHandledRef.current = false;
  };

  const handleListDragEnter = (event: DragEvent<HTMLUListElement>) => {
    if (isReordering || !draggingId || !isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setOptimisticQueue((prev) => moveItemToEnd(prev ?? serverQueue, draggingId));
  };

  const handleListDragOver = (event: DragEvent<HTMLUListElement>) => {
    if (isReordering || !draggingId || !isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleListDrop = async (event: DragEvent<HTMLUListElement>) => {
    if (isReordering || !draggingId || !isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const next = moveItemToEnd(currentQueue, draggingId);
    setOptimisticQueue(next);
    dropHandledRef.current = true;
    setDraggingId(null);
    await persistQueueOrder(next);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    dragCounterRef.current += 1;
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (isQueueDragEvent(event)) {
      return;
    }
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    await processFiles(files);
  };

  const handleStartVoting = async () => {
    setStartError(null);
    setStageActionError(null);
    setIsStarting(true);
    try {
      const state = await startNextRound();
      setShowState(state);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Failed to start round.');
    } finally {
      setIsStarting(false);
    }
  };

  const broadcastStateUpdate = () => {
    broadcastRef.current?.postMessage({ type: 'state-update' });
  };

  const handleStageAction = async (action: () => Promise<ShowState>, errorLabel: string) => {
    setStartError(null);
    setStageActionError(null);
    setIsStageMutating(true);
    try {
      const state = await action();
      setShowState(state);
      broadcastStateUpdate();
    } catch (error) {
      setStageActionError(error instanceof Error ? error.message : errorLabel);
    } finally {
      setIsStageMutating(false);
    }
  };

  const handleLockRound = () => handleStageAction(lockCurrentRound, 'Failed to lock round.');
  const handleShowResults = () => handleStageAction(showCurrentResults, 'Failed to show results.');
  const handleReopenRound = () => handleStageAction(reopenRound, 'Failed to reopen round.');
  const handleResetShow = () => handleStageAction(resetShow, 'Failed to reset show.');
  const handleClearAllVotes = () => handleStageAction(deleteAllVotes, 'Failed to clear all votes.');
  const handleClearAll = () => {
    if (window.confirm('⚠️ WARNING: This will delete ALL images, votes, and queue data. This cannot be undone. Are you sure?')) {
      handleStageAction(clearAll, 'Failed to clear all data.');
    }
  };
  const handlePauseTimerAction = () => handleStageAction(pauseTimer, 'Failed to pause timer.');
  const handleResumeTimerAction = () => handleStageAction(resumeTimer, 'Failed to resume timer.');
  const handleExtendThirty = () => handleStageAction(() => extendTimer(30), 'Failed to extend timer.');

  const handleCreateJudge = async (presetName?: string) => {
    if (isCreatingJudge) {
      return;
    }
    let name = presetName ?? '';
    if (!presetName) {
      name = window.prompt('Optional: enter judge name to prefill invite (leave blank to let them choose).', '') ?? '';
    }
    setIsCreatingJudge(true);
    setJudgesError(null);
    try {
      const judge = await createJudge({ name: name.trim() || undefined });
      setJudges((prev) => [...prev, judge].sort((a, b) => a.createdAt - b.createdAt));
      setCreatedInvite(judge);
      broadcastStateUpdate();
    } catch (error) {
      setJudgesError(error instanceof Error ? error.message : 'Failed to create judge.');
    } finally {
      setIsCreatingJudge(false);
    }
  };

  const handleDisableJudge = async (id: string) => {
    try {
      const updated = await disableJudge(id);
      setJudges((prev) => prev.map((judge) => (judge.id === id ? updated : judge)));
      broadcastStateUpdate();
    } catch (error) {
      setJudgesError(error instanceof Error ? error.message : 'Failed to disable judge.');
    }
  };

  const handleToggleOverlayVoting = async () => {
    const newState = !showOverlayVoting;
    setStageActionError(null);
    setIsStageMutating(true);
    try {
      const state = await toggleOverlayVoting(newState);
      setShowState(state);
      broadcastStateUpdate();
    } catch (error) {
      setStageActionError(error instanceof Error ? error.message : 'Failed to toggle overlay voting.');
    } finally {
      setIsStageMutating(false);
    }
  };

  const handleEditVote = (judgeId: string, currentScore: number) => {
    setEditingVoteId(judgeId);
    setEditingVoteScore(currentScore);
    setVoteActionError(null);
  };

  const handleSaveVote = async (judgeId: string) => {
    if (!activeImage) {
      setVoteActionError('No active image.');
      return;
    }
    setIsSavingVote(true);
    setVoteActionError(null);
    try {
      const state = await updateVote(activeImage.id, judgeId, editingVoteScore);
      setShowState(state);
      setEditingVoteId(null);
      broadcastStateUpdate();
    } catch (error) {
      setVoteActionError(error instanceof Error ? error.message : 'Failed to update vote.');
    } finally {
      setIsSavingVote(false);
    }
  };

  const handleDeleteVote = async (judgeId: string) => {
    if (!activeImage) {
      setVoteActionError('No active image.');
      return;
    }
    if (!window.confirm('Delete this vote? This action cannot be undone.')) {
      return;
    }
    setVoteActionError(null);
    try {
      const state = await deleteVote(activeImage.id, judgeId);
      setShowState(state);
      broadcastStateUpdate();
    } catch (error) {
      setVoteActionError(error instanceof Error ? error.message : 'Failed to delete vote.');
    }
  };

  const handleCancelEditVote = () => {
    setEditingVoteId(null);
    setVoteActionError(null);
  };

  const handleEditSetting = (key: keyof AppSettings) => {
    setEditingSettingKey(key);
    setEditingSettingValue(settings[key]);
    setSettingsError(null);
  };

  const handleSaveSetting = async () => {
    if (!editingSettingKey) {
      return;
    }
    setIsSavingSetting(true);
    setSettingsError(null);
    try {
      const updated = await updateSettings({ [editingSettingKey]: editingSettingValue });
      setSettings(updated);
      setEditingSettingKey(null);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Failed to update setting.');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleCancelEditSetting = () => {
    setEditingSettingKey(null);
    setSettingsError(null);
  };

  const canStartRound = serverQueue.length > 0 && !isStarting && controlStage !== 'voting';
  const startButtonLabel = isStarting
    ? 'Starting…'
    : controlStage === 'voting' && activeImage
      ? 'Advance to Next Image'
      : 'Show Image';
  const timerStatusLabel =
    timer.status === 'running'
      ? 'Running'
      : timer.status === 'paused'
        ? 'Paused'
        : timer.status === 'completed'
          ? 'Completed'
          : 'Idle';
  const isTimerRunning = timer.status === 'running';
  const isTimerPaused = timer.status === 'paused';
  const canPauseTimer = controlStage === 'voting' && isTimerRunning && !isStageMutating;
  const canResumeTimer = controlStage === 'voting' && isTimerPaused && !isStageMutating;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/control/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force navigation anyway
      navigate('/control/login');
    }
  };
  const canExtendTimer = controlStage === 'voting' && (isTimerRunning || isTimerPaused) && !isStageMutating;
  const timerDisplayValue = formatTimerValue(displayRemainingMs);
  const showOverlayVoting = showState?.showOverlayVoting ?? false;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0e1c14] text-bone-100">
      <SnowBackdrop />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10">
        <header className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.45em] text-specter-300">Slash or Smash · North Pole</p>
              <h1 className="text-4xl font-semibold text-gold md:text-5xl">Producer Workshop</h1>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <StateChip state={controlStage} />
              <div className="rounded-2xl border border-white/10 bg-grave-800/60 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Timer · {timerStatusLabel}</p>
                <p className="font-mono text-3xl font-semibold">{timerDisplayValue}</p>
                <p className="text-[0.7rem] text-specter-300/80">
                  Target {formatTimerValue(timer.durationMs)} · {timer.status === 'running' ? 'Auto-lock when timer ends' : 'Start round to begin timer'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-full border border-status-results/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-status-results transition hover:bg-status-results/10"
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3 rounded-3xl border border-white/5 bg-grave-800/50 p-3">
            {sceneBar.map((scene) => {
              const isActive = scene.id === activeScene;
              return (
                <button
                  key={scene.id}
                  type="button"
                  className={`rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-[0.35em] transition ${isActive
                    ? 'bg-gradient-to-r from-[#d64545] to-[#f7d774] text-[#0b1712] shadow-[0_12px_30px_rgba(0,0,0,0.35)]'
                    : 'border border-transparent text-specter-300 hover:border-gold/40 hover:text-gold'
                    } ${focusVisible}`}
                >
                  {scene.label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-8">
            <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Active Round</p>
                  <h2 className="text-3xl font-semibold text-bone-100 sm:text-4xl">
                    {activeImage ? activeImage.name : isLoadingShowState ? 'Loading…' : 'No image live'}
                  </h2>
                  <p className="text-sm text-specter-300">
                    {activeImage
                      ? `${activeImage.originalName} • ${formatBytes(activeImage.size)} • ${activeImage.mimeType.replace('image/', '').toUpperCase()}`
                      : serverQueue.length > 0
                        ? 'Start the next round to send it live.'
                        : 'Upload images to build your queue.'}
                  </p>
                </div>
                <StateChip state={controlStage === 'idle' ? 'ready' : controlStage} subtle />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div className="relative h-72 overflow-hidden rounded-3xl border border-white/5 bg-night-900/70">
                  {activeImage ? (
                    activeImage.type === 'link' ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-night-900 p-8 text-center">
                        <div className="text-6xl">🔗</div>
                        <a
                          href={activeImage.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xl font-semibold text-witchlight-500 underline decoration-witchlight-500/50 underline-offset-8 hover:decoration-witchlight-500"
                        >
                          {activeImage.url}
                        </a>
                        <p className="text-sm uppercase tracking-[0.35em] text-specter-300">External Link</p>
                      </div>
                    ) : (
                      <img src={activeImage.url} alt={activeImage.name} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-sm text-specter-300">
                      <p>Nothing on-air yet.</p>
                      <p className="text-xs uppercase tracking-[0.35em] text-specter-300/80">
                        {serverQueue.length > 0 ? 'Press Start to go live.' : 'Upload art to populate the queue.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-3xl border border-white/5 bg-night-900/60 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Vote Average</p>
                      <span className="rounded-full bg-status-voting/10 px-3 py-1 text-xs font-semibold text-status-voting">
                        {voteSummary ? `${voteSummary.judgeCount} judge${voteSummary.judgeCount === 1 ? '' : 's'} in` : 'No votes yet'}
                      </span>
                    </div>
                    <p className="mt-2 text-4xl font-semibold text-bone-100">
                      {voteAverage !== null ? voteAverage.toFixed(2) : '—'}
                    </p>
                    <p className="text-sm text-specter-300">Averages snap to nearest 0.25</p>
                  </div>

                  <div className="rounded-3xl border border-white/5 bg-night-900/60 px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-specter-300">Vote Distribution</p>
                    <div className="mt-4 grid grid-cols-5 items-end gap-3">
                      {voteDistribution.map((count, index) => {
                        const colors = ['bg-status-ready', 'bg-witchlight-500', 'bg-[#B45CFF]', 'bg-status-results', 'bg-status-voting'] as const;
                        const heightPx =
                          distributionMax > 0 ? Math.max((count / distributionMax) * MAX_BAR_HEIGHT, 8) : 8;
                        return (
                          <div key={index} className="flex flex-col items-center gap-2">
                            <div
                              className={`w-8 rounded-full ${colors[index]} transition-all`}
                              style={{ height: `${heightPx}px` }}
                            />
                            <span className="text-xs font-semibold text-specter-300">{index + 1}</span>
                            <span className="text-[0.65rem] text-specter-300/80">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`relative rounded-3xl border border-white/5 bg-grave-800/60 p-6 transition ${isDragActive ? 'border-dashed border-witchlight-500/70 bg-night-900/70' : ''
                }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              aria-label="Upload area. Drag and drop images here to add them to the queue."
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-semibold text-bone-100">Queue + Media</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.35em] text-specter-300/80">
                    {`Server queue: ${serverQueue.length} · Optimistic: ${optimisticQueue ? optimisticQueue.length : 0
                      }`}
                  </span>
                  {isUploading && (
                    <span className="rounded-full bg-status-ready/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-status-ready">
                      Uploading...
                    </span>
                  )}
                  <button
                    type="button"
                    className={`${secondaryButton} ${isUploading ? 'cursor-not-allowed opacity-70' : ''}`}
                    onClick={() => setIsLinkModalOpen(true)}
                    disabled={isUploading}
                  >
                    Add Link
                  </button>
                  <button
                    type="button"
                    className={`${secondaryButton} ${isUploading ? 'cursor-not-allowed opacity-70' : ''}`}
                    onClick={handleUploadButtonClick}
                    disabled={isUploading}
                  >
                    Upload Images
                  </button>
                </div>
              </div>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={handleFileInputChange}
              />
              {isDragActive && (
                <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[1.9rem] border-2 border-dashed border-witchlight-500/70 bg-night-900/80">
                  <div className="rounded-2xl border border-witchlight-500/50 bg-night-900/90 px-6 py-4 text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.35em] text-witchlight-500">
                      Drop images to upload
                    </p>
                    <p className="mt-2 text-xs text-specter-300">PNG, JPG, or WEBP up to 25MB each</p>
                  </div>
                </div>
              )}
              {uploadError && (
                <p className="mt-4 rounded-2xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                  {uploadError}
                </p>
              )}
              {uploadSuccess && !uploadError && (
                <p className="mt-4 rounded-2xl border border-status-ready/40 bg-status-ready/10 px-4 py-3 text-sm text-status-ready">
                  {uploadSuccess}
                </p>
              )}
              {libraryError && !uploadError && (
                <p className="mt-4 rounded-2xl border border-status-locked/40 bg-status-locked/10 px-4 py-3 text-sm text-status-locked">
                  {libraryError}
                </p>
              )}
              {showStateError && (
                <p className="mt-4 rounded-2xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                  {showStateError}
                </p>
              )}
              <ul
                className="mt-6 space-y-3"
                onDragEnter={handleListDragEnter}
                onDragOver={handleListDragOver}
                onDrop={(event) => {
                  void handleListDrop(event);
                }}
              >
                {currentQueue.length === 0 ? (
                  <li className="rounded-3xl border border-dashed border-white/10 bg-night-900/60 px-4 py-6 text-center text-sm text-specter-300">
                    Queue is empty. Upload art to line up the next round.
                  </li>
                ) : (
                  currentQueue.map((entry) => {
                    const isDraggingItem = draggingId === entry.image.id;
                    const isEditingThisItem = editingImageId === entry.image.id;
                    return (
                      <li
                        key={entry.image.id}
                        className={`group rounded-3xl border border-white/5 bg-night-900/70 p-4 transition hover:border-witchlight-500/40 hover:bg-night-900/80 ${isDraggingItem ? 'opacity-70 border-dashed border-witchlight-500' : ''
                          }`}
                        draggable={!isReordering && !isEditingThisItem}
                        aria-grabbed={isDraggingItem}
                        onDragStart={(event) => handleItemDragStart(event, entry.image.id)}
                        onDragEnter={(event) => handleItemDragEnter(event, entry.image.id)}
                        onDragOver={handleItemDragOver}
                        onDrop={(event) => void handleItemDrop(event, entry.image.id)}
                        onDragEnd={handleItemDragEnd}
                        style={{ cursor: isReordering ? 'not-allowed' : isEditingThisItem ? 'default' : 'grab' }}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex gap-4 flex-1">
                            {/* Thumbnail */}
                            {/* Thumbnail */}
                            <div className="flex-shrink-0">
                              {entry.image.type === 'link' ? (
                                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-night-900 text-3xl">
                                  🔗
                                </div>
                              ) : (
                                <img
                                  src={entry.image.url}
                                  alt={entry.image.name}
                                  className="h-20 w-20 rounded-2xl border border-white/10 bg-night-900 object-cover"
                                />
                              )}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs uppercase tracking-[0.35em] text-specter-300">#{entry.position}</p>
                              {isEditingThisItem ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingImageName}
                                    onChange={(e) => setEditingImageName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        void handleSaveImageName(entry.image.id);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEditImageName();
                                      }
                                    }}
                                    disabled={isSavingName}
                                    className="flex-1 rounded-full border border-witchlight-500/40 bg-night-900 px-4 py-2 text-lg font-semibold text-bone-100 outline-none transition focus:border-witchlight-500 disabled:opacity-60"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveImageName(entry.image.id)}
                                    disabled={isSavingName}
                                    className="rounded-full border border-status-ready/40 bg-status-ready/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-status-ready transition hover:bg-status-ready/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isSavingName ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditImageName}
                                    disabled={isSavingName}
                                    className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-specter-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-1 flex items-center gap-2">
                                  <h3 className="text-xl font-semibold text-bone-100">{entry.image.name}</h3>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditImageName(entry.image.id, entry.image.name)}
                                    disabled={isReordering}
                                    className="rounded px-2 py-1 text-xs text-witchlight-500 opacity-0 transition hover:bg-witchlight-500/10 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
                                    title="Edit name"
                                  >
                                    ✎ Edit
                                  </button>
                                </div>
                              )}
                              <p className="text-sm text-specter-300">
                                {formatBytes(entry.image.size)} • {entry.image.mimeType.replace('image/', '').toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-2 text-sm text-specter-300 md:items-end">
                            <span className="text-xs uppercase tracking-[0.35em]">
                              Uploaded {formatUploadTimestamp(entry.image.uploadedAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              {entry.image.type === 'link' && (
                                <a
                                  href={entry.image.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-witchlight-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-witchlight-500 transition hover:bg-witchlight-500/10"
                                >
                                  Open
                                </a>
                              )}
                              <span className="rounded-full border border-white/10 bg-night-900/60 px-3 py-1 text-xs uppercase tracking-[0.35em] text-specter-300">
                                {entry.image.id.slice(0, 8).toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleRemoveFromQueue(entry.image.id)}
                                disabled={isReordering || isEditingThisItem}
                                className="rounded-full border border-status-results/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-status-results transition hover:bg-status-results/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              {queueActionError && (
                <p className="mt-4 rounded-2xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                  {queueActionError}
                </p>
              )}
              {isReordering && (
                <p className="mt-3 text-xs uppercase tracking-[0.35em] text-specter-300">Saving queue…</p>
              )}
              <div className="mt-6 text-sm text-specter-300">
                {currentQueue.length > 0
                  ? `${currentQueue.length} image${currentQueue.length === 1 ? '' : 's'} waiting in queue.`
                  : 'Queue empty.'}
              </div>
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.35em] text-specter-300">Recently Uploaded</h3>
                  {recentUploads.length > 0 && (
                    <span className="text-xs uppercase tracking-[0.35em] text-specter-300">
                      {isUploading ? 'Saving...' : 'Synced'}
                    </span>
                  )}
                </div>
                {isLoadingUploads ? (
                  <p className="mt-4 text-sm text-specter-300">Loading uploads...</p>
                ) : recentUploads.length === 0 ? (
                  <p className="mt-4 text-sm text-specter-300">No uploads yet.</p>
                ) : (
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {recentUploads.slice(0, 6).map((image) => (
                      <li
                        key={image.id}
                        className="rounded-2xl border border-white/5 bg-night-900/60 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">
                          {formatUploadTimestamp(image.uploadedAt)}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-bone-100">{image.name}</p>
                        <p className="text-sm text-specter-300">{image.originalName}</p>
                        <p className="text-sm text-specter-300">
                          {formatBytes(image.size)} • {image.mimeType.replace('image/', '').toUpperCase()}
                        </p>
                        <a
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.35em] text-witchlight-500 transition hover:text-witchlight-500/80"
                        >
                          Preview
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-8">
            <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-bone-100">Round Controls</h2>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  className={`${primaryButton} ${canStartRound ? '' : 'cursor-not-allowed opacity-60'}`}
                  onClick={handleStartVoting}
                  disabled={!canStartRound}
                >
                  {startButtonLabel}
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${!(canPauseTimer || canResumeTimer) ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => {
                    if (canPauseTimer) {
                      void handlePauseTimerAction();
                    } else if (canResumeTimer) {
                      void handleResumeTimerAction();
                    }
                  }}
                  disabled={!(canPauseTimer || canResumeTimer)}
                >
                  {canPauseTimer ? 'Pause Timer' : canResumeTimer ? 'Resume Timer' : 'Start Timer'}
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${!canExtendTimer ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => {
                    if (canExtendTimer) {
                      void handleExtendThirty();
                    }
                  }}
                  disabled={!canExtendTimer}
                >
                  Extend +30s
                </button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={`${secondaryButton} ${controlStage !== 'voting' || isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => void handleLockRound()}
                  disabled={controlStage !== 'voting' || isStageMutating}
                >
                  Lock Votes
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${controlStage !== 'locked' || isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => void handleReopenRound()}
                  disabled={controlStage !== 'locked' || isStageMutating}
                >
                  Reopen Voting
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${controlStage !== 'locked' || isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => void handleShowResults()}
                  disabled={controlStage !== 'locked' || isStageMutating}
                >
                  Show Results
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => void handleToggleOverlayVoting()}
                  disabled={isStageMutating}
                >
                  {showOverlayVoting ? 'Hide' : 'Show'} Live Voting
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${controlStage !== 'results' || isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => void handleResetShow()}
                  disabled={controlStage !== 'results' || isStageMutating}
                >
                  Reset to Idle
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete ALL votes for ALL images? This cannot be undone.')) {
                      void handleClearAllVotes();
                    }
                  }}
                  disabled={isStageMutating}
                >
                  Clear All Votes
                </button>
                <button
                  type="button"
                  className={`rounded-full border-2 border-status-results bg-status-results/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-status-results transition hover:bg-status-results/20 ${isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => void handleClearAll()}
                  disabled={isStageMutating}
                >
                  ⚠️ Clear Everything
                </button>
                <button
                  type="button"
                  className={`${secondaryButton} ${isStageMutating ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => {
                    void refreshShowState();
                  }}
                  disabled={isStageMutating}
                >
                  Refresh State
                </button>
              </div>
              {(startError || stageActionError) && (
                <p className="mt-4 text-xs uppercase tracking-[0.35em] text-status-results">
                  {startError ?? stageActionError}
                </p>
              )}
              <div className="mt-6 rounded-3xl border border-white/5 bg-night-900/60 px-4 py-3 text-sm text-specter-300">
                Manual override tools sit below. All changes log to audit trail automatically.
              </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
              <h2 className="text-2xl font-semibold text-bone-100">Judge Telemetry</h2>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className={`${secondaryButton} ${isCreatingJudge ? 'cursor-not-allowed opacity-60' : ''}`}
                  onClick={() => void handleCreateJudge()}
                  disabled={isCreatingJudge}
                >
                  {isCreatingJudge ? 'Generating…' : 'Generate Judge Invite'}
                </button>
                <p className="text-xs text-specter-300">
                  Pending judges share invite link to activate icon and name.
                </p>
              </div>
              {createdInvite && (
                <div className="mt-4 rounded-2xl border border-witchlight-500/40 bg-witchlight-500/10 px-4 py-3 text-sm text-witchlight-500">
                  Invite ready: <span className="font-semibold">{appOrigin + createdInvite.invitePath}</span>
                </div>
              )}
              {judgesError && (
                <p className="mt-4 rounded-2xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                  {judgesError}
                </p>
              )}
              <ul className="mt-5 space-y-3">
                {isLoadingJudges ? (
                  <li className="rounded-2xl border border-white/5 bg-night-900/60 px-4 py-4 text-sm text-specter-300">
                    Loading judges…
                  </li>
                ) : judges.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-white/10 bg-night-900/60 px-4 py-4 text-sm text-specter-300">
                    No judges yet. Generate an invite to get started.
                  </li>
                ) : (
                  judges.map((judge) => {
                    const iconMeta = judge.icon ? JUDGE_ICON_MAP[judge.icon] : undefined;
                    const statusLabel = judge.status === 'active' ? 'Active' : judge.status === 'pending' ? 'Pending' : 'Disabled';
                    const statusStyle =
                      judge.status === 'active'
                        ? 'bg-status-voting/10 text-status-voting'
                        : judge.status === 'pending'
                          ? 'bg-status-ready/10 text-status-ready'
                          : 'bg-status-results/10 text-status-results';

                    return (
                      <li key={judge.id} className="rounded-2xl border border-white/5 bg-night-900/60 px-3 py-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xl flex-shrink-0" aria-hidden>{iconMeta?.emoji ?? '👤'}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-bone-100 truncate">{judge.name ?? 'Awaiting activation'}</p>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-specter-300">Code: {judge.inviteCode}</p>
                              <p className="text-[10px] text-specter-300 truncate">
                                <a
                                  href={judge.invitePath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-witchlight-500 hover:text-witchlight-500/80"
                                  title={appOrigin + judge.invitePath}
                                >
                                  {judge.invitePath}
                                </a>
                              </p>
                              {voteSummary && judge.status === 'active' && (
                                <p className="mt-0.5 text-[10px] text-specter-300/80">
                                  {votesByJudge.has(judge.id)
                                    ? `Score: ${votesByJudge.get(judge.id)?.score}`
                                    : 'No score'}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-1 md:items-end flex-shrink-0">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] ${statusStyle}`}>
                              {statusLabel}
                            </span>
                            {judge.lastSeenAt ? (
                              <p className="text-[10px] text-specter-300">Last seen {new Date(judge.lastSeenAt).toLocaleTimeString()}</p>
                            ) : (
                              <p className="text-[10px] text-specter-300/80">Never connected</p>
                            )}
                            {judge.status !== 'disabled' && (
                              <button
                                type="button"
                                className="rounded-full border border-status-results/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-status-results transition hover:bg-status-results/10"
                                onClick={() => void handleDisableJudge(judge.id)}
                              >
                                Disable
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
              <h2 className="text-2xl font-semibold text-bone-100">Overrides &amp; Settings</h2>
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Vote Log</p>
                  {voteActionError && (
                    <p className="mt-2 rounded-2xl border border-status-results/40 bg-status-results/10 px-3 py-2 text-sm text-status-results">
                      {voteActionError}
                    </p>
                  )}
                  {voteAuditTrail.length === 0 ? (
                    <p className="mt-2 text-sm text-specter-300">No votes received yet.</p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-specter-300">
                      {voteAuditTrail.slice(0, 8).map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-night-900/60 px-3 py-2">
                          {editingVoteId === entry.judgeId ? (
                            <div className="flex flex-1 items-center gap-3">
                              <div className="flex-1">
                                <p className="font-semibold text-bone-100">{entry.actor}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <label className="text-xs text-specter-300">Score:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={editingVoteScore}
                                    onChange={(e) => setEditingVoteScore(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                                    className="w-16 rounded border border-white/20 bg-night-900 px-2 py-1 text-bone-100"
                                    disabled={isSavingVote}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveVote(entry.judgeId)}
                                  disabled={isSavingVote}
                                  className="rounded-full border border-status-voting/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-status-voting transition hover:bg-status-voting/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSavingVote ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditVote}
                                  disabled={isSavingVote}
                                  className="rounded-full border border-specter-300/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-specter-300 transition hover:bg-specter-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <p className="font-semibold text-bone-100">{entry.actor}</p>
                                <p>{entry.action}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <time className="text-xs uppercase tracking-[0.35em] text-specter-300" dateTime={entry.ts}>
                                  {entry.ts}
                                </time>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditVote(entry.judgeId, entry.score)}
                                    className="rounded-full border border-witchlight-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-witchlight-500 transition hover:bg-witchlight-500/10"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteVote(entry.judgeId)}
                                    className="rounded-full border border-status-results/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-status-results transition hover:bg-status-results/10"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {settingsError && (
                  <p className="rounded-2xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                    {settingsError}
                  </p>
                )}
                <div className="rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3">
                  {editingSettingKey === 'defaultTimerSeconds' ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Default Timer</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={editingSettingValue}
                            onChange={(e) => setEditingSettingValue(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-24 rounded border border-white/20 bg-night-900 px-2 py-1 text-bone-100"
                            disabled={isSavingSetting}
                          />
                          <span className="text-sm text-specter-300">seconds</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveSetting()}
                          disabled={isSavingSetting}
                          className="rounded-full border border-status-voting/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-status-voting transition hover:bg-status-voting/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingSetting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditSetting}
                          disabled={isSavingSetting}
                          className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Default Timer</p>
                        <p className="text-sm text-specter-300">
                          {isLoadingSettings ? 'Loading...' : `${settings.defaultTimerSeconds} seconds • apply to new rounds`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => handleEditSetting('defaultTimerSeconds')}
                        disabled={isLoadingSettings}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3">
                  {editingSettingKey === 'graceWindowSeconds' ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Grace Window</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={editingSettingValue}
                            onChange={(e) => setEditingSettingValue(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-24 rounded border border-white/20 bg-night-900 px-2 py-1 text-bone-100"
                            disabled={isSavingSetting}
                          />
                          <span className="text-sm text-specter-300">seconds</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveSetting()}
                          disabled={isSavingSetting}
                          className="rounded-full border border-status-voting/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-status-voting transition hover:bg-status-voting/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingSetting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditSetting}
                          disabled={isSavingSetting}
                          className={`${secondaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-specter-300">Grace Window</p>
                        <p className="text-sm text-specter-300">
                          {isLoadingSettings ? 'Loading...' : `${settings.graceWindowSeconds} seconds • accepts straggler votes`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => handleEditSetting('graceWindowSeconds')}
                        disabled={isLoadingSettings}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <TwitchIntegration />
              </div>
            </section>

            <section className="rounded-3xl border border-white/5 bg-grave-800/60 p-6">
              <h2 className="text-2xl font-semibold text-bone-100">Quick Links</h2>
              <p className="mt-2 text-sm text-specter-300">All available routes in the application</p>
              <div className="mt-5 grid gap-3">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3 transition hover:border-witchlight-500/40 hover:bg-witchlight-500/5"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-witchlight-500 group-hover:text-witchlight-400">/</p>
                    <p className="text-xs text-specter-300">Landing page</p>
                  </div>
                  <svg className="h-4 w-4 text-specter-300 transition group-hover:text-witchlight-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href="/control"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3 transition hover:border-witchlight-500/40 hover:bg-witchlight-500/5"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-witchlight-500 group-hover:text-witchlight-400">/control</p>
                    <p className="text-xs text-specter-300">Producer control dashboard (current page)</p>
                  </div>
                  <svg className="h-4 w-4 text-specter-300 transition group-hover:text-witchlight-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href="/judge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3 transition hover:border-witchlight-500/40 hover:bg-witchlight-500/5"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-witchlight-500 group-hover:text-witchlight-400">/judge</p>
                    <p className="text-xs text-specter-300">Judge voting console</p>
                  </div>
                  <svg className="h-4 w-4 text-specter-300 transition group-hover:text-witchlight-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href="/leaderboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3 transition hover:border-witchlight-500/40 hover:bg-witchlight-500/5"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-witchlight-500 group-hover:text-witchlight-400">/leaderboard</p>
                    <p className="text-xs text-specter-300">Top images leaderboard</p>
                  </div>
                  <svg className="h-4 w-4 text-specter-300 transition group-hover:text-witchlight-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href="/overlay"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3 transition hover:border-witchlight-500/40 hover:bg-witchlight-500/5"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-witchlight-500 group-hover:text-witchlight-400">/overlay</p>
                    <p className="text-xs text-specter-300">Unified overlay for OBS (Ready, Voting, Locked, Results)</p>
                  </div>
                  <svg className="h-4 w-4 text-specter-300 transition group-hover:text-witchlight-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href="/overlay/leaderboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-night-900/60 px-4 py-3 transition hover:border-witchlight-500/40 hover:bg-witchlight-500/5"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-witchlight-500 group-hover:text-witchlight-400">/overlay/leaderboard</p>
                    <p className="text-xs text-specter-300">Leaderboard overlay scene for OBS</p>
                  </div>
                  <svg className="h-4 w-4 text-specter-300 transition group-hover:text-witchlight-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>

      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-900/90 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-grave-800 p-8 shadow-2xl">
            <h2 className="text-2xl font-semibold text-bone-100">Add Link to Queue</h2>
            <p className="mt-2 text-sm text-specter-300">
              Paste a URL to queue securely. Links will display as clickable items for producers and judges.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="link-url" className="text-xs font-semibold uppercase tracking-wider text-specter-300">Target URL</label>
                <input
                  id="link-url"
                  type="url"
                  placeholder="https://example.com/art/123"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-night-900 px-4 py-3 text-bone-100 outline-none focus:border-witchlight-500"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="link-name" className="text-xs font-semibold uppercase tracking-wider text-specter-300">Label (Optional)</label>
                <input
                  id="link-name"
                  type="text"
                  placeholder="e.g. ArtStation Submission #42"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-night-900 px-4 py-3 text-bone-100 outline-none focus:border-witchlight-500"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                />
              </div>
            </div>

            {addLinkError && (
              <p className="mt-4 rounded-xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                {addLinkError}
              </p>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold uppercase tracking-wider text-specter-300 transition hover:bg-white/5"
                disabled={isAddingLink}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateLink()}
                className="rounded-xl bg-witchlight-500 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-night-900 transition hover:bg-witchlight-400 disabled:opacity-50"
                disabled={isAddingLink}
              >
                {isAddingLink ? 'Adding...' : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="sticky bottom-0 border-t border-white/5 bg-night-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:px-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.45em] text-specter-300">Audit Trail</h2>
            <span className="text-xs text-specter-300/80">All overrides and scene changes land here.</span>
          </div>
          <ul className="flex flex-wrap gap-3">
            {(voteAuditTrail.length === 0
              ? [{ id: 'empty', actor: 'No votes yet', action: 'Judge scores will appear here.', ts: '', judgeId: '', score: 0 }]
              : voteAuditTrail
            ).map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-white/5 bg-grave-800/70 px-4 py-3 text-sm text-specter-300">
                {entry.ts && <p className="text-specter-300/80">{entry.ts}</p>}
                <p className="font-semibold text-bone-100">{entry.actor}</p>
                <p>{entry.action}</p>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </main>
  );
}
