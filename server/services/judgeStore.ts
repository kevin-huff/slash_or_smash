import crypto from 'node:crypto';
import { db } from '../db.js';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
const SECRET_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const JUDGE_ICONS = [
  'ghost',
  'pumpkin',
  'skull',
  'bat',
  'spider',
  'moon',
  'star',
  'planet',
  'ufo',
  'witch',
] as const;

const ICON_SET = new Set<string>(JUDGE_ICONS);

export type JudgeIcon = (typeof JUDGE_ICONS)[number];

export interface JudgeRecord {
  id: string;
  inviteCode: string;
  secret: string;
  name: string | null;
  icon: string | null;
  status: 'pending' | 'active' | 'disabled';
  createdAt: number;
  activatedAt: number | null;
  lastSeenAt: number | null;
}

function randomFromAlphabet(length: number, alphabet: string): string {
  const bytes = crypto.randomBytes(length);
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += alphabet[bytes[i] % alphabet.length];
  }
  return output;
}

function generateId(): string {
  return randomFromAlphabet(16, SECRET_ALPHABET);
}

function generateInviteCode(): string {
  return randomFromAlphabet(6, ID_ALPHABET);
}

function generateSecret(): string {
  return randomFromAlphabet(32, SECRET_ALPHABET);
}

const insertJudgeStmt = db.prepare(`
  INSERT INTO judges (
    id,
    invite_code,
    secret,
    name,
    icon,
    status,
    created_at
  ) VALUES (
    @id,
    @inviteCode,
    @secret,
    @name,
    @icon,
    @status,
    @createdAt
  )
`);

const listJudgesStmt = db.prepare(`
  SELECT
    id,
    invite_code as inviteCode,
    secret,
    name,
    icon,
    status,
    created_at as createdAt,
    activated_at as activatedAt,
    last_seen_at as lastSeenAt
  FROM judges
  ORDER BY created_at ASC
`);

const getBySecretStmt = db.prepare(`
  SELECT
    id,
    invite_code as inviteCode,
    secret,
    name,
    icon,
    status,
    created_at as createdAt,
    activated_at as activatedAt,
    last_seen_at as lastSeenAt
  FROM judges
  WHERE secret = ?
`);

const getByIdStmt = db.prepare(`
  SELECT
    id,
    invite_code as inviteCode,
    secret,
    name,
    icon,
    status,
    created_at as createdAt,
    activated_at as activatedAt,
    last_seen_at as lastSeenAt
  FROM judges
  WHERE id = ?
`);

const updateProfileStmt = db.prepare(`
  UPDATE judges
  SET name = @name,
      icon = @icon,
      status = @status,
      activated_at = @activatedAt,
      last_seen_at = @lastSeenAt
  WHERE secret = @secret
`);

const touchJudgeStmt = db.prepare(`
  UPDATE judges
  SET last_seen_at = @lastSeenAt
  WHERE secret = @secret
`);

const disableJudgeStmt = db.prepare(`
  UPDATE judges
  SET status = 'disabled'
  WHERE id = ?
`);

function mapRow(row: any): JudgeRecord {
  return {
    id: row.id,
    inviteCode: row.inviteCode,
    secret: row.secret,
    name: row.name ?? null,
    icon: row.icon ?? null,
    status: row.status,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt ?? null,
    lastSeenAt: row.lastSeenAt ?? null,
  };
}

export function createJudge(input: { name?: string | null; icon?: string | null } = {}): JudgeRecord {
  const now = Date.now();
  const icon = input.icon && ICON_SET.has(input.icon) ? input.icon : null;

  const record: JudgeRecord = {
    id: generateId(),
    inviteCode: generateInviteCode(),
    secret: generateSecret(),
    name: input.name?.trim() ? input.name.trim() : null,
    icon,
    status: 'pending',
    createdAt: now,
    activatedAt: null,
    lastSeenAt: null,
  };

  insertJudgeStmt.run({
    id: record.id,
    inviteCode: record.inviteCode,
    secret: record.secret,
    name: record.name,
    icon: record.icon,
    status: record.status,
    createdAt: record.createdAt,
  });

  return record;
}

export function listJudges(): JudgeRecord[] {
  const rows = listJudgesStmt.all();
  return rows.map(mapRow);
}

export function getJudgeBySecret(secret: string): JudgeRecord | null {
  const row = getBySecretStmt.get(secret);
  return row ? mapRow(row) : null;
}

export function getJudgeById(id: string): JudgeRecord | null {
  const row = getByIdStmt.get(id);
  return row ? mapRow(row) : null;
}

export function updateJudgeProfile(secret: string, name: string, icon: string): JudgeRecord {
  if (!ICON_SET.has(icon)) {
    throw new Error('Invalid icon choice');
  }

  const cleanedName = name.trim();
  if (!cleanedName) {
    throw new Error('Name is required');
  }

  const now = Date.now();

  const result = updateProfileStmt.run({
    secret,
    name: cleanedName,
    icon,
    status: 'active',
    activatedAt: now,
    lastSeenAt: now,
  });

  if (result.changes === 0) {
    throw new Error('Judge not found');
  }

  const updated = getJudgeBySecret(secret);
  if (!updated) {
    throw new Error('Judge not found after update');
  }

  return updated;
}

export function touchJudge(secret: string): JudgeRecord | null {
  const judge = getJudgeBySecret(secret);
  if (!judge) {
    return null;
  }
  const now = Date.now();
  touchJudgeStmt.run({
    secret,
    lastSeenAt: now,
  });
  return getJudgeBySecret(secret);
}

export function disableJudge(id: string): JudgeRecord | null {
  const existing = getJudgeById(id);
  if (!existing) {
    return null;
  }
  disableJudgeStmt.run(id);
  return getJudgeById(id);
}
