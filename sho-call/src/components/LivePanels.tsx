import { Bell, Undo2, X } from 'lucide-react';
import { formatClock } from '../../shared/timing.ts';
import type { ActivityEvent, Snapshot } from '../../shared/types.ts';
import type { ShowModel } from '../lib/model.ts';
import { DeptIcon, deptVars, ReadinessChip } from './ui.tsx';

export function RevisionBanner({ event, onDismiss }: { event: ActivityEvent | null; onDismiss: () => void }) {
  if (!event) return null;
  return (
    <div className="banner banner-revision" role="status">
      <Bell aria-hidden />
      <div className="grow">
        <p>Show updated</p>
        <p>{event.summary}</p>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onDismiss} aria-label="Dismiss update (it stays in Activity)">
        <X />
      </button>
    </div>
  );
}

export function ActivityPanel({
  s,
  onUndo,
  undoDisabled,
  filter,
}: {
  s: Snapshot;
  onUndo?: (revisionId: string) => void;
  undoDisabled?: string | null;
  filter?: (a: ActivityEvent) => boolean;
}) {
  const items = filter ? s.activity.filter(filter) : s.activity;
  return (
    <section className="panel pad-sm side-section" aria-labelledby="act-h">
      <h2 id="act-h">Activity</h2>
      {items.length === 0 ? <p className="muted small">Nothing yet.</p> : null}
      <ul className="activity">
        {items.slice(0, 60).map((a) => (
          <li key={a.seq} className={a.type === 'revision' || a.type === 'undo' ? 'rev-item' : ''}>
            <time dateTime={a.createdAt}>{formatClock(Date.parse(a.createdAt), s.show.timezone)}</time>
            <span>{a.summary}</span>
            <div className="spread">
              <span className="who">
                {a.actorName} · rev {a.revision}
              </span>
              {onUndo && a.undoableRevisionId ? (
                <button className="btn btn-sm btn-ghost" disabled={!!undoDisabled} title={undoDisabled ?? 'Undo creates a new compensating revision'} onClick={() => onUndo(a.undoableRevisionId!)}>
                  <Undo2 /> Undo
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrewPanel({ s, model }: { s: Snapshot; model: ShowModel }) {
  const online = new Map(s.presence.map((p) => [p.userId, p]));
  const operators = s.members.filter((m) => m.role === 'operator');
  const next = model.next;
  return (
    <section className="panel pad-sm side-section" aria-labelledby="crew-h">
      <h2 id="crew-h">Crew</h2>
      <div className="readiness-grid">
        {s.content.departments.map((d) => {
          const ops = operators.filter((o) => o.operateDepartments.includes(d.id));
          const cueInNext = next?.cueIds.find((id) => model.cueById.get(id)?.departmentId === d.id);
          return (
            <div key={d.id} className="ready-tile" style={deptVars(d)}>
              <div className="row">
                <DeptIcon icon={d.icon} />
                {d.name}
              </div>
              {ops.length === 0 ? <span className="small muted">No operator assigned</span> : null}
              {ops.map((o) => {
                const p = online.get(o.userId);
                return (
                  <span key={o.userId} className="small">
                    <span aria-hidden style={{ color: p?.online ? 'var(--ready)' : 'var(--history)' }}>{p?.online ? '●' : '○'}</span> {o.name}{' '}
                    <span className="muted">{p?.online ? 'online' : 'offline'}</span>
                  </span>
                );
              })}
              {cueInNext && s.session ? (
                <span className="small">
                  Next {next!.number}: <ReadinessChip value={model.readinessOfCue(cueInNext)} prefix={d.name} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
