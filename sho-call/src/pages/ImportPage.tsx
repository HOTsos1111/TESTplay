import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { api, ApiError, errorText } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { AppHeader } from '../components/AppHeader.tsx';
import { Field, useToast } from '../components/ui.tsx';
import type { ImportField, ImportMapping } from '../../shared/schemas.ts';
import type { ShowDetails, ShowContent } from '../../shared/types.ts';

interface Job {
  id: string;
  filename: string;
  kind: string;
  status: 'parsed' | 'unsupported' | 'committed';
  message: string;
  table: string[][];
  mapping: ImportMapping;
}

interface Issue {
  row: number;
  col: number | null;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface Normalized {
  content: ShowContent;
  issues: Issue[];
  counts: { segments: number; cues: number; groups: number; newDepartments: string[]; rowsUsed: number; rowsSkipped: number };
  firstTime: string | null;
  consequences: string | null;
}

const FIELD_LABEL: Record<ImportField, string> = {
  ignore: 'Ignore column',
  segment: 'Segment / item title',
  performer: 'Speaker / performer',
  segmentDuration: 'Segment duration',
  time: 'Cue time (HH:MM)',
  cueNumber: 'Cue number',
  department: 'Department name',
  instruction: 'Cue instruction',
  owner: 'Owner / operator',
  cueDuration: 'Cue duration',
  notes: 'Notes',
  group: 'Q-Link group label',
  deptColumn: 'Department column (one cue per cell)',
};

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}

export function ImportPage({ showId }: { showId: string | null }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [pasted, setPasted] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [result, setResult] = useState<Normalized | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<string | null>(null);
  const [mode, setMode] = useState<'new' | 'merge' | 'replace'>(showId ? 'merge' : 'new');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [target, setTarget] = useState<{ details: ShowDetails; revision: number } | null>(null);
  const [details, setDetails] = useState({ title: '', eventDate: today, timezone: localTz, plannedStart: '09:00', venue: '', notes: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showId) return;
    api<{ snapshot: { show: ShowDetails } }>('GET', `/api/shows/${showId}`)
      .then((r) => setTarget({ details: r.snapshot.show, revision: r.snapshot.show.revision }))
      .catch((e) => setError(errorText(e)));
  }, [showId]);

  const upload = async (body: { filename: string; dataBase64?: string; pastedText?: string }) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const j = await api<Job>('POST', '/api/imports', body);
      setJob(j);
      setMapping(j.mapping);
      setDetails((d) => ({ ...d, title: d.title || j.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('That file is larger than 10 MB. Export just the running order to CSV or XLSX.');
      return;
    }
    await upload({ filename: file.name, dataBase64: await readBase64(file) });
  };

  // Re-validate whenever the mapping, corrections or target change.
  useEffect(() => {
    if (!job || !mapping || job.status !== 'parsed') return;
    const t = window.setTimeout(async () => {
      try {
        const r = await api<Normalized>('POST', `/api/imports/${job.id}/normalize`, { mapping, targetShowId: showId ?? undefined, mode: showId ? mode : 'new' });
        setResult(r);
        if (r.firstTime && !showId) setDetails((d) => (d.plannedStart === '09:00' ? { ...d, plannedStart: r.firstTime! } : d));
      } catch (e) {
        setError(errorText(e));
      }
    }, 200);
    return () => clearTimeout(t);
  }, [job, mapping, mode, showId]);

  const issuesByCell = useMemo(() => {
    const m = new Map<string, Issue>();
    for (const i of result?.issues ?? []) {
      if (i.row < 0) continue;
      const key = i.col === null ? `${i.row}:*` : `${i.row}:${i.col}`;
      const prev = m.get(key);
      if (!prev || (prev.severity !== 'error' && i.severity === 'error')) m.set(key, i);
    }
    return m;
  }, [result]);

  const errors = result?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = result?.issues.filter((i) => i.severity === 'warning') ?? [];
  const infos = result?.issues.filter((i) => i.severity === 'info') ?? [];

  const toggleOmit = (row: number) =>
    mapping && setMapping({ ...mapping, omitRows: mapping.omitRows.includes(row) ? mapping.omitRows.filter((r) => r !== row) : [...mapping.omitRows, row] });

  const commit = async () => {
    if (!job || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        !showId || mode === 'new'
          ? { mapping, target: { mode: 'new', details } }
          : mode === 'merge'
            ? { mapping, target: { mode: 'merge', showId, baseRevision: target?.revision ?? 0 } }
            : { mapping, target: { mode: 'replace', showId, baseRevision: target?.revision ?? 0, confirm: true } };
      const r = await api<{ showId: string; counts: Normalized['counts']; revision: number }>('POST', `/api/imports/${job.id}/commit`, body);
      toast('ok', `Imported ${r.counts.segments} segments and ${r.counts.cues} cues (revision ${r.revision}).`);
      navigate(`/shows/${r.showId}/designer`);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray((e.details as { issues?: Issue[] })?.issues)) {
        setResult((prev) => (prev ? { ...prev, issues: (e.details as { issues: Issue[] }).issues } : prev));
      }
      setError(`Nothing was imported. ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const table = job?.table ?? [];
  const width = table[0]?.length ?? 0;
  const header = mapping && mapping.headerRow >= 0 ? table[mapping.headerRow] : null;
  const example = (col: number) => {
    const start = (mapping?.headerRow ?? -1) + 1;
    return table.slice(start, start + 40).map((r) => r[col]).find((v) => v?.trim()) ?? '';
  };

  return (
    <div className="app-root theme-director">
      <AppHeader>
        <span className="header-divider hide-phone" />
        <div className="identity">
          <div className="identity-label">Import show</div>
          {target ? <div className="identity-sub">into {target.details.title}</div> : null}
        </div>
      </AppHeader>
      <main id="main" className="page page-wide">
        <div className="page-head">
          <div className="stack" style={{ gap: 4 }}>
            <h1>Import and review</h1>
            <p className="muted">Choose file → preview → map columns → fix flagged rows → confirm. Nothing is saved until you confirm, and nothing is saved if problems remain.</p>
          </div>
          <a className="btn btn-sm" href="/sample-run-of-show.csv" download>
            <Download /> Sample CSV
          </a>
        </div>

        <section className="panel pad stack" aria-labelledby="src-h">
          <div className="spread">
            <h2 id="src-h">1. Source</h2>
            <div className="segmented" role="group" aria-label="Source type">
              <button aria-pressed={tab === 'file'} onClick={() => setTab('file')}>
                <FileSpreadsheet /> File
              </button>
              <button aria-pressed={tab === 'paste'} onClick={() => setTab('paste')}>
                <ClipboardPaste /> Paste text
              </button>
            </div>
          </div>
          {tab === 'file' ? (
            <div className="row-wrap">
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.docx,.pdf,.xls" className="sr-only" id="import-file" onChange={(e) => void onFile(e.target.files?.[0])} />
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload /> Choose file…
              </button>
              <span className="small muted">CSV and XLSX (first sheet) are fully supported. DOCX tables are read with a preview. PDF and scanned documents are not supported.</span>
            </div>
          ) : (
            <div className="stack">
              <Field label="Paste a table (tab or comma separated, e.g. copied from a spreadsheet or document)">
                <textarea className="input" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} />
              </Field>
              <div>
                <button className="btn btn-primary" disabled={!pasted.trim() || busy} onClick={() => void upload({ filename: 'Pasted text', pastedText: pasted })}>
                  Preview pasted text
                </button>
              </div>
            </div>
          )}
          {job ? (
            <div className={`banner ${job.status === 'unsupported' ? 'banner-error' : 'banner-info'}`} role={job.status === 'unsupported' ? 'alert' : 'status'}>
              <div className="grow">
                <p>
                  {job.filename} · {job.kind.toUpperCase()} · {table.length} rows × {width} columns
                </p>
                {job.message ? <p>{job.message}</p> : null}
              </div>
            </div>
          ) : null}
          {error ? <div className="banner banner-error" role="alert">{error}</div> : null}
        </section>

        {job && job.status === 'parsed' && mapping ? (
          <div className="designer" style={{ padding: 0, gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
            <section className="panel pad stack" aria-labelledby="prev-h">
              <div className="spread">
                <h2 id="prev-h">2. Preview</h2>
                <span className="small muted">Select a cell to correct it. Corrections apply to this import only; the uploaded source is kept unchanged.</span>
              </div>
              <div className="table-scroll">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      {Array.from({ length: width }, (_, c) => (
                        <th key={c} scope="col">
                          {FIELD_LABEL[mapping.columns[c]?.field ?? 'ignore']}
                          {mapping.columns[c]?.field === 'deptColumn' ? `: ${mapping.columns[c].department ?? ''}` : ''}
                        </th>
                      ))}
                      <th scope="col">Include</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.slice(0, 500).map((row, r) => {
                      const isHeader = r === mapping.headerRow;
                      const omitted = mapping.omitRows.includes(r);
                      const rowIssue = issuesByCell.get(`${r}:*`);
                      return (
                        <tr key={r} className={`${omitted ? 'omitted' : ''} ${rowIssue?.severity === 'error' ? 'err' : ''}`} style={isHeader ? { fontWeight: 700 } : undefined}>
                          <td className="tabular muted">{r + 1}{isHeader ? ' (header)' : ''}</td>
                          {row.map((cell, c) => {
                            const key = `${r}:${c}`;
                            const issue = issuesByCell.get(key);
                            const value = mapping.overrides[key] ?? cell;
                            return (
                              <td key={c} className={issue ? (issue.severity === 'error' ? 'cell-err' : issue.severity === 'warning' ? 'cell-warn' : '') : ''} title={issue?.message}>
                                {editCell === key ? (
                                  <input
                                    className="input input-sm"
                                    defaultValue={value}
                                    aria-label={`Row ${r + 1} column ${c + 1}`}
                                    autoFocus
                                    onBlur={(e) => {
                                      setMapping({ ...mapping, overrides: { ...mapping.overrides, [key]: e.target.value } });
                                      setEditCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      if (e.key === 'Escape') setEditCell(null);
                                    }}
                                  />
                                ) : (
                                  <button style={{ all: 'unset', cursor: isHeader ? 'default' : 'text', minWidth: 24, display: 'inline-block' }} disabled={isHeader} onClick={() => setEditCell(key)} aria-label={`Edit row ${r + 1} column ${c + 1}: ${value || 'empty'}`}>
                                    {value || <span className="muted">·</span>}
                                    {mapping.overrides[key] !== undefined ? <span className="chip chip-accent" style={{ marginLeft: 4, fontSize: 11 }}>edited</span> : null}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td>
                            {isHeader ? null : (
                              <label className="checkbox small">
                                <input type="checkbox" checked={!omitted} onChange={() => toggleOmit(r)} aria-label={`Include row ${r + 1}`} />
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {table.length > 500 ? <p className="small muted">Showing the first 500 rows; all {table.length} rows are validated.</p> : null}
            </section>

            <aside className="panel pad stack designer-side" aria-labelledby="map-h">
              <h2 id="map-h">3. Map columns</h2>
              <Field label="Header row">
                <select className="input" value={mapping.headerRow} onChange={(e) => setMapping({ ...mapping, headerRow: Number(e.target.value) })}>
                  <option value={-1}>No header row</option>
                  {table.slice(0, 10).map((r, i) => (
                    <option key={i} value={i}>
                      Row {i + 1}: {r.filter(Boolean).slice(0, 3).join(' | ').slice(0, 40)}
                    </option>
                  ))}
                </select>
              </Field>
              {Array.from({ length: width }, (_, c) => {
                const col = mapping.columns[c] ?? { field: 'ignore' as ImportField };
                const set = (patch: Partial<typeof col>) => {
                  const columns = [...mapping.columns];
                  while (columns.length < width) columns.push({ field: 'ignore' });
                  columns[c] = { ...col, ...patch };
                  setMapping({ ...mapping, columns });
                };
                return (
                  <div key={c} className="raised pad-sm stack" style={{ gap: 6 }}>
                    <label className="field">
                      <span>
                        Column {c + 1}
                        {header?.[c] ? ` “${header[c]}”` : ''}
                      </span>
                      <select className="input input-sm" value={col.field} onChange={(e) => set({ field: e.target.value as ImportField, department: e.target.value === 'deptColumn' ? col.department ?? header?.[c] ?? '' : undefined })}>
                        {(Object.keys(FIELD_LABEL) as ImportField[]).map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABEL[f]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {col.field === 'deptColumn' ? (
                      <input className="input input-sm" aria-label={`Department for column ${c + 1}`} value={col.department ?? ''} onChange={(e) => set({ department: e.target.value })} placeholder="Department name" />
                    ) : null}
                    <span className="small muted">e.g. {example(c) || '—'}</span>
                  </div>
                );
              })}
              {mapping.columns.some((c) => c.field === 'deptColumn') ? (
                <label className="checkbox">
                  <input type="checkbox" checked={mapping.linkRows} onChange={(e) => setMapping({ ...mapping, linkRows: e.target.checked })} />
                  Link each row’s department cues as one Q-Link call
                </label>
              ) : null}
              <button className="btn btn-sm btn-ghost" onClick={() => setMapping({ ...job.mapping, overrides: {}, omitRows: [] })}>
                <RotateCcw /> Reset mapping and corrections
              </button>
            </aside>
          </div>
        ) : null}

        {job && job.status === 'parsed' && result ? (
          <section className="panel pad stack" aria-labelledby="rev-h">
            <h2 id="rev-h">4. Review</h2>
            <p className="tabular">
              <b>{result.counts.segments}</b> segments · <b>{result.counts.cues}</b> cues · <b>{result.counts.groups}</b> Q-Links · {result.counts.rowsUsed} rows used · {result.counts.rowsSkipped} skipped
              {result.counts.newDepartments.length ? ` · new departments: ${result.counts.newDepartments.join(', ')}` : ''}
            </p>
            {errors.length ? (
              <div className="banner banner-error" role="alert">
                <div className="grow">
                  <p>{errors.length} problem{errors.length > 1 ? 's' : ''} must be fixed (correct the cell, change the mapping or untick the row):</p>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontWeight: 500 }}>
                    {errors.slice(0, 15).map((i, k) => (
                      <li key={k}>
                        {i.row >= 0 ? `Row ${i.row + 1}: ` : ''}
                        {i.message}{' '}
                        {i.row >= 0 ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => toggleOmit(i.row)}>
                            Omit row
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="banner banner-ok" role="status">
                <p className="grow">No blocking problems. Review the warnings, then confirm.</p>
              </div>
            )}
            {warnings.length ? (
              <details>
                <summary>{warnings.length} warning{warnings.length > 1 ? 's' : ''}</summary>
                <ul>
                  {warnings.map((i, k) => (
                    <li key={k}>
                      {i.row >= 0 ? `Row ${i.row + 1}: ` : ''}
                      {i.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {infos.length ? (
              <details>
                <summary>{infos.length} note{infos.length > 1 ? 's' : ''}</summary>
                <ul>
                  {infos.map((i, k) => (
                    <li key={k}>
                      {i.row >= 0 ? `Row ${i.row + 1}: ` : ''}
                      {i.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <h3>5. Where should it go?</h3>
            {showId ? (
              <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="sr-only">Import target</legend>
                <label className="checkbox">
                  <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge — append to {target?.details.title}
                </label>
                <label className="checkbox">
                  <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace the running order of {target?.details.title}
                </label>
                {result.consequences ? <p className="banner banner-info">{result.consequences}</p> : null}
                {mode === 'replace' ? (
                  <label className="checkbox">
                    <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} /> I understand the current segments and cues will be replaced
                  </label>
                ) : null}
              </fieldset>
            ) : (
              <div className="form-grid">
                <Field label="New show title">
                  <input className="input" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} />
                </Field>
                <Field label="Event date">
                  <input className="input" type="date" value={details.eventDate} onChange={(e) => setDetails({ ...details, eventDate: e.target.value })} />
                </Field>
                <Field label="Planned start (24h)" hint={result.firstTime ? `First time in the file: ${result.firstTime}` : undefined}>
                  <input className="input tabular" value={details.plannedStart} onChange={(e) => setDetails({ ...details, plannedStart: e.target.value })} />
                </Field>
                <Field label="Timezone">
                  <input className="input" value={details.timezone} onChange={(e) => setDetails({ ...details, timezone: e.target.value })} />
                </Field>
                <Field label="Venue">
                  <input className="input" value={details.venue} onChange={(e) => setDetails({ ...details, venue: e.target.value })} />
                </Field>
              </div>
            )}
            <div className="row-wrap">
              <button className="btn btn-primary" disabled={busy || errors.length > 0 || result.counts.cues === 0 || (mode === 'replace' && !confirmReplace) || (!showId && !details.title.trim())} onClick={() => void commit()}>
                Confirm import ({result.counts.segments} segments, {result.counts.cues} cues)
              </button>
              {errors.length ? <span className="small" style={{ color: 'var(--issue)' }}>Fix the problems above to enable import.</span> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
