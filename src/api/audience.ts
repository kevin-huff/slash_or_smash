import type { AudienceSummary } from './control';

export interface AudienceVoteResponse {
  voterId: string;
  audienceVotes: AudienceSummary;
}

export async function submitAudienceVote(score: number, voterId?: string, signal?: AbortSignal): Promise<AudienceVoteResponse> {
  const response = await fetch('/api/control/audience/vote', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ score, voterId }),
    signal,
  });

  if (!response.ok) {
    let message = `Failed to submit vote (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return (await response.json()) as AudienceVoteResponse;
}
