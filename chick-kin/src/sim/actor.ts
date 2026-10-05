// Competitor state. Player and rivals share this type and exactly the same movement rules.
import { CLASS_INFO, ABILITIES, type ChickClass, type ClassTuning } from '../data/classes';
import { GROWTH, type GrowthProfile, type Stage } from '../data/growth';
import type { PowerId } from '../data/items';

export interface ActorInput {
  mx: number;        // -1..1 (side: horizontal; top: x)
  my: number;        // -1..1 (top: depth, + toward camera). Side: unused.
  jump: boolean;     // held
  interact: boolean; // held (peck / scratch / tug / carry / deliver)
  ability: boolean;  // held; edge-triggered inside the sim
  duck: boolean;     // held (duck / brace)
}
export const NO_INPUT: ActorInput = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };

export type AnimState =
  | 'idle' | 'run' | 'jump' | 'fall' | 'flap' | 'glide' | 'land' | 'duck' | 'brace' | 'peck' | 'scratch'
  | 'push' | 'carry' | 'tug' | 'bumped' | 'ability' | 'celebrate' | 'respawn' | 'perch';

export interface ActivePower { id: PowerId; t: number; warned: boolean }

/** Per-phase objective counters (reset when a competitor enters a new phase/round). */
export interface PhaseStats {
  crumbs: number; worms: number; feathers: number; delivered: number; perchTime: number;
  reached: boolean; completeAt: number; progress: number; bestX: number; bestY: number;
}
export const freshStats = (): PhaseStats => ({ crumbs: 0, worms: 0, feathers: 0, delivered: 0, perchTime: 0, reached: false, completeAt: -1, progress: 0, bestX: -1e9, bestY: -1e9 });

export interface Perk { id: string; name: string; summary: string; stat: keyof ClassTuning; amount: number }

export class Actor {
  readonly id: number;
  readonly cls: ChickClass;
  readonly stage: Stage;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly tuning: ClassTuning;
  readonly g: GrowthProfile;

  // Kinematics. Side: x/y. Top: x/y plane + z hop height.
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  w: number; h: number; r: number;
  facing = 1;           // side: ±1
  heading = 0;          // top: radians, 0 = +x
  grounded = false;
  wasGrounded = false;
  coyote = 0;
  jumpBuffer = 0;
  jumpHeld = false;
  jumpCutDone = false;
  prevJump = false;
  prevInteract = false;
  prevAbility = false;
  airHops = 0;
  ducking = false;
  bracing = false;
  stamina: number;
  staminaMax: number;
  groundRef: number = -1;     // index of moving entity the actor stands on (side)
  groundKind = 'ground';
  onMud = false;
  onSeed = false;
  springLand = 0;
  vyBeforeLand = 0;
  respawns = 0;
  lastGroundY = 0;         // height of the last foothold (fall recovery)
  dropT = 0;               // dropping through a one-way platform
  onOneWay = false;
  stepDist = 0;

  abilityCd = 0;
  abilityT = 0;
  abilityReadyNotified = true;
  dodgeT = 0;
  stunT = 0;
  protectT = 0;
  powers: ActivePower[] = [];
  shield = false;

  carryTreats = 0;
  carryBundle = false;
  interactT = 0;           // seconds the interact button has been held on the current target
  interactTarget = -1;     // entity index being scratched / tugged
  peckT = 0;               // animation timer
  pushT = 0;
  nudgeCd = 0;             // generic peck-nudge cooldown

  checkpointX = 0; checkpointY = 0;
  cpIdx = -1;
  phase = 0;               // relay leg / active phase index
  st: PhaseStats = freshStats();
  finished = false;        // objective complete for the current level/round
  anim: AnimState = 'idle';
  animT = 0;
  idleT = 0;

  constructor(opts: { id: number; cls: ChickClass; stage: Stage; name: string; isPlayer: boolean; perk?: Perk | null }) {
    this.id = opts.id;
    this.cls = opts.cls;
    this.stage = opts.stage;
    this.name = opts.name;
    this.isPlayer = opts.isPlayer;
    const base = CLASS_INFO[opts.cls].tuning;
    const t: ClassTuning = { ...base };
    if (opts.perk) t[opts.perk.stat] *= 1 + Math.min(0.05, opts.perk.amount);
    this.tuning = t;
    this.g = GROWTH[opts.stage];
    this.w = this.g.side.w * (opts.cls === 'mighty' ? 1.08 : opts.cls === 'nimble' ? 0.92 : 1);
    this.h = this.g.side.h;
    this.r = this.g.top.radius * (opts.cls === 'mighty' ? 1.08 : opts.cls === 'nimble' ? 0.92 : 1);
    this.staminaMax = this.g.stamina * t.flap;
    this.stamina = this.staminaMax;
  }

  get ability() { return ABILITIES[this.cls]; }
  hasPower(id: PowerId) { return this.powers.some((p) => p.id === id); }
  get canAct() { return this.stunT <= 0; }

  /** Collider height currently in use (side). */
  get colH() { return this.ducking ? this.g.side.duckH : this.h; }

  /** Effective push strength (class × Power Corn). */
  get pushForce() { return this.tuning.push * (this.hasPower('PU-05') ? 1.35 : 1); }

  resetForPhase(x: number, y: number) {
    this.x = x; this.y = y; this.z = 0;
    this.vx = this.vy = this.vz = 0;
    this.grounded = false;
    this.stunT = 0; this.protectT = 0; this.dodgeT = 0; this.abilityT = 0;
    this.carryTreats = 0; this.carryBundle = false;
    this.interactT = 0; this.interactTarget = -1;
    this.stamina = this.staminaMax;
    this.checkpointX = x; this.checkpointY = y; this.cpIdx = -1; this.lastGroundY = y;
    this.st = freshStats();
    this.finished = false;
    this.anim = 'idle';
    this.powers = [];
    this.shield = false;
  }
}
