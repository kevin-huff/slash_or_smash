import { enqueueImage, getQueue, removeFromQueue, reorderQueue, takeNextFromQueue } from './queueStore.js';
import { clearRunState, getRunState, setRunState } from './runStateStore.js';
import { getImageById, type ImageRecord, updateImageStatus } from './imageStore.js';
import { getVoteSummary } from './voteStore.js';
import type { VoteSummary } from './voteStore.js';
import { createPredictionForRound, resolvePredictionForRound, cancelActivePrediction } from './twitchPredictions.js';

const DEFAULT_TIMER_MS = 120_000;
const TIMER_KEY = 'timer_state';

type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  updatedAt: number;
  targetTs: number | null;
}

export type ShowStage = 'idle' | 'ready' | 'voting' | 'locked' | 'results';

export interface QueueEntry {
  position: number;
  ord: number;
  image: ImageRecord;
}

export interface ShowState {
  stage: ShowStage;
  currentImage: ImageRecord | null;
  queue: QueueEntry[];
  timer: TimerState;
  currentVotes: VoteSummary | null;
  showOverlayVoting: boolean;
}

const DEFAULT_STAGE: ShowStage = 'idle';

export function normalizeStage(value: string | null): ShowStage {
  const candidate = value ?? DEFAULT_STAGE;
  if (candidate === 'ready' || candidate === 'voting' || candidate === 'locked' || candidate === 'results' || candidate === 'idle') {
    return candidate;
  }
  return DEFAULT_STAGE;
}

export function getCurrentStage(): ShowStage {
  return normalizeStage(getRunState('stage'));
}

export function setStage(stage: ShowStage): void {
  setRunState('stage', stage);
}

export function getCurrentImage(): ImageRecord | null {
  const currentId = getRunState('current_image_id');
  if (!currentId) {
    return null;
  }
  return getImageById(currentId);
}

export function setCurrentImage(imageId: string | null): void {
  if (imageId) {
    setRunState('current_image_id', imageId);
  } else {
    clearRunState('current_image_id');
  }
}

function defaultTimerState(): TimerState {
  const now = Date.now();
  return {
    status: 'idle',
    durationMs: DEFAULT_TIMER_MS,
    remainingMs: DEFAULT_TIMER_MS,
    updatedAt: now,
    targetTs: null,
  };
}

function readTimerState(): TimerState {
  const raw = getRunState(TIMER_KEY);
  if (!raw) {
    return defaultTimerState();
  }

  try {
    const parsed = JSON.parse(raw) as TimerState;
    if (
      parsed &&
      typeof parsed.status === 'string' &&
      typeof parsed.durationMs === 'number' &&
      typeof parsed.remainingMs === 'number' &&
      typeof parsed.updatedAt === 'number'
    ) {
      return parsed;
    }
  } catch {
    // fall through to default
  }

  return defaultTimerState();
}

function persistTimerState(state: TimerState): void {
  setRunState(TIMER_KEY, JSON.stringify(state));
}

function resolveTimerState(state: TimerState): TimerState {
  if (state.status !== 'running') {
    return state;
  }

  const now = Date.now();
  const target = state.targetTs ?? now;
  const remaining = Math.max(target - now, 0);

  if (remaining <= 0) {
    return {
      status: 'completed',
      durationMs: state.durationMs,
      remainingMs: 0,
      updatedAt: now,
      targetTs: null,
    };
  }

  return {
    ...state,
    remainingMs: remaining,
  };
}

function getTimerStateSnapshot(): TimerState {
  const current = readTimerState();
  const resolved = resolveTimerState(current);

  if (
    resolved.status !== current.status ||
    resolved.remainingMs !== current.remainingMs ||
    resolved.targetTs !== current.targetTs
  ) {
    persistTimerState({ ...resolved, updatedAt: resolved.updatedAt ?? Date.now() });
    return { ...resolved, updatedAt: resolved.updatedAt ?? Date.now() };
  }

  return resolved;
}

function startTimer(durationMs: number): TimerState {
  const now = Date.now();
  const next: TimerState = {
    status: 'paused',
    durationMs,
    remainingMs: durationMs,
    updatedAt: now,
    targetTs: null,
  };
  persistTimerState(next);
  return next;
}

function pauseTimerInternal(): TimerState {
  const current = getTimerStateSnapshot();
  if (current.status !== 'running') {
    throw new ControlActionError('Timer is not running', 409);
  }
  const now = Date.now();
  const remaining = Math.max((current.targetTs ?? now) - now, 0);
  const next: TimerState = {
    status: 'paused',
    durationMs: current.durationMs,
    remainingMs: remaining,
    updatedAt: now,
    targetTs: null,
  };
  persistTimerState(next);
  return next;
}

function resumeTimerInternal(): TimerState {
  const current = getTimerStateSnapshot();
  if (current.status !== 'paused') {
    throw new ControlActionError('Timer is not paused', 409);
  }
  const now = Date.now();
  const next: TimerState = {
    status: 'running',
    durationMs: current.durationMs,
    remainingMs: current.remainingMs,
    updatedAt: now,
    targetTs: now + current.remainingMs,
  };
  persistTimerState(next);
  return next;
}

function extendTimerInternal(deltaMs: number): TimerState {
  if (deltaMs <= 0) {
    throw new ControlActionError('Extension must be positive', 400);
  }
  const current = getTimerStateSnapshot();
  const now = Date.now();

  if (current.status === 'running') {
    const target = (current.targetTs ?? now) + deltaMs;
    const remaining = Math.max(target - now, 0);
    const next: TimerState = {
      status: 'running',
      durationMs: current.durationMs + deltaMs,
      remainingMs: remaining,
      updatedAt: now,
      targetTs: target,
    };
    persistTimerState(next);
    return next;
  }

  if (current.status === 'paused') {
    const next: TimerState = {
      status: 'paused',
      durationMs: current.durationMs + deltaMs,
      remainingMs: current.remainingMs + deltaMs,
      updatedAt: now,
      targetTs: null,
    };
    persistTimerState(next);
    return next;
  }

  throw new ControlActionError('Cannot extend timer in current state', 409);
}

function completeTimerInternal(): TimerState {
  const now = Date.now();
  const current = getTimerStateSnapshot();
  const next: TimerState = {
    status: 'completed',
    durationMs: current.durationMs,
    remainingMs: 0,
    updatedAt: now,
    targetTs: null,
  };
  persistTimerState(next);
  return next;
}

function resetTimerInternal(): TimerState {
  const next = defaultTimerState();
  persistTimerState(next);
  return next;
}

export function serializeShowState(): ShowState {
  let stage = getCurrentStage();
  const currentImage = getCurrentImage();
  let timer = getTimerStateSnapshot();

  if (stage === 'voting' && timer.status === 'completed') {
    if (currentImage) {
      updateImageStatus(currentImage.id, 'locked');
    }
    setStage('locked');
    stage = 'locked';
  }

  const queueRows = getQueue();
  timer = getTimerStateSnapshot(); // refresh after potential mutation
  const currentVotes = currentImage ? getVoteSummary(currentImage.id) : null;

  const queue: QueueEntry[] = queueRows.map((row, index) => ({
    position: index + 1,
    ord: row.ord,
    image: row.image,
  }));

  const showOverlayVoting = getRunState('show_overlay_voting') === 'true';

  return {
    stage,
    currentImage,
    queue,
    timer,
    currentVotes,
    showOverlayVoting,
  };
}

export class ControlActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ControlActionError';
    this.status = status;
  }
}

export function handleImageQueued(imageId: string): void {
  enqueueImage(imageId);
}

export function advanceToNextImage(): ShowState {
  const next = takeNextFromQueue();
  if (!next) {
    throw new ControlActionError('No images in queue. Upload an image first.', 409);
  }

  const previousImage = getCurrentImage();
  if (previousImage) {
    updateImageStatus(previousImage.id, 'done');
  }

  updateImageStatus(next.image.id, 'voting');
  setCurrentImage(next.image.id);
  setStage('voting');
  startTimer(DEFAULT_TIMER_MS);

  // Create Twitch prediction (async, non-blocking)
  const durationSeconds = Math.floor(DEFAULT_TIMER_MS / 1000);
  createPredictionForRound(next.image.id, durationSeconds).catch((error) => {
    console.error('Failed to create Twitch prediction:', error);
  });

  return serializeShowState();
}

export function lockCurrentImage(): ShowState {
  const current = getCurrentImage();
  const stage = getCurrentStage();
  if (!current) {
    throw new ControlActionError('No active image to lock', 409);
  }

  if (stage !== 'voting') {
    throw new ControlActionError('Only images in voting can be locked', 409);
  }

  updateImageStatus(current.id, 'locked');
  setStage('locked');
  completeTimerInternal();

  // Resolve Twitch prediction (async, non-blocking)
  resolvePredictionForRound(current.id).catch((error) => {
    console.error('Failed to resolve Twitch prediction:', error);
  });

  return serializeShowState();
}

export function showResults(): ShowState {
  const current = getCurrentImage();
  const stage = getCurrentStage();
  if (!current) {
    throw new ControlActionError('No active image to show results for', 409);
  }

  if (stage !== 'locked') {
    throw new ControlActionError('Can only show results after locking votes', 409);
  }

  updateImageStatus(current.id, 'done');
  setStage('results');
  completeTimerInternal();
  return serializeShowState();
}

export function reopenVoting(): ShowState {
  const current = getCurrentImage();
  const stage = getCurrentStage();
  if (!current) {
    throw new ControlActionError('No active image to reopen', 409);
  }

  if (stage !== 'locked') {
    throw new ControlActionError('Can only reopen voting from locked stage', 409);
  }

  // Cancel active Twitch prediction (async, non-blocking)
  cancelActivePrediction().catch((error) => {
    console.error('Failed to cancel Twitch prediction:', error);
  });

  updateImageStatus(current.id, 'voting');
  setStage('voting');
  
  // Restart the timer with the default duration
  const now = Date.now();
  const durationMs = DEFAULT_TIMER_MS;
  const next: TimerState = {
    status: 'running',
    durationMs,
    remainingMs: durationMs,
    updatedAt: now,
    targetTs: now + durationMs,
  };
  persistTimerState(next);

  // Create new Twitch prediction (async, non-blocking)
  const durationSeconds = Math.floor(durationMs / 1000);
  createPredictionForRound(current.id, durationSeconds).catch((error) => {
    console.error('Failed to create Twitch prediction:', error);
  });
  
  return serializeShowState();
}

export function resetToIdle(): ShowState {
  resetShowState();
  return serializeShowState();
}

export function resetShowState(): void {
  setStage('idle');
  setCurrentImage(null);
  resetTimerInternal();
}

export function reorderQueuedImages(imageIds: string[]): ShowState {
  const existingQueue = getQueue();
  const existingIds = existingQueue.map((entry) => entry.image.id);

  if (imageIds.length !== existingIds.length) {
    throw new ControlActionError('Queue length mismatch', 400);
  }

  for (const id of imageIds) {
    if (!existingIds.includes(id)) {
      throw new ControlActionError(`Image ${id} is not in the queue`, 404);
    }
  }

  reorderQueue(imageIds);
  return serializeShowState();
}

export function removeQueuedImage(imageId: string): ShowState {
  const existingQueue = getQueue();
  if (!existingQueue.some((entry) => entry.image.id === imageId)) {
    throw new ControlActionError('Image not found in queue', 404);
  }

  const removed = removeFromQueue(imageId);
  if (!removed) {
    throw new ControlActionError('Image not found in queue', 404);
  }

  return serializeShowState();
}

export function pauseTimerAction(): ShowState {
  pauseTimerInternal();
  return serializeShowState();
}

export function resumeTimerAction(): ShowState {
  resumeTimerInternal();
  return serializeShowState();
}

export function extendTimerAction(seconds: number): ShowState {
  extendTimerInternal(seconds * 1000);
  return serializeShowState();
}

export function setOverlayVotingVisibility(show: boolean): ShowState {
  setRunState('show_overlay_voting', show ? 'true' : 'false');
  return serializeShowState();
}
