import type { UploadedImage } from './images';
import { getAuthHeaders } from './auth';

export type ShowStage = 'idle' | 'ready' | 'voting' | 'locked' | 'results';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerState {
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  updatedAt: number;
  targetTs: number | null;
}

export interface QueueEntry {
  position: number;
  ord: number;
  image: UploadedImage;
}

export interface VoteSummaryItem {
  judgeId: string;
  judgeName: string | null;
  judgeIcon: string | null;
  judgeStatus: 'pending' | 'active' | 'disabled';
  score: number;
  updatedAt: number;
}

export interface VoteSummary {
  average: number | null;
  distribution: number[];
  judgeCount: number;
  votes: VoteSummaryItem[];
}

export interface AudienceSummary {
  average: number | null;
  distribution: number[];
  voteCount: number;
}

export interface ShowState {
  stage: ShowStage;
  currentImage: UploadedImage | null;
  queue: QueueEntry[];
  timer: TimerState;
  currentVotes: VoteSummary | null;
  audienceVotes: AudienceSummary | null;
  showOverlayVoting: boolean;
}

const BASE_URL = import.meta.env.BASE_URL ?? '/';

function withBase(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function mergeHeaders(additional?: HeadersInit): HeadersInit {
  const auth = getAuthHeaders();
  if (!additional) {
    return auth;
  }
  return { ...auth, ...additional };
}

export async function fetchShowState(signal?: AbortSignal): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/state'), {
    signal,
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = `Failed to load show state (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as ShowState;
}

export async function fetchShowStatePublic(signal?: AbortSignal): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/overlay/state'), {
    signal,
    // No auth headers for public overlay endpoint
  });
  if (!response.ok) {
    let message = `Failed to load show state (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as ShowState;
}

export async function startNextRound(): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/start'), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = `Failed to start round (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function updateQueueOrder(imageIds: string[]): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/queue'), {
    method: 'PUT',
    headers: mergeHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify({ queue: imageIds }),
  });

  if (!response.ok) {
    let message = `Failed to reorder queue (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function removeQueueItem(imageId: string): Promise<ShowState> {
  const response = await fetch(withBase(`/api/control/queue/${encodeURIComponent(imageId)}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = `Failed to remove queue item (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

async function postStageAction(path: string, defaultMessage: string): Promise<ShowState> {
  const response = await fetch(path, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = `${defaultMessage} (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await response.json()) as ShowState;
}

export function lockCurrentRound(): Promise<ShowState> {
  return postStageAction(withBase('/api/control/lock'), 'Failed to lock round');
}

export function showCurrentResults(): Promise<ShowState> {
  return postStageAction(withBase('/api/control/results'), 'Failed to show results');
}

export function reopenRound(): Promise<ShowState> {
  return postStageAction(withBase('/api/control/reopen'), 'Failed to reopen round');
}

export function resetShow(): Promise<ShowState> {
  return postStageAction(withBase('/api/control/reset'), 'Failed to reset show');
}

export function pauseTimer(): Promise<ShowState> {
  return postStageAction(withBase('/api/control/timer/pause'), 'Failed to pause timer');
}

export function resumeTimer(): Promise<ShowState> {
  return postStageAction(withBase('/api/control/timer/resume'), 'Failed to resume timer');
}

export async function extendTimer(seconds: number): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/timer/extend'), {
    method: 'POST',
    headers: mergeHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify({ seconds }),
  });

  if (!response.ok) {
    let message = `Failed to extend timer (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function toggleOverlayVoting(show: boolean): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/overlay/voting'), {
    method: 'POST',
    headers: mergeHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify({ show }),
  });

  if (!response.ok) {
    let message = `Failed to toggle overlay voting (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function updateVote(imageId: string, judgeId: string, score: number): Promise<ShowState> {
  const response = await fetch(withBase(`/api/control/votes/${encodeURIComponent(imageId)}/${encodeURIComponent(judgeId)}`), {
    method: 'PUT',
    headers: mergeHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify({ score }),
  });

  if (!response.ok) {
    let message = `Failed to update vote (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function deleteVote(imageId: string, judgeId: string): Promise<ShowState> {
  const response = await fetch(withBase(`/api/control/votes/${encodeURIComponent(imageId)}/${encodeURIComponent(judgeId)}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = `Failed to delete vote (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function deleteAllVotes(): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/votes'), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = `Failed to delete all votes (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}

export async function clearAll(): Promise<ShowState> {
  const response = await fetch(withBase('/api/control/clear-all'), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = `Failed to clear all data (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as ShowState;
}



export async function reconnectAudience(): Promise<unknown> {
  const response = await fetch(withBase('/api/control/audience/reconnect'), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = `Failed to reconnect audience chat (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return await response.json();
}

export interface AppSettings {
  defaultTimerSeconds: number;
  graceWindowSeconds: number;
}

export async function fetchSettings(signal?: AbortSignal): Promise<AppSettings> {
  const response = await fetch(withBase('/api/control/settings'), {
    signal,
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = `Failed to load settings (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as AppSettings;
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const response = await fetch(withBase('/api/control/settings'), {
    method: 'PUT',
    headers: mergeHeaders({
      'content-type': 'application/json',
    }),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    let message = `Failed to update settings (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as AppSettings;
}
