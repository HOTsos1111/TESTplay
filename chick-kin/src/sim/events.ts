// Semantic gameplay events. The simulation only emits these; UI, audio, FX and animation react to them.

export type SimEvent =
  | { type: 'countdown'; n: number }
  | { type: 'go' }
  | { type: 'jump'; a: number; x: number; y: number }
  | { type: 'flap'; a: number; x: number; y: number }
  | { type: 'land'; a: number; x: number; y: number; speed: number }
  | { type: 'step'; a: number; x: number; y: number; surface: string }
  | { type: 'peck'; a: number; x: number; y: number }
  | { type: 'pickup'; a: number; item: 'crumb' | 'feather' | 'treat' | 'bundle'; x: number; y: number; value: number }
  | { type: 'power'; a: number; pu: string; x: number; y: number; replaced?: string; refreshed?: boolean }
  | { type: 'powerEnd'; a: number; pu: string }
  | { type: 'powerWarn'; a: number; pu: string }
  | { type: 'ability'; a: number; ability: string; x: number; y: number }
  | { type: 'abilityReady'; a: number }
  | { type: 'bump'; a: number; by: number | 'hazard'; x: number; y: number; hazard?: string }
  | { type: 'shield'; a: number; x: number; y: number }
  | { type: 'dodge'; a: number; x: number; y: number }
  | { type: 'respawn'; a: number; x: number; y: number }
  | { type: 'checkpoint'; a: number; x: number; y: number }
  | { type: 'break'; x: number; y: number }
  | { type: 'scratch'; a: number; x: number; y: number }
  | { type: 'drop'; a: number; x: number; y: number }
  | { type: 'deliver'; a: number; count: number; x: number; y: number }
  | { type: 'tugStart'; a: number; x: number; y: number }
  | { type: 'tugWin'; a: number; x: number; y: number }
  | { type: 'perchClaim'; a: number }
  | { type: 'perchLost'; a: number }
  | { type: 'perchContest' }
  | { type: 'gate'; open: boolean; x: number; y: number }
  | { type: 'push'; a: number; x: number; y: number }
  | { type: 'spring'; a: number; x: number; y: number }
  | { type: 'eggRelease'; x: number; y: number }
  | { type: 'windWarn'; x: number; y: number }
  | { type: 'mud'; a: number; x: number; y: number }
  | { type: 'complete'; a: number; place: number }
  | { type: 'leadChange'; a: number }
  | { type: 'phase'; a: number; phase: number }
  | { type: 'round'; round: number }
  | { type: 'roundEnd'; round: number; order: number[] }
  | { type: 'tiebreak' }
  | { type: 'timerLow'; seconds: number }
  | { type: 'finish' };

export class EventLog {
  list: SimEvent[] = [];
  emit(e: SimEvent) { this.list.push(e); }
  drain(): SimEvent[] { const l = this.list; this.list = []; return l; }
}
