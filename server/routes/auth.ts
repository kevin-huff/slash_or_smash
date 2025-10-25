import express from 'express';
import { verifyProducerPassword, isPasswordSet, setProducerPassword } from '../services/authStore.js';

export const authRouter = express.Router();

const SESSION_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// Simple in-memory session store (upgrade to Redis for production)
const sessions = new Map<string, { expiresAt: number }>();

function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
}

// Clean expired sessions every 5 minutes
setInterval(cleanExpiredSessions, 1000 * 60 * 5);

export function requireProducerAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', requiresAuth: true });
    return;
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessions.delete(token);
    }
    res.status(401).json({ error: 'Session expired', requiresAuth: true });
    return;
  }

  // Extend session
  session.expiresAt = Date.now() + SESSION_DURATION;
  next();
}

authRouter.get('/status', (req, res) => {
  const passwordSet = isPasswordSet();
  const token = req.headers.authorization?.replace('Bearer ', '');
  const isAuthenticated = token ? sessions.has(token) && sessions.get(token)!.expiresAt > Date.now() : false;

  res.json({
    passwordSet,
    isAuthenticated,
  });
});

authRouter.post('/setup', (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string' || password.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters' });
    return;
  }

  if (isPasswordSet()) {
    res.status(400).json({ error: 'Password already set. Use /login to authenticate.' });
    return;
  }

  setProducerPassword(password);

  // Auto-login after setup
  const token = generateSessionToken();
  sessions.set(token, { expiresAt: Date.now() + SESSION_DURATION });

  res.json({ token, message: 'Password set successfully' });
});

authRouter.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password required' });
    return;
  }

  if (!verifyProducerPassword(password)) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const token = generateSessionToken();
  sessions.set(token, { expiresAt: Date.now() + SESSION_DURATION });

  res.json({ token });
});

authRouter.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    sessions.delete(token);
  }

  res.json({ message: 'Logged out successfully' });
});

authRouter.post('/change-password', requireProducerAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password required' });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    res.status(400).json({ error: 'New password must be at least 4 characters' });
    return;
  }

  if (!verifyProducerPassword(currentPassword)) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  setProducerPassword(newPassword);

  res.json({ message: 'Password changed successfully' });
});
