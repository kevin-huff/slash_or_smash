import crypto from 'node:crypto';
import { db } from '../db.js';

const SALT_ROUNDS = 10;

interface ProducerAuth {
  id: number;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export function isPasswordSet(): boolean {
  const stmt = db.prepare('SELECT id FROM producer_auth WHERE id = 1');
  const row = stmt.get() as ProducerAuth | undefined;
  return !!row;
}

export function setProducerPassword(password: string): void {
  const passwordHash = hashPassword(password);
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO producer_auth (id, password_hash, created_at, updated_at)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      password_hash = excluded.password_hash,
      updated_at = excluded.updated_at
  `);

  stmt.run(passwordHash, now, now);
}

export function verifyProducerPassword(password: string): boolean {
  const stmt = db.prepare('SELECT password_hash FROM producer_auth WHERE id = 1');
  const row = stmt.get() as { password_hash: string } | undefined;

  if (!row) {
    return false;
  }

  return verifyPassword(password, row.password_hash);
}

export function getDefaultPassword(): string {
  // Check for environment variable first
  const envPassword = process.env.PRODUCER_PASSWORD;
  if (envPassword) {
    return envPassword;
  }

  // Generate a random password if none exists
  return crypto.randomBytes(8).toString('hex');
}

export function initializeAuth(): string | null {
  if (!isPasswordSet()) {
    const defaultPassword = getDefaultPassword();
    setProducerPassword(defaultPassword);
    return defaultPassword;
  }
  return null;
}
