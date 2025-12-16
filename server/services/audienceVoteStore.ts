import { db } from '../db.js';

export interface AudienceVoteSummary {
  average: number | null;
  distribution: number[];
  voteCount: number;
}

const upsertAudienceVoteStmt = db.prepare(`
  INSERT INTO audience_votes (
    image_id,
    voter_id,
    score,
    updated_at
  ) VALUES (
    @imageId,
    @voterId,
    @score,
    @updatedAt
  )
  ON CONFLICT(image_id, voter_id)
  DO UPDATE SET
    score = excluded.score,
    updated_at = excluded.updated_at
`);

const deleteAudienceVotesForImageStmt = db.prepare(`
  DELETE FROM audience_votes
  WHERE image_id = ?
`);

const deleteAllAudienceVotesStmt = db.prepare(`
  DELETE FROM audience_votes
`);

const listAudienceVotesStmt = db.prepare(`
  SELECT image_id as imageId, voter_id as voterId, score, updated_at as updatedAt
  FROM audience_votes
  WHERE image_id = ?
`);

export function saveAudienceVote(imageId: string, voterId: string, score: number): void {
  const now = Date.now();
  upsertAudienceVoteStmt.run({ imageId, voterId, score, updatedAt: now });
}

export function clearAudienceVotesForImage(imageId: string): void {
  deleteAudienceVotesForImageStmt.run(imageId);
}

export function clearAllAudienceVotes(): void {
  deleteAllAudienceVotesStmt.run();
}

export function getAudienceVoteSummary(imageId: string): AudienceVoteSummary {
  const rows = listAudienceVotesStmt.all(imageId) as Array<{ imageId: string; voterId: string; score: number; updatedAt: number }>;
  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;

  for (const row of rows) {
    if (row.score >= 1 && row.score <= 5) {
      distribution[row.score - 1] += 1;
      sum += row.score;
    }
  }

  const voteCount = rows.length;
  const average = voteCount > 0 ? Math.round((sum / voteCount) * 4) / 4 : null;

  return {
    average,
    distribution,
    voteCount,
  };
}
