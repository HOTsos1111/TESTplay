# Sho Call — v1 preliminary build

**Live show coordination reimagined.** A password-protected web workspace where a Director plans a running order and calls cues from a master console. Audio, video, lighting, stage management and front-of-house crew follow the same show on phones, tablets or laptops. A Verdigen product.

This is a working **preliminary build** for demonstration and evaluation. It is not production-ready (see [Known limitations](#known-limitations)). All demo data (“Summit Live”, people and venue) is fictional. Sho Call does **not** trigger audio, video or lighting equipment: a Go means the instruction was issued to people.

The product brief, style guide and UX spec this build follows are in [`docs/spec/`](docs/spec/).

## Quick start

Requires **Node.js 22.18 or newer** (it uses Node's built-in TypeScript type stripping and `node:sqlite`; no native modules, no external database).

```bash
cd sho-call
npm install
npm run dev          # API + WebSocket server on :8787 and the Vite client on :5174
```

Open <http://localhost:5174>. On an empty database the server seeds the fictional **Summit Live** demo automatically. Demo accounts all use the password `showcall-demo`, and the login page has one-click buttons for them:

| Account | Role |
|---|---|
| producer@summit-live.example | Owner/producer: membership, show details |
| director@summit-live.example | Director: calls cues, live edits |
| audio@summit-live.example | Operator: Audio |
| lighting@summit-live.example | Operator: Lighting |
| video@summit-live.example | Operator: Video |
| stage@summit-live.example | Operator: Stage Manager + Front of House |
| viewer@summit-live.example | Viewer (read-only) |

To see real synchronization, open the Director in one browser and a crew account in **another browser or a private window** (sessions are cookie-based, so two tabs in the same profile share one login). To try it on a phone on the same network, run `npm run build && npm start` and open `http://<your-computer-ip>:8787`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server (auto-restart) + Vite dev server with proxy |
| `npm run build` | Typecheck and build the client into `dist/` |
| `npm start` | Production server: API, WebSocket and the built client on one port |
| `npm run db:migrate` | Apply SQL migrations (also done automatically on start) |
| `npm run user:create -- --email … --name … --password …` | Create a local account (e.g. the first owner when `DEMO_LOGIN=false`) |
| `npm run db:seed` | **Reset** the database file and seed Summit Live (planned start ≈10 minutes from now) |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run check:browser` | End-to-end walkthrough in headless Chromium across two browser contexts; writes `screenshots/` (needs `npm run build`; set `CHROME=/path/to/chrome` if Playwright's Chromium is not installed) |

### Configuration

Copy `.env.example` to `.env` if you need to change anything. No secrets are required.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | HTTP + WebSocket port |
| `CLIENT_PORT` | `5174` | Vite dev server port |
| `DATABASE_PATH` | `./data/sho-call.db` | SQLite file (created and migrated automatically) |
| `ALLOWED_ORIGINS` | *(empty)* | Extra browser origins allowed to open the WebSocket |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `DEMO_LOGIN` | `true` | Show demo-account buttons and auto-seed an empty database |

## Hosted prototype (Render)

The repository root has a `render.yaml` Blueprint that deploys this app as one free Render web service. The service handles the API, the WebSocket and the built client on one HTTPS URL.

1. Sign in at <https://dashboard.render.com> with GitHub and allow Render to access this repository.
2. Choose **New → Blueprint** and pick the repository. Render reads `render.yaml`, which deploys the `claude/epic-fermat-fsrgla` branch from `sho-call/`. Click **Apply**.
3. When the deploy is live, open the `https://sho-call-….onrender.com` URL. Use the demo-account buttons, with the Director on a laptop and a crew account on a phone or in a private window.

Free-plan behaviour: the service sleeps after about 15 minutes idle, and the first visit after that takes up to a minute to wake it. The database lives on temporary disk, so every restart or redeploy resets to a freshly seeded Summit Live. That is fine for a prototype; keeping data would need a paid instance with a persistent disk. After merging to another branch, change `branch:` in `render.yaml`.

## Demo walkthrough

About ten minutes, following the showcase in the UX spec. Every step is backed by server state; `npm run check:browser` automates it.

1. **Director laptop:** sign in as Director → *Director console*. The seed has a rehearsal running with no console in control, so the console is read-only. Choose **Take control here…** and confirm.
2. **Audio phone** (second browser): sign in as Audio operator → *Crew view*. The blue Audio workspace shows the current/next cue, an Approx. countdown and readiness buttons. It has no Director controls.
3. The armed call is **001 “House open”**, a Q-Link of four departments. Press **S** (or Standby). The Audio phone shows a STANDBY alert.
4. On the phone press **Ready**. The Director's focus card shows Audio *Ready*. Readiness is separate from the call state.
5. Press **G** (or Go). All four members become *called* with one action id and timestamp, and the phone shows GO. Pressing G again does nothing: the armed call stays put and is already called.
6. Click the **021** row (an independent Audio cue) and Go it. Nothing else changes.
7. **Live edit** → *Move segments*: move the panel up. *Adjust timing*: **+05:00**. Review the server preview (affected cues, departments, timing) → **Apply changes**. Both devices show “Revision N: … moved after …; upcoming estimates +05:00”. The fixed-time walk-out is not shifted.
8. In Activity, **Undo** the revision. A compensating revision is created and earlier calls are untouched.
9. On a crew device, toggle departments (e.g. Lighting only, then add Audio). The filter is personal and never changes the Director's view or grants access.
10. Scroll the Director running order: follow pauses and **Return to Live (F)** appears.
11. Put the crew device offline (airplane mode, or DevTools → Network → Offline). It shows **Offline — showing revision N, last synced …** with a STALE stamp, and readiness is disabled. Go back online: it reconnects, fetches the authoritative snapshot and replays nothing.
12. Open **Show Designer**. The default **Grid** layout puts each call on one row with a column per department; **List** shows cues vertically. Click a call's script box to edit its Standby/GO call notes, a `+` cell to add a department to a call, or **Add cue** to pick departments (with **ALL**). It shows segments, department cues, Q-Links and the details drawer. Then use **Import → Sample CSV** to go through preview → mapping → review → confirm.

The seed also includes a speaker change (published revision 2), a held cue (Lighting 060, “waiting for the award result”), estimated timings, a fixed-time item and a reusable template.

## Director call script

Every call has a **call script**: what the show caller reads aloud. It defaults to the standard form, for example *“Standby Video, Audio and Lighting for Cue 023”* and *“Video, Audio and Lighting — GO Cue 023”*. It appears as a large bold box at the front of each running-order row in the Director console, with the line to read next highlighted, and large in the armed-call card. **Script on/off** toggles the column. Call notes are edited in Show Designer and saved with the show's revisions. Clearing a field returns it to the default. A Q-Link call stores its script on the group; an independent cue stores it on the cue.

## Architecture

```
shared/   domain types, cue state machine, Q-Link/call derivation, timing projection, zod schemas
server/   node:http API + ws real-time hub + node:sqlite persistence
src/      React 19 client (Vite)
tests/    Vitest unit + cross-client integration tests (real HTTP + WebSocket)
scripts/  dev runner, browser walkthrough check
```

- **Server-authoritative, revisioned.** All state lives in SQLite. Every mutation runs in one transaction and bumps a per-show sequence number. Content edits create numbered **revisions** with before/after values and are rejected with `409 revision_conflict` when based on a stale revision.
- **Commands.** Cue actions are HTTP POSTs carrying an **idempotency key** and the calling console's client id. Retrying a key returns the original result (`duplicate: true`) and never re-issues. A Go on an already-called cue is rejected by the state machine. A Q-Link call is one transaction: every eligible member gets the same action id and timestamp. If a response is lost, the console asks `GET /cue-actions/:key` after reconnecting and reports *accepted* or *not received*. It never resends on its own.
- **Real-time.** Authenticated WebSocket (`/ws`, session cookie, origin check). Membership is checked on subscribe and on every push. Each push is a full, permission-filtered **snapshot** with a sequence number, so reconnecting clients recover authoritative state rather than replaying events. Durable history is the `activity_events` table, not the socket.
- **Permissions** are enforced on the server for HTTP and subscriptions. Roles are owner, director, operator and viewer. Departments an operator operates are separate from those they can see, and hidden departments are removed from snapshots server-side. There is one controlling Director **console** per session; other consoles, including the same user's other tabs, are read-only until an explicit, logged **Take control**.
- **Timing.** A planned schedule comes from segment durations in the show's IANA timezone. The live schedule adds per-segment delays from shifts. Under *projected* policy it also pushes for late starts and overruns. Fixed-time items never shift and conflicts are flagged. Called times never change, and countdowns are labelled *Approx.* and never issue cues.
- **Rehearsal vs live** sessions are separate rows with separate event logs. The rehearsal badge is always visible.
- **Future adapters.** Cues carry an optional `target` field for playback/hardware adapters. v1 stores it and never acts on it.

Main API families: `/api/auth/*`, `/api/shows` (create, duplicate, templates, details, members), `/api/shows/:id/{draft,content,revisions}`, `/api/shows/:id/session/{start,end,take-control}`, `/api/shows/:id/{cue-actions,readiness,live-edits,undo}` and `/api/imports/*` (upload → normalize → commit). Errors return `{ error, code, details? }` with 401/403/404/409/422 as appropriate.

### Import support

| Source | Status |
|---|---|
| CSV / TSV / pasted text | Supported, with delimiter detection |
| XLSX | Supported (first worksheet, time-formatted cells) |
| DOCX | Tables are read (largest table) with a review warning. Without a table, paragraphs become rows. |
| PDF (text or scanned) | **Not supported.** It is reported as unsupported; there is no extraction or OCR. |
| Legacy `.xls` | Not supported; re-save as `.xlsx` or CSV |

Two sheet shapes are handled. In *one row per cue* the sheet has a Department column. In *one row per segment* each department has its own column, and each row can become a Q-Link. The import flags blank rows, merged headings, duplicates, missing departments, invalid times, duration/time disagreements and cue-number collisions. Cells can be corrected and rows omitted in the preview. The original upload is stored separately from the normalized show. A commit with any error writes nothing. New show is the default. Merge or replace into an existing show shows the consequences first and goes through the normal revision check.

## Checks run for this build

- `npm run typecheck`: clean.
- `npm test`: 52 tests across 5 files. They cover the cue state machine, Q-Link aggregation, timezone/DST conversion, schedule shifts and projection, CSV/XLSX/DOCX import and validation, and a **cross-client integration suite**: two real clients over HTTP + WebSocket test atomic Q-Link Go, duplicate requests, an independent cue, hold/resume, permission rejections for HTTP and WebSocket, a CSRF header check, server-side department filtering, reorder + shift propagation, revision conflicts, undo, issued-cue deletion protection, reconnect recovery without replay, lost-acknowledgement lookup, stale readiness and session separation.
- `npm run check:browser`: 26 steps in headless Chromium with a Director laptop context and an Audio phone context. It covers the walkthrough above plus no horizontal scrolling at phone/tablet/desktop sizes, keyboard shortcuts ignored while typing, viewer has no enabled controls, and a basic accessibility pass (named buttons and links, labelled inputs, image alt text, main landmark).

## Known limitations

- **Not production-ready.** Before any real event it would need a security review, load testing, backups, monitoring and an accessibility audit with assistive-technology users.
- **Accounts:** local email + password accounts only. There is no password reset, email invitation or SSO. Owners can create a local account for a crew member and must pass on the password themselves; nothing is emailed.
- **Single server process.** Real-time fan-out is in memory, so horizontal scaling would need a shared pub/sub such as Postgres LISTEN/NOTIFY or Redis. SQLite suits one node.
- `node:sqlite` is marked experimental in Node 22. Node prints an `ExperimentalWarning`, which the npm scripts silence.
- **Import:** PDF/OCR and legacy `.xls` are unsupported, and DOCX import uses the largest table only.
- **Show Designer:** reordering uses Move up/down buttons (keyboard accessible); there is no drag-and-drop. Templates are copies of a show; editing a template does not update shows made from it.
- **Preferences:** view presets, department filters, sound and follow-live are stored per device in `localStorage` (by design, they are personal). They do not roam between devices.
- **Keyboard shortcuts** are fixed (documented in Help) rather than user-editable.
- Readiness and presence go stale 15 seconds after an operator disconnects.
- No playback or hardware integration (out of scope for v1).

## Deployment prerequisites

- Node.js ≥ 22.18 on a single host, and a persistent volume for `DATABASE_PATH`.
- HTTPS termination in front (a reverse proxy) with WebSocket upgrade forwarding for `/ws`. Set `COOKIE_SECURE=true` and add the public origin to `ALLOWED_ORIGINS` if it differs from the host header.
- Set `DEMO_LOGIN=false`, create the first owner with `npm run user:create`, then add crew from each show's member settings (there is no self sign-up).
- `npm ci && npm run build && npm start`.

## Screenshots

Captured by `npm run check:browser` from the running app (fictional demo data):

| | |
|---|---|
| ![Director console](docs/screenshots/03-director-desktop.png) | ![Audio phone receiving Go](docs/screenshots/04-audio-phone-go.png) |
| ![Lighting tablet with Audio context](docs/screenshots/06-lighting-tablet-landscape.png) | ![Offline crew phone](docs/screenshots/07-audio-phone-offline.png) |
| ![Show Designer](docs/screenshots/10-designer.png) | ![Import review](docs/screenshots/11-import-review.png) |
