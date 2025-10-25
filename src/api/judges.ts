import type { VoteSummary } from './control';
import { getAuthHeaders } from './auth';

export interface JudgeSummary {
  id: string;
  name: string | null;
  icon: string | null;
  status: 'pending' | 'active' | 'disabled';
  inviteCode: string;
  inviteToken: string;
  invitePath: string;
  createdAt: number;
  activatedAt: number | null;
  lastSeenAt: number | null;
}

export interface JudgeProfile {
  id: string;
  name: string | null;
  icon: string | null;
  status: 'pending' | 'active' | 'disabled';
  inviteCode: string;
  inviteToken: string;
  createdAt: number;
  activatedAt: number | null;
  lastSeenAt: number | null;
}

const BASE_URL = import.meta.env.BASE_URL ?? '/';

function withBase(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function assertResponse(response: Response, defaultMessage: string): void {
  if (!response.ok) {
    throw new Error(`${defaultMessage} (${response.status})`);
  }
}

export async function listJudges(): Promise<{ judges: JudgeSummary[]; icons: string[] }> {
  const response = await fetch(withBase('/api/judges'), {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = `Failed to load judges (${response.status})`;
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
  return (await response.json()) as { judges: JudgeSummary[]; icons: string[] };
}

export async function createJudge(input: { name?: string; icon?: string } = {}): Promise<JudgeSummary> {
  const response = await fetch(withBase('/api/judges'), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    let message = `Failed to create judge (${response.status})`;
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
  const payload = (await response.json()) as { judge: JudgeSummary };
  return payload.judge;
}

export async function disableJudge(id: string): Promise<JudgeSummary> {
  const response = await fetch(withBase(`/api/judges/${encodeURIComponent(id)}/disable`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    let message = `Failed to disable judge (${response.status})`;
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
  const payload = (await response.json()) as { judge: JudgeSummary };
  return payload.judge;
}

export async function fetchJudgeProfile(token: string): Promise<JudgeProfile> {
  const response = await fetch(withBase('/api/judge/profile'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    let message = `Failed to load judge profile (${response.status})`;
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
  const payload = (await response.json()) as { judge: JudgeProfile };
  return payload.judge;
}

export async function activateJudge(token: string, name: string, icon: string): Promise<JudgeProfile> {
  const response = await fetch(withBase('/api/judge/activate'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token, name, icon }),
  });
  if (!response.ok) {
    let message = `Failed to activate judge (${response.status})`;
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
  const payload = (await response.json()) as { judge: JudgeProfile };
  return payload.judge;
}

export async function pingJudge(token: string): Promise<void> {
  const response = await fetch(withBase('/api/judge/ping'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  assertResponse(response, 'Failed to ping judge');
}

export async function submitJudgeVote(token: string, score: number): Promise<VoteSummary> {
  const response = await fetch(withBase('/api/judge/vote'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token, score }),
  });
  if (!response.ok) {
    let message = `Failed to submit vote (${response.status})`;
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
  const payload = (await response.json()) as { summary: VoteSummary };
  return payload.summary;
}
