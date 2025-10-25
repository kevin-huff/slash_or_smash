import crypto from 'node:crypto';
import path from 'node:path';
import type { Request } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { createImage, listImages, updateImageName } from '../services/imageStore.js';
import { handleImageQueued } from '../services/showState.js';
import { serializeImage } from '../utils/imageResponse.js';
import { getVoteSummary } from '../services/voteStore.js';

export class UploadValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'UploadValidationError';
    this.status = status;
  }
}

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

function resolveExtension(file: Express.Multer.File): string {
  if (EXTENSION_BY_MIME[file.mimetype]) {
    return EXTENSION_BY_MIME[file.mimetype];
  }
  const ext = path.extname(file.originalname);
  if (ext) {
    return ext.toLowerCase();
  }
  return '';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const extension = resolveExtension(file);
    const hash = crypto
      .createHash('sha256')
      .update(`${file.originalname}_${Date.now()}_${crypto.randomUUID()}`)
      .digest('hex');
    cb(null, `${hash}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new UploadValidationError('Unsupported image type. Allowed: PNG, JPG, WEBP'));
      return;
    }
    cb(null, true);
  },
});

export const imagesRouter = Router();

imagesRouter.get('/', (_req, res) => {
  const images = listImages().map(serializeImage);
  res.json({ images });
});

imagesRouter.post('/', upload.array('files', 20), (req: Request, res) => {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const uploadedAt = Date.now();
  const records = files.map((file) => {
    const id = crypto.randomUUID();
    const basename = path.parse(file.originalname).name || 'Untitled Image';
    const name = basename.trim() || 'Untitled Image';
    const relativePath = path.join('uploads', file.filename).replace(/\\/g, '/');
    const created = createImage({
      id,
      name,
      originalName: file.originalname,
      filePath: relativePath,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt,
    });
    handleImageQueued(created.id);
    return created;
  });

  res.status(201).json({ images: records.map(serializeImage) });
});

export const publicImagesRouter = Router();

publicImagesRouter.get('/leaderboard', (_req, res) => {
  const images = listImages();
  
  const leaderboard = images.map((image) => {
    const voteSummary = getVoteSummary(image.id);
    return {
      image: serializeImage(image),
      average: voteSummary.average,
      voteCount: voteSummary.judgeCount,
      distribution: voteSummary.distribution,
    };
  });

  // Sort by average score (nulls last), then by upload time
  leaderboard.sort((a, b) => {
    if (a.average === null && b.average === null) {
      return b.image.uploadedAt - a.image.uploadedAt;
    }
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    if (b.average !== a.average) {
      return b.average - a.average;
    }
    return b.image.uploadedAt - a.image.uploadedAt;
  });

  res.json({ leaderboard });
});

imagesRouter.get('/leaderboard', (_req, res) => {
  const images = listImages();
  
  const leaderboard = images.map((image) => {
    const voteSummary = getVoteSummary(image.id);
    return {
      image: serializeImage(image),
      average: voteSummary.average,
      voteCount: voteSummary.judgeCount,
      distribution: voteSummary.distribution,
    };
  });

  // Sort by average score (nulls last), then by upload time
  leaderboard.sort((a, b) => {
    if (a.average === null && b.average === null) {
      return b.image.uploadedAt - a.image.uploadedAt;
    }
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    if (b.average !== a.average) {
      return b.average - a.average;
    }
    return b.image.uploadedAt - a.image.uploadedAt;
  });

  res.json({ leaderboard });
});

imagesRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Image name is required' });
    return;
  }

  const updated = updateImageName(id, name.trim());
  if (!updated) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  res.json({ image: serializeImage(updated) });
});
