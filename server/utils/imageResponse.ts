import type { ImageRecord } from '../services/imageStore.js';

function toPublicUrl(record: ImageRecord): string {
  const normalisedPath = record.filePath.replace(/\\/g, '/');
  return normalisedPath.startsWith('/') ? normalisedPath : `/${normalisedPath}`;
}

export function serializeImage(record: ImageRecord) {
  return {
    id: record.id,
    name: record.name,
    originalName: record.originalName,
    filePath: record.filePath,
    url: toPublicUrl(record),
    mimeType: record.mimeType,
    size: record.size,
    uploadedAt: record.uploadedAt,
    status: record.status,
  };
}
