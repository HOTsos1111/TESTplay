import { useEffect, useState, type FormEvent } from 'react';
import { FileSpreadsheet, PencilRuler, Play, Radio, Square, Trash2, UserPlus, Users } from 'lucide-react';
import { api, ApiError, errorText } from '../lib/api.ts';
import { linkTo } from '../lib/router.ts';
import { useLiveShow, useTick } from '../lib/useLiveShow.ts';
import { clientId } from '../lib/ids.ts';
import { AppHeader } from '../components/AppHeader.tsx';
import { ConnectionIndicator, DeptLabel, Dialog, Field, ModeBadge, StaleBanner, useToast } from '../components/ui.tsx';
import { formatClock } from '../../shared/timing.ts';
import type { Department, Member, Role, Snapshot } from '../../shared/types.ts';

export function ShowPage({ showId }: { showId: string }) {
  const live = useLiveShow(showId);
  const now = useTick(1000);
  const s = live.snapshot;
  if (live.error && !s) {
    return (
      <div className="app-root">
        <AppHeader />
        <main id="main" className="page">
          <div className="banner banner-error" role="alert">{live.error}</div>
        </main>
      </div>
    );
  }
  if (!s) {
    return (
      <div className="app-root">
        <AppHeader />
        <main id="main" className="page" aria-busy="true">
          <p className="muted">Loading show…</p>
        </main>
      </div>
    );
  }
  const canDirect = s.me.role === 'owner' || s.me.role === 'director';
  const disabled = live.conn !== 'connected';
  return (
    <div className="app-root">
      <AppHeader>
        <span className="header-divider hide-phone" />
        <span className="show-title hide-phone">{s.show.title}</span>
        <ConnectionIndicator conn={live.conn} lastSync={live.lastSync} revision={live.revision} tz={s.show.timezone} now={now} />
      </AppHeader>
      <main id="main" className="page">
        <StaleBanner conn={live.conn} revision={live.revision} lastSync={live.lastSync} tz={s.show.timezone} />
        <div className="page-head">
          <div className="stack" style={{ gap: 6 }}>
            <div className="row-wrap">
              <ModeBadge mode={s.session?.mode ?? null} />
              <span className="chip chip-neutral">Your role: {s.me.role}</span>
              <span className="chip chip-neutral">Revision {s.show.revision}</span>
            </div>
            <h1>{s.show.title}</h1>
            <p className="muted">
              <span className="tabular">{s.show.eventDate}</span> · starts <span className="tabular">{s.show.plannedStart}</span> ({s.show.timezone})
              {s.show.venue ? ` · ${s.show.venue}` : ''}
            </p>
          </div>
          <div className="row-wrap">
            {canDirect ? (
              <a className="btn btn-primary" href={`/shows/${showId}/console`} onClick={linkTo(`/shows/${showId}/console`)}>
                <Radio /> Director console
              </a>
            ) : null}
            <a className={`btn ${canDirect ? '' : 'btn-primary'}`} href={`/shows/${showId}/crew`} onClick={linkTo(`/shows/${showId}/crew`)}>
              <Users /> Crew view
            </a>
            {canDirect ? (
              <>
                <a className="btn" href={`/shows/${showId}/designer`} onClick={linkTo(`/shows/${showId}/designer`)}>
                  <PencilRuler /> Show Designer
                </a>
                <a className="btn" href={`/shows/${showId}/import`} onClick={linkTo(`/shows/${showId}/import`)}>
                  <FileSpreadsheet /> Import
                </a>
              </>
            ) : null}
          </div>
        </div>

        <SessionPanel s={s} disabled={disabled} />
        <DetailsPanel s={s} disabled={disabled} />
        <section className="panel pad stack" aria-labelledby="dep-h">
          <h2 id="dep-h">Departments</h2>
          <div className="row-wrap">
            {s.content.departments.map((d) => (
              <DeptLabel key={d.id} dept={d} />
            ))}
          </div>
          <p className="small muted">Add, rename or remove departments in Show Designer.</p>
        </section>
        {canDirect ? <MembersPanel s={s} disabled={disabled} /> : null}
      </main>
    </div>
  );
}

function SessionPanel({ s, disabled }: { s: Snapshot; disabled: boolean }) {
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const canDirect = s.me.role === 'owner' || s.me.role === 'director';
  const session = s.session;
  return (
    <section className="panel pad stack" aria-labelledby="ses-h">
      <h2 id="ses-h">Session</h2>
      {session ? (
        <>
          <p>
            <ModeBadge mode={session.mode} /> started at <span className="tabular">{formatClock(Date.parse(session.startedAt), s.show.timezone)}</span> ·{' '}
            {session.timingPolicy === 'projected' ? 'estimated automatic projection' : 'manual timing shifts'} · Director control: <b>{session.directorName}</b>
            {session.controlClientId ? '' : ' (no console has taken control yet)'}
          </p>
          {canDirect ? (
            <div className="row-wrap">
              <button className="btn btn-danger" disabled={disabled} onClick={() => setEnding(true)}>
                <Square /> End session
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="muted">No session is running. Crew can open the show and read the running order; calling starts only when a Director starts a rehearsal or live session.</p>
          {canDirect ? (
            <div className="row-wrap">
              <button className="btn btn-primary" disabled={disabled} onClick={() => setStarting(true)}>
                <Play /> Start session…
              </button>
            </div>
          ) : null}
        </>
      )}
      {starting ? <StartSessionDialog s={s} onClose={() => setStarting(false)} onStarted={() => toast('ok', 'Session started.')} /> : null}
      {ending && session ? (
        <Dialog title={`End ${session.mode === 'live' ? 'live session' : 'rehearsal'}?`} onClose={() => setEnding(false)}>
          <div className="stack">
            <p>
              Ending stops calling for everyone connected. Cue history, readiness and the activity log for this {session.mode} are kept. A new session starts with every cue pending.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setEnding(false)}>
                Keep running
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await api('POST', `/api/shows/${s.show.id}/session/end`, { confirm: true });
                    toast('ok', 'Session ended.');
                    setEnding(false);
                  } catch (e) {
                    toast('error', errorText(e));
                  }
                }}
              >
                End session
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

export function StartSessionDialog({ s, onClose, onStarted }: { s: Snapshot; onClose: () => void; onStarted: () => void }) {
  const [mode, setMode] = useState<'rehearsal' | 'live'>('rehearsal');
  const [policy, setPolicy] = useState<'manual' | 'projected'>('projected');
  const directors = s.members.filter((m) => m.role === 'owner' || m.role === 'director');
  const [director, setDirector] = useState(directors.find((d) => d.userId === s.me.userId)?.userId ?? directors[0]?.userId ?? s.me.userId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const directorName = directors.find((d) => d.userId === director)?.name ?? s.me.name;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('POST', `/api/shows/${s.show.id}/session/start`, { mode, timingPolicy: policy, directorUserId: director, clientId: clientId() });
      onStarted();
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Start session" onClose={onClose}>
      <form className="stack-lg" onSubmit={submit}>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field">Session type</legend>
          <label className="checkbox">
            <input type="radio" name="mode" checked={mode === 'rehearsal'} onChange={() => setMode('rehearsal')} /> Rehearsal — clearly badged; separate event log
          </label>
          <label className="checkbox">
            <input type="radio" name="mode" checked={mode === 'live'} onChange={() => setMode('live')} /> Live show
          </label>
        </fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field">Timing policy</legend>
          <label className="checkbox">
            <input type="radio" name="policy" checked={policy === 'projected'} onChange={() => setPolicy('projected')} /> Estimated automatic projection — a late start or overrun moves future estimates
          </label>
          <label className="checkbox">
            <input type="radio" name="policy" checked={policy === 'manual'} onChange={() => setPolicy('manual')} /> Manual shifts only — estimates move when the Director applies a shift
          </label>
          <p className="small muted">Neither policy issues cues. Countdowns are approximate and only the Director calls Go.</p>
        </fieldset>
        <Field label="Director control">
          <select className="input" value={director} onChange={(e) => setDirector(e.target.value)}>
            {directors.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name} ({d.role})
              </option>
            ))}
          </select>
        </Field>
        <p className="banner banner-info">
          {directorName} will have Director control{director === s.me.userId ? ' from this console' : '; they take control explicitly when they open the console'}.
        </p>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Start {mode === 'live' ? 'live session' : 'rehearsal'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DetailsPanel({ s, disabled }: { s: Snapshot; disabled: boolean }) {
  const { toast } = useToast();
  const owner = s.me.role === 'owner';
  const [d, setD] = useState({ ...s.show });
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setD({ ...s.show });
  }, [s.show, dirty]);
  const set = (k: keyof typeof d, v: string) => {
    setDirty(true);
    setD({ ...d, [k]: v });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('PATCH', `/api/shows/${s.show.id}/details`, { title: d.title, eventDate: d.eventDate, timezone: d.timezone, plannedStart: d.plannedStart, venue: d.venue, notes: d.notes });
      setDirty(false);
      setError(null);
      toast('ok', 'Show details saved.');
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <section className="panel pad stack" aria-labelledby="det-h">
      <h2 id="det-h">Show details</h2>
      <form className="stack" onSubmit={save}>
        <fieldset disabled={!owner} className="form-grid" style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Title">
            <input className="input" value={d.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Event date">
            <input className="input" type="date" value={d.eventDate} onChange={(e) => set('eventDate', e.target.value)} />
          </Field>
          <Field label="Planned start (24h)">
            <input className="input tabular" value={d.plannedStart} onChange={(e) => set('plannedStart', e.target.value)} />
          </Field>
          <Field label="Timezone">
            <input className="input" value={d.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field label="Venue">
            <input className="input" value={d.venue} onChange={(e) => set('venue', e.target.value)} />
          </Field>
        </fieldset>
        <Field label="Notes">
          <textarea className="input" value={d.notes} disabled={!owner} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {owner ? (
          <div className="row">
            <button className="btn btn-primary" disabled={!dirty || disabled}>
              Save details
            </button>
            {dirty ? <span className="small muted">Unsaved changes</span> : null}
          </div>
        ) : (
          <p className="small muted">Only the show owner can edit these details.</p>
        )}
      </form>
    </section>
  );
}

const ROLES: Role[] = ['owner', 'director', 'operator', 'viewer'];

function DeptChecks({ departments, value, onChange, label }: { departments: Department[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="row-wrap" role="group" aria-label={label}>
      {departments.map((d) => (
        <label key={d.id} className="checkbox small">
          <input type="checkbox" checked={value.includes(d.id)} onChange={(e) => onChange(e.target.checked ? [...value, d.id] : value.filter((x) => x !== d.id))} />
          {d.name}
        </label>
      ))}
    </div>
  );
}

function MembersPanel({ s, disabled }: { s: Snapshot; disabled: boolean }) {
  const owner = s.me.role === 'owner';
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const deptName = (id: string) => s.content.departments.find((d) => d.id === id)?.name ?? '?';
  return (
    <section className="panel pad stack" aria-labelledby="mem-h">
      <div className="spread">
        <h2 id="mem-h">Members and permissions</h2>
        {owner ? (
          <button className="btn btn-sm" disabled={disabled} onClick={() => setAdding(true)}>
            <UserPlus /> Add member
          </button>
        ) : null}
      </div>
      <p className="small muted">
        Operators report readiness only for departments they operate. Visibility is separate: a member can see departments they cannot operate. Filters in the crew view never grant access.
      </p>
      <div className="table-scroll" style={{ maxHeight: 'none' }}>
        <table className="grid-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Operates</th>
              <th scope="col">Can see</th>
              {owner ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {s.members.map((m) => (
              <tr key={m.userId}>
                <td>
                  {m.name}
                  <div className="small muted">{m.email}</div>
                </td>
                <td>{m.role}</td>
                <td>{m.operateDepartments.map(deptName).join(', ') || '—'}</td>
                <td>{m.role === 'owner' || m.role === 'director' || m.visibleDepartments === null ? 'All departments' : [...new Set([...m.visibleDepartments, ...m.operateDepartments])].map(deptName).join(', ')}</td>
                {owner ? (
                  <td>
                    <button className="btn btn-sm btn-ghost" disabled={disabled} onClick={() => setEditing(m)}>
                      Edit
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? <AddMemberDialog s={s} onClose={() => setAdding(false)} /> : null}
      {editing ? <EditMemberDialog s={s} member={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function AddMemberDialog({ s, onClose }: { s: Snapshot; onClose: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [operate, setOperate] = useState<string[]>([]);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ created: boolean }>('POST', `/api/shows/${s.show.id}/members`, {
        email,
        role,
        operateDepartments: role === 'operator' ? operate : [],
        visibleDepartments: null,
        createAccount: needsAccount ? { name, password } : undefined,
      });
      toast('ok', r.created ? `Account created and added. Share the password with them yourself — Sho Call has not emailed anyone.` : 'Member added.');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'no_account') setNeedsAccount(true);
      setError(errorText(err));
    }
  };
  return (
    <Dialog title="Add member" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus required />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        {role === 'operator' ? <DeptChecks departments={s.content.departments} value={operate} onChange={setOperate} label="Departments they operate" /> : null}
        {needsAccount ? (
          <fieldset className="stack" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
            <legend className="field">New local account</legend>
            <p className="small muted">No invitation email is sent. You will need to give them the password yourself.</p>
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Temporary password" hint="At least 10 characters">
              <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
          </fieldset>
        ) : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary">{needsAccount ? 'Create account and add' : 'Add member'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function EditMemberDialog({ s, member, onClose }: { s: Snapshot; member: Member; onClose: () => void }) {
  const { toast } = useToast();
  const [role, setRole] = useState<Role>(member.role);
  const [operate, setOperate] = useState(member.operateDepartments);
  const [allVisible, setAllVisible] = useState(member.visibleDepartments === null);
  const [visible, setVisible] = useState(member.visibleDepartments ?? []);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await api('PATCH', `/api/shows/${s.show.id}/members/${member.userId}`, {
        role,
        operateDepartments: role === 'operator' ? operate : [],
        visibleDepartments: allVisible ? null : visible,
      });
      toast('ok', 'Member updated.');
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };
  const remove = async () => {
    try {
      await api('DELETE', `/api/shows/${s.show.id}/members/${member.userId}`);
      toast('ok', `${member.name} removed.`);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Dialog title={`Edit ${member.name}`} onClose={onClose}>
      <div className="stack">
        <Field label="Role">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} data-autofocus>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        {role === 'operator' ? (
          <>
            <p className="field">Operates</p>
            <DeptChecks departments={s.content.departments} value={operate} onChange={setOperate} label="Departments they operate" />
          </>
        ) : null}
        {role === 'operator' || role === 'viewer' ? (
          <>
            <label className="checkbox">
              <input type="checkbox" checked={allVisible} onChange={(e) => setAllVisible(e.target.checked)} /> Can see all departments
            </label>
            {!allVisible ? <DeptChecks departments={s.content.departments} value={visible} onChange={setVisible} label="Departments they can see" /> : null}
          </>
        ) : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="spread">
          <button className="btn btn-danger btn-sm" onClick={() => void remove()}>
            <Trash2 /> Remove from show
          </button>
          <div className="row">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => void save()}>
              Save
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

