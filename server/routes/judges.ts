import { Router } from 'express';
import {
  createJudge,
  disableJudge,
  getJudgeBySecret,
  JUDGE_ICONS,
  listJudges,
  touchJudge,
  updateJudgeProfile,
} from '../services/judgeStore.js';
import type { JudgeRecord } from '../services/judgeStore.js';
import { saveVote, getVoteSummary } from '../services/voteStore.js';
import { getCurrentStage, getCurrentImage } from '../services/showState.js';

function judgeToResponse(judge: JudgeRecord) {
  return {
    id: judge.id,
    name: judge.name,
    icon: judge.icon,
    status: judge.status,
    inviteCode: judge.inviteCode,
    inviteToken: judge.secret,
    createdAt: judge.createdAt,
    activatedAt: judge.activatedAt,
    lastSeenAt: judge.lastSeenAt,
  };
}

export const judgesRouter = Router();
export const judgePublicRouter = Router();

judgesRouter.get('/', (_req, res) => {
  const judges = listJudges().map((judge) => ({
    ...judgeToResponse(judge),
    invitePath: `/judge?token=${encodeURIComponent(judge.secret)}`,
  }));
  res.json({ judges, icons: JUDGE_ICONS });
});

judgesRouter.post('/', (req, res) => {
  const { name, icon } = req.body as { name?: string; icon?: string };
  try {
    const judge = createJudge({ name, icon });
    res.status(201).json({
      judge: {
        ...judgeToResponse(judge),
        invitePath: `/judge?token=${encodeURIComponent(judge.secret)}`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create judge' });
  }
});

judgesRouter.post('/:id/disable', (req, res) => {
  const { id } = req.params;
  const judge = disableJudge(id);
  if (!judge) {
    res.status(404).json({ error: 'Judge not found' });
    return;
  }
  res.json({ judge: judgeToResponse(judge) });
});

judgePublicRouter.get('/icons', (_req, res) => {
  res.json({ icons: JUDGE_ICONS });
});

judgePublicRouter.post('/profile', (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }
  const judge = getJudgeBySecret(token);
  if (!judge) {
    res.status(404).json({ error: 'Judge not found' });
    return;
  }
  res.json({ judge: judgeToResponse(judge) });
});

judgePublicRouter.post('/activate', (req, res) => {
  const { token, name, icon } = req.body as { token?: string; name?: string; icon?: string };
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }
  if (!name || !icon) {
    res.status(400).json({ error: 'name and icon are required' });
    return;
  }
  try {
    const judge = updateJudgeProfile(token, name, icon);
    res.json({ judge: judgeToResponse(judge) });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to activate judge' });
  }
});

judgePublicRouter.post('/ping', (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }
  const judge = touchJudge(token);
  if (!judge) {
    res.status(404).json({ error: 'Judge not found' });
    return;
  }
  res.json({ judge: judgeToResponse(judge) });
});

judgePublicRouter.post('/vote', (req, res) => {
  const { token, score } = req.body as { token?: string; score?: number };
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    res.status(400).json({ error: 'score must be a number' });
    return;
  }

  const intScore = Math.round(score);
  if (intScore < 1 || intScore > 5) {
    res.status(400).json({ error: 'score must be between 1 and 5' });
    return;
  }

  const judge = getJudgeBySecret(token);
  if (!judge) {
    res.status(404).json({ error: 'Judge not found' });
    return;
  }

  if (judge.status !== 'active') {
    res.status(403).json({ error: 'Judge invite not active' });
    return;
  }

  const stage = getCurrentStage();
  if (stage !== 'voting') {
    res.status(409).json({ error: 'Voting is not currently active' });
    return;
  }

  const currentImage = getCurrentImage();
  if (!currentImage) {
    res.status(409).json({ error: 'No active image to vote on' });
    return;
  }

  saveVote(currentImage.id, judge.id, intScore);
  touchJudge(token);
  const summary = getVoteSummary(currentImage.id);
  res.json({ summary });
});
