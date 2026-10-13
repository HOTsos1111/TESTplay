// Authenticated real-time channel. Clients subscribe to one show; membership is
// checked on subscribe and again on every push. Every push is a full,
// permission-filtered snapshot with a sequence number, so a reconnecting client
// recovers authoritative state without replaying any commands.

import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Db } from './db.ts';
import { COOKIE_NAME, parseCookies, userForToken } from './auth.ts';
import { getMembership } from './store.ts';
import { buildSnapshot, type PresenceSource } from './snapshot.ts';
import type { Presence, User } from '../shared/types.ts';

interface Conn {
  ws: WebSocket;
  user: User;
  showId: string | null;
  alive: boolean;
}

interface PresenceEntry {
  connections: number;
  lastSeen: number;
  name: string;
}

/** Readiness from an operator offline for longer than this is shown as unknown. */
const PRESENCE_GRACE_MS = 15_000;

export class Hub implements PresenceSource {
  private db: Db;
  private wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  private conns = new Set<Conn>();
  private presenceByShow = new Map<string, Map<string, PresenceEntry>>();
  private pending = new Map<string, NodeJS.Timeout>();
  private heartbeat: NodeJS.Timeout;
  private allowedOrigins: string[];

  constructor(db: Db, allowedOrigins: string[]) {
    this.db = db;
    this.allowedOrigins = allowedOrigins;
    this.heartbeat = setInterval(() => {
      for (const c of this.conns) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        c.ws.ping();
      }
    }, 10_000);
  }

  close() {
    clearInterval(this.heartbeat);
    for (const t of this.pending.values()) clearTimeout(t);
    for (const c of this.conns) c.ws.terminate();
    this.wss.close();
  }

  private originAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) return true; // non-browser clients (tests, CLI) carry no Origin
    const host = req.headers.host;
    try {
      const u = new URL(origin);
      if (u.host === host) return true;
      if (this.allowedOrigins.includes(origin)) return true;
      if (this.allowedOrigins.length === 0 && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    } catch {
      return false;
    }
    return false;
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') return socket.destroy();
    if (!this.originAllowed(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      return socket.destroy();
    }
    const user = userForToken(this.db, parseCookies(req.headers.cookie)[COOKIE_NAME]);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws, user));
  }

  private send(c: Conn, msg: unknown) {
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private onConnection(ws: WebSocket, user: User) {
    const conn: Conn = { ws, user, showId: null, alive: true };
    this.conns.add(conn);
    ws.on('pong', () => (conn.alive = true));
    ws.on('message', (raw) => {
      conn.alive = true;
      let msg: { type?: string; showId?: string; t?: number };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return this.send(conn, { type: 'error', code: 'bad_message', error: 'Malformed message.' });
      }
      if (msg.type === 'ping') {
        this.touch(conn);
        return this.send(conn, { type: 'pong', t: msg.t, serverNow: new Date().toISOString() });
      }
      if (msg.type === 'subscribe' && typeof msg.showId === 'string') {
        if (!getMembership(this.db, msg.showId, user.id)) {
          this.send(conn, { type: 'error', code: 'forbidden', error: 'You are not a member of this show.' });
          return ws.close(4403, 'forbidden');
        }
        if (conn.showId) this.leave(conn);
        conn.showId = msg.showId;
        this.join(conn);
        this.pushTo(conn, 'subscribe');
        this.schedule(msg.showId, 'presence');
        return;
      }
      this.send(conn, { type: 'error', code: 'bad_message', error: 'Unknown message type.' });
    });
    ws.on('close', () => {
      this.conns.delete(conn);
      if (conn.showId) {
        const showId = conn.showId;
        this.leave(conn);
        this.schedule(showId, 'presence');
        // Re-push after the grace period so stale readiness turns to "unknown".
        setTimeout(() => this.schedule(showId, 'presence'), PRESENCE_GRACE_MS + 500).unref();
      }
    });
  }

  private join(c: Conn) {
    const map = this.presenceByShow.get(c.showId!) ?? new Map<string, PresenceEntry>();
    const e = map.get(c.user.id) ?? { connections: 0, lastSeen: Date.now(), name: c.user.name };
    e.connections++;
    e.lastSeen = Date.now();
    map.set(c.user.id, e);
    this.presenceByShow.set(c.showId!, map);
  }

  private leave(c: Conn) {
    const e = this.presenceByShow.get(c.showId!)?.get(c.user.id);
    if (e) {
      e.connections = Math.max(0, e.connections - 1);
      e.lastSeen = Date.now();
    }
  }

  private touch(c: Conn) {
    if (!c.showId) return;
    const e = this.presenceByShow.get(c.showId)?.get(c.user.id);
    if (e) e.lastSeen = Date.now();
  }

  isFresh(showId: string, userId: string): boolean {
    const e = this.presenceByShow.get(showId)?.get(userId);
    if (!e) return false;
    return e.connections > 0 || Date.now() - e.lastSeen < PRESENCE_GRACE_MS;
  }

  presence(showId: string): Presence[] {
    const map = this.presenceByShow.get(showId);
    if (!map) return [];
    const out: Presence[] = [];
    for (const [userId, e] of map) {
      const m = getMembership(this.db, showId, userId);
      if (!m) continue;
      out.push({
        userId,
        name: e.name,
        role: m.role,
        departments: m.operateDepartments,
        online: e.connections > 0,
        lastSeen: new Date(e.lastSeen).toISOString(),
      });
    }
    return out;
  }

  private pushTo(c: Conn, reason: string) {
    try {
      const snapshot = buildSnapshot(this.db, c.showId!, c.user, this);
      this.send(c, { type: 'snapshot', reason, snapshot });
    } catch {
      // Membership removed or show deleted: end the subscription.
      this.send(c, { type: 'error', code: 'forbidden', error: 'You no longer have access to this show.' });
      c.ws.close(4403, 'forbidden');
    }
  }

  /** Push fresh snapshots to everyone watching a show (coalesced). */
  schedule(showId: string, reason = 'update') {
    if (this.pending.has(showId)) return;
    const t = setTimeout(() => {
      this.pending.delete(showId);
      for (const c of this.conns) if (c.showId === showId) this.pushTo(c, reason);
    }, 5);
    this.pending.set(showId, t);
  }

  connectionCount(showId: string): number {
    let n = 0;
    for (const c of this.conns) if (c.showId === showId) n++;
    return n;
  }
}
