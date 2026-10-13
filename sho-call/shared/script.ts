// The Director's call script ("call notes"): what the show caller reads aloud
// for each call. Empty stored text means the generated default is used.
//   Standby Video, Audio and Lighting for Cue 023
//   Video, Audio and Lighting — GO Cue 023

import type { Call } from './calls.ts';
import type { ShowContent } from './types.ts';

export interface CallScript {
  standby: string;
  go: string;
  /** True when the text is the generated default (not edited). */
  standbyDefault: boolean;
  goDefault: boolean;
  /** The generated default text (shown as a placeholder when editing). */
  defaults: { standby: string; go: string };
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function defaultScript(departmentNames: string[], number: string): { standby: string; go: string } {
  const who = listNames(departmentNames);
  return {
    standby: `Standby ${who} for Cue ${number}`,
    go: `${who} — GO Cue ${number}`,
  };
}

/** Script for a call, using the stored override when present. */
export function callScript(call: Pick<Call, 'kind' | 'groupId' | 'cueIds' | 'number'>, content: Pick<ShowContent, 'cues' | 'groups' | 'departments'>): CallScript {
  const deptOrder = new Map(content.departments.map((d, i) => [d.id, i]));
  const members = call.cueIds
    .map((id) => content.cues.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => (deptOrder.get(a.departmentId) ?? 0) - (deptOrder.get(b.departmentId) ?? 0));
  const names = [...new Set(members.map((m) => content.departments.find((d) => d.id === m.departmentId)?.name ?? 'Crew'))];
  const def = defaultScript(names, call.number);
  const source = call.kind === 'group' ? content.groups.find((g) => g.id === call.groupId) : members[0];
  const standby = source?.standbyScript?.trim() ?? '';
  const go = source?.goScript?.trim() ?? '';
  return {
    standby: standby || def.standby,
    go: go || def.go,
    standbyDefault: !standby,
    goDefault: !go,
    defaults: def,
  };
}
