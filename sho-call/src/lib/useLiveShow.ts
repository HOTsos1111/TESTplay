// Real-time connection to one show.
//
// States: connecting → connected → reconnecting → offline.
// "connected" is only reported after an authoritative snapshot has arrived on
// the current socket. While not connected the last snapshot stays readable but
// is marked stale, and the UI disables every server-mutating control. Nothing
// is queued while offline and nothing is replayed on reconnect.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../shared/types.ts';

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface LiveShow {
  snapshot: Snapshot | null;
  conn: ConnState;
  /** Client time (ms) of the last message from the server. */
  lastSync: number | null;
  /** Revision of the snapshot currently displayed. */
  revision: number | null;
  error: string | null;
  /** Server-corrected "now" in epoch ms. */
  now: () => number;
  /** Ask the server for a fresh snapshot (reconnects if needed). */
  resync: () => void;
}

const STALE_AFTER_MS = 12_000;
const OFFLINE_AFTER_MS = 10_000;

export function useLiveShow(showId: string | null): LiveShow {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const ws = useRef<WebSocket | null>(null);
  const lastMessage = useRef(0);
  const disconnectedAt = useRef<number | null>(null);
  const attempt = useRef(0);
  const seqRef = useRef(-1);
  const stopped = useRef(false);
  const reconnectTimer = useRef<number | null>(null);
  const hadSnapshot = useRef(false);

  const now = useCallback(() => Date.now() + offset.current, []);

  const connect = useCallback(() => {
    if (!showId || stopped.current) return;
    ws.current?.close();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}/ws`);
    ws.current = sock;
    setConn(hadSnapshot.current ? 'reconnecting' : 'connecting');

    sock.onopen = () => {
      sock.send(JSON.stringify({ type: 'subscribe', showId }));
      sock.send(JSON.stringify({ type: 'ping', t: performance.now() }));
    };
    sock.onmessage = (ev) => {
      if (ws.current !== sock) return;
      lastMessage.current = Date.now();
      const msg = JSON.parse(String(ev.data)) as
        | { type: 'snapshot'; snapshot: Snapshot }
        | { type: 'pong'; t: number; serverNow: string }
        | { type: 'error'; code: string; error: string };
      if (msg.type === 'snapshot') {
        const s = msg.snapshot;
        // Ignore anything older than what is displayed (out-of-order delivery).
        if (s.seq < seqRef.current) return;
        seqRef.current = s.seq;
        hadSnapshot.current = true;
        if (Math.abs(Date.parse(s.serverNow) - (Date.now() + offset.current)) > 2000) {
          offset.current = Date.parse(s.serverNow) - Date.now();
        }
        setSnapshot(s);
        setLastSync(Date.now());
        setConn('connected');
        setError(null);
        attempt.current = 0;
        disconnectedAt.current = null;
      } else if (msg.type === 'pong') {
        const rtt = performance.now() - msg.t;
        offset.current = Date.parse(msg.serverNow) + rtt / 2 - Date.now();
        setLastSync(Date.now());
      } else if (msg.type === 'error') {
        setError(msg.error);
        if (msg.code === 'forbidden') stopped.current = true;
      }
    };
    sock.onclose = () => {
      if (ws.current !== sock) return;
      ws.current = null;
      disconnectedAt.current ??= Date.now();
      if (stopped.current) {
        setConn('offline');
        return;
      }
      const elapsed = Date.now() - disconnectedAt.current;
      setConn(!navigator.onLine || elapsed > OFFLINE_AFTER_MS ? 'offline' : hadSnapshot.current ? 'reconnecting' : 'connecting');
      const delay = Math.min(10_000, 1000 * 2 ** attempt.current);
      attempt.current++;
      reconnectTimer.current = window.setTimeout(connect, delay);
    };
  }, [showId]);

  useEffect(() => {
    stopped.current = false;
    seqRef.current = -1;
    hadSnapshot.current = false;
    setSnapshot(null);
    connect();
    const ping = window.setInterval(() => {
      const sock = ws.current;
      if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: 'ping', t: performance.now() }));
    }, 4000);
    // Watchdog: a socket that has gone silent is treated as disconnected.
    const watchdog = window.setInterval(() => {
      const sock = ws.current;
      if (sock && sock.readyState === WebSocket.OPEN && lastMessage.current && Date.now() - lastMessage.current > STALE_AFTER_MS) {
        sock.close();
      }
      if (!ws.current && disconnectedAt.current && Date.now() - disconnectedAt.current > OFFLINE_AFTER_MS) setConn('offline');
    }, 1000);
    const goOffline = () => {
      setConn('offline');
      disconnectedAt.current ??= Date.now();
      ws.current?.close();
    };
    const goOnline = () => {
      attempt.current = 0;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (!ws.current) connect();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      stopped.current = true;
      clearInterval(ping);
      clearInterval(watchdog);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      const sock = ws.current;
      ws.current = null;
      sock?.close();
    };
  }, [connect]);

  const resync = useCallback(() => {
    attempt.current = 0;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    connect();
  }, [connect]);

  return { snapshot, conn, lastSync, revision: snapshot?.show.revision ?? null, error, now, resync };
}

/** Re-render on an interval (for clocks). */
export function useTick(ms = 1000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}
