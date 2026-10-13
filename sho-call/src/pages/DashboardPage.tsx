import { useEffect, useState, type FormEvent } from 'react';
import { Copy, FileSpreadsheet, LayoutTemplate, Plus, Radio } from 'lucide-react';
import { api, errorText } from '../lib/api.ts';
import { linkTo, navigate } from '../lib/router.ts';
import { AppHeader } from '../components/AppHeader.tsx';
import { Dialog, Field, useToast } from '../components/ui.tsx';
import { STANDARD_DEPARTMENTS } from '../../shared/calls.ts';
import type { ShowSummary } from '../../shared/types.ts';

const STATE_LABEL: Record<ShowSummary['state'], string> = { draft: 'Draft', rehearsal: 'Rehearsal running', live: 'Live', ended: 'Ended' };

export const liveHref = (s: { id: string; role: string }) => (s.role === 'owner' || s.role === 'director' ? `/shows/${s.id}/console` : `/shows/${s.id}/crew`);

export function DashboardPage() {
  const [shows, setShows] = useState<ShowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ templateId?: string } | null>(null);
  const [dup, setDup] = useState<{ show: ShowSummary; asTemplate: boolean } | null>(null);

  const load = () =>
    api<{ shows: ShowSummary[] }>('GET', '/api/shows')
      .then((r) => setShows(r.shows))
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    void load();
  }, []);

  const regular = shows?.filter((s) => !s.isTemplate) ?? [];
  const templates = shows?.filter((s) => s.isTemplate) ?? [];

  return (
    <div className="app-root">
      <AppHeader />
      <main id="main" className="page">
        <div className="page-head">
          <div className="stack" style={{ gap: 4 }}>
            <h1>Shows</h1>
            <p className="muted">Plan running orders, then call them live with your crew.</p>
          </div>
          <div className="row-wrap">
            <button className="btn btn-primary" onClick={() => setCreating({})}>
              <Plus /> Create show
            </button>
            <a className="btn" href="/import" onClick={linkTo('/import')}>
              <FileSpreadsheet /> Import show
            </a>
          </div>
        </div>
        {error ? <div className="banner banner-error" role="alert">{error}</div> : null}
        {shows === null && !error ? <p className="muted" aria-busy="true">Loading shows…</p> : null}
        {shows && regular.length === 0 ? (
          <div className="empty stack">
            <h2>No shows yet</h2>
            <p>Create a show in Show Designer, start from a template, or import a spreadsheet running order.</p>
          </div>
        ) : null}
        <div className="cards">
          {regular.map((s) => (
            <article key={s.id} className="panel show-card">
              <div className="spread">
                <span className={`badge-mode ${s.state === 'live' ? 'badge-live' : s.state === 'rehearsal' ? 'badge-rehearsal' : 'badge-none'}`}>{STATE_LABEL[s.state]}</span>
                <span className="chip chip-neutral">{s.role}</span>
              </div>
              <h2>
                <a href={`/shows/${s.id}`} onClick={linkTo(`/shows/${s.id}`)} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {s.title}
                </a>
              </h2>
              <p className="muted">
                <span className="tabular">{s.eventDate}</span>
                {s.venue ? ` · ${s.venue}` : ''}
              </p>
              <p className="small muted">Revision {s.revision}</p>
              <div className="row-wrap">
                <a className="btn btn-primary btn-sm" href={liveHref(s)} onClick={linkTo(liveHref(s))}>
                  <Radio /> {s.role === 'owner' || s.role === 'director' ? 'Director console' : 'Crew view'}
                </a>
                <a className="btn btn-sm" href={`/shows/${s.id}`} onClick={linkTo(`/shows/${s.id}`)}>
                  Open show
                </a>
                {s.role === 'owner' || s.role === 'director' ? (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => setDup({ show: s, asTemplate: false })}>
                      <Copy /> Duplicate
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setDup({ show: s, asTemplate: true })}>
                      <LayoutTemplate /> Save as template
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {templates.length ? (
          <section className="stack" aria-labelledby="tpl-h">
            <h2 id="tpl-h">Templates</h2>
            <div className="cards">
              {templates.map((t) => (
                <article key={t.id} className="panel show-card">
                  <h3>{t.title}</h3>
                  <div className="row-wrap">
                    <button className="btn btn-sm btn-primary" onClick={() => setCreating({ templateId: t.id })}>
                      <Plus /> New show from template
                    </button>
                    <a className="btn btn-sm" href={`/shows/${t.id}/designer`} onClick={linkTo(`/shows/${t.id}/designer`)}>
                      Edit template
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      {creating ? <CreateShowDialog templateId={creating.templateId} templates={templates} onClose={() => setCreating(null)} /> : null}
      {dup ? <DuplicateDialog show={dup.show} asTemplate={dup.asTemplate} onClose={() => setDup(null)} onDone={load} /> : null}
    </div>
  );
}

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function CreateShowDialog({ templateId, templates, onClose }: { templateId?: string; templates: ShowSummary[]; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [timezone, setTimezone] = useState(localTz);
  const [plannedStart, setPlannedStart] = useState('09:00');
  const [venue, setVenue] = useState('');
  const [depts, setDepts] = useState<string[]>(STANDARD_DEPARTMENTS.map((d) => d.key));
  const [custom, setCustom] = useState('');
  const [tpl, setTpl] = useState(templateId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const customs = custom.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await api<{ showId: string }>('POST', '/api/shows', {
        details: { title, eventDate, timezone, plannedStart, venue, notes: '' },
        departments: [...depts, ...customs],
        fromTemplateId: tpl || undefined,
      });
      toast('ok', 'Show created. Add segments and cues in Show Designer.');
      navigate(`/shows/${r.showId}/designer`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Create show" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required data-autofocus />
        </Field>
        <div className="form-grid">
          <Field label="Event date">
            <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          </Field>
          <Field label="Planned start (24h)">
            <input className="input tabular" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} placeholder="09:00" required />
          </Field>
        </div>
        <Field label="Timezone" hint="IANA name, e.g. Europe/London or America/New_York">
          <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
        </Field>
        <Field label="Venue">
          <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </Field>
        {templates.length ? (
          <Field label="Start from">
            <select className="input" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              <option value="">Blank running order</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  Template: {t.title}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {!tpl ? (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field" style={{ marginBottom: 6 }}>Departments</legend>
            <div className="row-wrap">
              {STANDARD_DEPARTMENTS.map((d) => (
                <label key={d.key} className="checkbox">
                  <input type="checkbox" checked={depts.includes(d.key)} onChange={(e) => setDepts(e.target.checked ? [...depts, d.key] : depts.filter((x) => x !== d.key))} />
                  {d.name}
                </label>
              ))}
            </div>
            <Field label="Custom departments" hint="Comma separated, e.g. Front of House, Pyro">
              <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </Field>
          </fieldset>
        ) : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Create show
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DuplicateDialog({ show, asTemplate, onClose, onDone }: { show: ShowSummary; asTemplate: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(asTemplate ? `${show.title} (template)` : `${show.title} (copy)`);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('POST', `/api/shows/${show.id}/duplicate`, { title, asTemplate });
      toast('ok', asTemplate ? 'Template saved.' : 'Show duplicated.');
      onDone();
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Dialog title={asTemplate ? 'Save as template' : 'Duplicate show'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">Copies the published running order, departments and Q-Links. Members, sessions and history are not copied.</p>
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus />
        </Field>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary">{asTemplate ? 'Save template' : 'Duplicate'}</button>
        </div>
      </form>
    </Dialog>
  );
}
