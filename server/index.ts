import path from 'node:path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from './config.js';
import { imagesRouter, publicImagesRouter, UploadValidationError } from './routes/images.js';
import { controlRouter, controlPublicRouter } from './routes/control.js';
import { judgePublicRouter, judgesRouter } from './routes/judges.js';
import { authRouter, requireProducerAuth } from './routes/auth.js';
import twitchRouter from './routes/twitch.js';
import { initializeAuth } from './services/authStore.js';

// Debug: Check if Twitch env vars are loaded
console.log('[Server] TWITCH_CLIENT_ID:', process.env.TWITCH_CLIENT_ID ? `${process.env.TWITCH_CLIENT_ID.substring(0, 8)}...` : 'NOT SET');
console.log('[Server] TWITCH_CLIENT_SECRET:', process.env.TWITCH_CLIENT_SECRET ? 'SET' : 'NOT SET');

const app = express();

app.set('trust proxy', true);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(
  '/uploads',
  express.static(config.uploadsDir, {
    index: false,
    fallthrough: false,
    setHeaders(res, filePath) {
      const extension = path.extname(filePath).toLowerCase();
      if (extension === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (extension === '.jpg' || extension === '.jpeg') {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (extension === '.webp') {
        res.setHeader('Content-Type', 'image/webp');
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

// Public routes
app.use('/api/images', publicImagesRouter);
app.use('/api/judge', judgePublicRouter);
app.use('/api/control', controlPublicRouter);
app.use('/api/auth', authRouter);
app.use('/api/integrations/twitch', twitchRouter); // Twitch integration (used on authenticated pages)

// Protected routes
app.use('/api/images', requireProducerAuth, imagesRouter);
app.use('/api/control', requireProducerAuth, controlRouter);
app.use('/api/judges', requireProducerAuth, judgesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File exceeds 25MB limit' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof UploadValidationError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Unknown server error' });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${config.port}`);
  
  // Initialize auth and show password if generated
  const generatedPassword = initializeAuth();
  if (generatedPassword) {
    // eslint-disable-next-line no-console
    console.log('\n⚠️  PRODUCER PASSWORD GENERATED ⚠️');
    // eslint-disable-next-line no-console
    console.log(`Password: ${generatedPassword}`);
    // eslint-disable-next-line no-console
    console.log('Please save this password and change it after first login.\n');
  }
});
