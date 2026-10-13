// Shared Sho Call domain types. Used by the server, the client and the tests.
// Every show-owned entity carries a stable id that never changes when display
// order or the human cue number changes.

export type Role = 'owner' | 'director' | 'operator' | 'viewer';

export type CueState =
  | 'pending'
  | 'prepared'
  | 'standby'
  | 'called'
  | 'complete'
  | 'held'
  | 'skipped';

export type CueAction =
  | 'prepare'
  | 'standby'
  | 'go'
  | 'complete'
  | 'hold'
  | 'resume'
  | 'skip'
  | 'restore';

export type Readiness = 'ready' | 'not_ready' | 'issue';
/** Aggregate readiness of a cue or Q-Link group as shown to the Director. */
export type AggregateReadiness = 'ready' | 'pending' | 'issue' | 'unknown';

export type SessionMode = 'rehearsal' | 'live';
export type TimingPolicy = 'manual' | 'projected';

export type IconKey = 'director' | 'video' | 'audio' | 'lighting' | 'stage' | 'foh' | 'generic';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Department {
  id: string;
  key: string;
  name: string;
  icon: IconKey;
  sort: number;
}

export interface Segment {
  id: string;
  position: number;
  title: string;
  performer: string;
  /** Planned duration in seconds. */
  durationSec: number;
  /** Optional fixed local start time "HH:MM" that must not be shifted. */
  fixedTime: string | null;
  notes: string;
}

/**
 * Optional metadata reserved for future playback/hardware adapters. v1 stores
 * and displays it but never triggers anything from it.
 */
export interface CueTarget {
  kind: string;
  ref: string;
}

export interface Cue {
  id: string;
  segmentId: string;
  position: number;
  number: string;
  departmentId: string;
  instruction: string;
  owner: string;
  /** Planned offset from the start of its segment, seconds. */
  offsetSec: number;
  durationSec: number;
  groupId: string | null;
  target: CueTarget | null;
}

export interface CueGroup {
  id: string;
  label: string;
  segmentId: string | null;
}

export interface ShowContent {
  departments: Department[];
  segments: Segment[];
  cues: Cue[];
  groups: CueGroup[];
}

export interface ShowDetails {
  id: string;
  title: string;
  /** Local event date, YYYY-MM-DD. */
  eventDate: string;
  /** IANA timezone, e.g. Europe/London. */
  timezone: string;
  /** Planned local start, HH:MM. */
  plannedStart: string;
  venue: string;
  notes: string;
  isTemplate: boolean;
  revision: number;
  updatedAt: string;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Department ids this member may operate (acknowledge readiness for). */
  operateDepartments: string[];
  /** Department ids this member may see; null means all departments. */
  visibleDepartments: string[] | null;
}

export interface LiveSession {
  id: string;
  mode: SessionMode;
  timingPolicy: TimingPolicy;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt: string | null;
  directorUserId: string;
  directorName: string;
  /** The browser tab (client id) that holds calling control, if any. */
  controlClientId: string | null;
}

export interface CueLiveState {
  cueId: string;
  state: CueState;
  prevState: CueState | null;
  reason: string;
  calledAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  lastActionId: string | null;
}

export interface SegmentLive {
  segmentId: string;
  /** Accumulated delay applied by live timing shifts, seconds. */
  delaySec: number;
  actualStart: string | null;
  actualEnd: string | null;
}

export interface ReadinessEntry {
  cueId: string;
  userId: string;
  userName: string;
  status: Readiness;
  note: string;
  updatedAt: string;
  /** False when the operator is no longer connected: display as unknown. */
  fresh: boolean;
}

export interface Presence {
  userId: string;
  name: string;
  role: Role;
  departments: string[];
  online: boolean;
  lastSeen: string;
}

export interface ActivityEvent {
  seq: number;
  sessionId: string | null;
  type: string;
  actorName: string;
  summary: string;
  revision: number;
  createdAt: string;
  /** For content revisions: whether an Undo is currently offered. */
  undoableRevisionId?: string | null;
}

export interface Snapshot {
  seq: number;
  serverNow: string;
  show: ShowDetails;
  me: Member;
  members: Member[];
  content: ShowContent;
  session: LiveSession | null;
  cueStates: CueLiveState[];
  segmentLive: SegmentLive[];
  readiness: ReadinessEntry[];
  presence: Presence[];
  activity: ActivityEvent[];
}

export interface ShowSummary {
  id: string;
  title: string;
  eventDate: string;
  venue: string;
  isTemplate: boolean;
  revision: number;
  role: Role;
  state: 'draft' | 'rehearsal' | 'live' | 'ended';
  updatedAt: string;
}

/** A change to one entity inside a revision; used for previews, history and undo. */
export interface EntityChange {
  kind: 'segment' | 'cue' | 'group' | 'department' | 'delay';
  id: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface ChangePreview {
  summary: string;
  changes: EntityChange[];
  affectedCueIds: string[];
  affectedDepartmentIds: string[];
  timingNotes: string[];
  errors: string[];
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}
