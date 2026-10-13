import { randomBytes, randomUUID } from 'node:crypto';

/** Short url-safe random id with a readable prefix, e.g. "cue_k3j9..." */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x')}`;
}

export const uuid = () => randomUUID();
export const nowIso = () => new Date().toISOString();
