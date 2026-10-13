import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, FileSpreadsheet, Link2, Plus, Save, Search, Send, Settings2, Trash2, Unlink } from 'lucide-react';
import { api, ApiError, errorText } from '../lib/api.ts';
import { linkTo } from '../lib/router.ts';
import { localId } from '../lib/ids.ts';
import { useLiveShow, useTick } from '../lib/useLiveShow.ts';
import { AppHeader } from '../components/AppHeader.tsx';
import { ConnectionIndicator, DeptIcon, DeptLabel, Dialog, Field, ModeBadge, QLinkTag, StaleBanner, useToast } from '../components/ui.tsx';
import { contentSchema, validateContent } from '../../shared/schemas.ts';
import { ICON_KEYS, slugKey } from '../../shared/calls.ts';
import { computeSchedule, formatClock, formatDuration, formatMinutes, parseClock, parseDuration, sortSegments } from '../../shared/timing.ts';
import type { ChangePreview, Cue, Department, IconKey, Segment, ShowContent } from '../../shared/types.ts';

type Selection = { kind: 'segment' | 'cue'; id: string } | null;

function nextNumber(content: ShowContent, departmentId: string): string {
  const nums = content.cues.filter((c) => c.departmentId === departmentId).map((c) => parseInt(c.number, 10)).filter((n) => !Number.isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return String(n).padStart(3, '0');
}

export function DesignerPage({ showId }: { showId: string }) {
  const { toast } = useToast();
  const live = useLiveShow(showId);
  const now = useTick(5000);
  const s = live.snapshot;
  const [content, setContent] = useState<ShowContent | null>(null);
  const [baseRevision, setBaseRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [draftInfo, setDraftInfo] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);
  const [managingDepts, setManagingDepts] = useState(false);
  const [review, setReview] = useState<ChangePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [awaitRevision, setAwaitRevision] = useState(0);
  const [addingCue, setAddingCue] = useState<string | null>(null);

  // Load: an unpublished draft if present, else the published content.
  useEffect(() => {
    if (!s || content || s.show.revision < awaitRevision) return;
    api<{ draft: { baseRevision: number; content: ShowContent; updatedAt: string; updatedBy: string } | null }>('GET', `/api/shows/${showId}/draft`)
      .then((r) => {
        if (r.draft) {
          setContent(r.draft.content);
          setBaseRevision(r.draft.baseRevision);
          setDraftInfo(`Unpublished draft saved by ${r.draft.updatedBy} at ${formatClock(Date.parse(r.draft.updatedAt), s.show.timezone)}, based on revision ${r.draft.baseRevision}.`);
        } else {
          setContent(structuredClone(s.content));
          setBaseRevision(s.show.revision);
        }
      })
      .catch((e) => toast('error', errorText(e)));
  }, [s, content, showId, toast, awaitRevision]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (fn: (c: ShowContent) => void) => {
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const errors = useMemo(() => {
    if (!content) return [];
    const parsed = contentSchema.safeParse(content);
    const out = parsed.success ? [] : parsed.error.issues.map((i) => describeIssue(content, i.path, i.message));
    return [...new Set([...out, ...validateContent(content)])];
  }, [content]);

  const badCues = useMemo(() => {
    const bad = new Set<string>();
    if (!content) return bad;
    const seen = new Map<string, string>();
    for (const c of content.cues) {
      if (!c.instruction.trim() || !c.number.trim()) bad.add(c.id);
      const k = `${c.departmentId}|${c.number.toLowerCase()}`;
      if (seen.has(k)) {
        bad.add(c.id);
        bad.add(seen.get(k)!);
      }
      seen.set(k, c.id);
    }
    return bad;
  }, [content]);

  const schedule = useMemo(() => {
    if (!content || !s) return null;
    try {
      return computeSchedule({ content, eventDate: s.show.eventDate, plannedStart: s.show.plannedStart, timezone: s.show.timezone, session: null, segmentLive: [], cueStates: [], now });
    } catch {
      return null;
    }
  }, [content, s, now]);

  if (!s || !content) {
    return (
      <div className="app-root theme-director theme-designer">
        <AppHeader />
        <main id="main" className="page" aria-busy="true">
          {live.error ? <div className="banner banner-error">{live.error}</div> : <p className="muted">Loading Show Designer…</p>}
        </main>
      </div>
    );
  }

  const canEdit = s.me.role === 'owner' || s.me.role === 'director';
  const liveMode = !!s.session;
  const tz = s.show.timezone;
  const segments = sortSegments(content.segments);
  const deptById = new Map(content.departments.map((d) => [d.id, d]));
  const groupById = new Map(content.groups.map((g) => [g.id, g]));
  const q = query.trim().toLowerCase();
  const cueVisible = (c: Cue) =>
    (!deptFilter.length || deptFilter.includes(c.departmentId)) &&
    (!q || c.instruction.toLowerCase().includes(q) || c.number.toLowerCase().includes(q) || (deptById.get(c.departmentId)?.name.toLowerCase().includes(q) ?? false));
  const cuesOf = (segId: string) => content.cues.filter((c) => c.segmentId === segId).sort((a, b) => a.offsetSec - b.offsetSec || a.position - b.position);
  const behind = s.show.revision !== baseRevision;

  const addSegment = () => {
    const id = localId('seg');
    update((c) => {
      c.segments.push({ id, position: c.segments.length, title: 'New segment', performer: '', durationSec: 300, fixedTime: null, notes: '' });
    });
    setSel({ kind: 'segment', id });
  };

  const addCue = () => {
    const segId = sel?.kind === 'segment' ? sel.id : sel?.kind === 'cue' ? content.cues.find((x) => x.id === sel.id)?.segmentId : segments[segments.length - 1]?.id;
    if (!segId) {
      toast('info', 'Add a segment first.');
      return;
    }
    if (!content.departments.length) {
      toast('info', 'Add a department first.');
      return;
    }
    setAddingCue(segId);
  };

  const createCues = (segId: string, deptIds: string[], number: string, link: boolean) => {
    const ids = deptIds.map(() => localId('cue'));
    update((c) => {
      const seg = c.segments.find((x) => x.id === segId);
      const gid = link && deptIds.length > 1 ? localId('grp') : null;
      if (gid) c.groups.push({ id: gid, label: `${number} ${seg?.title ?? 'Cue'}`.slice(0, 120), segmentId: segId });
      deptIds.forEach((departmentId, i) => {
        c.cues.push({ id: ids[i], segmentId: segId, position: c.cues.length, number, departmentId, instruction: '', owner: '', offsetSec: 0, durationSec: 0, groupId: gid, target: null });
      });
    });
    setAddingCue(null);
    setSel({ kind: 'cue', id: ids[0] });
    toast('info', `Added cue ${number} for ${deptIds.length} department${deptIds.length > 1 ? 's' : ''}. Fill in each instruction.`);
  };

  const moveSegment = (id: string, dir: -1 | 1) =>
    update((c) => {
      const ordered = sortSegments(c.segments);
      const i = ordered.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= ordered.length) return;
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      ordered.forEach((x, k) => (c.segments.find((y) => y.id === x.id)!.position = k));
    });

  const moveCue = (id: string, dir: -1 | 1) =>
    update((c) => {
      const cue = c.cues.find((x) => x.id === id)!;
      const siblings = c.cues.filter((x) => x.segmentId === cue.segmentId).sort((a, b) => a.offsetSec - b.offsetSec || a.position - b.position);
      const i = siblings.findIndex((x) => x.id === id);
      const other = siblings[i + dir];
      if (!other) return;
      // Swap order; keep times consistent by swapping offsets when they differ.
      [cue.position, other.position] = [other.position, cue.position];
      if (cue.offsetSec !== other.offsetSec) [cue.offsetSec, other.offsetSec] = [other.offsetSec, cue.offsetSec];
    });

  const duplicateSegment = (id: string) =>
    update((c) => {
      const seg = c.segments.find((x) => x.id === id)!;
      const nid = localId('seg');
      for (const x of c.segments) if (x.position > seg.position) x.position++;
      c.segments.push({ ...seg, id: nid, title: `${seg.title} (copy)`, position: seg.position + 1 });
      const groupMap = new Map<string, string>();
      for (const cue of c.cues.filter((x) => x.segmentId === id)) {
        let gid: string | null = null;
        if (cue.groupId) {
          gid = groupMap.get(cue.groupId) ?? localId('grp');
          if (!groupMap.has(cue.groupId)) {
            groupMap.set(cue.groupId, gid);
            c.groups.push({ id: gid, label: `${c.groups.find((g) => g.id === cue.groupId)?.label ?? 'Q-Link'} (copy)`, segmentId: nid });
          }
        }
        c.cues.push({ ...cue, id: localId('cue'), segmentId: nid, number: nextNumber(c, cue.departmentId), groupId: gid, position: c.cues.length });
      }
    });

  const deleteSegment = (id: string) => {
    const n = content.cues.filter((c) => c.segmentId === id).length;
    if (n && !window.confirm(`Delete this segment and its ${n} cue${n > 1 ? 's' : ''}?`)) return;
    update((c) => {
      c.segments = c.segments.filter((x) => x.id !== id);
      c.cues = c.cues.filter((x) => x.segmentId !== id);
    });
    setSel(null);
  };

  const duplicateCue = (id: string) => {
    const nid = localId('cue');
    update((c) => {
      const cue = c.cues.find((x) => x.id === id)!;
      c.cues.push({ ...cue, id: nid, number: nextNumber(c, cue.departmentId), groupId: null, position: c.cues.length });
    });
    setSel({ kind: 'cue', id: nid });
  };

  const deleteCue = (id: string) => {
    update((c) => {
      c.cues = c.cues.filter((x) => x.id !== id);
    });
    setSel(null);
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      await api('PUT', `/api/shows/${showId}/draft`, { baseRevision, content });
      setDirty(false);
      setDraftInfo(`Draft saved at ${formatClock(Date.now(), tz)} (not published).`);
      toast('ok', 'Draft saved. Crew still see the published running order.');
    } catch (e) {
      toast('error', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const openReview = async () => {
    setBusy(true);
    setConflict(null);
    try {
      const r = await api<{ preview: ChangePreview }>('PUT', `/api/shows/${showId}/content`, { baseRevision, content, dryRun: true });
      setReview(r.preview);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'revision_conflict') setConflict(e.message);
      else toast('error', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      const r = await api<{ applied: boolean; revision: number; preview: ChangePreview }>('PUT', `/api/shows/${showId}/content`, { baseRevision, content, dryRun: false });
      setReview(null);
      if (r.applied) {
        toast('ok', `Published revision ${r.revision}: ${r.preview.summary}`);
        setBaseRevision(r.revision);
        setDirty(false);
        setDraftInfo(null);
        setAwaitRevision(r.revision);
        setContent(null); // reload the normalised published version once it arrives
      } else toast('info', 'Nothing changed.');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'revision_conflict') {
        setReview(null);
        setConflict(e.message);
      } else toast('error', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const loadPublished = async () => {
    if (dirty && !window.confirm('Discard your unpublished changes and load the latest published running order?')) return;
    await api('DELETE', `/api/shows/${showId}/draft`).catch(() => {});
    setContent(structuredClone(s.content));
    setBaseRevision(s.show.revision);
    setDirty(false);
    setDraftInfo(null);
    setConflict(null);
    setSel(null);
  };

  const selCue = sel?.kind === 'cue' ? content.cues.find((c) => c.id === sel.id) : undefined;
  const selSeg = sel?.kind === 'segment' ? content.segments.find((x) => x.id === sel.id) : undefined;
  const checkedCues = content.cues.filter((c) => checked.includes(c.id));

  return (
    <div className="app-root theme-director theme-designer">
      <AppHeader>
        <span className="header-divider hide-phone" />
        <div className="identity">
          <div style={{ minWidth: 0 }}>
            <div className="identity-label">Show Designer</div>
            <div className="identity-sub">
              {s.show.title} · {s.show.eventDate} · {s.show.plannedStart} {tz}
            </div>
          </div>
        </div>
        <ModeBadge mode={s.session?.mode ?? null} />
        <ConnectionIndicator conn={live.conn} lastSync={live.lastSync} revision={live.revision} tz={tz} now={Date.now()} />
      </AppHeader>
      <main id="main" className="stack" style={{ gap: 12, paddingTop: 12 }}>
        <div className="stack" style={{ padding: '0 24px', gap: 8 }}>
          <StaleBanner conn={live.conn} revision={live.revision} lastSync={live.lastSync} tz={tz} />
          {liveMode ? (
            <div className="banner banner-reconnecting" role="status">
              <span className="grow">
                <b>Live session running — you are editing a draft.</b> Nothing changes for the crew until you review and Apply Changes, which publishes one revision. Issued cues cannot be deleted.
              </span>
            </div>
          ) : null}
          {draftInfo ? (
            <div className="banner banner-info">
              <span className="grow">{draftInfo}</span>
              <button className="btn btn-sm" onClick={() => void loadPublished()}>
                Load latest published
              </button>
            </div>
          ) : null}
          {behind ? (
            <div className="banner banner-reconnecting" role="status">
              <span className="grow">
                The published show is now revision {s.show.revision}; you are editing from revision {baseRevision}. Publishing will be refused until you load the latest version.
              </span>
              <button className="btn btn-sm" onClick={() => void loadPublished()}>
                Load revision {s.show.revision}
              </button>
            </div>
          ) : null}
          {conflict ? <div className="banner banner-error" role="alert">{conflict}</div> : null}
          {!canEdit ? <div className="banner banner-info">You can view the running order, but only the owner or a Director can edit it.</div> : null}
        </div>

        <div className="toolbar" role="toolbar" aria-label="Show Designer">
          <button className="btn btn-sm" onClick={addSegment} disabled={!canEdit}>
            <Plus /> Add segment
          </button>
          <button className="btn btn-sm" onClick={addCue} disabled={!canEdit}>
            <Plus /> Add cue
          </button>
          <a className="btn btn-sm" href={`/shows/${showId}/import`} onClick={linkTo(`/shows/${showId}/import`)}>
            <FileSpreadsheet /> Import
          </a>
          <label className="row" style={{ gap: 6 }}>
            <Search width={18} aria-hidden />
            <span className="sr-only">Search cues</span>
            <input className="input input-sm" placeholder="Search cues" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 180 }} />
          </label>
          <div className="segmented" role="group" aria-label="Department filter">
            <button aria-pressed={deptFilter.length === 0} onClick={() => setDeptFilter([])}>
              All
            </button>
            {content.departments.map((d) => (
              <button key={d.id} aria-pressed={deptFilter.includes(d.id)} onClick={() => setDeptFilter(deptFilter.includes(d.id) ? deptFilter.filter((x) => x !== d.id) : [...deptFilter, d.id])}>
                <DeptIcon icon={d.icon} size={16} /> {d.name}
              </button>
            ))}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setManagingDepts(true)} disabled={!canEdit}>
            <Settings2 /> Departments
          </button>
          <span className="grow" />
          <button className="btn btn-sm" onClick={() => setLinking(true)} disabled={!canEdit || checkedCues.length < 1}>
            <Link2 /> Q-Link ({checkedCues.length})
          </button>
          <button className="btn btn-sm" onClick={() => void saveDraft()} disabled={!canEdit || busy || !dirty || live.conn !== 'connected'}>
            <Save /> Save draft
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => void openReview()} disabled={!canEdit || busy || errors.length > 0 || live.conn !== 'connected'} title={errors.length ? 'Fix the listed problems first' : undefined}>
            <Send /> {liveMode ? 'Apply changes…' : 'Publish…'}
          </button>
        </div>

        <div className="designer">
          <section aria-label="Running order">
            {errors.length ? (
              <div className="banner banner-error" role="alert" style={{ marginBottom: 12 }}>
                <div className="grow">
                  <p>{errors.length} problem{errors.length > 1 ? 's' : ''} to fix before publishing:</p>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontWeight: 500 }}>
                    {errors.slice(0, 8).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            {segments.length === 0 ? (
              <div className="empty stack">
                <h2>Empty running order</h2>
                <p>Add a segment, then add department cues to it — or import a spreadsheet.</p>
              </div>
            ) : null}
            {segments.map((seg, i) => {
              const t = schedule?.segments.get(seg.id);
              const cues = cuesOf(seg.id).filter(cueVisible);
              if ((q || deptFilter.length) && cues.length === 0) return null;
              return (
                <article key={seg.id} className={`designer-seg ${sel?.id === seg.id ? 'selected' : ''}`} aria-label={`Segment ${i + 1}: ${seg.title}`}>
                  <header>
                    <button className="btn btn-ghost btn-sm" style={{ fontWeight: 750 }} onClick={() => setSel({ kind: 'segment', id: seg.id })} aria-label={`Edit segment ${seg.title}`}>
                      {i + 1}. {seg.title}
                    </button>
                    {seg.performer ? <span className="muted">{seg.performer}</span> : null}
                    <span className="tabular muted">
                      {t ? formatClock(t.plannedStart, tz, false) : '--:--'} · {formatMinutes(seg.durationSec)}
                    </span>
                    {seg.fixedTime ? <span className="chip chip-neutral">Fixed {seg.fixedTime}</span> : null}
                    {t?.conflict ? <span className="conflict small">Overlaps preceding items</span> : null}
                    <span className="grow" />
                    {canEdit ? (
                      <span className="row" style={{ gap: 4 }}>
                        <button className="btn btn-sm btn-icon btn-ghost" aria-label={`Move ${seg.title} up`} disabled={i === 0} onClick={() => moveSegment(seg.id, -1)}>
                          <ArrowUp />
                        </button>
                        <button className="btn btn-sm btn-icon btn-ghost" aria-label={`Move ${seg.title} down`} disabled={i === segments.length - 1} onClick={() => moveSegment(seg.id, 1)}>
                          <ArrowDown />
                        </button>
                        <button className="btn btn-sm btn-icon btn-ghost" aria-label={`Duplicate ${seg.title}`} onClick={() => duplicateSegment(seg.id)}>
                          <Copy />
                        </button>
                        <button className="btn btn-sm btn-icon btn-ghost" aria-label={`Delete ${seg.title}`} onClick={() => deleteSegment(seg.id)}>
                          <Trash2 />
                        </button>
                      </span>
                    ) : null}
                  </header>
                  {cues.length === 0 ? <p className="muted small" style={{ padding: '8px 12px' }}>No cues yet.</p> : null}
                  {cues.map((c) => {
                    const d = deptById.get(c.departmentId);
                    const g = c.groupId ? groupById.get(c.groupId) : null;
                    const ct = schedule?.cues.get(c.id);
                    return (
                      <div
                        key={c.id}
                        className={`dcue ${sel?.id === c.id ? 'selected' : ''} ${g ? 'linked' : ''} ${badCues.has(c.id) ? 'cell-err' : ''}`}
                        onClick={() => setSel({ kind: 'cue', id: c.id })}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select cue ${c.number} for Q-Link`}
                          checked={checked.includes(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setChecked(e.target.checked ? [...checked, c.id] : checked.filter((x) => x !== c.id))}
                          disabled={!canEdit}
                        />
                        <button className="num" style={{ all: 'unset', cursor: 'pointer', fontWeight: 750 }} onClick={() => setSel({ kind: 'cue', id: c.id })} aria-label={`Edit cue ${c.number} ${d?.name ?? ''}`}>
                          {c.number || '—'}
                        </button>
                        <span className="tabular dcue-time">{ct ? formatClock(ct.planned, tz, false) : ''}</span>
                        <span className="dcue-dept">
                          <DeptLabel dept={d} size={14} />
                        </span>
                        <span className="instr">
                          {c.instruction || <i className="field-error">Instruction required</i>}
                          {g ? (
                            <div>
                              <QLinkTag label={g.label} />
                            </div>
                          ) : null}
                        </span>
                        {canEdit ? (
                          <span className="row hide-phone" style={{ gap: 2 }}>
                            <button className="btn btn-sm btn-icon btn-ghost" aria-label={`Move cue ${c.number} earlier`} onClick={(e) => (e.stopPropagation(), moveCue(c.id, -1))}>
                              <ArrowUp />
                            </button>
                            <button className="btn btn-sm btn-icon btn-ghost" aria-label={`Move cue ${c.number} later`} onClick={(e) => (e.stopPropagation(), moveCue(c.id, 1))}>
                              <ArrowDown />
                            </button>
                          </span>
                        ) : (
                          <span />
                        )}
                      </div>
                    );
                  })}
                </article>
              );
            })}
          </section>

          <aside className="designer-side panel pad stack" aria-label="Details">
            {selCue ? (
              <CueEditor
                key={selCue.id}
                cue={selCue}
                content={content}
                canEdit={canEdit}
                segStart={schedule?.segments.get(selCue.segmentId)?.plannedStart ?? null}
                tz={tz}
                onChange={(patch) => update((c) => Object.assign(c.cues.find((x) => x.id === selCue.id)!, patch))}
                onDuplicate={() => duplicateCue(selCue.id)}
                onDelete={() => deleteCue(selCue.id)}
                onUnlink={() =>
                  update((c) => {
                    c.cues.find((x) => x.id === selCue.id)!.groupId = null;
                  })
                }
              />
            ) : selSeg ? (
              <SegmentEditor key={selSeg.id} seg={selSeg} canEdit={canEdit} onChange={(patch) => update((c) => Object.assign(c.segments.find((x) => x.id === selSeg.id)!, patch))} />
            ) : (
              <div className="stack">
                <h2>Details</h2>
                <p className="muted">Select a segment or cue to edit its full details. Tick cues across departments, then choose Q-Link to bind them to one Director call.</p>
                <p className="small muted">Revision {s.show.revision} published{dirty ? ' · you have unsaved changes' : ''}.</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {addingCue ? (
        <AddCueDialog content={content} segmentId={addingCue} onClose={() => setAddingCue(null)} onCreate={createCues} />
      ) : null}
      {linking ? (
        <QLinkDialog
          cues={checkedCues}
          content={content}
          onClose={() => setLinking(false)}
          onLink={(label) => {
            const gid = localId('grp');
            update((c) => {
              c.groups.push({ id: gid, label, segmentId: checkedCues[0]?.segmentId ?? null });
              for (const cue of c.cues) if (checked.includes(cue.id)) cue.groupId = gid;
            });
            setChecked([]);
            setLinking(false);
          }}
          onIndependent={() => {
            update((c) => {
              for (const cue of c.cues) if (checked.includes(cue.id)) cue.groupId = null;
            });
            setChecked([]);
            setLinking(false);
          }}
        />
      ) : null}
      {managingDepts ? <DepartmentsDialog content={content} onClose={() => setManagingDepts(false)} onChange={(departments) => update((c) => void (c.departments = departments))} /> : null}
      {review ? (
        <Dialog title={liveMode ? 'Review and apply changes' : 'Review and publish'} onClose={() => setReview(null)} wide>
          <div className="stack">
            <p>
              <b>{review.summary}</b>
            </p>
            <p className="muted">
              {review.changes.length} change{review.changes.length === 1 ? '' : 's'} · {review.affectedCueIds.length} cue{review.affectedCueIds.length === 1 ? '' : 's'} affected · departments:{' '}
              {review.affectedDepartmentIds.map((id) => deptById.get(id)?.name).filter(Boolean).join(', ') || 'none'}
            </p>
            {review.timingNotes.length ? (
              <ul className="small tabular" style={{ margin: 0, paddingLeft: 18 }}>
                {review.timingNotes.slice(0, 15).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <div className="table-scroll" style={{ maxHeight: 260 }}>
              <table className="grid-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {review.changes.slice(0, 200).map((ch) => (
                    <tr key={`${ch.kind}-${ch.id}`}>
                      <td>{ch.label}</td>
                      <td>{ch.before === null ? 'Added' : ch.after === null ? 'Removed' : 'Changed'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {review.errors.map((e) => (
              <p key={e} className="field-error">
                {e}
              </p>
            ))}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setReview(null)}>
                Keep editing
              </button>
              <button className="btn btn-primary" onClick={() => void publish()} disabled={busy || review.errors.length > 0 || review.changes.length === 0}>
                {liveMode ? 'Apply changes' : 'Publish'} as revision {s.show.revision + 1}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function describeIssue(content: ShowContent, path: PropertyKey[], message: string): string {
  const [list, idx] = path as [keyof ShowContent, number];
  const item = (content[list] as unknown[])?.[idx] as { number?: string; title?: string; name?: string; label?: string } | undefined;
  const name = item?.number ? `Cue ${item.number}` : item?.title ?? item?.name ?? item?.label ?? String(list);
  return `${name}: ${message}`;
}

function CueEditor({
  cue,
  content,
  canEdit,
  segStart,
  tz,
  onChange,
  onDuplicate,
  onDelete,
  onUnlink,
}: {
  cue: Cue;
  content: ShowContent;
  canEdit: boolean;
  segStart: number | null;
  tz: string;
  onChange: (patch: Partial<Cue>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUnlink: () => void;
}) {
  const [timeText, setTimeText] = useState(segStart !== null ? formatClock(segStart + cue.offsetSec * 1000, tz, false) : '');
  const [timeErr, setTimeErr] = useState<string | null>(null);
  const [durText, setDurText] = useState(formatDuration(cue.durationSec));
  const group = cue.groupId ? content.groups.find((g) => g.id === cue.groupId) : null;
  const dup = content.cues.some((c) => c.id !== cue.id && c.departmentId === cue.departmentId && c.number.toLowerCase() === cue.number.toLowerCase());
  const applyTime = () => {
    const t = parseClock(timeText);
    if (!t || segStart === null) {
      setTimeErr('Use 24-hour HH:MM.');
      return;
    }
    const segLocal = parseClock(formatClock(segStart, tz))!;
    let off = t.h * 3600 + t.m * 60 + t.s - (segLocal.h * 3600 + segLocal.m * 60 + segLocal.s);
    if (off < 0) {
      setTimeErr(`Cue time is before the segment starts (${formatClock(segStart, tz, false)}).`);
      return;
    }
    setTimeErr(null);
    onChange({ offsetSec: off });
  };
  return (
    <fieldset disabled={!canEdit} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <h2>Cue {cue.number}</h2>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Cue number" error={!cue.number.trim() ? 'Required.' : dup ? 'Already used in this department.' : null}>
          <input className="input tabular" value={cue.number} onChange={(e) => onChange({ number: e.target.value })} aria-invalid={!cue.number.trim() || dup} />
        </Field>
        <Field label="Cue time" error={timeErr}>
          <input className="input tabular" value={timeText} onChange={(e) => setTimeText(e.target.value)} onBlur={applyTime} aria-invalid={!!timeErr} />
        </Field>
      </div>
      <Field label="Department">
        <select className="input" value={cue.departmentId} onChange={(e) => onChange({ departmentId: e.target.value })}>
          {content.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Instruction" error={!cue.instruction.trim() ? 'Required — this is what the operator reads.' : null}>
        <textarea className="input" value={cue.instruction} onChange={(e) => onChange({ instruction: e.target.value })} aria-invalid={!cue.instruction.trim()} rows={4} />
      </Field>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Owner / operator">
          <input className="input" value={cue.owner} onChange={(e) => onChange({ owner: e.target.value })} />
        </Field>
        <Field label="Est. duration">
          <input
            className="input tabular"
            value={durText}
            onChange={(e) => setDurText(e.target.value)}
            onBlur={() => {
              const v = parseDuration(durText);
              if (v !== null) onChange({ durationSec: v });
              else setDurText(formatDuration(cue.durationSec));
            }}
          />
        </Field>
      </div>
      <Field label="Segment">
        <select className="input" value={cue.segmentId} onChange={(e) => onChange({ segmentId: e.target.value })}>
          {sortSegments(content.segments).map((sg) => (
            <option key={sg.id} value={sg.id}>
              {sg.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="raised pad-sm stack" style={{ gap: 6 }}>
        <span className="field">Q-Link</span>
        {group ? (
          <>
            <QLinkTag label={group.label} />
            <p className="small muted">
              Called together with:{' '}
              {content.cues
                .filter((c) => c.groupId === group.id && c.id !== cue.id)
                .map((c) => `${content.departments.find((d) => d.id === c.departmentId)?.name} ${c.number}`)
                .join(', ') || 'no other cues'}
            </p>
            <button className="btn btn-sm" onClick={onUnlink}>
              <Unlink /> Make independent
            </button>
          </>
        ) : (
          <p className="small muted">Independent cue — the Director calls it on its own.</p>
        )}
      </div>
      <div className="row-wrap">
        <button className="btn btn-sm" onClick={onDuplicate}>
          <Copy /> Duplicate
        </button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>
          <Trash2 /> Delete cue
        </button>
      </div>
    </fieldset>
  );
}

function SegmentEditor({ seg, canEdit, onChange }: { seg: Segment; canEdit: boolean; onChange: (patch: Partial<Segment>) => void }) {
  const [dur, setDur] = useState(formatDuration(seg.durationSec));
  const [durErr, setDurErr] = useState<string | null>(null);
  const [fixed, setFixed] = useState(seg.fixedTime ?? '');
  const [fixedErr, setFixedErr] = useState<string | null>(null);
  return (
    <fieldset disabled={!canEdit} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <h2>Segment</h2>
      <Field label="Title" error={!seg.title.trim() ? 'Required.' : null}>
        <input className="input" value={seg.title} onChange={(e) => onChange({ title: e.target.value })} aria-invalid={!seg.title.trim()} />
      </Field>
      <Field label="Speaker / performer">
        <input className="input" value={seg.performer} onChange={(e) => onChange({ performer: e.target.value })} />
      </Field>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Estimated duration" error={durErr} hint="Minutes or MM:SS">
          <input
            className="input tabular"
            value={dur}
            onChange={(e) => setDur(e.target.value)}
            onBlur={() => {
              const v = parseDuration(dur);
              if (v === null) setDurErr('Use minutes (5) or MM:SS (05:00).');
              else {
                setDurErr(null);
                onChange({ durationSec: v });
                setDur(formatDuration(v));
              }
            }}
          />
        </Field>
        <Field label="Fixed start (optional)" error={fixedErr} hint="Never shifted by delays">
          <input
            className="input tabular"
            value={fixed}
            placeholder="HH:MM"
            onChange={(e) => setFixed(e.target.value)}
            onBlur={() => {
              if (!fixed.trim()) {
                setFixedErr(null);
                onChange({ fixedTime: null });
              } else if (!parseClock(fixed)) setFixedErr('Use 24-hour HH:MM.');
              else {
                setFixedErr(null);
                onChange({ fixedTime: fixed.trim() });
              }
            }}
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="input" value={seg.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Field>
    </fieldset>
  );
}

function QLinkDialog({ cues, content, onClose, onLink, onIndependent }: { cues: Cue[]; content: ShowContent; onClose: () => void; onLink: (label: string) => void; onIndependent: () => void }) {
  const segTitle = content.segments.find((x) => x.id === cues[0]?.segmentId)?.title ?? '';
  const [mode, setMode] = useState<'group' | 'independent'>('group');
  const [label, setLabel] = useState(segTitle ? `${segTitle}` : 'Q-Link');
  const deptName = (id: string) => content.departments.find((d) => d.id === id)?.name ?? '?';
  const depts = cues.map((c) => c.departmentId);
  const dupDept = depts.find((d, i) => depts.indexOf(d) !== i);
  return (
    <Dialog title="Q-Link" onClose={onClose}>
      <div className="stack">
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Calling mode</legend>
          <label className="checkbox">
            <input type="radio" checked={mode === 'group'} onChange={() => setMode('group')} /> Linked — one Director call issues all of these
          </label>
          <label className="checkbox">
            <input type="radio" checked={mode === 'independent'} onChange={() => setMode('independent')} /> Independent — each cue is called on its own
          </label>
        </fieldset>
        {mode === 'group' ? (
          <Field label="Group label" error={!label.trim() ? 'Required.' : null}>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} data-autofocus />
          </Field>
        ) : null}
        <div className="raised pad-sm stack" style={{ gap: 6 }}>
          <span className="field">{mode === 'group' ? 'Linked preview' : 'These cues become independent'}</span>
          {mode === 'group' ? <QLinkTag label={label || '…'} /> : null}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {cues.map((c) => (
              <li key={c.id}>
                {deptName(c.departmentId)} {c.number}: {c.instruction || <i>no instruction</i>}
              </li>
            ))}
          </ul>
          <p className="small muted">Cue ids and instructions are kept exactly as they are.</p>
        </div>
        {mode === 'group' && dupDept ? <p className="field-error">Two selected cues belong to {deptName(dupDept)}. A Q-Link can include one cue per department.</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {mode === 'group' ? (
            <button className="btn btn-primary" disabled={!label.trim() || !!dupDept || cues.length < 2} onClick={() => onLink(label.trim())}>
              <Link2 /> Link {cues.length} cues
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onIndependent}>
              Make independent
            </button>
          )}
        </div>
        {mode === 'group' && cues.length < 2 ? <p className="small muted">Select at least two cues to link.</p> : null}
      </div>
    </Dialog>
  );
}

function DepartmentsDialog({ content, onClose, onChange }: { content: ShowContent; onClose: () => void; onChange: (d: Department[]) => void }) {
  const [list, setList] = useState(content.departments.map((d) => ({ ...d })));
  const [name, setName] = useState('');
  const used = (id: string) => content.cues.filter((c) => c.departmentId === id).length;
  const set = (i: number, patch: Partial<Department>) => setList(list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <Dialog title="Departments" onClose={onClose}>
      <div className="stack">
        {list.map((d, i) => (
          <div key={d.id} className="row">
            <DeptIcon icon={d.icon} />
            <input className="input input-sm grow" aria-label="Department name" value={d.name} onChange={(e) => set(i, { name: e.target.value })} />
            <select className="input input-sm" aria-label={`${d.name} icon`} value={d.icon} onChange={(e) => set(i, { icon: e.target.value as IconKey })}>
              {ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm btn-icon btn-ghost"
              aria-label={`Remove ${d.name}`}
              disabled={used(d.id) > 0}
              title={used(d.id) ? `${used(d.id)} cues use this department` : undefined}
              onClick={() => setList(list.filter((x) => x.id !== d.id))}
            >
              <Trash2 />
            </button>
          </div>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            let key = slugKey(name);
            while (list.some((d) => d.key === key)) key = `${key}-2`;
            setList([...list, { id: localId('dep'), key, name: name.trim(), icon: 'generic', sort: list.length }]);
            setName('');
          }}
        >
          <input className="input input-sm grow" placeholder="Add a custom department" value={name} onChange={(e) => setName(e.target.value)} aria-label="New department name" />
          <button className="btn btn-sm">
            <Plus /> Add
          </button>
        </form>
        <p className="small muted">Departments with cues cannot be removed. Changes are part of your draft until published.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onChange(list.map((d, i) => ({ ...d, sort: i })));
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function AddCueDialog({
  content,
  segmentId,
  onClose,
  onCreate,
}: {
  content: ShowContent;
  segmentId: string;
  onClose: () => void;
  onCreate: (segmentId: string, deptIds: string[], number: string, link: boolean) => void;
}) {
  const [segId, setSegId] = useState(segmentId);
  const [chosen, setChosen] = useState<string[]>([]);
  const [link, setLink] = useState(true);
  const suggested = (ids: string[]) => {
    const nums = content.cues.filter((c) => !ids.length || ids.includes(c.departmentId)).map((c) => parseInt(c.number, 10)).filter((n) => !Number.isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  };
  const [number, setNumber] = useState(() => suggested([]));
  const [numberEdited, setNumberEdited] = useState(false);
  const all = content.departments.map((d) => d.id);
  const allOn = chosen.length === all.length;
  const choose = (ids: string[]) => {
    setChosen(ids);
    if (!numberEdited) setNumber(suggested(ids));
  };
  const clash = chosen
    .filter((id) => content.cues.some((c) => c.departmentId === id && c.number.toLowerCase() === number.trim().toLowerCase()))
    .map((id) => content.departments.find((d) => d.id === id)?.name);
  return (
    <Dialog title="Add cue" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (chosen.length && number.trim() && !clash.length) onCreate(segId, all.filter((id) => chosen.includes(id)), number.trim(), link);
        }}
      >
        <div className="spread">
          <span className="field">Which departments are in this cue?</span>
          <button type="button" className={`btn btn-sm ${allOn ? 'btn-primary' : ''}`} aria-pressed={allOn} onClick={() => choose(allOn ? [] : all)} data-autofocus>
            ALL
          </button>
        </div>
        <div className="dept-picker" role="group" aria-label="Departments in this cue">
          {content.departments.map((d) => {
            const on = chosen.includes(d.id);
            return (
              <button type="button" key={d.id} className="dept-toggle" aria-pressed={on} onClick={() => choose(on ? chosen.filter((x) => x !== d.id) : [...chosen, d.id])}>
                <span className="tick" aria-hidden>
                  {on ? '✓' : ''}
                </span>
                <DeptIcon icon={d.icon} /> {d.name}
              </button>
            );
          })}
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <Field label="Cue number" error={!number.trim() ? 'Required.' : clash.length ? `Already used in ${clash.join(', ')}.` : null}>
            <input
              className="input tabular"
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setNumberEdited(true);
              }}
              aria-invalid={!number.trim() || clash.length > 0}
            />
          </Field>
          <Field label="Segment">
            <select className="input" value={segId} onChange={(e) => setSegId(e.target.value)}>
              {sortSegments(content.segments).map((sg) => (
                <option key={sg.id} value={sg.id}>
                  {sg.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {chosen.length > 1 ? (
          <label className="checkbox">
            <input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} /> Link as one Q-Link call (the Director issues all {chosen.length} together)
          </label>
        ) : null}
        <p className="small muted">One cue is created per department with the same number. You then write each department's instruction in the details panel.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!chosen.length || !number.trim() || clash.length > 0}>
            <Plus /> Add cue{chosen.length > 1 ? ` for ${chosen.length} departments` : ''}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
