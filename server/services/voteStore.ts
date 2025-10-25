import { db } from '../db.js';
import { listJudges } from './judgeStore.js';

export interface VoteRecord {
  imageId: string;
  judgeId: string;
  score: number;
  updatedAt: number;
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

const upsertVoteStmt = db.prepare(`
  INSERT INTO votes (
    image_id,
    judge_id,
    score,
    updated_at
  ) VALUES (
    @imageId,
    @judgeId,
    @score,
    @updatedAt
  )
  ON CONFLICT(image_id, judge_id)
  DO UPDATE SET
    score = excluded.score,
    updated_at = excluded.updated_at
`);

const listVotesForImageStmt = db.prepare(`
  SELECT image_id as imageId, judge_id as judgeId, score, updated_at as updatedAt
  FROM votes
  WHERE image_id = ?
`);

const deleteVoteStmt = db.prepare(`
  DELETE FROM votes
  WHERE image_id = ? AND judge_id = ?
`);

const deleteAllVotesStmt = db.prepare(`
  DELETE FROM votes
`);

export function saveVote(imageId: string, judgeId: string, score: number): void {
  const now = Date.now();
  upsertVoteStmt.run({ imageId, judgeId, score, updatedAt: now });
}

export function deleteVote(imageId: string, judgeId: string): void {
  deleteVoteStmt.run(imageId, judgeId);
}

export function deleteAllVotes(): void {
  deleteAllVotesStmt.run();
}

export function listVotesForImage(imageId: string): VoteRecord[] {
  return listVotesForImageStmt.all(imageId) as VoteRecord[];
}

export function getVoteSummary(imageId: string): VoteSummary {
  const votes = listVotesForImage(imageId);
  const judges = listJudges();
  const judgeMap = new Map(judges.map((judge) => [judge.id, judge]));

  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;

  const items: VoteSummaryItem[] = votes.map((vote) => {
    const judge = judgeMap.get(vote.judgeId);
    if (vote.score >= 1 && vote.score <= 5) {
      distribution[vote.score - 1] += 1;
    }
    sum += vote.score;
    return {
      judgeId: vote.judgeId,
      judgeName: judge?.name ?? null,
      judgeIcon: judge?.icon ?? null,
      judgeStatus: judge?.status ?? 'pending',
      score: vote.score,
      updatedAt: vote.updatedAt,
    };
  });

  const judgeCount = votes.length;
  const average = judgeCount > 0 ? Math.round((sum / judgeCount) * 4) / 4 : null;

  return {
    average,
    distribution,
    judgeCount,
    votes: items,
  };
}
