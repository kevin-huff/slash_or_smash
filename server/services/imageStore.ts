import { db } from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export interface ImageRecord {
  id: string;
  name: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  status: string;
  type: 'image' | 'link';
  url: string | null;
  metadata?: string | null;
}

export interface CreateImageInput {
  id: string;
  name: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  status?: string;
}

interface InsertImageParams {
  id: string;
  name: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  status: string;
  type: string;
  url: string | null;
  metadata: string | null;
}

const insertImage = db.prepare<InsertImageParams>(`
  INSERT INTO images (
    id,
    name,
    original_name,
    file_path,
    mime_type,
    size,
    uploaded_at,
    status,
    type,
    url,
    metadata
  ) VALUES (@id, @name, @originalName, @filePath, @mimeType, @size, @uploadedAt, @status, @type, @url, @metadata)
`);

const listImagesStmt = db.prepare(`
  SELECT
    id,
    name,
    original_name as originalName,
    file_path as filePath,
    mime_type as mimeType,
    size,
    uploaded_at as uploadedAt,
    status,
    type,
    url,
    metadata
  FROM images
  ORDER BY uploaded_at DESC
`);

const getImageByIdStmt = db.prepare<
  [string]
>(`
  SELECT
    id,
    name,
    original_name as originalName,
    file_path as filePath,
    mime_type as mimeType,
    size,
    uploaded_at as uploadedAt,
    status,
    type,
    url,
    metadata
  FROM images
  WHERE id = ?
`);

const updateStatusStmt = db.prepare<[string, string]>(`UPDATE images SET status = ? WHERE id = ?`);

const updateNameStmt = db.prepare<[string, string]>(`UPDATE images SET name = ? WHERE id = ?`);

const deleteAllImagesStmt = db.prepare(`DELETE FROM images`);

export function createImage(record: CreateImageInput): ImageRecord {
  const status = record.status ?? 'queued';
  const type = 'image';
  const url = null;
  const metadata = null;

  insertImage.run({
    id: record.id,
    name: record.name,
    originalName: record.originalName,
    filePath: record.filePath,
    mimeType: record.mimeType,
    size: record.size,
    uploadedAt: record.uploadedAt,
    status,
    type,
    url,
    metadata
  });

  return {
    id: record.id,
    name: record.name,
    originalName: record.originalName,
    filePath: record.filePath,
    mimeType: record.mimeType,
    size: record.size,
    uploadedAt: record.uploadedAt,
    status,
    type,
    url
  };
}

export function createLink(id: string, name: string, url: string, metadata: any = null): ImageRecord {
  const status = 'queued';
  const type = 'link';
  const now = Date.now();
  const mimeType = 'application/x-link';
  const filePath = 'LINK';
  const size = 0;
  const originalName = 'Link';
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  insertImage.run({
    id,
    name,
    originalName,
    filePath,
    mimeType,
    size,
    uploadedAt: now,
    status,
    type,
    url,
    metadata: metadataStr
  });

  return {
    id,
    name,
    originalName,
    filePath,
    mimeType,
    size,
    uploadedAt: now,
    status,
    type,
    url,
    metadata: metadataStr
  };
}

export function listImages(): ImageRecord[] {
  return listImagesStmt.all().map((row: any) => ({
    ...row,
    type: row.type || 'image',
    url: row.url || null,
    metadata: row.metadata,
  })) as ImageRecord[];
}

export function getImageById(id: string): ImageRecord | null {
  const row = getImageByIdStmt.get(id) as any;
  if (!row) return null;
  return {
    ...row,
    type: row.type || 'image',
    url: row.url || null,
    metadata: row.metadata,
  } as ImageRecord;
}

export function updateImageStatus(id: string, status: string): void {
  updateStatusStmt.run(status, id);
}

export function updateImageName(id: string, name: string): ImageRecord | null {
  const image = getImageById(id);
  if (!image) {
    return null;
  }
  updateNameStmt.run(name, id);
  return { ...image, name };
}

export function deleteAllImages(): void {
  // Get all images before deleting from DB
  const images = listImages();

  // Delete all database records
  deleteAllImagesStmt.run();

  // Delete all files from uploads directory
  for (const image of images) {
    if (image.type === 'link') continue;
    try {
      const fullPath = path.join(config.rootDir, image.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted file: ${image.filePath}`);
      }
    } catch (error) {
      console.error(`Failed to delete file ${image.filePath}:`, error);
    }
  }
}
