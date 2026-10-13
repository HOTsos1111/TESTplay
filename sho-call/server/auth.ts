// Password hashing (scrypt) and opaque session tokens. Only a SHA-256 hash of
// each token is stored, so a database leak does not expose live sessions.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { all, get, run, type Db } from './db.ts';
import { newId, nowIso } from './ids.ts';
import type { User } from '../shared/types.ts';

const SESSION_DAYS = 14;
export const COOKIE_NAME = 'sc_session';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, actual);
}

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

export function createUser(db: Db, email: string, name: string, password: string): User {
  const id = newId('usr');
  run(db, 'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', id, email.toLowerCase(), name, hashPassword(password), nowIso());
  return { id, email: email.toLowerCase(), name };
}

export function findUserByEmail(db: Db, email: string) {
  return get<{ id: string; email: string; name: string; password_hash: string }>(db, 'SELECT * FROM users WHERE email = ?', email.toLowerCase());
}

export function createSession(db: Db, userId: string): string {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  run(db, 'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sha(token), userId, nowIso(), expires);
  return token;
}

export function userForToken(db: Db, token: string | undefined): User | null {
  if (!token) return null;
  const row = get<{ id: string; email: string; name: string; expires_at: string }>(
    db,
    'SELECT u.id, u.email, u.name, s.expires_at FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
    sha(token),
  );
  if (!row || row.expires_at < nowIso()) return null;
  return { id: row.id, email: row.email, name: row.name };
}

export function destroySession(db: Db, token: string | undefined) {
  if (token) run(db, 'DELETE FROM auth_sessions WHERE token_hash = ?', sha(token));
}

export function purgeExpiredSessions(db: Db) {
  run(db, 'DELETE FROM auth_sessions WHERE expires_at < ?', nowIso());
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function listUsers(db: Db): User[] {
  return all<User>(db, 'SELECT id, email, name FROM users ORDER BY name');
}

/** Simple in-memory login throttle: 10 failures per email+ip per 10 minutes. */
const failures = new Map<string, { count: number; until: number }>();
export function loginThrottled(key: string): boolean {
  const f = failures.get(key);
  return !!f && f.count >= 10 && f.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const f = failures.get(key);
  const until = Date.now() + 10 * 60_000;
  failures.set(key, { count: f && f.until > Date.now() ? f.count + 1 : 1, until });
}
export function clearLoginFailures(key: string) {
  failures.delete(key);
}
