// Director live edits: a draft change set that is previewed by the server and
// applied as one revision. The published show stays usable while drafting.

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { api, errorText } from '../lib/api.ts';
import { clientId } from '../lib/ids.ts';
import type { LiveOp } from '../../shared/schemas.ts';
import { formatDelta, formatDuration, parseDuration, sortSegments } from '../../shared/timing.ts';
import type { ChangePreview, Snapshot } from '../../shared/types.ts';
import { Drawer, Field, useToast } from './ui.tsx';

type Tab = 'move' | 'timing' | 'edit';

export function LiveEditDrawer({ s, onClose, canApply, blockedReason }: { s: Snapshot; onClose: () => void; canApply: boolean; blockedReason: string | null }) {
  const { toast, announce } = useToast();
  const [tab, setTab] = useState<Tab>('move');
  const original = useMemo(() => sortSegments(s.content.segments), [s.content.segments]);
  const [order, setOrder] = useState(original.map((x) => x.id));
  const [shift, setShift] = useState(0);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [cueSearch, setCueSearch] = useState('');
  const [selectedCue, setSelectedCue] = useState<string>('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const started = new Set(s.segmentLive.filter((x) => x.actualStart).map((x) => x.segmentId));
  const segById = new Map(s.content.segments.map((x) => [x.id, x]));
  const deptName = (id: string) => s.content.departments.find((d) => d.id === id)?.name ?? '';

  const ops: LiveOp[] = useMemo(() => {
    const out: LiveOp[] = [];
    // Translate the desired order into a sequence of single moves.
    const cur = original.map((x) => x.id);
    order.forEach((id, i) => {
      if (cur[i] !== id) {
        cur.splice(cur.indexOf(id), 1);
        cur.splice(i, 0, id);
        out.push({ op: 'moveSegment', segmentId: id, toIndex: i });
      }
    });
    for (const [segmentId, durationSec] of Object.entries(durations)) {
      if (segById.get(segmentId)?.durationSec !== durationSec) out.push({ op: 'editSegment', segmentId, durationSec });
    }
    for (const [cueId, instruction] of Object.entries(edits)) {
      const c = s.content.cues.find((x) => x.id === cueId);
      if (c && instruction.trim() && c.instruction !== instruction) out.push({ op: 'editCue', cueId, instruction });
    }
    if (shift !== 0) out.push({ op: 'shift', deltaSec: shift });
    return out;
  }, [order, durations, edits, shift, original]);

  // Server-side preview of the impact (debounced).
  useEffect(() => {
    if (!ops.length) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const r = await api<{ preview: ChangePreview }>('POST', `/api/shows/${s.show.id}/live-edits`, { baseRevision: s.show.revision, ops, dryRun: true, reason, clientId: clientId() });
        setPreview(r.preview);
        setPreviewError(null);
      } catch (e) {
        setPreviewError(errorText(e));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [ops, s.show.id, s.show.revision, reason]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    if (started.has(order[idx]) || started.has(order[j])) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    announce(`${segById.get(order[idx])?.title} moved to position ${j + 1}`);
  };

  const reset = () => {
    setOrder(original.map((x) => x.id));
    setShift(0);
    setDurations({});
    setEdits({});
    setReason('');
  };

  const apply = async () => {
    setBusy(true);
    try {
      const r = await api<{ revision: number; preview: ChangePreview }>('POST', `/api/shows/${s.show.id}/live-edits`, { baseRevision: s.show.revision, ops, dryRun: false, reason, clientId: clientId() });
      toast('ok', `Revision ${r.revision} applied: ${r.preview.summary}`);
      reset();
      onClose();
    } catch (e) {
      toast('error', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cues = s.content.cues.filter((c) => {
    const q = cueSearch.trim().toLowerCase();
    return !q || c.number.toLowerCase().includes(q) || c.instruction.toLowerCase().includes(q) || deptName(c.departmentId).toLowerCase().includes(q);
  });
  const selected = s.content.cues.find((c) => c.id === selectedCue);

  return (
    <Drawer title="Live edit" onClose={onClose}>
      {ops.length ? (
        <div className="banner banner-reconnecting" role="status">
          <span className="grow">
            <b>Draft — not yet applied.</b> The published show is unchanged until you apply.
          </span>
        </div>
      ) : (
        <p className="muted small">Changes are collected as a draft, previewed, then applied as one revision that every connected screen receives.</p>
      )}
      <div className="segmented" role="group" aria-label="Edit type">
        {(
          [
            ['move', 'Move segments'],
            ['timing', 'Adjust timing'],
            ['edit', 'Edit instructions'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'move' ? (
        <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }} aria-label="Segment order">
          {order.map((id, i) => {
            const seg = segById.get(id)!;
            const locked = started.has(id);
            const movedFrom = original.findIndex((x) => x.id === id);
            return (
              <li key={id} className="raised pad-sm row" style={{ padding: '8px 12px' }}>
                <span className="tabular muted" style={{ width: 24 }}>{i + 1}</span>
                <span className="grow">
                  <b>{seg.title}</b>
                  {seg.performer ? <span className="muted small"> · {seg.performer}</span> : null}
                  {movedFrom !== i ? <span className="chip chip-standby" style={{ marginLeft: 8 }}>Moved</span> : null}
                </span>
                {locked ? (
                  <span className="small muted row" style={{ gap: 4 }}>
                    <Lock width={14} /> Started
                  </span>
                ) : (
                  <>
                    <button className="btn btn-sm btn-icon" aria-label={`Move ${seg.title} up`} disabled={i === 0 || started.has(order[i - 1])} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </button>
                    <button className="btn btn-sm btn-icon" aria-label={`Move ${seg.title} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {tab === 'timing' ? (
        <div className="stack-lg">
          <section className="stack">
            <h3>Shift upcoming estimates</h3>
            <p className="small muted">Applies to segments that have not started. Fixed-time items are not shifted; completed and called times never change.</p>
            <div className="row-wrap">
              {[-300, -60, 60, 300].map((d) => (
                <button key={d} className="btn btn-sm" onClick={() => setShift(shift + d)}>
                  {formatDelta(d)}
                </button>
              ))}
              <span className="chip chip-accent tabular" aria-live="polite">
                Shift: {shift === 0 ? 'none' : formatDelta(shift)}
              </span>
              {shift ? (
                <button className="btn btn-sm btn-ghost" onClick={() => setShift(0)}>
                  Clear
                </button>
              ) : null}
            </div>
          </section>
          <section className="stack">
            <h3>Segment durations</h3>
            {original.map((seg) => {
              const finished = s.segmentLive.find((x) => x.segmentId === seg.id)?.actualEnd;
              const val = durations[seg.id] ?? seg.durationSec;
              return (
                <div key={seg.id} className="row">
                  <span className="grow">{seg.title}</span>
                  <input
                    className="input input-sm tabular"
                    style={{ width: 96 }}
                    aria-label={`${seg.title} duration`}
                    disabled={!!finished}
                    defaultValue={formatDuration(val)}
                    onBlur={(e) => {
                      const v = parseDuration(e.target.value);
                      if (v !== null) setDurations({ ...durations, [seg.id]: v });
                      else e.target.value = formatDuration(val);
                    }}
                  />
                  {durations[seg.id] !== undefined && durations[seg.id] !== seg.durationSec ? (
                    <span className="chip chip-standby tabular">{formatDelta(durations[seg.id] - seg.durationSec)}</span>
                  ) : null}
                </div>
              );
            })}
          </section>
        </div>
      ) : null}

      {tab === 'edit' ? (
        <div className="stack">
          <Field label="Find cue">
            <input className="input" value={cueSearch} onChange={(e) => setCueSearch(e.target.value)} placeholder="Number, department or text" />
          </Field>
          <Field label="Cue">
            <select className="input" value={selectedCue} onChange={(e) => setSelectedCue(e.target.value)} size={6}>
              {cues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number} · {deptName(c.departmentId)} · {c.instruction.slice(0, 70)}
                  {edits[c.id] !== undefined && edits[c.id] !== c.instruction ? ' (edited)' : ''}
                </option>
              ))}
            </select>
          </Field>
          {selected ? (
            <Field label={`Instruction for ${selected.number} (${deptName(selected.departmentId)})`}>
              <textarea className="input" value={edits[selected.id] ?? selected.instruction} onChange={(e) => setEdits({ ...edits, [selected.id]: e.target.value })} />
            </Field>
          ) : null}
        </div>
      ) : null}

      <section className="raised pad-sm stack" aria-labelledby="impact-h" aria-live="polite">
        <h3 id="impact-h">Review before applying</h3>
        {!ops.length ? <p className="muted small">No changes yet.</p> : null}
        {previewError ? <p className="field-error">{previewError}</p> : null}
        {preview && ops.length ? (
          <>
            <p>
              <b>{preview.summary}</b>
            </p>
            <p className="small muted">
              {preview.affectedCueIds.length} cue{preview.affectedCueIds.length === 1 ? '' : 's'} affected · departments:{' '}
              {preview.affectedDepartmentIds.map(deptName).join(', ') || 'none'}
            </p>
            {preview.timingNotes.length ? (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {preview.timingNotes.slice(0, 12).map((n) => (
                  <li key={n} className="tabular">
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.errors.map((e) => (
              <p key={e} className="field-error">
                {e}
              </p>
            ))}
          </>
        ) : null}
        <Field label="Reason (optional, shown in history)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </section>
      <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {blockedReason ? <span className="small" style={{ color: 'var(--warning)' }}>{blockedReason}</span> : null}
        <button className="btn btn-ghost" onClick={reset} disabled={!ops.length}>
          Discard draft
        </button>
        <button className="btn btn-primary" onClick={() => void apply()} disabled={!canApply || busy || !ops.length || !!preview?.errors.length || !!previewError}>
          {busy ? 'Applying…' : 'Apply changes'}
        </button>
      </div>
    </Drawer>
  );
}
