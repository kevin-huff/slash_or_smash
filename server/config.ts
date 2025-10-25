import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(ROOT_DIR, 'data-dev');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.sqlite');
const DEFAULT_PORT = 4000;

interface AppConfig {
  rootDir: string;
  dataDir: string;
  uploadsDir: string;
  dbFile: string;
  port: number;
}

export const config: AppConfig = {
  rootDir: ROOT_DIR,
  dataDir: DATA_DIR,
  uploadsDir: UPLOADS_DIR,
  dbFile: DB_FILE,
  port: Number.parseInt(process.env.PORT ?? '', 10) || DEFAULT_PORT,
};

export function ensureDataDirectories(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}
