// HTTP API + static hosting + WebSocket hub. createApp() is used by the CLI
// entry point and by the integration tests (with a temporary database).

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { openDb, get, run, tx, type Db } from './db.ts';
import { HttpError, badRequest, forbidden, notFound, unauthorized } from './errors.ts';
import {
  COOKIE_NAME,
  clearLoginFailures,
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  loginThrottled,
  parseCookies,
  purgeExpiredSessions,
  recordLoginFailure,
  userForToken,
  verifyPassword,
} from './auth.ts';
import {
  addEvent,
  createShow,
  getMembership,
  getShow,
  listMembers,
  listShowsForUser,
  loadContent,
  removeMember,
  updateShowDetails,
  upsertMember,
  writeContent,
  cloneContent,
} from './store.ts';
import { activeSession, cueAction, endSession, findAction, setReadiness, startSession, takeControl } from './sessions.ts';
import { applyLiveEdit, assertCanEditContent, publishContent, undoRevision } from './revisions.ts';
import { buildSnapshot } from './snapshot.ts';
import { Hub } from './hub.ts';
import { commitImport, createImportJob, getImportJob, normalizeImport } from './importer.ts';
import { newId, nowIso } from './ids.ts';
import { DEMO_ACCOUNTS } from './seed.ts';
import { loadConfig, type Config } from './config.ts';
import {
  contentPutSchema,
  cueActionSchema,
  draftSchema,
  endSessionSchema,
  importCommitSchema,
  importMappingSchema,
  importUploadSchema,
  liveEditSchema,
  loginSchema,
  memberAddSchema,
  memberUpdateSchema,
  readinessSchema,
  showDetailsSchema,
  startSessionSchema,
  takeControlSchema,
  undoSchema,
} from '../shared/schemas.ts';
import { STANDARD_DEPARTMENTS } from '../shared/calls.ts';
import type { Member, ShowContent, User } from '../shared/types.ts';

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  url: URL;
  user: User | null;
  body: () => Promise<unknown>;
}

type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  auth: boolean;
  bodyLimit: number;
}

function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(body);
}

function readBody(req: IncomingMessage, limit: number): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'too_large', 'Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolveBody({});
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(badRequest('Body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(422, 'invalid', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.', r.error.issues);
  }
  return r.data;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface App {
  db: Db;
  hub: Hub;
  url: string;
  port: number;
  close: () => Promise<void>;
}

export async function createApp(overrides: Partial<Config> & { staticDir?: string | null } = {}): Promise<App> {
  const config = { ...loadConfig(), ...overrides };
  const db = openDb(config.databasePath);
  purgeExpiredSessions(db);
  const hub = new Hub(db, config.allowedOrigins);
  const staticDir = overrides.staticDir === undefined ? resolve(process.cwd(), 'dist') : overrides.staticDir;
  const routes: Route[] = [];

  const route = (method: string, path: string, handler: Handler, opts: { auth?: boolean; bodyLimit?: number } = {}) => {
    const keys: string[] = [];
    const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    routes.push({ method, pattern, keys, handler, auth: opts.auth ?? true, bodyLimit: opts.bodyLimit ?? 1_000_000 });
  };

  const member = (showId: string, user: User): Member => {
    const m = getMembership(db, showId, user.id);
    if (!m) throw notFound('Show not found or you are not a member.');
    return m;
  };
  const requireOwner = (m: Member) => {
    if (m.role !== 'owner') throw forbidden('Only the show owner can do that.');
  };
  const cookie = (token: string, maxAge: number) =>
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.cookieSecure ? '; Secure' : ''}`;

  // ------------------------------------------------------------ auth
  route('POST', '/api/auth/login', async (ctx) => {
    const input = parse(loginSchema, await ctx.body());
    const key = `${input.email}|${ctx.req.socket.remoteAddress}`;
    if (loginThrottled(key)) throw new HttpError(429, 'throttled', 'Too many attempts. Wait a few minutes and try again.');
    const row = findUserByEmail(db, input.email);
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      recordLoginFailure(key);
      throw new HttpError(401, 'bad_credentials', 'That email and password do not match an account.');
    }
    clearLoginFailures(key);
    const token = createSession(db, row.id);
    ctx.res.setHeader('set-cookie', cookie(token, 14 * 86400));
    return { user: { id: row.id, email: row.email, name: row.name } };
  }, { auth: false });

  route('POST', '/api/auth/logout', (ctx) => {
    destroySession(db, parseCookies(ctx.req.headers.cookie)[COOKIE_NAME]);
    ctx.res.setHeader('set-cookie', cookie('', 0));
    return { ok: true };
  }, { auth: false });

  route('GET', '/api/auth/me', (ctx) => ({ user: ctx.user }), { auth: false });

  route('GET', '/api/demo-accounts', () => ({
    enabled: config.demoLogin,
    accounts: config.demoLogin ? DEMO_ACCOUNTS.map(({ email, name, label, password }) => ({ email, name, label, password })) : [],
  }), { auth: false });

  // ------------------------------------------------------------ shows
  route('GET', '/api/shows', (ctx) => ({ shows: listShowsForUser(db, ctx.user!.id) }));

  route('POST', '/api/shows', async (ctx) => {
    const input = parse(
      z.object({ details: showDetailsSchema, departments: z.array(z.string().max(40)).max(20).default(['video', 'audio', 'lighting', 'stage']), fromTemplateId: z.string().optional() }),
      await ctx.body(),
    );
    const user = ctx.user!;
    const showId = tx(db, () => {
      const id = createShow(db, user.id, input.details);
      let content: ShowContent;
      if (input.fromTemplateId) {
        member(input.fromTemplateId, user);
        content = cloneContent(loadContent(db, input.fromTemplateId));
      } else {
        content = defaultContent(input.departments);
      }
      writeContent(db, id, content);
      addEvent(db, id, { sessionId: null, type: 'show', actorId: user.id, actorName: user.name, summary: input.fromTemplateId ? 'Show created from template' : 'Show created' });
      return id;
    });
    return { showId };
  });

  route('GET', '/api/shows/:id', (ctx) => {
    member(ctx.params.id, ctx.user!);
    return { snapshot: buildSnapshot(db, ctx.params.id, ctx.user!, hub) };
  });

  route('PATCH', '/api/shows/:id/details', async (ctx) => {
    requireOwner(member(ctx.params.id, ctx.user!));
    const input = parse(showDetailsSchema, await ctx.body());
    tx(db, () => {
      updateShowDetails(db, ctx.params.id, input);
      addEvent(db, ctx.params.id, { sessionId: activeSession(db, ctx.params.id)?.id ?? null, type: 'show', actorId: ctx.user!.id, actorName: ctx.user!.name, summary: 'Show details updated' });
    });
    hub.schedule(ctx.params.id);
    return { show: getShow(db, ctx.params.id) };
  });

  route('POST', '/api/shows/:id/duplicate', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    assertCanEditContent(m.role);
    const input = parse(z.object({ title: z.string().trim().min(1).max(120), asTemplate: z.boolean().default(false) }), await ctx.body());
    const src = getShow(db, ctx.params.id);
    const showId = tx(db, () => {
      const id = createShow(db, ctx.user!.id, { ...src, title: input.title, isTemplate: input.asTemplate });
      writeContent(db, id, cloneContent(loadContent(db, ctx.params.id)));
      addEvent(db, id, { sessionId: null, type: 'show', actorId: ctx.user!.id, actorName: ctx.user!.name, summary: input.asTemplate ? `Template saved from ${src.title}` : `Duplicated from ${src.title}` });
      return id;
    });
    return { showId };
  });

  // ------------------------------------------------------------ content & drafts
  route('GET', '/api/shows/:id/draft', (ctx) => {
    member(ctx.params.id, ctx.user!);
    const d = get<{ base_revision: number; content: string; updated_at: string; name: string }>(
      db, 'SELECT d.*, u.name FROM show_drafts d JOIN users u ON u.id = d.updated_by WHERE show_id = ?', ctx.params.id,
    );
    return { draft: d ? { baseRevision: d.base_revision, content: JSON.parse(d.content), updatedAt: d.updated_at, updatedBy: d.name } : null };
  });

  route('PUT', '/api/shows/:id/draft', async (ctx) => {
    assertCanEditContent(member(ctx.params.id, ctx.user!).role);
    const input = parse(draftSchema, await ctx.body());
    run(
      db,
      `INSERT INTO show_drafts (show_id, base_revision, content, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (show_id) DO UPDATE SET base_revision = excluded.base_revision, content = excluded.content, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      ctx.params.id, input.baseRevision, JSON.stringify(input.content), ctx.user!.id, nowIso(),
    );
    return { savedAt: nowIso() };
  });

  route('DELETE', '/api/shows/:id/draft', (ctx) => {
    assertCanEditContent(member(ctx.params.id, ctx.user!).role);
    run(db, 'DELETE FROM show_drafts WHERE show_id = ?', ctx.params.id);
    return { ok: true };
  });

  route('PUT', '/api/shows/:id/content', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    assertCanEditContent(m.role);
    const session = activeSession(db, ctx.params.id);
    if (session && session.directorUserId !== ctx.user!.id && m.role !== 'owner') {
      throw forbidden(`${session.directorName} has Director control; only they or the owner can apply changes during the session.`);
    }
    const input = parse(contentPutSchema, await ctx.body());
    const result = publishContent(db, ctx.params.id, ctx.user!, input);
    if (result.applied) hub.schedule(ctx.params.id);
    return result;
  }, { bodyLimit: 5_000_000 });

  route('GET', '/api/shows/:id/revisions', (ctx) => {
    member(ctx.params.id, ctx.user!);
    return {
      revisions: db
        .prepare(`SELECT r.id, r.revision, r.kind, r.summary, r.reason, r.created_at AS createdAt, r.undo_of AS undoOf, r.undone_by AS undoneBy, u.name AS actorName
          FROM show_revisions r JOIN users u ON u.id = r.actor_id WHERE r.show_id = ? ORDER BY r.revision DESC LIMIT 200`)
        .all(ctx.params.id),
    };
  });

  // ------------------------------------------------------------ members
  route('GET', '/api/shows/:id/members', (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    if (m.role === 'viewer' || m.role === 'operator') throw forbidden();
    return { members: listMembers(db, ctx.params.id) };
  });

  route('POST', '/api/shows/:id/members', async (ctx) => {
    requireOwner(member(ctx.params.id, ctx.user!));
    const input = parse(memberAddSchema, await ctx.body());
    const result = tx(db, () => {
      let user = findUserByEmail(db, input.email);
      let created = false;
      if (!user) {
        if (!input.createAccount) throw new HttpError(404, 'no_account', 'No account uses that email. Create a local account for them below.');
        const u = createUser(db, input.email, input.createAccount.name, input.createAccount.password);
        user = { ...u, password_hash: '' };
        created = true;
      } else if (input.createAccount) {
        throw new HttpError(409, 'account_exists', 'An account with that email already exists; add it without creating a new one.');
      }
      if (getMembership(db, ctx.params.id, user.id)) throw new HttpError(409, 'already_member', `${user.name} is already a member.`);
      upsertMember(db, ctx.params.id, user.id, input.role, input.operateDepartments, input.visibleDepartments);
      addEvent(db, ctx.params.id, { sessionId: null, type: 'membership', actorId: ctx.user!.id, actorName: ctx.user!.name, summary: `${user.name} added as ${input.role}` });
      return { userId: user.id, created };
    });
    hub.schedule(ctx.params.id);
    return result;
  });

  route('PATCH', '/api/shows/:id/members/:userId', async (ctx) => {
    requireOwner(member(ctx.params.id, ctx.user!));
    const input = parse(memberUpdateSchema, await ctx.body());
    tx(db, () => {
      const target = getMembership(db, ctx.params.id, ctx.params.userId);
      if (!target) throw notFound('Member not found.');
      if (target.role === 'owner' && input.role !== 'owner') ensureAnotherOwner(db, ctx.params.id, ctx.params.userId);
      upsertMember(db, ctx.params.id, ctx.params.userId, input.role, input.operateDepartments, input.visibleDepartments);
      addEvent(db, ctx.params.id, { sessionId: null, type: 'membership', actorId: ctx.user!.id, actorName: ctx.user!.name, summary: `${target.name} is now ${input.role}` });
    });
    hub.schedule(ctx.params.id);
    return { ok: true };
  });

  route('DELETE', '/api/shows/:id/members/:userId', (ctx) => {
    requireOwner(member(ctx.params.id, ctx.user!));
    tx(db, () => {
      const target = getMembership(db, ctx.params.id, ctx.params.userId);
      if (!target) throw notFound('Member not found.');
      if (target.role === 'owner') ensureAnotherOwner(db, ctx.params.id, ctx.params.userId);
      removeMember(db, ctx.params.id, ctx.params.userId);
      addEvent(db, ctx.params.id, { sessionId: null, type: 'membership', actorId: ctx.user!.id, actorName: ctx.user!.name, summary: `${target.name} removed from the show` });
    });
    hub.schedule(ctx.params.id);
    return { ok: true };
  });

  // ------------------------------------------------------------ live session
  route('POST', '/api/shows/:id/session/start', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    const input = parse(startSessionSchema, await ctx.body());
    const r = startSession(db, ctx.params.id, ctx.user!, m, input);
    hub.schedule(ctx.params.id);
    return r;
  });

  route('POST', '/api/shows/:id/session/end', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    parse(endSessionSchema, await ctx.body());
    endSession(db, ctx.params.id, ctx.user!, m);
    hub.schedule(ctx.params.id);
    return { ok: true };
  });

  route('POST', '/api/shows/:id/session/take-control', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    const input = parse(takeControlSchema, await ctx.body());
    takeControl(db, ctx.params.id, ctx.user!, m, input.clientId);
    hub.schedule(ctx.params.id);
    return { ok: true };
  });

  route('POST', '/api/shows/:id/cue-actions', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    const input = parse(cueActionSchema, await ctx.body());
    const result = cueAction(db, ctx.params.id, ctx.user!, m, input);
    if (!result.duplicate) hub.schedule(ctx.params.id);
    return result;
  });

  route('GET', '/api/shows/:id/cue-actions/:key', (ctx) => {
    member(ctx.params.id, ctx.user!);
    const r = findAction(db, ctx.params.id, ctx.params.key);
    return r ? { status: 'accepted', result: r } : { status: 'not_received' };
  });

  route('POST', '/api/shows/:id/readiness', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    const input = parse(readinessSchema, await ctx.body());
    setReadiness(db, ctx.params.id, ctx.user!, m, input);
    hub.schedule(ctx.params.id);
    return { ok: true };
  });

  const assertLiveEditor = (showId: string, user: User, m: Member, clientId: string) => {
    assertCanEditContent(m.role);
    const session = activeSession(db, showId);
    if (session && (session.directorUserId !== user.id || session.controlClientId !== clientId)) {
      throw forbidden(`Only the console with Director control (${session.directorName}) can apply live edits.`);
    }
  };

  route('POST', '/api/shows/:id/live-edits', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    const input = parse(liveEditSchema, await ctx.body());
    assertLiveEditor(ctx.params.id, ctx.user!, m, input.clientId);
    const result = applyLiveEdit(db, ctx.params.id, ctx.user!, input);
    if (result.applied) hub.schedule(ctx.params.id);
    return result;
  });

  route('POST', '/api/shows/:id/undo', async (ctx) => {
    const m = member(ctx.params.id, ctx.user!);
    const input = parse(undoSchema, await ctx.body());
    assertLiveEditor(ctx.params.id, ctx.user!, m, input.clientId);
    const result = undoRevision(db, ctx.params.id, ctx.user!, input.revisionId, input.baseRevision);
    hub.schedule(ctx.params.id);
    return result;
  });

  // ------------------------------------------------------------ import
  route('POST', '/api/imports', async (ctx) => {
    const input = parse(importUploadSchema, await ctx.body());
    if (input.dataBase64 === undefined && input.pastedText === undefined) throw badRequest('Choose a file or paste text.');
    return createImportJob(db, ctx.user!, input.filename, input.dataBase64, input.pastedText);
  }, { bodyLimit: 16_000_000 });

  route('GET', '/api/imports/:id', (ctx) => {
    const job = getImportJob(db, ctx.user!, ctx.params.id);
    return { id: job.id, filename: job.filename, kind: job.source_kind, status: job.status, message: job.message, table: job.table, committedShowId: job.committed_show_id };
  });

  route('POST', '/api/imports/:id/normalize', async (ctx) => {
    const input = parse(z.object({ mapping: importMappingSchema, targetShowId: z.string().optional(), mode: z.enum(['new', 'merge', 'replace']).default('new') }), await ctx.body());
    const job = getImportJob(db, ctx.user!, ctx.params.id);
    let existing: ShowContent | null = null;
    let consequences: string | null = null;
    if (input.targetShowId && input.mode !== 'new') {
      member(input.targetShowId, ctx.user!);
      const cur = loadContent(db, input.targetShowId);
      existing = input.mode === 'merge' ? cur : { ...cur, segments: [], cues: [], groups: [] };
      consequences =
        input.mode === 'replace'
          ? `Replace removes the current ${cur.segments.length} segments and ${cur.cues.length} cues and creates a new revision.`
          : `Merge appends after the current ${cur.segments.length} segments; existing cues are not changed.`;
    }
    const result = normalizeImport(job.table, input.mapping, existing);
    return { ...result, consequences };
  });

  route('POST', '/api/imports/:id/commit', async (ctx) => {
    const input = parse(importCommitSchema, await ctx.body());
    const r = commitImport(db, ctx.user!, ctx.params.id, input.mapping, input.target, (showId) => getMembership(db, showId, ctx.user!.id)?.role ?? null);
    if (r.seq) hub.schedule(r.showId);
    return r;
  });

  // ------------------------------------------------------------ server
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const method = req.method ?? 'GET';
        if (method !== 'GET' && method !== 'HEAD') {
          // CSRF guard: browsers cannot send this custom header cross-site without CORS, which is not enabled.
          if (req.headers['x-sho-call'] !== '1') throw forbidden('Missing request header.');
        }
        for (const r of routes) {
          if (r.method !== method) continue;
          const m = r.pattern.exec(url.pathname);
          if (!m) continue;
          const params: Record<string, string> = {};
          r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
          const user = userForToken(db, parseCookies(req.headers.cookie)[COOKIE_NAME]);
          if (r.auth && !user) throw unauthorized();
          const data = await r.handler({ req, res, params, url, user, body: () => readBody(req, r.bodyLimit) });
          return json(res, 200, data ?? {});
        }
        throw notFound('Unknown API route.');
      }
      if (url.pathname === '/healthz') return json(res, 200, { ok: true });
      return serveStatic(url.pathname, res);
    } catch (err) {
      if (err instanceof HttpError) return json(res, err.status, { error: err.message, code: err.code, details: err.details });
      console.error(err);
      return json(res, 500, { error: 'Something went wrong on the server. The request was not applied.', code: 'server_error' });
    }
  }

  function serveStatic(pathname: string, res: ServerResponse) {
    if (!staticDir || !existsSync(staticDir)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Client not built. Run `npm run dev` (dev server) or `npm run build` first.');
    }
    const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(staticDir, safe);
    if (!file.startsWith(staticDir) || !existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html');
    const ext = extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    createReadStream(file).pipe(res);
  }

  const server = createServer((req, res) => void handle(req, res));
  server.on('upgrade', (req, socket, head) => hub.handleUpgrade(req, socket, head));
  await new Promise<void>((r) => server.listen(config.port, r));
  const port = (server.address() as AddressInfo).port;
  return {
    db,
    hub,
    port,
    url: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((r) => {
        hub.close();
        server.closeAllConnections();
        server.close(() => {
          db.close();
          r();
        });
      }),
  };
}

function ensureAnotherOwner(db: Db, showId: string, userId: string) {
  const others = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM show_members WHERE show_id = ? AND role = 'owner' AND user_id != ?`, showId, userId)!.n;
  if (others === 0) throw new HttpError(409, 'last_owner', 'A show needs at least one owner.');
}

/**
 * A new blank show opens with one segment and one opening cue for every
 * department chosen at setup, linked as a single Q-Link call.
 */
export function defaultContent(departmentNames: string[]): ShowContent {
  const departments = departmentNames.map((name, i) => {
    const std = STANDARD_DEPARTMENTS.find((d) => d.key === name);
    return std
      ? { id: newId('dep'), key: std.key, name: std.name, icon: std.icon, sort: i, color: '' }
      : { id: newId('dep'), key: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) || `dept-${i}`, name, icon: 'generic' as const, sort: i, color: '' };
  });
  const segment = { id: newId('seg'), position: 0, title: 'Opening', performer: '', durationSec: 300, fixedTime: null, notes: '' };
  const group = departments.length > 1 ? { id: newId('grp'), label: 'Opening cue', segmentId: segment.id, standbyScript: '', goScript: '' } : null;
  const cues = departments.map((d, i) => ({
    id: newId('cue'),
    segmentId: segment.id,
    position: i,
    number: '001',
    departmentId: d.id,
    instruction: `${d.name}: opening cue (edit this instruction)`,
    owner: '',
    offsetSec: 0,
    durationSec: 0,
    groupId: group?.id ?? null,
    target: null, standbyScript: '', goScript: '',
  }));
  return { departments, segments: departments.length ? [segment] : [], cues, groups: group ? [group] : [] };
}
