# Sho Call — Screen and interaction specification

## Reference map

| Reference | Implemented screen/relationship |
|---|---|
| 01_ShoCal_Cover.png | Brand/login atmosphere and product identity |
| 02a_Audio_Crew_Use.png | Audio operator using a portable crew view |
| 02b_Lighting_Crew_Use.png | Lighting operator and department identity |
| 03_Director_View_Presets.png | Director overview/compact/expanded views |
| 04_Shared_Web_Show.png | One shared show across connected devices |
| 05_Director_Video_Audio.png | Director and department layout family |
| 06_Lighting_Stage_Manager.png | Lighting and stage-management identity |
| 07_Department_View_Filters.png | Select relevant departments/expand context |
| 08_Live_Timeline_Updates.png | Live edits and delayed schedule propagation |
| 09_Import_and_Edit_Show.png | Spreadsheet/document import and review |
| 10_Show_Designer_Q_Link.png | Show Designer and Q-Link grouping |
| 11_Audio_Cue_Timing.png | Distinct cue fields, show clock/countdowns |
| 12_Front_of_House_Crew.png | Additional crew use beyond technical departments |
| VertiGen_Emblem_Gold.png | Subtle Verdigen attribution |

## A. Login and show dashboard

Login has product identity, accessible credentials, recoverable validation and clear demo access if enabled. Dashboard lists shows with title/date/venue, draft/live/ended state, role and last revision. Primary actions Create Show, Import Show, Open Show. Show membership and session state before exposing live controls. Include empty state and duplicate/template actions. A live show opening as viewer must never expose an enabled Go button.

## B. Show setup

Capture title, date, timezone, planned start, venue, departments and crew. Offer standard Video, Audio, Lighting and Stage Manager, plus custom departments. Invite/add members through an implemented mechanism; do not show a success toast for an unsent invite. Choose rehearsal or live session deliberately. Display which user will have Director control. Do not start live calling as an incidental result of saving show details.

## C. Import review

Three-part layout: file/source summary, data preview, mapping/validation panel. Each field maps to a column with examples. Highlight ambiguous timing and missing departments. Allow corrected cells and explicit omit-row choices. Show imported item counts and unhandled content before Confirm Import. Error states preserve selections so the user can fix them. Provide keyboard-accessible column mapping and a sample file.

## D. Show Designer

Gold/bronze shell, show details in top bar. Running-order rows show segment number/title, time, duration, department cue summaries and Q-Link status. Details drawer edits full instructions, owners and timing. Toolbar: Add Segment, Add Cue, Import, Search, Departments, Save Draft, Publish. Grouping selected cues opens a Q-Link panel with named members and independent/group mode. Show a clear linked preview. Editing during live mode displays a draft banner and affected-item review; Publish becomes Apply Changes.

## E. Director live console

Desktop: header with show/session clocks and sync state; left/full-width running order; prominent current-cue focus; crew readiness/activity panel. Preset controls are always visible. Full Show shows chronology; Compact reduces secondary details; Expanded reveals full department instructions; Current/Upcoming emphasizes immediate work. Department preset filters context without changing the live calling target.

Each row includes cue number, cue time, description and status as separate fields. Display Q-Link member department icons and readiness. Focus card provides Prepare/Standby/Go/Complete plus Hold and Skip menus. Show the exact target name/number beside the actions. Prevent duplicate activation while a command is in flight. A rejected command keeps the prior authoritative state and explains the failure. Separate called status from operator completion.

Live edit control opens a drawer with Move, Hold, Skip, Adjust Timing and Edit Instructions. Preview changed items and impact; Apply creates a revision. Undo applies only to eligible edits. Keep a visible activity history. Director transfer and session end require a concrete review of the action, without interrupting routine cue calls.

## F. Department laptop view

Blue shell with department icon+name. Show current assigned instruction, next relevant cues, call state, Approx. countdown, show clock and last sync. A filtered timeline provides surrounding context. Ready/Not Ready/Issue affects the operator's assigned cue only. Expand other permitted departments via selector. Display Director calls with gold accents. Read-only viewers can navigate but cannot acknowledge or mutate.

## G. Department phone view

Sticky compact header with role/department, show title and sync indicator. Current cue card dominates; instruction wraps naturally. Ready/Issue actions have large touch targets; no Director controls for ordinary operators. Upcoming cues follow as cards, with a collapsed completed history. Department selector opens a sheet. Show clock and Approx. countdown remain separate and labeled. If reading history, show Return to Live rather than force-scrolling. Notifications must not cover the cue instruction or acknowledgement button.

## H. Tablet view

Use split timeline/focus card in landscape when readable; stacked layout in portrait. Keep compact icons with labels. Director mode uses gold/bronze; crew uses blue. Preserve access to activity, department filters and current cue without reducing instructions to desktop-sized miniature text.

## I. Live update and connection states

On a published change, display a concise banner such as 'Revision 12: keynote moved after break; upcoming estimates +05:00'. Highlight changed fields briefly and persist the summary in Activity. A crew member viewing older cues keeps their position. Show planned and revised timing in a detail view rather than overcrowding every row.

Offline banner says 'Offline — showing revision 11, last synced 14:32:08'. Disable mutations. Reconnecting remains distinct from Connected. Successful reconnection updates the snapshot/revision and surfaces material missed changes. Never display queued Go success while offline.

## J. Help, shortcuts and preferences

Help panel explains Q-Link, call states versus readiness, approximate timers, connection states and view presets. Preferences include selected departments, density, follow-live and optional sound; they are personal. Shortcut list is discoverable and editable if implemented. Do not fire shortcuts inside inputs. About uses Sho Call and subtle Verdigen attribution.

## Showcase walkthrough

Open a Director laptop and an Audio phone view in separate browsers. Start a rehearsal. Prepare/Standby/Go the linked opening. Mark Audio ready and show readiness on Director. Call an independent cue. Move a speaker and apply a five-minute shift; show both devices update. Filter Lighting alone, then expand Audio context. Scroll history and Return to Live. Disconnect a crew client, show stale status, reconnect and recover. Finish with Show Designer/import preview and the event history. Every demonstrated behavior must be backed by working state, not hard-coded animations.
