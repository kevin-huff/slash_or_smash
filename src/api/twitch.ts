export interface TwitchStatus {
  connected: boolean;
  configured: boolean;
  enabled?: boolean;
  error?: string;
}

/**
 * Get Twitch integration status
 */
export async function getTwitchStatus(): Promise<TwitchStatus> {
  const response = await fetch('/api/integrations/twitch/status', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch Twitch status');
  }
  
  return response.json();
}

/**
 * Initiate Twitch OAuth connection
 */
export function connectTwitch(): void {
  window.location.href = '/api/integrations/twitch/connect';
}

/**
 * Disconnect from Twitch
 */
export async function disconnectTwitch(): Promise<void> {
  const response = await fetch('/api/integrations/twitch/disconnect', {
    method: 'POST',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to disconnect from Twitch');
  }
}

/**
 * Enable or disable Twitch predictions
 */
export async function toggleTwitchPredictions(enabled: boolean): Promise<void> {
  const response = await fetch('/api/integrations/twitch/toggle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ enabled }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to toggle Twitch predictions');
  }
}

/**
 * Manually retry failed prediction
 */
export async function retryTwitchPrediction(imageId: string, duration: number): Promise<void> {
  const response = await fetch('/api/integrations/twitch/prediction/retry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ imageId, duration }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to retry Twitch prediction');
  }
}
