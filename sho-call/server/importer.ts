// Import of traditional running orders.
//
//   choose file → preview → map columns → normalise departments/times →
//   flag errors/ambiguities → review → confirm → commit
//
// Supported: CSV/TSV, XLSX (first sheet), DOCX tables, pasted text.
// Not supported (reported honestly): PDF, scanned documents, legacy .xls.
// The uploaded source is preserved in import_jobs separately from the show.
// Commit is all-or-nothing: any error means nothing is written.

import readXlsxSheet from './xlsx.ts';
import mammoth from 'mammoth';
import { get, run, tx, type Db } from './db.ts';
import { badRequest, forbidden, notFound, unprocessable } from './errors.ts';
import { newId, nowIso } from './ids.ts';
import { addEvent, createShow, loadContent, writeContent } from './store.ts';
import { publishContent } from './revisions.ts';
import { matchDepartment, slugKey, STANDARD_DEPARTMENTS } from '../shared/calls.ts';
import { formatDuration, parseDuration } from '../shared/timing.ts';
import type { ImportField, ImportMapping } from '../shared/schemas.ts';
import type { Cue, CueGroup, Department, IconKey, Segment, ShowContent, User } from '../shared/types.ts';

export type SourceKind = 'csv' | 'xlsx' | 'docx' | 'text' | 'pdf' | 'unknown';

export interface ParsedSource {
  kind: SourceKind;
  status: 'parsed' | 'unsupported';
  message: string;
  table: string[][];
}

// ------------------------------------------------------------------ parsing

/** RFC 4180-style parser with delimiter auto-detection (comma, tab, semicolon). */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const sample = clean.split(/\r?\n/).slice(0, 10).join('\n');
  const count = (ch: string) => sample.split(ch).length - 1;
  const delim = count('\t') > count(',') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return squareUp(rows);
}

function squareUp(rows: string[][]): string[][] {
  const trimmed = rows.map((r) => r.map((c) => c.replace(/\s+/g, ' ').trim()));
  while (trimmed.length && trimmed[trimmed.length - 1].every((c) => c === '')) trimmed.pop();
  const width = Math.max(0, ...trimmed.map((r) => r.length));
  return trimmed.map((r) => [...r, ...Array(width - r.length).fill('')]);
}

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function parseUpload(filename: string, data: Buffer | null, pastedText?: string): Promise<ParsedSource> {
  if (pastedText !== undefined) {
    const table = parseDelimited(pastedText);
    return { kind: 'text', status: 'parsed', message: table.length ? '' : 'Nothing to import was found in the pasted text.', table };
  }
  if (!data) throw badRequest('No file content received.');
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    return { kind: 'csv', status: 'parsed', message: '', table: parseDelimited(data.toString('utf8')) };
  }
  if (ext === 'xlsx') {
    try {
      return { kind: 'xlsx', status: 'parsed', message: 'Only the first worksheet was read.', table: squareUp(await readXlsxSheet(data)) };
    } catch {
      return { kind: 'xlsx', status: 'unsupported', message: 'This file could not be read as an Excel workbook. Re-save it as .xlsx or export it to CSV.', table: [] };
    }
  }
  if (ext === 'docx') {
    const { value: html } = await mammoth.convertToHtml({ buffer: data });
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
    if (tables.length) {
      // Use the largest table; a running order is usually the main one.
      const parsed = tables.map((t) =>
        (t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((tr) => (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map((td) => decodeHtml(td))),
      );
      parsed.sort((a, b) => b.length - a.length);
      return {
        kind: 'docx',
        status: 'parsed',
        message: tables.length > 1 ? `Found ${tables.length} tables; using the largest (${parsed[0].length} rows). Check the preview.` : 'Read the table from the document. Check the preview: merged cells and formatting are not preserved.',
        table: squareUp(parsed[0]),
      };
    }
    const { value: text } = await mammoth.extractRawText({ buffer: data });
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    return {
      kind: 'docx',
      status: 'parsed',
      message: 'No table was found in this document, so each paragraph became one row in a single column. Expect to correct rows by hand, or paste a table instead.',
      table: squareUp(lines.map((l) => (l.includes('\t') ? l.split('\t') : [l]))),
    };
  }
  if (ext === 'pdf') {
    return {
      kind: 'pdf',
      status: 'unsupported',
      message: 'PDF import is not supported in this version (text and scanned PDFs need extraction/OCR that is not implemented). Export the running order to CSV or XLSX, or copy the table and use Paste text.',
      table: [],
    };
  }
  if (ext === 'xls') {
    return { kind: 'unknown', status: 'unsupported', message: 'Legacy .xls files are not supported. Re-save as .xlsx or CSV.', table: [] };
  }
  return { kind: 'unknown', status: 'unsupported', message: `Files of type .${ext || '?'} are not supported. Use CSV, XLSX, DOCX or paste text.`, table: [] };
}

// ------------------------------------------------------------------ mapping

const HEADER_RULES: [ImportField, RegExp][] = [
  ['cueNumber', /^(cue\s*(#|no\.?|num(ber)?)|q\s*#?|#|no\.?|cue)$/i],
  ['time', /^(cue\s*)?(time|start|start time|scheduled|clock|at)$/i],
  ['segmentDuration', /^(dur(ation)?|length|run\s*time|mins?)$/i],
  ['cueDuration', /^cue\s*dur(ation)?$/i],
  ['segment', /^(segment|item|title|running order|session|cue title|cue name|programme|program|element)$/i],
  ['performer', /^(speaker|performer|presenter|talent|who|artist|host)s?$/i],
  ['department', /^(dept\.?|department|discipline)$/i],
  ['instruction', /^(instruction|action|cue description|description|cue text|details)$/i],
  ['owner', /^(owner|operator|assigned( to)?|op)$/i],
  ['group', /^(group|q-?link|link(ed)?( group)?)$/i],
  ['notes', /^(notes?|comments?|remarks)$/i],
];

const DEPT_HEADER = /^(video|vid|vt|vision|graphics|gfx|audio|sound|snd|lighting|lights|lx|stage|stage manager|sm|dsm|foh|front of house|camera|cameras|pyro|sfx|rigging)$/i;

export function guessMapping(table: string[][]): ImportMapping {
  let headerRow = -1;
  let best = 0;
  for (let r = 0; r < Math.min(table.length, 6); r++) {
    const score = table[r].filter((c) => HEADER_RULES.some(([, re]) => re.test(c)) || DEPT_HEADER.test(c)).length;
    if (score > best) {
      best = score;
      headerRow = r;
    }
  }
  const width = table[0]?.length ?? 0;
  const header = headerRow >= 0 ? table[headerRow] : Array(width).fill('');
  const used = new Set<ImportField>();
  const columns = header.map((h) => {
    const text = h.trim();
    for (const [field, re] of HEADER_RULES) {
      if (re.test(text) && !used.has(field)) {
        used.add(field);
        return { field };
      }
    }
    if (DEPT_HEADER.test(text)) return { field: 'deptColumn' as ImportField, department: text };
    return { field: 'ignore' as ImportField };
  });
  return { headerRow, columns, linkRows: true, omitRows: [], overrides: {} };
}

// ------------------------------------------------------------------ normalise

export interface ImportIssue {
  row: number;
  col: number | null;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface NormalizeResult {
  content: ShowContent;
  issues: ImportIssue[];
  counts: { segments: number; cues: number; groups: number; newDepartments: string[]; rowsUsed: number; rowsSkipped: number };
  firstTime: string | null;
}

/** Seconds since midnight from "10:05", "10:05:30", "10.05", "9:30 pm", "1005", or an Excel day fraction. */
export function parseSheetTime(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const m =
    /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(t) ??
    /^(\d{1,2})(\d{2})()\s*(am|pm)?$/.exec(t);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const s = Number(m[3] || 0);
    const ampm = m[4]?.replace(/\./g, '');
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59 || s > 59) return null;
    return h * 3600 + min * 60 + s;
  }
  if (/^0?\.\d+$/.test(t)) {
    const frac = Number(t);
    if (frac >= 0 && frac < 1) return Math.round(frac * 86400);
  }
  return null;
}

export const clockFromSeconds = (sec: number) => {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

function iconFor(name: string): IconKey {
  const n = name.toLowerCase();
  if (/video|vid|vision|camera|graphics|gfx|vt/.test(n)) return 'video';
  if (/audio|sound|snd/.test(n)) return 'audio';
  if (/light|lx/.test(n)) return 'lighting';
  if (/stage|sm\b/.test(n)) return 'stage';
  if (/foh|front of house|house/.test(n)) return 'foh';
  return 'generic';
}

export function normalizeImport(table: string[][], mapping: ImportMapping, existing: ShowContent | null): NormalizeResult {
  const issues: ImportIssue[] = [];
  const cols = mapping.columns;
  const colOf = (f: ImportField) => cols.findIndex((c) => c.field === f);
  const cSeg = colOf('segment');
  const cPerf = colOf('performer');
  const cDur = colOf('segmentDuration');
  const cTime = colOf('time');
  const cNum = colOf('cueNumber');
  const cDept = colOf('department');
  const cInstr = colOf('instruction');
  const cOwner = colOf('owner');
  const cCueDur = colOf('cueDuration');
  const cNotes = colOf('notes');
  const cGroup = colOf('group');
  const deptCols = cols.map((c, i) => ({ ...c, i })).filter((c) => c.field === 'deptColumn');
  const wide = deptCols.length > 0;
  const omit = new Set(mapping.omitRows);

  if (!wide && cInstr < 0) issues.push({ row: -1, col: null, severity: 'error', message: 'Map an Instruction column, or map department columns (Video, Audio...) for a one-row-per-segment sheet.' });
  if (!wide && cDept < 0) issues.push({ row: -1, col: null, severity: 'error', message: 'Map a Department column, or map department columns for a one-row-per-segment sheet.' });

  const departments: Department[] = existing
    ? existing.departments.map((d) => ({ ...d }))
    : STANDARD_DEPARTMENTS.map((d, i) => ({ id: newId('dep'), key: d.key, name: d.name, icon: d.icon, sort: i }));
  const newDepartments: string[] = [];
  const resolveDept = (name: string): Department | null => {
    const clean = name.trim();
    if (!clean) return null;
    const hit = matchDepartment(clean, departments);
    if (hit) return hit;
    let key = slugKey(clean);
    while (departments.some((d) => d.key === key)) key = `${key}-2`;
    const d: Department = { id: newId('dep'), key, name: clean.slice(0, 40), icon: iconFor(clean), sort: departments.length };
    departments.push(d);
    newDepartments.push(d.name);
    return d;
  };

  const cell = (r: number, c: number): string => {
    if (c < 0) return '';
    const o = mapping.overrides[`${r}:${c}`];
    return (o ?? table[r]?.[c] ?? '').trim();
  };

  const segments: (Segment & { startSec: number | null; durGiven: number | null; firstRow: number })[] = [];
  const cues: (Cue & { row: number; timeSec: number | null })[] = [];
  const groups: CueGroup[] = [];
  const groupByKey = new Map<string, CueGroup>();
  const seenRows = new Map<string, number>();
  let rowsUsed = 0;
  let rowsSkipped = 0;
  let current: (typeof segments)[number] | null = null;
  let autoNumber = 1;
  const segPosBase = existing ? existing.segments.length : 0;

  const startRow = mapping.headerRow + 1;
  for (let r = startRow; r < table.length; r++) {
    const raw = table[r].map((_, c) => cell(r, c));
    if (omit.has(r)) {
      rowsSkipped++;
      issues.push({ row: r, col: null, severity: 'info', message: 'Omitted by you.' });
      continue;
    }
    const filled = raw.filter(Boolean);
    if (filled.length === 0) {
      rowsSkipped++;
      continue;
    }
    const mappedFilled = raw.filter((v, c) => v && cols[c] && cols[c].field !== 'ignore');
    if (filled.length === 1 && cols.filter((c) => c.field !== 'ignore').length >= 3) {
      rowsSkipped++;
      issues.push({ row: r, col: raw.findIndex(Boolean), severity: 'warning', message: `"${filled[0]}" looks like a heading or merged cell and was not imported. Fill in the row or leave it omitted.` });
      continue;
    }
    if (mappedFilled.length === 0) {
      rowsSkipped++;
      issues.push({ row: r, col: null, severity: 'warning', message: 'Row has content only in unmapped columns; skipped.' });
      continue;
    }
    const signature = raw.join('\u0001');
    if (seenRows.has(signature)) {
      issues.push({ row: r, col: null, severity: 'warning', message: `Duplicate of row ${seenRows.get(signature)! + 1}. Omit it if it was pasted twice.` });
    } else seenRows.set(signature, r);
    rowsUsed++;

    // ----- time
    const timeText = cell(r, cTime);
    let timeSec: number | null = null;
    if (timeText) {
      timeSec = parseSheetTime(timeText);
      if (timeSec === null) issues.push({ row: r, col: cTime, severity: 'error', message: `"${timeText}" is not a time. Use 24-hour HH:MM (e.g. 10:05).` });
    }

    // ----- segment
    const segTitle = cell(r, cSeg);
    const startNew = !current || (segTitle && segTitle !== current.title) || (wide && cSeg < 0);
    if (startNew) {
      const durText = cell(r, cDur);
      let durGiven: number | null = null;
      if (durText) {
        durGiven = parseDuration(durText);
        if (durGiven === null) issues.push({ row: r, col: cDur, severity: 'error', message: `"${durText}" is not a duration. Use minutes (5), MM:SS (05:00) or H:MM:SS.` });
      }
      const title: string = segTitle || (wide ? `Row ${r + 1}` : 'Imported cues');
      if (!segTitle && cSeg >= 0) issues.push({ row: r, col: cSeg, severity: 'warning', message: `No segment title; using "${title}".` });
      if (!segTitle && cSeg < 0 && !current) issues.push({ row: r, col: null, severity: 'info', message: 'No segment column mapped; cues go into one segment.' });
      current = {
        id: newId('seg'),
        position: segPosBase + segments.length,
        title: title.slice(0, 160),
        performer: cell(r, cPerf).slice(0, 160),
        durationSec: durGiven ?? 0,
        fixedTime: null,
        notes: cell(r, cNotes).slice(0, 4000),
        startSec: timeSec,
        durGiven,
        firstRow: r,
      };
      segments.push(current);
    } else if (current) {
      if (!current.performer && cell(r, cPerf)) current.performer = cell(r, cPerf);
      if (current.startSec === null && timeSec !== null) current.startSec = timeSec;
    }
    const seg = current!;

    // ----- cues
    const number = cell(r, cNum);
    const owner = cell(r, cOwner).slice(0, 80);
    const cueDurText = cell(r, cCueDur);
    const cueDur = cueDurText ? parseDuration(cueDurText) : 0;
    if (cueDurText && cueDur === null) issues.push({ row: r, col: cCueDur, severity: 'error', message: `"${cueDurText}" is not a duration.` });
    const rowNumber = number || String(autoNumber).padStart(3, '0');

    const makeCue = (dept: Department, instruction: string): Cue & { row: number; timeSec: number | null } => ({
      id: newId('cue'),
      segmentId: seg.id,
      position: cues.length,
      number: rowNumber.slice(0, 16),
      departmentId: dept.id,
      instruction: instruction.slice(0, 2000),
      owner,
      offsetSec: 0,
      durationSec: cueDur ?? 0,
      groupId: null,
      target: null,
      row: r,
      timeSec,
    });

    const rowCues: (Cue & { row: number; timeSec: number | null })[] = [];
    if (wide) {
      for (const dc of deptCols) {
        const text = cell(r, dc.i);
        if (!text || text === '-' || text === '—') continue;
        const dept = resolveDept(dc.department || table[mapping.headerRow]?.[dc.i] || `Column ${dc.i + 1}`);
        if (!dept) continue;
        rowCues.push(makeCue(dept, text));
      }
      if (rowCues.length === 0 && !startNew) {
        issues.push({ row: r, col: null, severity: 'warning', message: 'Row has no department instructions.' });
      }
    } else {
      const instruction = cell(r, cInstr);
      const deptName = cell(r, cDept);
      if (!instruction) issues.push({ row: r, col: cInstr, severity: 'error', message: 'Missing instruction.' });
      if (!deptName) issues.push({ row: r, col: cDept, severity: 'error', message: 'Missing department. Type one in, or omit the row.' });
      const dept = resolveDept(deptName);
      if (dept && instruction) rowCues.push(makeCue(dept, instruction));
    }
    if (rowCues.length && !number) {
      issues.push({ row: r, col: cNum, severity: 'info', message: `No cue number; assigned ${rowNumber}.` });
    }
    if (rowCues.length) autoNumber++;

    // ----- Q-Link grouping
    const groupLabel = cell(r, cGroup);
    if (groupLabel && !wide) {
      const key = `${seg.id}|${groupLabel.toLowerCase()}`;
      let g = groupByKey.get(key);
      if (!g) {
        g = { id: newId('grp'), label: groupLabel.slice(0, 120), segmentId: seg.id };
        groupByKey.set(key, g);
        groups.push(g);
      }
      for (const c of rowCues) c.groupId = g.id;
    } else if (wide && mapping.linkRows && rowCues.length > 1) {
      const g: CueGroup = { id: newId('grp'), label: `${rowNumber} ${seg.title}`.slice(0, 120), segmentId: seg.id };
      groups.push(g);
      for (const c of rowCues) c.groupId = g.id;
    }
    cues.push(...rowCues);
  }

  // ----- timing: durations from consecutive start times, offsets within segments
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const next = segments[i + 1];
    if (s.startSec !== null && next && next.startSec !== null) {
      let diff = next.startSec - s.startSec;
      if (diff < 0) diff += 86400; // crosses midnight
      if (s.durGiven !== null && Math.abs(s.durGiven - diff) > 59) {
        issues.push({ row: s.firstRow, col: cDur, severity: 'warning', message: `Duration ${formatDuration(s.durGiven)} disagrees with the start times (${formatDuration(diff)} until the next segment). Start times were used.` });
      }
      s.durationSec = diff;
    } else if (s.durGiven === null) {
      s.durationSec = 300;
      issues.push({ row: s.firstRow, col: cDur, severity: 'warning', message: 'No duration or next start time; estimated 05:00. Adjust it in Show Designer.' });
    }
  }
  for (const c of cues) {
    const seg = segments.find((s) => s.id === c.segmentId)!;
    if (c.timeSec !== null && seg.startSec !== null) {
      let off = c.timeSec - seg.startSec;
      if (off < 0) off += 86400;
      if (off > seg.durationSec && seg.durationSec > 0) {
        issues.push({ row: c.row, col: cTime, severity: 'warning', message: `Cue time is after the end of "${seg.title}".` });
      }
      c.offsetSec = off;
    }
  }

  // ----- cue number collisions (same department + number)
  const taken = new Map<string, string>();
  for (const c of existing?.cues ?? []) taken.set(`${c.departmentId}|${c.number.toLowerCase()}`, 'existing show');
  for (const c of cues) {
    const key = `${c.departmentId}|${c.number.toLowerCase()}`;
    const prev = taken.get(key);
    if (prev) {
      const dept = departments.find((d) => d.id === c.departmentId)?.name ?? '';
      issues.push({ row: c.row, col: cNum, severity: 'error', message: `Cue number ${c.number} is already used in ${dept} (${prev}). Renumber it or omit the row.` });
    } else taken.set(key, `row ${c.row + 1}`);
  }
  if (cues.length === 0 && !issues.some((i) => i.severity === 'error')) {
    issues.push({ row: -1, col: null, severity: 'error', message: 'No cues were found with the current mapping.' });
  }

  const firstTime = segments.find((s) => s.startSec !== null)?.startSec ?? null;
  const content: ShowContent = {
    departments,
    segments: segments.map(({ startSec: _a, durGiven: _b, firstRow: _c, ...s }) => s),
    cues: cues.map(({ row: _r, timeSec: _t, ...c }) => c),
    groups,
  };
  return {
    content,
    issues,
    counts: {
      segments: segments.length,
      cues: cues.length,
      groups: groups.length,
      newDepartments,
      rowsUsed,
      rowsSkipped,
    },
    firstTime: firstTime === null ? null : clockFromSeconds(firstTime),
  };
}

// ------------------------------------------------------------------ jobs

interface JobRow {
  id: string;
  user_id: string;
  filename: string;
  source_kind: SourceKind;
  status: string;
  message: string;
  table_json: string;
  committed_show_id: string | null;
}

export async function createImportJob(db: Db, user: User, filename: string, dataBase64?: string, pastedText?: string) {
  const data = dataBase64 !== undefined ? Buffer.from(dataBase64, 'base64') : null;
  const parsed = await parseUpload(filename, data, pastedText);
  const id = newId('imp');
  run(
    db,
    `INSERT INTO import_jobs (id, user_id, filename, source_kind, source, status, message, table_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, user.id, filename, parsed.kind, data ?? Buffer.from(pastedText ?? '', 'utf8'), parsed.status, parsed.message, JSON.stringify(parsed.table), nowIso(),
  );
  return { id, filename, kind: parsed.kind, status: parsed.status, message: parsed.message, table: parsed.table, mapping: guessMapping(parsed.table) };
}

export function getImportJob(db: Db, user: User, id: string) {
  const job = get<JobRow>(db, 'SELECT id, user_id, filename, source_kind, status, message, table_json, committed_show_id FROM import_jobs WHERE id = ?', id);
  if (!job || job.user_id !== user.id) throw notFound('Import not found.');
  return { ...job, table: JSON.parse(job.table_json) as string[][] };
}

export function commitImport(
  db: Db,
  user: User,
  jobId: string,
  mapping: ImportMapping,
  target:
    | { mode: 'new'; details: { title: string; eventDate: string; timezone: string; plannedStart: string; venue: string; notes: string } }
    | { mode: 'merge' | 'replace'; showId: string; baseRevision: number },
  memberRole: (showId: string) => string | null,
) {
  const job = getImportJob(db, user, jobId);
  if (job.status === 'unsupported') throw unprocessable(job.message);
  if (job.committed_show_id) throw unprocessable('This import was already committed.');

  if (target.mode === 'new') {
    const result = normalizeImport(job.table, mapping, null);
    const errors = result.issues.filter((i) => i.severity === 'error');
    if (errors.length) throw unprocessable(`${errors.length} problem(s) must be fixed before importing.`, { issues: result.issues });
    return tx(db, () => {
      const showId = createShow(db, user.id, target.details);
      writeContent(db, showId, result.content);
      run(db, 'UPDATE shows SET revision = 1 WHERE id = ?', showId);
      run(db, `INSERT INTO show_revisions (id, show_id, revision, session_id, kind, actor_id, summary, reason, changes, created_at) VALUES (?, ?, 1, NULL, 'import', ?, ?, '', '[]', ?)`,
        newId('rev'), showId, user.id, `Imported ${result.counts.segments} segments and ${result.counts.cues} cues from ${job.filename}`, nowIso());
      addEvent(db, showId, { sessionId: null, type: 'revision', actorId: user.id, actorName: user.name, summary: `Revision 1: imported ${result.counts.segments} segments and ${result.counts.cues} cues from ${job.filename}` });
      run(db, 'UPDATE import_jobs SET status = ?, committed_show_id = ? WHERE id = ?', 'committed', showId, jobId);
      return { showId, counts: result.counts, revision: 1, seq: null as number | null };
    });
  }

  const role = memberRole(target.showId);
  if (role !== 'owner' && role !== 'director') throw forbidden('Only the owner or a Director can import into this show.');
  const existing = loadContent(db, target.showId);
  const result = normalizeImport(job.table, mapping, target.mode === 'merge' ? existing : { ...existing, segments: [], cues: [], groups: [] });
  const errors = result.issues.filter((i) => i.severity === 'error');
  if (errors.length) throw unprocessable(`${errors.length} problem(s) must be fixed before importing.`, { issues: result.issues });
  const next: ShowContent =
    target.mode === 'merge'
      ? {
          departments: result.content.departments,
          segments: [...existing.segments, ...result.content.segments],
          cues: [...existing.cues, ...result.content.cues],
          groups: [...existing.groups, ...result.content.groups],
        }
      : result.content;
  const r = publishContent(db, target.showId, user, { baseRevision: target.baseRevision, content: next, dryRun: false, reason: `Import from ${job.filename}` }, 'import');
  run(db, 'UPDATE import_jobs SET status = ?, committed_show_id = ? WHERE id = ?', 'committed', target.showId, jobId);
  return { showId: target.showId, counts: result.counts, revision: r.revision, seq: r.seq ?? null };
}
