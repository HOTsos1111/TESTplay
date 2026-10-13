// Cue call state machine.
//
//   pending → prepared → standby → called → complete
//   held and skipped are explicit side states.
//
// "called" means the Director issued the instruction (Go). It is not proof that
// equipment ran; only an explicit Complete marks a cue complete. Hold stores the
// prior state so Resume restores it without reissuing Go.

import type { CueAction, CueState } from './types.ts';

export interface Transition {
  ok: true;
  state: CueState;
  /** State remembered while held, or null. */
  prevState: CueState | null;
}

export interface Rejection {
  ok: false;
  reason: string;
}

const LABEL: Record<CueState, string> = {
  pending: 'pending',
  prepared: 'prepared',
  standby: 'in standby',
  called: 'already called',
  complete: 'already complete',
  held: 'held',
  skipped: 'skipped',
};

export const ACTIONS_REQUIRING_REASON: CueAction[] = ['skip'];

export function transition(
  state: CueState,
  prevState: CueState | null,
  action: CueAction,
): Transition | Rejection {
  const reject = (why?: string): Rejection => ({
    ok: false,
    reason: why ?? `Cannot ${action === 'go' ? 'Go' : action}: cue is ${LABEL[state]}.`,
  });
  switch (action) {
    case 'prepare':
      return state === 'pending' ? { ok: true, state: 'prepared', prevState: null } : reject();
    case 'standby':
      return state === 'pending' || state === 'prepared'
        ? { ok: true, state: 'standby', prevState: null }
        : reject();
    case 'go':
      return state === 'pending' || state === 'prepared' || state === 'standby'
        ? { ok: true, state: 'called', prevState: null }
        : reject();
    case 'complete':
      return state === 'called' ? { ok: true, state: 'complete', prevState: null } : reject();
    case 'hold':
      return state === 'pending' || state === 'prepared' || state === 'standby'
        ? { ok: true, state: 'held', prevState: state }
        : reject(state === 'called' ? 'Cannot hold: cue was already called. Use a corrective note instead.' : undefined);
    case 'resume':
      return state === 'held'
        ? { ok: true, state: prevState ?? 'pending', prevState: null }
        : reject('Cannot resume: cue is not held.');
    case 'skip':
      return state === 'pending' || state === 'prepared' || state === 'standby' || state === 'held'
        ? { ok: true, state: 'skipped', prevState: null }
        : reject();
    case 'restore':
      // Corrective action: return a skipped cue to the running order.
      return state === 'skipped' ? { ok: true, state: 'pending', prevState: null } : reject('Only skipped cues can be restored.');
  }
}

export function isOpen(state: CueState): boolean {
  return state === 'pending' || state === 'prepared' || state === 'standby' || state === 'held';
}

export function isDone(state: CueState): boolean {
  return state === 'called' || state === 'complete' || state === 'skipped';
}

export const STATE_LABEL: Record<CueState, string> = {
  pending: 'Pending',
  prepared: 'Prepared',
  standby: 'Standby',
  called: 'Called',
  complete: 'Complete',
  held: 'Held',
  skipped: 'Skipped',
};

export const ACTION_LABEL: Record<CueAction, string> = {
  prepare: 'Prepare',
  standby: 'Standby',
  go: 'Go',
  complete: 'Complete',
  hold: 'Hold',
  resume: 'Resume',
  skip: 'Skip',
  restore: 'Restore',
};
