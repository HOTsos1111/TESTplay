// Runtime validation shared by the API server and the client forms.

import { z } from 'zod';
import type { ShowContent } from './types.ts';
import { isValidTimezone, parseClock } from './timing.ts';

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Invalid id');
const shortText = (max = 200) => z.string().max(max);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const roleSchema = z.enum(['owner', 'director', 'operator', 'viewer']);
export const iconSchema = z.enum(['director', 'video', 'audio', 'lighting', 'stage', 'foh', 'generic']);

const clockText = z.string().refine((v) => parseClock(v) !== null, 'Use 24-hour time, e.g. 09:30.');

export const showDetailsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-04.'),
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone.'),
  plannedStart: clockText,
  venue: shortText(120).default(''),
  notes: shortText(4000).default(''),
});
export type ShowDetailsInput = z.infer<typeof showDetailsSchema>;

export const departmentSchema = z.object({
  id,
  key: z.string().min(1).max(32),
  name: z.string().trim().min(1, 'Department name is required.').max(40),
  icon: iconSchema,
  sort: z.number().int(),
  color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, 'Use a colour like #EF4444.').default(''),
});

export const segmentSchema = z.object({
  id,
  position: z.number().int(),
  title: z.string().trim().min(1, 'Segment title is required.').max(160),
  performer: shortText(160),
  durationSec: z.number().int().min(0).max(24 * 3600),
  fixedTime: clockText.nullable(),
  notes: shortText(4000),
});

export const cueSchema = z.object({
  id,
  segmentId: id,
  position: z.number().int(),
  number: z.string().trim().min(1, 'Cue number is required.').max(16),
  departmentId: id,
  instruction: z.string().trim().min(1, 'Instruction is required.').max(2000),
  owner: shortText(80),
  offsetSec: z.number().int().min(0).max(24 * 3600),
  durationSec: z.number().int().min(0).max(24 * 3600),
  groupId: id.nullable(),
  target: z.object({ kind: z.string().max(40), ref: z.string().max(200) }).nullable(),
  standbyScript: z.string().max(500).default(''),
  goScript: z.string().max(500).default(''),
});

export const groupSchema = z.object({
  id,
  label: z.string().trim().min(1, 'Q-Link label is required.').max(120),
  segmentId: id.nullable(),
  standbyScript: z.string().max(500).default(''),
  goScript: z.string().max(500).default(''),
});

export const contentSchema = z.object({
  departments: z.array(departmentSchema).max(30),
  segments: z.array(segmentSchema).max(500),
  cues: z.array(cueSchema).max(3000),
  groups: z.array(groupSchema).max(1000),
});

/** Cross-entity checks that a per-field schema cannot express. */
export function validateContent(content: ShowContent): string[] {
  const errors: string[] = [];
  const segIds = new Set(content.segments.map((s) => s.id));
  const deptIds = new Set(content.departments.map((d) => d.id));
  const groupIds = new Set(content.groups.map((g) => g.id));
  const seen = new Set<string>();
  const dupCheck = (kind: string, ids: string[]) => {
    for (const x of ids) {
      if (seen.has(x)) errors.push(`Duplicate ${kind} id ${x}.`);
      seen.add(x);
    }
  };
  dupCheck('department', content.departments.map((d) => d.id));
  dupCheck('segment', content.segments.map((s) => s.id));
  dupCheck('cue', content.cues.map((c) => c.id));
  dupCheck('group', content.groups.map((g) => g.id));

  const deptKeys = new Set<string>();
  for (const d of content.departments) {
    if (deptKeys.has(d.key)) errors.push(`Two departments share the key "${d.key}".`);
    deptKeys.add(d.key);
  }
  const numbers = new Map<string, string>();
  const deptName = new Map(content.departments.map((d) => [d.id, d.name]));
  for (const c of content.cues) {
    if (!segIds.has(c.segmentId)) errors.push(`Cue ${c.number} belongs to a missing segment.`);
    if (!deptIds.has(c.departmentId)) errors.push(`Cue ${c.number} has no valid department.`);
    if (c.groupId && !groupIds.has(c.groupId)) errors.push(`Cue ${c.number} references a missing Q-Link group.`);
    const key = `${c.departmentId}|${c.number.toLowerCase()}`;
    if (numbers.has(key)) {
      errors.push(`Cue number ${c.number} is used twice in ${deptName.get(c.departmentId) ?? 'one department'}.`);
    }
    numbers.set(key, c.id);
  }
  for (const g of content.groups) {
    const members = content.cues.filter((c) => c.groupId === g.id);
    const depts = members.map((m) => m.departmentId);
    if (new Set(depts).size !== depts.length) {
      errors.push(`Q-Link "${g.label}" has two cues for the same department.`);
    }
  }
  return errors;
}

export const contentPutSchema = z.object({
  baseRevision: z.number().int().min(0),
  content: contentSchema,
  dryRun: z.boolean().default(false),
  reason: shortText(300).default(''),
});

export const draftSchema = z.object({
  baseRevision: z.number().int().min(0),
  content: contentSchema,
});

export const cueActionSchema = z.object({
  target: z.object({ kind: z.enum(['cue', 'group']), id }),
  action: z.enum(['prepare', 'standby', 'go', 'complete', 'hold', 'resume', 'skip', 'restore']),
  reason: shortText(300).default(''),
  idempotencyKey: z.string().min(8).max(80),
  clientId: z.string().min(8).max(80),
});
export type CueActionInput = z.infer<typeof cueActionSchema>;

export const readinessSchema = z.object({
  cueId: id,
  status: z.enum(['ready', 'not_ready', 'issue']),
  note: shortText(300).default(''),
});

export const startSessionSchema = z.object({
  mode: z.enum(['rehearsal', 'live']),
  timingPolicy: z.enum(['manual', 'projected']),
  directorUserId: id,
  clientId: z.string().min(8).max(80),
});

export const takeControlSchema = z.object({
  clientId: z.string().min(8).max(80),
  confirm: z.literal(true),
});

export const endSessionSchema = z.object({ confirm: z.literal(true) });

export const liveOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('moveSegment'), segmentId: id, toIndex: z.number().int().min(0) }),
  z.object({
    op: z.literal('editSegment'),
    segmentId: id,
    title: z.string().trim().min(1).max(160).optional(),
    performer: shortText(160).optional(),
    durationSec: z.number().int().min(0).max(24 * 3600).optional(),
    notes: shortText(4000).optional(),
  }),
  z.object({
    op: z.literal('editCue'),
    cueId: id,
    instruction: z.string().trim().min(1).max(2000).optional(),
    number: z.string().trim().min(1).max(16).optional(),
    owner: shortText(80).optional(),
    offsetSec: z.number().int().min(0).max(24 * 3600).optional(),
  }),
  z.object({ op: z.literal('shift'), deltaSec: z.number().int().min(-3 * 3600).max(3 * 3600) }),
]);
export type LiveOp = z.infer<typeof liveOpSchema>;

export const liveEditSchema = z.object({
  baseRevision: z.number().int().min(0),
  ops: z.array(liveOpSchema).min(1).max(100),
  dryRun: z.boolean().default(false),
  reason: shortText(300).default(''),
  clientId: z.string().min(8).max(80),
});

export const undoSchema = z.object({
  revisionId: id,
  baseRevision: z.number().int().min(0),
  clientId: z.string().min(8).max(80),
});

export const memberAddSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: roleSchema,
  operateDepartments: z.array(id).default([]),
  visibleDepartments: z.array(id).nullable().default(null),
  /** When set, creates a local account for a person who does not have one yet. */
  createAccount: z
    .object({ name: z.string().trim().min(1).max(80), password: z.string().min(10, 'Use at least 10 characters.').max(200) })
    .optional(),
});

export const memberUpdateSchema = z.object({
  role: roleSchema,
  operateDepartments: z.array(id),
  visibleDepartments: z.array(id).nullable(),
});

export const importUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  /** base64 file content; or pastedText for paste intake. */
  dataBase64: z.string().max(15_000_000).optional(),
  pastedText: z.string().max(2_000_000).optional(),
});

export const importFieldSchema = z.enum([
  'ignore',
  'segment',
  'performer',
  'segmentDuration',
  'time',
  'cueNumber',
  'department',
  'instruction',
  'owner',
  'cueDuration',
  'notes',
  'group',
  'deptColumn',
]);
export type ImportField = z.infer<typeof importFieldSchema>;

export const importMappingSchema = z.object({
  headerRow: z.number().int().min(-1),
  columns: z.array(
    z.object({ field: importFieldSchema, department: z.string().max(40).optional() }),
  ),
  linkRows: z.boolean().default(true),
  omitRows: z.array(z.number().int().min(0)).default([]),
  /** Corrected cell values keyed "row:col". */
  overrides: z.record(z.string(), z.string().max(2000)).default({}),
});
export type ImportMapping = z.infer<typeof importMappingSchema>;

export const importCommitSchema = z.object({
  mapping: importMappingSchema,
  target: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('new'), details: showDetailsSchema }),
    z.object({ mode: z.literal('merge'), showId: id, baseRevision: z.number().int() }),
    z.object({ mode: z.literal('replace'), showId: id, baseRevision: z.number().int(), confirm: z.literal(true) }),
  ]),
});
