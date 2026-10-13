// Detects what changed between consecutive authoritative snapshots so the UI can
// briefly highlight it, show a revision banner and announce meaningful events.
import { useEffect, useRef, useState } from 'react';
import type { ActivityEvent, Snapshot } from '../../shared/types.ts';

export interface Changes {
  changed: Set<string>;
  banner: ActivityEvent | null;
  dismissBanner: () => void;
}

export function useChanges(s: Snapshot | null, onEvents?: (events: ActivityEvent[]) => void): Changes {
  const prev = useRef<Snapshot | null>(null);
  const lastSeq = useRef<number | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<ActivityEvent | null>(null);
  const cb = useRef(onEvents);
  cb.current = onEvents;

  useEffect(() => {
    if (!s) return;
    const before = prev.current;
    prev.current = s;
    const maxSeq = s.activity.reduce((m, a) => Math.max(m, a.seq), 0);
    if (lastSeq.current === null || !before || before.show.id !== s.show.id) {
      lastSeq.current = maxSeq;
      return;
    }
    const fresh = s.activity.filter((a) => a.seq > lastSeq.current!).sort((a, b) => a.seq - b.seq);
    lastSeq.current = Math.max(lastSeq.current, maxSeq);
    if (fresh.length) {
      cb.current?.(fresh);
      const rev = [...fresh].reverse().find((a) => a.type === 'revision' || a.type === 'undo');
      if (rev) setBanner(rev);
    }
    if (before.show.revision !== s.show.revision || before.segmentLive !== s.segmentLive) {
      const ids = new Set<string>();
      const oldCues = new Map(before.content.cues.map((c) => [c.id, c]));
      for (const c of s.content.cues) {
        const o = oldCues.get(c.id);
        if (!o || o.instruction !== c.instruction || o.number !== c.number || o.offsetSec !== c.offsetSec || o.segmentId !== c.segmentId || o.groupId !== c.groupId) ids.add(c.id);
      }
      const oldSegs = new Map(before.content.segments.map((x) => [x.id, x]));
      for (const x of s.content.segments) {
        const o = oldSegs.get(x.id);
        if (!o || o.position !== x.position || o.durationSec !== x.durationSec || o.title !== x.title || o.performer !== x.performer) ids.add(x.id);
      }
      const oldDelay = new Map(before.segmentLive.map((x) => [x.segmentId, x.delaySec]));
      for (const x of s.segmentLive) if ((oldDelay.get(x.segmentId) ?? 0) !== x.delaySec) ids.add(x.segmentId);
      if (ids.size) {
        setChanged(ids);
        const t = window.setTimeout(() => setChanged(new Set()), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [s]);

  return { changed, banner, dismissBanner: () => setBanner(null) };
}
