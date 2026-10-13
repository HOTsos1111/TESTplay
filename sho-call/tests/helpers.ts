// Test helpers: an in-process server on a temporary database, cookie-carrying
// HTTP clients and authenticated WebSocket subscribers.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { createApp, type App } from '../server/app.ts';
import { seedDemo, type SeedResult } from '../server/seed.ts';
import type { Snapshot } from '../shared/types.ts';

export interface TestEnv {
  app: App;
  seed: SeedResult;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestEnv> {
  const dir = mkdtempSync(join(tmpdir(), 'sho-call-test-'));
  const app = await createApp({ port: 0, databasePath: join(dir, 'test.db'), staticDir: null, demoLogin: true, allowedOrigins: [] });
  const seed = seedDemo(app.db, { timezone: 'UTC', startInMinutes: 30 });
  return {
    app,
    seed,
    close: async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export class Client {
  base: string;
  cookie = '';
  constructor(base: string) {
    this.base = base;
  }

  async login(email: string, password = 'showcall-demo') {
    const res = await fetch(`${this.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sho-call': '1' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`login failed ${res.status}`);
    this.cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
    return this;
  }

  async req<T = unknown>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: T }> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-sho-call': '1', cookie: this.cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json()) as T };
  }

  snapshot(showId: string) {
    return this.req<{ snapshot: Snapshot }>('GET', `/api/shows/${showId}`).then((r) => r.data.snapshot);
  }

  subscribe(showId: string): Promise<Sub> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.base.replace('http', 'ws')}/ws`, { headers: { cookie: this.cookie } });
      const sub = new Sub(ws);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', showId })));
      ws.on('error', reject);
      ws.on('unexpected-response', (_req, res) => reject(new Error(`ws rejected ${res.statusCode}`)));
      sub.next((m) => m.type === 'snapshot' || m.type === 'error').then(() => resolve(sub), reject);
    });
  }
}

type Msg = { type: string; snapshot?: Snapshot; code?: string };

export class Sub {
  ws: WebSocket;
  messages: Msg[] = [];
  closeCode: number | null = null;
  private waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw)) as Msg;
      this.messages.push(m);
      this.waiters = this.waiters.filter((w) => {
        if (w.pred(m)) {
          w.resolve(m);
          return false;
        }
        return true;
      });
    });
    ws.on('close', (code) => (this.closeCode = code));
  }

  get latest(): Snapshot | null {
    for (let i = this.messages.length - 1; i >= 0; i--) if (this.messages[i].snapshot) return this.messages[i].snapshot!;
    return null;
  }

  next(pred: (m: Msg) => boolean, timeoutMs = 4000): Promise<Msg> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
      this.waiters.push({ pred, resolve: (m) => (clearTimeout(t), resolve(m)) });
    });
  }

  /** Wait for a snapshot satisfying a condition (checks the latest one first). */
  async until(pred: (s: Snapshot) => boolean, timeoutMs = 4000): Promise<Snapshot> {
    if (this.latest && pred(this.latest)) return this.latest;
    const m = await this.next((x) => !!x.snapshot && pred(x.snapshot), timeoutMs);
    return m.snapshot!;
  }

  close() {
    this.ws.close();
  }
}

export const key = () => `test-${Math.random().toString(36).slice(2)}-${Date.now()}`;
