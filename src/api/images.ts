import { getAuthHeaders } from './auth';

export interface UploadedImage {
  id: string;
  name: string;
  originalName: string;
  url: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  status: string;
}

export interface LeaderboardEntry {
  image: UploadedImage;
  average: number | null;
  voteCount: number;
  distribution: number[];
}

interface ImagesResponse {
  images: UploadedImage[];
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

function sortImages(images: UploadedImage[]): UploadedImage[] {
  return images.slice().sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function listImages(signal?: AbortSignal): Promise<UploadedImage[]> {
  const response = await fetch('/api/images', { 
    signal,
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to load images (${response.status})`);
  }

  const payload = (await response.json()) as ImagesResponse;
  return sortImages(payload.images);
}

export async function updateImageName(imageId: string, name: string): Promise<UploadedImage> {
  const response = await fetch(`/api/images/${imageId}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    let message = `Failed to update image name (${response.status})`;
    try {
      const payload = await response.json();
      if (payload.error && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // Ignore parse errors
    }
    throw new Error(message);
  }

  const payload = await response.json();
  return payload.image as UploadedImage;
}

export async function uploadImages(files: File[]): Promise<UploadedImage[]> {
  if (files.length === 0) {
    throw new Error('No files selected for upload.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const authHeaders = getAuthHeaders();
  const headers: Record<string, string> = {};
  if (authHeaders.Authorization) {
    headers.Authorization = authHeaders.Authorization;
  }

  const response = await fetch('/api/images', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // Ignore JSON parse errors; fall back to default message.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as ImagesResponse;
  return sortImages(payload.images);
}

export async function fetchLeaderboard(signal?: AbortSignal): Promise<LeaderboardEntry[]> {
  const response = await fetch('/api/images/leaderboard', { signal });

  if (!response.ok) {
    throw new Error(`Failed to load leaderboard (${response.status})`);
  }

  const payload = (await response.json()) as LeaderboardResponse;
  return payload.leaderboard;
}
