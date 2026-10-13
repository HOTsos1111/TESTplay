import { Dialog } from './ui.tsx';

export const SHORTCUTS: [string, string][] = [
  ['1', 'Full Show view'],
  ['2', 'Current / Upcoming view'],
  ['3', 'Compact view'],
  ['4', 'Expanded view'],
  ['F', 'Return to Live (follow the current call)'],
  ['N', 'Arm the next open call'],
  ['P', 'Prepare the armed call'],
  ['S', 'Standby the armed call'],
  ['G', 'Go the armed call'],
  ['?', 'Open this help'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Sho Call help" onClose={onClose} wide>
      <div className="stack-lg">
        <section className="stack">
          <h3>Calls, states and readiness</h3>
          <p>
            A <b>call</b> is what the Director issues: one independent cue, or a <b>Q-Link</b> group that binds cues from several
            departments to a single call. Calling a Q-Link is one server command, so every member gets the same action and time.
          </p>
          <p>
            Call states: <b>Pending → Prepared → Standby → Go (called) → Complete</b>, plus <b>Held</b> and <b>Skipped</b>. “Go”
            means the instruction was issued, not that equipment ran; only an explicit Complete marks a cue complete. Resume returns a
            held cue to its earlier state without issuing Go again.
          </p>
          <p>
            <b>Readiness</b> (Ready, Not ready, Issue) is reported by operators and is separate from the call state. An operator who
            disconnects shows as <b>Unknown</b>, never Ready.
          </p>
        </section>
        <section className="stack">
          <h3>Timing</h3>
          <p>
            <b>Show clock</b> is the wall-clock time in the show’s timezone. <b>Elapsed</b> is time since the session started.
            <b> Approx.</b> countdowns are estimates toward the named target; reaching zero never issues a cue. Delays and timing
            shifts change estimates for future items only. Fixed-time items are never shifted; conflicts are flagged.
          </p>
        </section>
        <section className="stack">
          <h3>Connection states</h3>
          <p>
            <b>Connected</b>: showing the live server state. <b>Reconnecting</b>/<b>Offline</b>: the last received sheet stays
            readable but is marked <b>stale</b>, and all actions are disabled. Commands are never queued offline or replayed later.
          </p>
        </section>
        <section className="stack">
          <h3>Director keyboard shortcuts</h3>
          <p className="muted">Shortcuts work only in the live console, never while typing in a field or when a dialog is open.</p>
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map(([k, a]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="stack">
          <h3>Views and preferences</h3>
          <p>
            View presets, department filters, density, follow-live and alert sound are personal to this device. They never change what
            anyone else sees, and a department filter never grants access to a department.
          </p>
        </section>
        <p className="small muted">Sho Call v1 preliminary build · a Verdigen product. Sho Call does not control audio, video or lighting equipment.</p>
      </div>
    </Dialog>
  );
}
