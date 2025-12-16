import { Router } from 'express';
import {
  advanceToNextImage,
  ControlActionError,
  extendTimerAction,
  lockCurrentImage,
  pauseTimerAction,
  reorderQueuedImages,
  removeQueuedImage,
  reopenVoting,
  resetToIdle,
  resumeTimerAction,
  serializeShowState,
  setOverlayVotingVisibility,
  showResults,
  type ShowState,
} from '../services/showState.js';
import { listJudges } from '../services/judgeStore.js';
import { serializeImage } from '../utils/imageResponse.js';
import { deleteVote, deleteAllVotes, saveVote } from '../services/voteStore.js';
import { deleteAllImages } from '../services/imageStore.js';
import { clearQueue } from '../services/queueStore.js';
import { getSettings, updateSettings, type AppSettings } from '../services/settingsStore.js';
import { clearAllAudienceVotes, getAudienceVoteSummary, saveAudienceVote } from '../services/audienceVoteStore.js';
import crypto from 'node:crypto';

const controlRouter = Router();

function mapStateForResponse(state: ShowState) {
  const judges = listJudges();
  const judgeMap = new Map(judges.map((judge) => [judge.id, judge]));
  const currentVotes = state.currentVotes
    ? {
        average: state.currentVotes.average,
        distribution: state.currentVotes.distribution,
        judgeCount: state.currentVotes.judgeCount,
        votes: state.currentVotes.votes.map((vote) => {
          const judge = judgeMap.get(vote.judgeId);
          return {
            judgeId: vote.judgeId,
            judgeName: vote.judgeName ?? judge?.name ?? null,
            judgeIcon: vote.judgeIcon ?? judge?.icon ?? null,
            judgeStatus: vote.judgeStatus,
            score: vote.score,
            updatedAt: vote.updatedAt,
          };
        }),
      }
    : null;
  const audienceVotes = state.audienceVotes
    ? {
        average: state.audienceVotes.average,
        distribution: state.audienceVotes.distribution,
        voteCount: state.audienceVotes.voteCount,
      }
    : null;
  return {
    stage: state.stage,
    currentImage: state.currentImage ? serializeImage(state.currentImage) : null,
    queue: state.queue.map((entry) => ({
      position: entry.position,
      ord: entry.ord,
      image: serializeImage(entry.image),
    })),
    timer: state.timer,
    currentVotes,
    audienceVotes,
    showOverlayVoting: state.showOverlayVoting,
  };
}

controlRouter.get('/state', (_req, res) => {
  const state = serializeShowState();
  const response = mapStateForResponse(state);
  console.log('[GET /api/control/state] Response:', {
    stage: response.stage,
    queueLength: response.queue.length,
    queueIds: response.queue.map(e => e.image.id),
    showOverlayVoting: response.showOverlayVoting,
  });
  res.json(response);
});

controlRouter.post('/start', (_req, res, next) => {
  try {
    const state = advanceToNextImage();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.put('/queue', (req, res, next) => {
  const body = req.body as { queue?: unknown };
  if (!body.queue || !Array.isArray(body.queue) || !body.queue.every((id) => typeof id === 'string')) {
    res.status(400).json({ error: 'Body must include queue: string[]' });
    return;
  }

  try {
    const state = reorderQueuedImages(body.queue as string[]);
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.delete('/queue/:imageId', (req, res, next) => {
  const { imageId } = req.params;

  try {
    const state = removeQueuedImage(imageId);
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/timer/pause', (_req, res, next) => {
  try {
    const state = pauseTimerAction();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/timer/resume', (_req, res, next) => {
  try {
    const state = resumeTimerAction();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/timer/extend', (req, res, next) => {
  const body = req.body as { seconds?: unknown };
  const seconds = typeof body.seconds === 'number' ? body.seconds : null;
  if (seconds === null || Number.isNaN(seconds) || seconds <= 0) {
    res.status(400).json({ error: 'Body must include seconds > 0' });
    return;
  }

  try {
    const state = extendTimerAction(seconds);
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/lock', (_req, res, next) => {
  try {
    const state = lockCurrentImage();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/results', (_req, res, next) => {
  try {
    const state = showResults();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/reopen', (_req, res, next) => {
  try {
    const state = reopenVoting();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/reset', (_req, res, next) => {
  try {
    const state = resetToIdle();
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.post('/overlay/voting', (req, res, next) => {
  const body = req.body as { show?: unknown };
  if (typeof body.show !== 'boolean') {
    res.status(400).json({ error: 'Body must include show: boolean' });
    return;
  }

  console.log('[POST /api/control/overlay/voting] Setting overlay voting to:', body.show);
  try {
    const state = setOverlayVotingVisibility(body.show);
    console.log('[POST /api/control/overlay/voting] New state showOverlayVoting:', state.showOverlayVoting);
    res.json(mapStateForResponse(state));
  } catch (error) {
    if (error instanceof ControlActionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

controlRouter.put('/votes/:imageId/:judgeId', (req, res, next) => {
  const { imageId, judgeId } = req.params;
  const body = req.body as { score?: unknown };
  
  if (typeof body.score !== 'number' || body.score < 1 || body.score > 5) {
    res.status(400).json({ error: 'Body must include score: number (1-5)' });
    return;
  }

  try {
    saveVote(imageId, judgeId, body.score);
    const state = serializeShowState();
    res.json(mapStateForResponse(state));
  } catch (error) {
    next(error);
  }
});

controlRouter.delete('/votes/:imageId/:judgeId', (req, res, next) => {
  const { imageId, judgeId } = req.params;

  try {
    deleteVote(imageId, judgeId);
    const state = serializeShowState();
    res.json(mapStateForResponse(state));
  } catch (error) {
    next(error);
  }
});

controlRouter.delete('/votes', (_req, res, next) => {
  try {
    deleteAllVotes();
    clearAllAudienceVotes();
    const state = serializeShowState();
    res.json(mapStateForResponse(state));
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/clear-all', (_req, res, next) => {
  try {
    // Reset show state first
    resetToIdle();
    
    // Clear queue
    clearQueue();
    
    // Delete all votes
    deleteAllVotes();
    clearAllAudienceVotes();
    
    // Delete all images (database records and files)
    deleteAllImages();
    
    const state = serializeShowState();
    res.json(mapStateForResponse(state));
  } catch (error) {
    next(error);
  }
});

controlRouter.get('/settings', (_req, res) => {
  const settings = getSettings();
  res.json(settings);
});

controlRouter.put('/settings', (req, res, next) => {
  const body = req.body as Partial<AppSettings>;
  
  if (body.defaultTimerSeconds !== undefined) {
    if (typeof body.defaultTimerSeconds !== 'number' || body.defaultTimerSeconds <= 0) {
      res.status(400).json({ error: 'defaultTimerSeconds must be a positive number' });
      return;
    }
  }
  
  if (body.graceWindowSeconds !== undefined) {
    if (typeof body.graceWindowSeconds !== 'number' || body.graceWindowSeconds < 0) {
      res.status(400).json({ error: 'graceWindowSeconds must be a non-negative number' });
      return;
    }
  }

  try {
    const settings = updateSettings(body);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Public router for overlay (no auth required)
export const controlPublicRouter = Router();

controlPublicRouter.get('/overlay/state', (_req, res) => {
  const state = serializeShowState();
  const response = mapStateForResponse(state);
  res.json(response);
});

controlPublicRouter.post('/audience/vote', (req, res) => {
  const body = req.body as { score?: unknown; voterId?: unknown };
  const score = typeof body.score === 'number' ? body.score : null;

  if (score === null || Number.isNaN(score) || score < 1 || score > 5) {
    res.status(400).json({ error: 'Body must include score: number (1-5)' });
    return;
  }

  const state = serializeShowState();
  if (state.stage !== 'voting' || !state.currentImage) {
    res.status(409).json({ error: 'No active voting round' });
    return;
  }

  const providedId = typeof body.voterId === 'string' && body.voterId.trim().length > 0 ? body.voterId.trim() : null;
  const voterId = providedId ?? crypto.randomUUID();

  saveAudienceVote(state.currentImage.id, voterId, Math.round(score));
  const audienceVotes = getAudienceVoteSummary(state.currentImage.id);

  res.json({ voterId, audienceVotes });
});

export { controlRouter };
