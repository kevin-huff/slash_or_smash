import tmi, { type ChatUserstate } from 'tmi.js';
import { getCurrentImage, getCurrentStage } from './showState.js';
import { saveAudienceVote } from './audienceVoteStore.js';
import { getBroadcasterChatCredentials } from './twitchClient.js';

let client: tmi.Client | null = null;
let isConnecting = false;

type ChatStatus = {
  enabled: boolean;
  connecting: boolean;
  connected: boolean;
  channel: string | null;
  username: string | null;
  lastError: string | null;
  lastConnectedAt: number | null;
  lastDisconnectReason: string | null;
  lastSeenVoteAt: number | null;
  missingEnv: string[];
  lastNotice: string | null;
  authSource: 'broadcaster' | 'env' | 'none';
  hasBroadcasterToken: boolean;
};

const status: ChatStatus = {
  enabled: false,
  connecting: false,
  connected: false,
  channel: null,
  username: null,
  lastError: null,
  lastConnectedAt: null,
  lastDisconnectReason: null,
  lastSeenVoteAt: null,
  missingEnv: [],
  lastNotice: null,
  authSource: 'none',
  hasBroadcasterToken: false,
};

function parseScore(message: string): number | null {
  const trimmed = message.trim();
  const directMatch = trimmed.match(/^([1-5])$/);
  if (directMatch) {
    return Number.parseInt(directMatch[1], 10);
  }

  const commandMatch = trimmed.match(/^!v(?:ote)?\s*([1-5])$/i);
  if (commandMatch) {
    return Number.parseInt(commandMatch[1], 10);
  }

  return null;
}

export async function initChatListener(): Promise<void> {
  if (client || isConnecting) {
    return;
  }

  isConnecting = true;

  try {
    const envUsername = process.env.TWITCH_CHAT_USERNAME;
    const envToken = process.env.TWITCH_CHAT_OAUTH_TOKEN;
    const envChannel = process.env.TWITCH_CHAT_CHANNEL;

    status.missingEnv = [];
    if (!envUsername) status.missingEnv.push('TWITCH_CHAT_USERNAME');
    if (!envToken) status.missingEnv.push('TWITCH_CHAT_OAUTH_TOKEN');
    if (!envChannel) status.missingEnv.push('TWITCH_CHAT_CHANNEL');

    // Prefer broadcaster OAuth tokens from our Twitch integration
    const broadcasterCreds = await getBroadcasterChatCredentials();
    status.hasBroadcasterToken = !!broadcasterCreds;

    const username = broadcasterCreds?.username ?? envUsername ?? null;
    const token = broadcasterCreds ? `oauth:${broadcasterCreds.accessToken.replace(/^oauth:/, '')}` : envToken ?? null;
    const channel = envChannel;
    status.authSource = broadcasterCreds ? 'broadcaster' : envToken && envUsername ? 'env' : 'none';

    if (!username || !token || !channel) {
      console.warn('[Chat] Twitch chat listener not started: missing credentials');
      status.enabled = false;
      status.connected = false;
      status.connecting = false;
      status.channel = channel ?? null;
      status.username = username ?? null;
      status.lastError = 'Missing Twitch chat credentials';
      return;
    }

    status.enabled = true;
    status.username = username;
    status.channel = channel.startsWith('#') ? channel : `#${channel}`;
    status.connecting = true;

    client = new tmi.Client({
      identity: {
        username,
        password: token.startsWith('oauth:') ? token : `oauth:${token}`,
      },
      channels: [channel.startsWith('#') ? channel : `#${channel}`],
      connection: {
        reconnect: false, // Disable internal reconnect to prevent zombie loops
        secure: true,
      },
    });

    client.on('message', (_channel: string, userstate: ChatUserstate, message: string, self: boolean) => {
      if (self) return;
      const score = parseScore(message);
      if (score === null) {
        return;
      }

      const stage = getCurrentStage();
      const currentImage = getCurrentImage();
      if (stage !== 'voting' || !currentImage) {
        return;
      }

      const voterId = userstate['user-id'] || userstate.username || 'anon';
      try {
        saveAudienceVote(currentImage.id, voterId, score);
        status.lastSeenVoteAt = Date.now();
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[Chat] Vote recorded', { voterId, score, imageId: currentImage.id });
        }
      } catch (error) {
        console.error('[Chat] Failed to record vote', error);
      }
    });

    client.on('connected', (_addr: string, port: number) => {
      console.log(`[Chat] Connected to Twitch chat on port ${port}`);
      status.connected = true;
      status.connecting = false;
      status.lastConnectedAt = Date.now();
      status.lastError = null;
      status.lastNotice = null;
    });

    client.on('connecting', (addr: string, port: number) => {
      status.connecting = true;
      status.connected = false;
      console.log(`[Chat] Connecting to Twitch chat ${addr}:${port}`);
    });

    client.on('disconnected', (reason: string) => {
      console.warn('[Chat] Disconnected from Twitch chat', reason);
      status.connected = false;
      status.connecting = false;
      status.lastDisconnectReason = reason;
    });

    client.on('reconnect', () => {
      console.warn('[Chat] Reconnecting to Twitch chat…');
      status.connecting = true;
      status.connected = false;
    });

    client.on('notice', (_channel: string, msgid: string, message: string) => {
      status.lastNotice = `${msgid ?? ''} ${message ?? ''}`.trim();
      console.warn('[Chat] Notice', { msgid, message });
      const lower = `${msgid ?? ''} ${message ?? ''}`.toLowerCase();
      if (lower.includes('authentication') || lower.includes('login')) {
        status.lastError = message || 'Login/authentication failed';
        status.connecting = false;
        status.connected = false;
      }
    });

    try {
      await client.connect();
    } catch (error) {
      console.error('[Chat] Failed to connect to Twitch chat', error);
      // Important: Disconnect to stop internal reconnection timers if the initial connect failed
      if (client) {
        client.disconnect().catch(() => { });
      }
      client = null;
      status.connected = false;
      status.connecting = false;
      status.lastError = error instanceof Error ? error.message : String(error);
      status.lastNotice = status.lastNotice ?? status.lastError;
    }
  } finally {
    isConnecting = false;
  }
}

export function getChatListenerStatus(): ChatStatus {
  return { ...status };
}

export function sendVotingOpenMessage(imageName?: string): void {
  if (!client || !status.connected || !status.channel) {
    return;
  }
  const suffix = imageName ? ` · ${imageName}` : '';
  const message = `Voting is open! Rate 1-5 (or !vote 1-5)${suffix}`;
  void client
    .say(status.channel, message)
    .catch((error) => {
      console.error('[Chat] Failed to send voting message', error);
      status.lastError = error instanceof Error ? error.message : String(error);
    });
}

export async function reconnectChatListener(): Promise<void> {
  console.log('[Chat] Force reconnect requested');

  if (client) {
    try {
      await client.disconnect();
    } catch (error) {
      console.warn('[Chat] Error disconnecting existing client during reconnect:', error);
    }
    client = null;
  }

  // Reset status
  status.connected = false;
  status.connecting = false;
  status.lastError = null;
  status.lastNotice = null;
  status.lastDisconnectReason = null;
  status.missingEnv = [];
  status.authSource = 'none';
  status.hasBroadcasterToken = false;
  isConnecting = false;

  // Re-initialize
  return initChatListener();
}
