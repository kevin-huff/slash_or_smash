import tmi, { type ChatUserstate } from 'tmi.js';
import { getCurrentImage, getCurrentStage } from './showState.js';
import { saveAudienceVote } from './audienceVoteStore.js';

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

  const username = process.env.TWITCH_CHAT_USERNAME;
  const token = process.env.TWITCH_CHAT_OAUTH_TOKEN;
  const channel = process.env.TWITCH_CHAT_CHANNEL;

  status.missingEnv = [];
  if (!username) status.missingEnv.push('TWITCH_CHAT_USERNAME');
  if (!token) status.missingEnv.push('TWITCH_CHAT_OAUTH_TOKEN');
  if (!channel) status.missingEnv.push('TWITCH_CHAT_CHANNEL');

  if (!username || !token || !channel) {
    console.warn('[Chat] Twitch chat listener not started: missing TWITCH_CHAT_USERNAME, TWITCH_CHAT_OAUTH_TOKEN, or TWITCH_CHAT_CHANNEL');
    status.enabled = false;
    status.connected = false;
    status.connecting = false;
    status.channel = channel ?? null;
    status.username = username ?? null;
    status.lastError = 'Missing Twitch chat env vars';
    return;
  }

  status.enabled = true;
  status.username = username;
  status.channel = channel.startsWith('#') ? channel : `#${channel}`;
  status.connecting = true;

  isConnecting = true;

  client = new tmi.Client({
    identity: {
      username,
      password: token.startsWith('oauth:') ? token : `oauth:${token}`,
    },
    channels: [channel.startsWith('#') ? channel : `#${channel}`],
    connection: {
      reconnect: true,
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
  });

  client.on('disconnected', (reason: string) => {
    console.warn('[Chat] Disconnected from Twitch chat', reason);
    status.connected = false;
    status.connecting = false;
    status.lastDisconnectReason = reason;
  });

  try {
    await client.connect();
  } catch (error) {
    console.error('[Chat] Failed to connect to Twitch chat', error);
    client = null;
    status.connected = false;
    status.connecting = false;
    status.lastError = error instanceof Error ? error.message : String(error);
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
