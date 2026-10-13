// Director running order: one row per call (Q-Link group or independent cue),
// grouped under segment headings. Clicking a row arms it as the calling target;
// it never issues anything by itself.

import { Fragment } from 'react';
import type { Call } from '../../shared/calls.ts';
import { formatClock, formatDelta } from '../../shared/timing.ts';
import type { Snapshot } from '../../shared/types.ts';
import { callTime, type ShowModel } from '../lib/model.ts';
import { DeptIcon, deptVars, QLinkTag, ReadinessChip, StatusChip } from './ui.tsx';
import { callScript } from '../../shared/script.ts';

export type Preset = 'full' | 'current' | 'compact' | 'expanded';

export function visibleCalls(model: ShowModel, preset: Preset, deptFilter: string[]): Call[] {
  let calls = model.calls;
  if (deptFilter.length) {
    calls = calls.filter((c) => c.cueIds.some((id) => deptFilter.includes(model.cueById.get(id)?.departmentId ?? '')));
  }
  if (preset === 'current') {
    const nextIdx = model.next ? calls.findIndex((c) => c.id === model.next!.id) : calls.length;
    const lastIdx = model.last ? calls.findIndex((c) => c.id === model.last!.id) : -1;
    const start = Math.max(0, Math.min(lastIdx >= 0 ? lastIdx : nextIdx, nextIdx) - 1);
    calls = calls.slice(start, Math.max(start, nextIdx) + 5);
  }
  return calls;
}

export function RunningOrder({
  s,
  model,
  calls,
  preset,
  deptFilter,
  armedId,
  onArm,
  changed,
  showScript = true,
  layout = 'consolidated',
}: {
  showScript?: boolean;
  /** consolidated: one description column; columns: one column per department. */
  layout?: 'consolidated' | 'columns';
  s: Snapshot;
  model: ShowModel;
  calls: Call[];
  preset: Preset;
  deptFilter: string[];
  armedId: string | null;
  onArm: (id: string) => void;
  changed: Set<string>;
}) {
  const tz = s.show.timezone;
  const bySeg = new Map<string, Call[]>();
  for (const c of calls) bySeg.set(c.segmentId, [...(bySeg.get(c.segmentId) ?? []), c]);
  const currentId = model.last && model.stateOfCall(model.last) === 'called' ? model.last.id : null;
  const nextId = model.next?.id ?? null;
  const columns = layout === 'columns' ? s.content.departments.filter((d) => !deptFilter.length || deptFilter.includes(d.id)) : [];
  const span = (showScript ? 1 : 0) + 3 + (layout === 'columns' ? columns.length : 1);

  return (
    <table className={`ro ${layout === 'columns' ? 'ro-columns' : ''}`}>
      <caption className="sr-only">Running order. Select a row to arm it as the calling target.</caption>
      <thead>
        <tr>
          {showScript ? <th scope="col">Call script</th> : null}
          <th scope="col">Cue #</th>
          <th scope="col">Cue time</th>
          {layout === 'columns' ? (
            columns.map((d) => (
              <th key={d.id} scope="col" className="dept-col-head" style={deptVars(d)}>
                <span className="row" style={{ gap: 6 }}>
                  <DeptIcon icon={d.icon} size={16} /> {d.name}
                </span>
              </th>
            ))
          ) : (
            <th scope="col">Cue description</th>
          )}
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {model.segments.map((seg, segIdx) => {
          const segCalls = bySeg.get(seg.id);
          if (!segCalls?.length && (preset === 'current' || deptFilter.length)) return null;
          const t = model.schedule.segments.get(seg.id);
          return (
            <Fragment key={seg.id}>
              <tr className={`seg-row ${changed.has(seg.id) ? 'changed' : ''}`}>
                <td colSpan={span}>
                  <div className="seg-head">
                    <span className="seg-title">
                      {segIdx + 1}. {seg.title}
                    </span>
                    {seg.performer ? <span className="seg-meta">{seg.performer}</span> : null}
                    {t ? (
                      <span className="seg-meta tabular">
                        {t.status === 'done' ? 'Ran' : t.status === 'running' ? 'Started' : 'Est.'} {formatClock(t.estStart, tz, false)}
                        {t.status !== 'done' && Math.abs(t.driftSec) >= 30 ? (
                          <>
                            {' '}
                            · planned {formatClock(t.plannedStart, tz, false)} <span className="delay">({formatDelta(t.driftSec)})</span>
                          </>
                        ) : null}
                        {t.status === 'running' && t.overrunSec > 0 ? <span className="delay"> · running long {formatDelta(t.overrunSec)}</span> : null}
                      </span>
                    ) : null}
                    {seg.fixedTime ? <span className="chip chip-neutral">Fixed {seg.fixedTime}</span> : null}
                    {t?.conflict ? <span className="conflict">Conflict: preceding items now run past this fixed time</span> : null}
                  </div>
                </td>
              </tr>
              {(segCalls ?? []).map((call) => {
                const state = model.stateOfCall(call);
                const time = callTime(model, call);
                const done = !model.isOpen(call) && state !== 'called';
                const cls = [
                  'call-row',
                  done ? 'is-done' : '',
                  call.id === currentId ? 'is-current' : '',
                  call.id === nextId ? 'is-next' : '',
                  call.id === armedId ? 'is-armed' : '',
                  call.cueIds.some((id) => changed.has(id)) ? 'changed' : '',
                ].join(' ');
                const members = call.cueIds.map((id) => model.cueById.get(id)!).filter(Boolean);
                const shownMembers = deptFilter.length ? members.filter((m) => deptFilter.includes(m.departmentId)) : members;
                const ready = model.readinessOfCall(call);
                const script = callScript(call, s.content);
                return (
                  <tr
                    key={call.id}
                    className={cls}
                    onClick={() => onArm(call.id)}
                    data-call-id={call.id}
                  >
                    {showScript ? (
                      <td className="col-script">
                        <CallScriptCell standby={script.standby} go={script.go} state={state} />
                      </td>
                    ) : null}
                    <td className="col-num">
                      <button
                        className="btn-ghost"
                        style={{ all: 'unset', cursor: 'pointer' }}
                        aria-label={`Arm call ${call.number} ${call.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onArm(call.id);
                        }}
                      >
                        {call.number}
                      </button>
                      {layout === 'columns' && call.kind === 'group' ? (
                        <div style={{ fontSize: 13 }}>
                          <QLinkTag label={call.label} />
                        </div>
                      ) : null}
                    </td>
                    <td className="col-time">
                      {time.actual ? (
                        <span title="Called at">{formatClock(time.actual, tz, false)}</span>
                      ) : (
                        <span title={`Planned ${formatClock(time.planned, tz, false)}`}>{formatClock(time.estimated, tz, false)}</span>
                      )}
                    </td>
                    {layout === 'columns' ? (
                      columns.map((d) => {
                        const m = members.find((x) => x.departmentId === d.id);
                        return (
                          <td key={d.id} className={`dept-col ${m ? 'has-cue' : 'no-cue'}`} style={deptVars(d)}>
                            {m ? (
                              <>
                                {m.instruction}
                                {call.kind === 'group' && model.states.get(m.id) && model.stateOfCall(call) === 'mixed' ? (
                                  <div style={{ marginTop: 6 }}>
                                    <StatusChip state={model.states.get(m.id)!.state} />
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <span className="sr-only">No {d.name} cue</span>
                            )}
                          </td>
                        );
                      })
                    ) : (
                    <td className="col-desc">
                      {call.kind === 'group' ? <QLinkTag label={call.label} /> : null}
                      {call.kind === 'cue' ? (
                        <div className="cue-title">
                          <span className="dept-tag" style={{ marginRight: 8, ...deptVars(model.deptById.get(members[0]?.departmentId)) }}>
                            <DeptIcon icon={model.deptById.get(members[0]?.departmentId)?.icon ?? 'generic'} size={14} />
                            {model.deptById.get(members[0]?.departmentId)?.name}
                          </span>
                          {members[0]?.instruction}
                        </div>
                      ) : preset === 'expanded' ? (
                        <div className="dept-cells">
                          {shownMembers.map((m) => {
                            const d = model.deptById.get(m.departmentId);
                            return (
                              <div key={m.id} className="dept-cell" style={deptVars(d)}>
                                <DeptIcon icon={d?.icon ?? 'generic'} />
                                <div>
                                  <div className="dept-name">{d?.name}</div>
                                  <div>{m.instruction}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <div className="dept-tags">
                            {shownMembers.map((m) => {
                              const d = model.deptById.get(m.departmentId);
                              return (
                                <span key={m.id} className="dept-tag" style={deptVars(d)}>
                                  <DeptIcon icon={d?.icon ?? 'generic'} size={14} />
                                  {d?.name}
                                </span>
                              );
                            })}
                          </div>
                          <div className="cue-instr">{shownMembers.map((m) => m.instruction).join(' · ')}</div>
                        </>
                      )}
                      {call.kind === 'cue' && preset !== 'compact' && members[0]?.owner ? <div className="cue-instr">Owner: {members[0].owner}</div> : null}
                    </td>
                    )}
                    <td className="col-status">
                      <div className="stack" style={{ gap: 6 }}>
                        <StatusChip state={state} />
                        {s.session && model.isOpen(call) ? <ReadinessChip value={ready} /> : null}
                        {call.id === armedId ? <span className="chip chip-accent">Armed</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/** Large bold call-script box at the front of each row. The line the Director reads next is emphasised. */
export function CallScriptCell({ standby, go, state, size = 'md' }: { standby: string; go: string; state: string; size?: 'md' | 'lg' }) {
  const next = state === 'pending' || state === 'prepared' ? 'sb' : state === 'standby' || state === 'held' || state === 'mixed' ? 'go' : 'done';
  return (
    <div className={`script-box script-${size} script-${next}`}>
      <span className={`script-line ${next === 'sb' ? 'is-next' : ''}`}>
        <span className="script-tag tag-sb">SB</span>
        <span>{standby}</span>
      </span>
      <span className={`script-line ${next === 'go' ? 'is-next' : ''}`}>
        <span className="script-tag tag-go">GO</span>
        <span>{go}</span>
      </span>
    </div>
  );
}
