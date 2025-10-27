import { db } from '../db.js';
import type { ImageRecord } from './imageStore.js';

interface QueueRow {
  ord: number;
  image: ImageRecord;
}

const selectQueueStmt = db.prepare(`
  SELECT
    q.ord as ord,
    i.id as id,
    i.name as name,
    i.original_name as originalName,
    i.file_path as filePath,
    i.mime_type as mimeType,
    i.size as size,
    i.uploaded_at as uploadedAt,
    i.status as status
  FROM queue q
  JOIN images i ON i.id = q.image_id
  ORDER BY q.ord ASC
`);

const nextOrdStmt = db.prepare(`SELECT COALESCE(MAX(ord), 0) AS maxOrd FROM queue`);
const insertQueueStmt = db.prepare<[string, number]>(`INSERT INTO queue (image_id, ord) VALUES (?, ?)`);
const deleteFromQueueStmt = db.prepare<[string]>(`DELETE FROM queue WHERE image_id = ?`);
const clearQueueStmt = db.prepare(`DELETE FROM queue`);
const updateOrdStmt = db.prepare<[number, string]>(`UPDATE queue SET ord = ? WHERE image_id = ?`);
const selectFirstStmt = db.prepare(`
  SELECT
    q.image_id as imageId,
    q.ord as ord,
    i.id as id,
    i.name as name,
    i.original_name as originalName,
    i.file_path as filePath,
    i.mime_type as mimeType,
    i.size as size,
    i.uploaded_at as uploadedAt,
    i.status as status
  FROM queue q
  JOIN images i ON i.id = q.image_id
  ORDER BY q.ord ASC
  LIMIT 1
`);

export function getQueue(): QueueRow[] {
  const rows = selectQueueStmt.all() as Array<{
    ord: number;
    id: string;
    name: string;
    originalName: string;
    filePath: string;
    mimeType: string;
    size: number;
    uploadedAt: number;
    status: string;
  }>;

  return rows.map((row) => ({
    ord: row.ord,
    image: {
      id: row.id,
      name: row.name,
      originalName: row.originalName,
      filePath: row.filePath,
      mimeType: row.mimeType,
      size: row.size,
      uploadedAt: row.uploadedAt,
      status: row.status,
    },
  }));
}

export function enqueueImage(imageId: string): void {
  const row = nextOrdStmt.get() as { maxOrd: number } | undefined;
  const nextOrd = (row?.maxOrd ?? 0) + 10; // step by 10 to allow future inserts
  insertQueueStmt.run(imageId, nextOrd);
}

export function removeFromQueue(imageId: string): boolean {
  const result = deleteFromQueueStmt.run(imageId);
  return result.changes > 0;
}

export function takeNextFromQueue(): QueueRow | null {
  const row = selectFirstStmt.get() as
    | {
        imageId: string;
        ord: number;
        id: string;
        name: string;
        originalName: string;
        filePath: string;
        mimeType: string;
        size: number;
        uploadedAt: number;
        status: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  deleteFromQueueStmt.run(row.imageId);

  return {
    ord: row.ord,
    image: {
      id: row.id,
      name: row.name,
      originalName: row.originalName,
      filePath: row.filePath,
      mimeType: row.mimeType,
      size: row.size,
      uploadedAt: row.uploadedAt,
      status: row.status,
    },
  };
}

export function reorderQueue(imageIds: string[]): void {
  const existing = getQueue();
  if (imageIds.length !== existing.length) {
    throw new Error('Queue size mismatch');
  }

  const existingIds = new Set(existing.map((row) => row.image.id));
  for (const id of imageIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Image ${id} not found in queue`);
    }
  }

  const tx = db.transaction(() => {
    imageIds.forEach((imageId, index) => {
      const ord = (index + 1) * 10;
      updateOrdStmt.run(ord, imageId);
    });
  });

  tx();
}

export function clearQueue(): void {
  clearQueueStmt.run();
}
