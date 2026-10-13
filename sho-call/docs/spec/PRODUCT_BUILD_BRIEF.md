# Sho Call v1 — Detailed product and implementation brief

Prepared 13 October 2026. Visible product name: **Sho Call**. Established web domain: **www.shocall.com**. Master brand: **Verdigen**. Tagline: **Live show coordination reimagined.**

## 1. Product in plain language

Sho Call is a password-protected, web-based workspace for planning and coordinating live shows. A Director/showcaller creates a running order and calls cues from a master console. Audio, video, lighting, stage management and other crew follow that same show on phones, tablets or laptops, with each person choosing a focused department view or a broader view of the production.

The system replaces multiple printed cue sheets, scattered spreadsheets and conflicting revisions with one shared, current show flow. A speaker changing order, a delayed segment, a held cue or a revised instruction can be applied during the show and distributed to connected users. Each crew member sees the information needed for their job, while the Director can inspect the entire production. It supplements crew communication and human execution; v1 does not trigger audio, video or lighting hardware.

Use cases include conferences, awards, theatre, concerts, launches and experiential events. Initial demonstration uses fictional Summit Live data. Do not suggest these categories imply integrations with their equipment.

## 2. Confirmed v1 scope

- Password-protected access, show membership, role-based permissions.
- Create a show directly in Show Designer; import traditional documents/spreadsheets through a review step.
- Running order, segments, department cues, cue numbers, times, durations, descriptions and statuses.
- Master Director view and individually configurable crew views.
- Q-Link grouped cues and independent department calls.
- Prepare, Standby and Go actions; completed history and relevant upcoming cues.
- Live synchronization, timeline shifts and approximate adaptive countdowns.
- Preset views and keyboard shortcuts, focused cue highlighting.
- Minimal live edits: move, hold, skip and revise segments/cues, with apply/undo and visible updates.
- Alerts and clear offline/reconnecting/stale states.
- Responsive phone, tablet and laptop layouts.
- Extension points for future playback targets/statuses without implementing playback.

## 3. Roles and permissions

Recommended initial roles: owner/producer, Director, department operator, viewer. Owner manages membership and show configuration. Director owns live calls and published edits. Operators can see permitted departments and submit readiness/acknowledgement for their assigned cues. Viewers are read-only. Separate visibility of a department from permission to operate it. A department filter never grants access. Enforce authorization on the server, including real-time subscriptions.

Keep one active calling Director per session. A second Director connection should be read-only until an explicit transfer; display who has control. Avoid competing consoles silently issuing commands. Do not use a shared password as the only production identity model: authenticated membership should attribute actions to a user. A clearly labeled prototype can use seeded accounts.

## 4. Show planning and input

Show details: title, event date/timezone, venue, planned start, departments, notes and crew. Segments have stable IDs, display order, title, speaker/performer, estimated duration, scheduled time and notes. Department cues have stable IDs, human cue number, department, instruction, owner, planned timing/offset, estimated duration and optional group.

Build editable rows with inline validation and a details drawer. Add, duplicate, reorder, remove, search and filter. Dragging must have a keyboard-accessible Move action. Cue descriptions can wrap; full instructions must never depend on hover. Support templates and saving a show as a reusable template. Keep editing separate from publishing during a live session.

## 5. Import workflow

Provide XLSX and CSV import first, with explicit column mapping. Include a downloadable sample CSV. Support document intake in a practical second pass: DOCX tables or pasted text with a preview; PDF extraction, if implemented, must mark uncertain rows for manual review. Scanned PDFs must show an honest unsupported/needs-OCR result unless OCR is actually implemented. Do not pretend that every traditional document imports perfectly.

Flow: choose file → preview → map columns → normalize departments/times → flag errors/ambiguities → review → confirm → commit. Preserve the uploaded source separately from the normalized show. Handle blank rows, merged headings, duplicates, missing department names, invalid times and cue-number collisions. No partial silent write on validation failure. Show a count of imported segments and cues. Import into a new show by default; explicitly select merge/replace for existing content and show consequences before applying.

## 6. Q-Link semantics

Q-Link binds selected cues across departments to one Director call. It can represent all department instructions in a running-order row or a manually selected subset. Unlinked cues remain independently callable. Display a chain/group indicator, member departments and group label. Editing group membership must preserve each cue ID and instructions.

Calling a group uses one atomic server command so all members receive the same action ID and timestamp. One Go event must not create duplicate calls on double-click, retry or reconnect. Operator readiness is separate from the Director call status. A Go means the instruction was issued, not proof that equipment ran. Only an explicit completion action marks a cue complete. Show aggregate group readiness as ready/pending/issue, derived from its members. Never turn a disconnected operator into ready.

## 7. Live show operation

Director console offers full show, current/upcoming, compact overview, expanded cue detail and department presets. Current cue/segment remains prominent. Upcoming calls use gold accents; completed history is muted but legible. Live follow auto-scrolls only when enabled. Manual scrolling pauses follow and reveals Return to Live. Avoid unexpected jumping while a person reviews earlier instructions.

Actions: Prepare, Standby, Go, Complete, Hold, Resume and Skip. A sensible cue state model is pending → prepared → standby → called → complete, with held/skipped as explicit states. Store prior state when holding; resume restores it without reissuing Go. Hold/skip require reasons when relevant. Skipped cues are retained in history. Do not automatically Go when a countdown reaches zero. Expose direct calls for independent cues and grouped calls for Q-Link.

Keyboard shortcuts should be configurable or documented. Recommended mapping: 1 Full Show, 2 Current/Upcoming, 3 Compact, 4 Expanded, F Return to Live, S Standby, G Go. Hotkeys operate only in the live console when focus is outside text inputs, dialogs and editable fields; show focus/armed target clearly. Do not silently make a keyboard press fire a different cue after filtering. Provide visible buttons for all keyboard actions.

## 8. Timing and adaptation

Distinct labels: Cue number, Cue time, Cue description, Status, Show clock and Approx. countdown. Show actual wall-clock time separately from elapsed session time. Countdown must say Approx. and show its target. Store dates/timestamps with timezone-safe handling; never mix elapsed durations with local times.

Use a planned schedule and an active live schedule. Starting late can shift future estimates. A segment running long updates projected future timing, with clear delay indicators. Confirm the timing policy at session setup: manual shifts or estimated automatic projection; neither policy issues cues. Applying +05:00 updates eligible future items consistently on connected views while retaining original planned times for comparison. Completed/called timestamps never change retroactively. Flag fixed-time items and conflicts rather than blindly shifting them. Manual duration overrides should be explicit.

Server timestamps anchor timers; clients derive smooth display locally and periodically resynchronize. On reconnect, obtain authoritative state and revision before rendering the display as live. A frozen stale countdown must not look current.

## 9. Live edits and history

Live edit mode creates a draft change set while the published show stays usable. Move a speaker/segment, change instructions, hold, skip, adjust duration or shift timing. Before Apply, show affected cues, departments and timing. Commit one revision atomically and broadcast a human-readable change summary. Operators see the changed instruction and revision marker without losing their selected view.

Use revision checks to prevent overwriting a concurrent edit. Undo creates a compensating revision for eligible content edits; it cannot erase an issued Go, completed action, audit entry or executed real-world event. For irreversible live actions, offer a clearly labeled corrective action rather than fake rollback. Record actor, timestamp, reason, revision and before/after values.

## 10. Crew experience and alerts

Each operator sees a clearly named department and consistent icon, the current relevant cue, next cues, timing and status. They may expand other permitted departments. Preferences belong to the user/device and do not change others' views. Director identity remains Director throughout the interface.

Provide readiness states Ready, Not Ready and Issue, distinct from call states, with optional note. Display a prominent Go/Standby alert for assigned cues. Alerts require text and shape as well as color. Optional sound must be opt-in with a Test Sound button; browser sound restrictions mean silent delivery cannot be assumed. Treat vibration as an optional progressive enhancement. Important change notices remain in an activity panel after dismissal.

## 11. Connection and reliability

Connected, reconnecting and offline/stale states are always visible. Show last sync time and current revision. On disconnect, retain the last received sheet for reading with a conspicuous stale marker; disable server-mutating controls. Do not queue Go commands offline or replay them later. Recover with a state snapshot and ordered events. Readiness and participant presence should expire appropriately and display unknown if stale. Page refresh restores selected view and retrieves live server state.

Recommended implementation: typed responsive frontend, server API, persistent database, authenticated real-time channels and a shared schema/validation layer. Reuse an existing stack when present. Separate cue coordination domain logic from presentation. Use idempotency keys, revision numbers and server-side transactions. Do not assume real-time transport alone provides durable history. Rehearsal and live sessions must be distinct, with a conspicuous rehearsal badge and separate event logs.

## 12. Suggested domain model

User; Show; ShowMembership; Department; Segment; Cue; CueGroup; CueGroupMember; ShowRevision; LiveSession; CueAction; OperatorReadiness; ActivityEvent; UserViewPreference; ImportJob. Every show-owned entity carries showId. Sessions carry mode, status, actual start and controlling Director. Use stable IDs regardless of changing display order or human cue number. Include target metadata fields for future adapters without introducing playback side effects.

API families: authentication/membership; shows/templates; segments/cues/groups; import preview/commit; session start/end/control-transfer; live cue actions/readiness; revision apply/correct; snapshot/events. Specify runtime validation and error handling for each implemented action. Distinguish rejected commands from accepted commands whose acknowledgement was lost.

## 13. Demo and acceptance criteria

Seed Summit Live with five departments, at least eight segments, a speaker change, a linked opening cue, independent cues, a held cue and estimated timings. Include Director, Audio, Lighting, Stage Manager and read-only demo accounts. Provide an obvious demo/rehearsal label.

The build is ready to showcase when:

1. A user creates or imports a show, corrects mappings, and saves the normalized running order.
2. Director and crew open separate browsers/devices and receive the same authoritative session state.
3. A Q-Link Go updates all members once; repeating its request does not issue another Go.
4. An independent audio cue can be called without changing unrelated cues.
5. Crew filter departments, expand context and acknowledge readiness without gaining Director rights.
6. Director applies a speaker reorder and +05:00 future shift; every connected client sees the revision and timing changes.
7. Eligible edit Undo records a correction without deleting previous live calls.
8. Disconnect clearly marks stale state, disables mutations, and reconnect recovers without replaying Go.
9. Phone, tablet and desktop layouts remain readable and keyboard controls do not fire while typing.
10. Unauthorized commands/subscriptions are rejected on the server.

Test the cue state machine, atomic grouped calls, duplicate requests, revision conflicts, permissions, timeline shifts, and reconnect recovery. Add a meaningful cross-client integration test plus responsive/accessibility smoke checks. Document executed checks, known limitations and deployment prerequisites. Do not declare production readiness based solely on a successful build.

## 14. Implementation sequence

First: identity, seeded show, Director and crew layouts, persistent cue model and real synchronization. Second: Q-Link, readiness, timing and event history. Third: Show Designer, CSV/XLSX review/import, templates and revisioned live edits. Fourth: responsive polish, connectivity recovery, permission tests and demo documentation. Finish the complete v1 scope; explicitly document any unsupported import formats. Future roadmap: playback adapters, hardware targets, advanced integrations and broader automation, separate from v1.
