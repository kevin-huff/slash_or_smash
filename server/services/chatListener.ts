import tmi from 'tmi.js';
import { getCurrentImage, getCurrentStage } from './showState.js';
import { saveAudienceVote } from './audienceVoteStore.js';

let client: tmi.Client | null = null;
let isConnecting = false;

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

  if (!username || !token || !channel) {
    console.warn('[Chat] Twitch chat listener not started: missing TWITCH_CHAT_USERNAME, TWITCH_CHAT_OAUTH_TOKEN, or TWITCH_CHAT_CHANNEL');
    return;
  }

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

  client.on('message', (_channel, userstate, message, self) => {
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
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Chat] Vote recorded', { voterId, score, imageId: currentImage.id });
      }
    } catch (error) {
      console.error('[Chat] Failed to record vote', error);
    }
  });

  client.on('connected', (_addr, port) => {
    console.log(`[Chat] Connected to Twitch chat on port ${port}`);
  });

  client.on('disconnected', (reason) => {
    console.warn('[Chat] Disconnected from Twitch chat', reason);
  });

  try {
    await client.connect();
  } catch (error) {
    console.error('[Chat] Failed to connect to Twitch chat', error);
    client = null;
  } finally {
    isConnecting = false;
  }
}
