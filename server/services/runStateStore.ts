import { db } from '../db.js';

export type RunStateKey = 'stage' | 'current_image_id' | 'timer_state' | 'show_overlay_voting' | 'settings' | 'twitch_prediction_id';

const getStmt = db.prepare<
  [RunStateKey]
>(`SELECT value FROM run_state WHERE key = ?`);

const upsertStmt = db.prepare<
  [RunStateKey, string]
>(`INSERT INTO run_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);

const deleteStmt = db.prepare<[RunStateKey]>(`DELETE FROM run_state WHERE key = ?`);

export function getRunState(key: RunStateKey): string | null {
  const row = getStmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setRunState(key: RunStateKey, value: string): void {
  upsertStmt.run(key, value);
}

export function clearRunState(key: RunStateKey): void {
  deleteStmt.run(key);
}
