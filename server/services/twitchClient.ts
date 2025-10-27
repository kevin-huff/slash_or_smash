import { db } from '../db.js';

// Direct database access for Twitch tokens (bypassing RunStateKey type restriction)
function getTwitchState(key: string): string | null {
  const stmt = db.prepare<[string]>(`SELECT value FROM run_state WHERE key = ?`);
  const row = stmt.get(`twitch_${key}`) as { value: string } | undefined;
  return row?.value ?? null;
}

function setTwitchState(key: string, value: string): void {
  const stmt = db.prepare<[string, string]>(
    `INSERT INTO run_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  stmt.run(`twitch_${key}`, value);
}

function clearTwitchState(key: string): void {
  const stmt = db.prepare<[string]>(`DELETE FROM run_state WHERE key = ?`);
  stmt.run(`twitch_${key}`);
}

export interface TwitchTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  broadcasterId: string;
}

export interface TwitchPrediction {
  id: string;
  title: string;
  outcomes: Array<{ id: string; title: string; color: string }>;
  prediction_window: number;
  status: string;
}

export interface CreatePredictionParams {
  title: string;
  outcomes: string[];
  predictionWindowSeconds: number;
}

export interface ResolvePredictionParams {
  predictionId: string;
  winningOutcomeId: string;
}

const TWITCH_API_BASE = 'https://api.twitch.tv/helix';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

export class TwitchClient {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      return null;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = Date.now();
    if (tokens.expiresAt && tokens.expiresAt - now < 5 * 60 * 1000) {
      // Token expired or expiring soon, refresh it
      const refreshed = await this.refreshAccessToken(tokens.refreshToken);
      if (refreshed) {
        return refreshed.accessToken;
      }
      return null;
    }

    return tokens.accessToken;
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<TwitchTokens | null> {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await fetch(TWITCH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        console.error('Failed to refresh Twitch token:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      const tokens: TwitchTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        broadcasterId: (await this.getStoredTokens())?.broadcasterId || '',
      };

      await this.storeTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Error refreshing Twitch token:', error);
      return null;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TwitchTokens | null> {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const response = await fetch(TWITCH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        console.error('Failed to exchange code for token:', response.status, await response.text());
        return null;
      }

      const data = await response.json();

      // Get broadcaster ID
      const broadcasterId = await this.getBroadcasterId(data.access_token);
      if (!broadcasterId) {
        console.error('Failed to get broadcaster ID');
        return null;
      }

      const tokens: TwitchTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        broadcasterId,
      };

      await this.storeTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return null;
    }
  }

  /**
   * Get broadcaster ID from access token
   */
  private async getBroadcasterId(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${TWITCH_API_BASE}/users`, {
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data[0]?.id || null;
    } catch (error) {
      console.error('Error getting broadcaster ID:', error);
      return null;
    }
  }

  /**
   * Create a prediction
   */
  async createPrediction(params: CreatePredictionParams): Promise<TwitchPrediction | null> {
    try {
      const accessToken = await this.getValidAccessToken();
      const tokens = await this.getStoredTokens();

      if (!accessToken || !tokens?.broadcasterId) {
        console.error('No valid Twitch tokens available');
        return null;
      }

      const body = {
        broadcaster_id: tokens.broadcasterId,
        title: params.title,
        outcomes: params.outcomes.map((title) => ({ title })),
        prediction_window: params.predictionWindowSeconds,
      };

      const response = await fetch(`${TWITCH_API_BASE}/predictions`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create prediction:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      return data.data[0] || null;
    } catch (error) {
      console.error('Error creating prediction:', error);
      return null;
    }
  }

  /**
   * Resolve a prediction
   */
  async resolvePrediction(params: ResolvePredictionParams): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken();
      const tokens = await this.getStoredTokens();

      if (!accessToken || !tokens?.broadcasterId) {
        console.error('No valid Twitch tokens available');
        return false;
      }

      // First, check the current status of the prediction
      const statusResponse = await fetch(
        `${TWITCH_API_BASE}/predictions?broadcaster_id=${tokens.broadcasterId}&id=${params.predictionId}`,
        {
          headers: {
            'Client-ID': this.clientId,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const prediction = statusData.data?.[0];
        
        if (prediction) {
          console.log(`Prediction ${params.predictionId} current status: ${prediction.status}`);
          
          // If prediction is already RESOLVED or CANCELED, we can't resolve it again
          if (prediction.status === 'RESOLVED' || prediction.status === 'CANCELED') {
            console.log(`Prediction already ${prediction.status}, skipping resolution`);
            return true;
          }
          
          // If prediction is still ACTIVE or LOCKED, we can resolve it
        }
      }

      const body = {
        broadcaster_id: tokens.broadcasterId,
        id: params.predictionId,
        status: 'RESOLVED',
        winning_outcome_id: params.winningOutcomeId,
      };

      const response = await fetch(`${TWITCH_API_BASE}/predictions`, {
        method: 'PATCH',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to resolve prediction:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error resolving prediction:', error);
      return false;
    }
  }

  /**
   * Cancel a prediction (refunds points)
   */
  async cancelPrediction(predictionId: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken();
      const tokens = await this.getStoredTokens();

      if (!accessToken || !tokens?.broadcasterId) {
        console.error('No valid Twitch tokens available');
        return false;
      }

      const body = {
        broadcaster_id: tokens.broadcasterId,
        id: predictionId,
        status: 'CANCELED',
      };

      const response = await fetch(`${TWITCH_API_BASE}/predictions`, {
        method: 'PATCH',
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to cancel prediction:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error canceling prediction:', error);
      return false;
    }
  }

  /**
   * Check if we have valid credentials
   */
  async isConnected(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      return false;
    }

    const accessToken = await this.getValidAccessToken();
    return !!accessToken;
  }

  /**
   * Clear stored tokens (disconnect)
   */
  async disconnect(): Promise<void> {
    clearTwitchState('access_token');
    clearTwitchState('refresh_token');
    clearTwitchState('expires_at');
    clearTwitchState('broadcaster_id');
  }

  /**
   * Store tokens in settings
   */
  private async storeTokens(tokens: TwitchTokens): Promise<void> {
    setTwitchState('access_token', tokens.accessToken);
    setTwitchState('refresh_token', tokens.refreshToken);
    setTwitchState('expires_at', tokens.expiresAt.toString());
    setTwitchState('broadcaster_id', tokens.broadcasterId);
  }

  /**
   * Get stored tokens from settings
   */
  private async getStoredTokens(): Promise<TwitchTokens | null> {
    const accessToken = getTwitchState('access_token');
    const refreshToken = getTwitchState('refresh_token');
    const expiresAt = getTwitchState('expires_at');
    const broadcasterId = getTwitchState('broadcaster_id');

    if (!accessToken || !refreshToken || !broadcasterId) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt ? parseInt(expiresAt, 10) : 0,
      broadcasterId,
    };
  }
}

// Singleton instance
let twitchClient: TwitchClient | null = null;

export function getTwitchClient(): TwitchClient | null {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  console.log('[Twitch] getTwitchClient called');
  console.log('[Twitch] CLIENT_ID:', clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET');
  console.log('[Twitch] CLIENT_SECRET:', clientSecret ? 'SET' : 'NOT SET');

  if (!clientId || !clientSecret) {
    console.warn('Twitch credentials not configured');
    return null;
  }

  if (!twitchClient) {
    twitchClient = new TwitchClient(clientId, clientSecret);
  }

  return twitchClient;
}
