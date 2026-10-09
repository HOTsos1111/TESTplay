import Phaser from 'phaser';
import { chapterById, type ChapterDef } from '../data/chapters';
import { DEPTH, SCORING, TUNING, UPGRADE_EFFECTS, VIEW, WORLD } from '../data/config';
import { HINTS } from '../data/copy';
import { POWERUP_TUNING, POWERUPS, type PowerUpKind } from '../data/powerups';
import { HeroView } from '../entities/HeroView';
import { TrolleyBoss } from '../entities/TrolleyBoss';
import { LevelTheme, theme } from '../systems/LevelTheme';
import { SquirrelSwarm, type Boss } from '../entities/SquirrelSwarm';
import { PigeonBoss } from '../entities/PigeonBoss';
import { PatternBoss } from '../entities/PatternBoss';
import {
  Acorn, Barrel, Bone, LowBar, BurstMarker, Cardboard, LiftPlatform, PowerUp, Crate, Entity, Gate, GroundPiece, Platform, Scent, Squirrel, Tyre, type GameContext,
} from '../entities/World';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { Fx } from '../systems/Fx';
import { Scenery } from '../systems/Scenery';
import { LevelScenery } from '../systems/LevelScenery';
import { buildLevelTheme } from '../systems/LevelSkins';
import { setGroundPalette } from '../systems/Ground3D';
import { LEVEL_ART, pieceKey } from '../data/levelArt';
import { InputManager } from '../systems/InputManager';
import { buildLevel, type LevelLayout, type Spawnable } from '../systems/LevelBuilder';
import { PlayerController, type FrameInput, type PlayerStats, type Rect, type Solid } from '../systems/PlayerController';
import { progress } from '../systems/ProgressStore';
import { debugFlags, registerTestHook } from '../systems/debug';
import { Hud } from '../ui/Hud';
import { TouchControls } from '../ui/TouchControls';

export interface GameSceneData {
  chapter: number;
  startAt?: 'start' | 'encounter';
}

export interface ResultsData {
  chapter: number;
  success: boolean;
  metres: number;
  bones: number;
  bonus: number;
  newBest: boolean;
  checkpoint: boolean;
}

type Phase = 'run' | 'encounter' | 'victory' | 'defeat';

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function statsFromUpgrades(): PlayerStats {
  const u = progress.state.upgrades;
  return {
    wagCapacity: TUNING.wagCapacity + UPGRADE_EFFECTS.tail * u.tail,
    rechargeRate: TUNING.groundRecharge * (1 + UPGRADE_EFFECTS.recharge * u.recharge),
    barkRange: TUNING.barkRange + UPGRADE_EFFECTS.bark * u.bark,
  };
}

/** Boss arenas: the camera stops and the dog moves freely inside this band of the screen. */
const ARENA = { minX: 70, maxX: 1210, speed: 300 } as const;

export class GameScene extends Phaser.Scene {
  private chapter!: ChapterDef;
  private layout!: LevelLayout;
  private cursor = 0;
  private pc!: PlayerController;
  private hero!: HeroView;
  private shadow!: Phaser.GameObjects.Image;
  private input2!: InputManager;
  private hud!: Hud;
  private fx!: Fx;
  private entities: Entity[] = [];
  private solids: Solid[] = [];
  private phase: Phase = 'run';
  private phaseT = 0;
  private hearts: number = TUNING.maxHearts;
  private bones = 0;
  private pulseId = 0;
  private pulseT = 0;
  private boss: Boss | null = null;
  private startAt: 'start' | 'encounter' = 'start';
  private debugG: Phaser.GameObjects.Graphics | null = null;
  private ctx!: GameContext;
  private stackBursts = new Set<string>();
  private resultsSent = false;
  private paused = false;
  private onHidden = () => this.pauseGame();
  private touch!: TouchControls;
  private scenery!: Scenery | LevelScenery;
  /** Camera scrolls on its own; the hero paces within a band of the screen. */
  private camX = 0;
  private scrollSpeed = 0;
  private paceInput = 0;
  /** Brief simulation freeze for comic timing (the hero rig keeps animating). */
  private hitstop = 0;
  /** Remaining seconds for each active power-up. */
  private power: Partial<Record<PowerUpKind, number>> = {};
  private shieldImg!: Phaser.GameObjects.Image;

  private activatePowerUp(kind: PowerUpKind): void {
    const def = POWERUPS[kind];
    const wasActive = (this.power[kind] ?? 0) > 0;
    this.power[kind] = def.duration;
    Audio.play('powerup');
    this.hud.showHint(`${def.name}! ${def.blurb}`, 2.2);
    if (kind === 'whistle') {
      if (!wasActive) this.pc.stats.barkRange += POWERUP_TUNING.whistleExtraRange;
      // Sonic blast: every squirrel and acorn on screen is sent packing.
      Audio.play('sonic');
      this.fx.barkRing(this.scale.width, () => ({ x: this.pc.x + 40, y: this.pc.y - 46 }), 0.5);
      this.cameras.main.shake(200, 0.006);
      for (const e of this.entities) {
        if (e instanceof Squirrel && e.right === Number.POSITIVE_INFINITY) e.flee(this.ctx);
        if (e instanceof Acorn) e.onBark(this.ctx);
      }
    }
  }

  private expirePowerUp(kind: PowerUpKind): void {
    delete this.power[kind];
    if (kind === 'whistle') this.pc.stats.barkRange -= POWERUP_TUNING.whistleExtraRange;
    Audio.play('powerdown');
  }

  private updatePowerUps(dt: number): void {
    for (const k of Object.keys(this.power) as PowerUpKind[]) {
      this.power[k]! -= dt;
      if (this.power[k]! <= 0) this.expirePowerUp(k);
    }
    if (this.power.bacon) {
      this.pc.wag = this.pc.stats.wagCapacity;
      if (!this.pc.bursting) this.pc.burstMeter = 1;
    }
    if (this.power.magnet) {
      const tx = this.pc.x + 10;
      const ty = this.pc.y - 40;
      for (const e of this.entities) {
        if (!(e instanceof Bone) || !e.alive) continue;
        const p = e.pos;
        if (Math.hypot(p.x - tx, p.y - ty) < POWERUP_TUNING.magnetRadius) e.pull(tx, ty, POWERUP_TUNING.magnetPull, dt);
      }
    }
  }
  private burstWasReady = true;

  private onResize(size: Phaser.Structs.Size): void {
    this.scenery.layout(size.width);
    this.hud.layout(size.width);
    this.touch.layout(size.width);
  }

  constructor() {
    super('Game');
  }

  /** Levels built from an asset guide load that guide's pieces on the way in. */
  preload(): void {
    const data = (this.sys.settings.data ?? {}) as GameSceneData;
    const n = chapterById(data.chapter ?? 1).art;
    if (!n || !LEVEL_ART[n]) return;
    for (const key of LEVEL_ART[n].buildings ?? []) {
      if (!this.textures.exists(key)) this.load.image(key, `levels/shared/${key}.webp`);
    }
    for (const code of ['e1', 'e2', 'b1', 'h1', 'h2', 'h3', 'p1', 'p2', 'p3', 'fg1', 'fg2', 'mg1', 'mg2', 'bg1', 'bg2']) {
      const key = pieceKey(n, code);
      if (!this.textures.exists(key)) this.load.image(key, `levels/l0${n}/${code}.webp`);
    }
  }

  create(data: GameSceneData): void {
    this.chapter = chapterById(data.chapter ?? 1);
    const art = this.chapter.art;
    LevelTheme.id = (art && buildLevelTheme(this, art)) || this.chapter.theme;
    setGroundPalette(art ? LEVEL_ART[art].ground : null);
    this.layout = buildLevel(this.chapter);
    this.startAt = data.startAt === 'encounter' ? 'encounter' : 'start';
    this.entities = [];
    this.solids = [];
    this.phase = 'run';
    this.phaseT = 0;
    this.hearts = TUNING.maxHearts;
    this.bones = 0;
    this.pulseId = 0;
    this.pulseT = 0;
    this.boss = null;
    this.stackBursts = new Set();
    this.resultsSent = false;
    this.paused = false;
    this.pendingHints = [];
    this.pitFall = false;
    this.groundEnd = -Infinity;
    this.camX = 0;
    this.scrollSpeed = 0;
    this.paceInput = 0;
    this.hitstop = 0;
    this.power = {};
    this.burstWasReady = true;

    const startX = this.startAt === 'encounter' ? this.layout.encounterX + 160 : this.layout.startX;
    this.pc = new PlayerController(startX, WORLD.groundY, { ...statsFromUpgrades(), doubleJump: this.chapter.doubleJump });
    this.pc.speed = this.chapter.speedStart;
    this.camX = startX - VIEW.width * VIEW.heroScreenX;

    const camStart = startX - VIEW.width * VIEW.heroScreenX;
    const zones = this.chapter.zones.map((z) => ({ ...z, x: this.layout.chunkStarts[z.chunk]?.x ?? 0 }));
    if (!zones.length) zones.push({ chunk: 0, ...theme().defaultZone, x: 0 });
    this.scenery = art ? new LevelScenery(this, art, camStart) : new Scenery(this, zones, camStart);

    this.fx = new Fx(this);
    this.hero = new HeroView(this, startX, WORLD.groundY).setDepth(DEPTH.hero);
    this.hero.onStep = () => Audio.play('step');
    this.hero.onSnap = () => {
      Audio.play('burst_snap');
      // Freeze-frame beat, then a dust blast where the rear end launched from.
      this.hitstop = 0.07;
      this.fx.puff(this.pc.x - 60, this.pc.y - 18, 8, 1.3);
      for (let i = 0; i < 8; i++) this.fx.streak(this.pc.x - 40 - i * 18, this.pc.y - 10 - Math.random() * 60);
      this.cameras.main.shake(140, 0.009);
    };
    this.shieldImg = this.add.image(startX, WORLD.groundY, 'shield_bubble').setScale(ART_SCALE * 1.15).setDepth(DEPTH.hero + 1).setVisible(false);
    this.shadow = this.add.image(startX, WORLD.groundY, 'shadow').setScale(ART_SCALE).setDepth(DEPTH.groundShadow);

    this.input2 = new InputManager(this);
    this.hud = new Hud(this, () => this.input2.requestPause());
    {
      const span = Math.max(1, this.layout.encounterX - this.layout.startX);
      const tint: Record<string, number> = { depot_near: 0xebd3a6, depot_near_sorting: 0xe6cfa4, depot_near_cold: 0xa9cfe0, depot_near_yard: 0x5e9c6a, depot_near_street: 0xc9765f };
      const zoneMarks = zones.map((z) => ({ from: Math.max(0, (z.x - this.layout.startX) / span), color: tint[z.near] ?? 0xffe1aa }));
      const burstMarks = this.layout.items.filter((i) => i.type === 'burstMarker').map((i) => (i.x - this.layout.startX) / span);
      this.hud.setMinimap(zoneMarks, burstMarks);
    }
    this.touch = new TouchControls(this, this.input2, (p) => p.x > this.scale.width - 100 && p.y < 100);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.ctx = {
      scene: this,
      fx: this.fx,
      heroX: startX,
      heroY: WORLD.groundY,
      cameraLeft: 0,
      cameraRight: 0,
      surfaceBelow: (x, y) => this.surfaceBelow(x, y),
      spawn: (e) => this.entities.push(e),
      collectPowerUp: (kind) => this.activatePowerUp(kind),
      isClearSpot: (x) => this.isClearSpot(x),
      addBone: () => {
        this.bones++;
        progress.addBones(1);
        Audio.play('bone');
      },
    };

    // Skip content behind the start point (checkpoint retries start at the encounter).
    this.cursor = 0;
    const skipBefore = startX - this.scale.width;
    while (this.cursor < this.layout.items.length) {
      const it = this.layout.items[this.cursor];
      const keep = it.type === 'ground' ? it.x + it.w > skipBefore : it.type === 'gate' ? true : it.x > startX;
      if (keep) break;
      this.cursor++;
    }
    this.layoutCamera();
    this.spawnAhead(true);

    this.debugG = this.add.graphics().setDepth(DEPTH.debug);

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onHidden);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (this.startAt === 'encounter') {
      this.startEncounter();
    } else {
      Audio.playMusic(this.chapter.music);
      this.hud.banner(`Level ${this.chapter.id}: ${this.chapter.title}`, this.chapter.opening, 2.6);
    }

    registerTestHook('input', () => this.input2);
    // Test-only: jump the hero to a world x (used by visual checks).
    registerTestHook('teleport', () => (x: number, y?: number, grace = 2) => {
      this.pc.x = x;
      this.camX = x - VIEW.width * VIEW.heroScreenX;
      if (y !== undefined) {
        this.pc.y = y;
        this.pc.vy = 0;
        this.pc.grounded = false;
      }
      this.pc.invulnerable = grace;
    });
    registerTestHook('game', () => ({
      phase: this.phase,
      x: this.pc.x,
      y: this.pc.y,
      vy: this.pc.vy,
      grounded: this.pc.grounded,
      hovering: this.pc.hovering,
      wag: this.pc.wag,
      hearts: this.hearts,
      bones: this.bones,
      bossHits: this.boss?.hits ?? null,
      bossPhase: this.boss?.phase ?? null,
      bossAttack: this.boss instanceof PatternBoss ? this.boss.telegraph : null,
      bossScreenX: this.boss instanceof PatternBoss ? this.boss.screenX : null,
      facing: this.pc.facing,
      screenX: this.pc.x - this.camX,
      entities: this.entities.length,
      encounterX: this.layout.encounterX,
      barkCooldown: this.pc.barkCooldown,
      paused: this.paused,
      speed: this.pc.speed,
      burstMeter: this.pc.burstMeter,
      powerups: { ...this.power },
      bursting: this.pc.bursting,
      effectiveSpeed: this.pc.effectiveSpeed,
      heroView: this.hero.debugState,
      scenery: this.scenery.debug,
      hazardsAhead: this.entities
        .map((e) => (e.alive ? e.hazard() : null))
        .filter((r): r is Rect => !!r && r.x + r.w > this.pc.x - 500 && r.x < this.pc.x + 600)
        .map((r) => ({ dx: Math.round(r.x - this.pc.x), w: r.w, top: WORLD.groundY - r.y, bottom: WORLD.groundY - (r.y + r.h) })),
      ducking: this.pc.ducking,
      doubleUsed: this.pc.doubleUsed,
      powerupsAt: this.entities.filter((e): e is PowerUp => e instanceof PowerUp).map((p) => p.where),
      barkTargetsAhead: this.entities
        .map((e) => (e.alive ? e.barkTarget() : null))
        .filter((r): r is Rect => !!r && r.x + r.w > this.pc.x && r.x < this.pc.x + 600)
        .map((r) => ({ dx: Math.round(r.x - this.pc.x), top: WORLD.groundY - r.y, bottom: WORLD.groundY - (r.y + r.h) })),
      solidsAhead: this.solids
        .filter((r) => r.kind !== 'ground' && r.x + r.w > this.pc.x - 46 && r.x < this.pc.x + 600)
        .map((r) => ({ dx: Math.round(r.x - this.pc.x), w: r.w, top: WORLD.groundY - r.y, kind: r.kind })),
      gapsAhead: (() => {
        const gaps: [number, number][] = [];
        let start: number | null = null;
        for (let dx = 0; dx <= 1200; dx += 10) {
          const x = this.pc.x + dx;
          const solid = this.solids.some((s) => s.kind === 'ground' && x >= s.x && x <= s.x + s.w);
          if (!solid && start === null) start = dx;
          if (solid && start !== null) {
            gaps.push([start, dx]);
            start = null;
          }
        }
        if (start !== null) gaps.push([start, 1200]);
        return gaps;
      })(),
      height: WORLD.groundY - this.pc.y,
      barkRange: this.pc.stats.barkRange,
    }));
  }

  private cleanup(): void {
    Audio.setThreat(false);
    setGroundPalette(null);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onHidden);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    Audio.stopTail(true);
    this.fx.clear();
    for (const e of this.entities) e.destroy();
    this.entities = [];
    this.solids = [];
    registerTestHook('game', null);
    registerTestHook('input', null);
    registerTestHook('teleport', null);
  }

  // ------------------------------------------------------------ pause

  pauseGame(): void {
    if (this.paused || this.resultsSent || !this.scene.isActive()) return;
    this.paused = true;
    Audio.stopTail(true);
    Audio.pauseMusic();
    this.input2.clear();
    this.scene.launch('Pause', { chapter: this.chapter.id });
    this.scene.pause();
  }

  private onResume(): void {
    this.paused = false;
    this.input2.clear();
    this.pc.resetInputState();
    Audio.resumeMusic();
  }

  // ------------------------------------------------------------ world

  private surfaceBelow(x: number, y: number): number | null {
    let best: number | null = null;
    for (const s of this.solids) {
      if (x >= s.x && x <= s.x + s.w && s.y >= y - 1 && (best === null || s.y < best)) best = s.y;
    }
    return best;
  }

  private createEntity(it: Spawnable): Entity | null {
    switch (it.type) {
      case 'ground':
        return new GroundPiece(this, it.x, it.w, it.edgeLeft, it.edgeRight);
      case 'platform':
        return new Platform(this, it.x, it.w, it.top, !it.floating);
      case 'crate':
        return new Crate(this, it.x, it.top);
      case 'cardboard':
        return new Cardboard(this, it.x, it.top, it.stack, (s) => this.burstStack(s));
      case 'tyre':
        return new Tyre(this, it.x, it.bottom);
      case 'squirrel':
        return new Squirrel(this, it.x, it.bottom);
      case 'bone':
        return new Bone(this, it.x, it.y, it.id);
      case 'scent':
        return new Scent(this, it.x, it.y);
      case 'gate':
        return new Gate(this, it.x);
      case 'burstMarker':
        return new BurstMarker(this, it.x);
      case 'barrel':
        return new Barrel(this, it.x);
      case 'lowbar':
        return new LowBar(this, it.x, it.phase);
      case 'powerup':
        return new PowerUp(this, it.x, it.y, it.kind);
      case 'lift':
        return new LiftPlatform(this, it.x, it.w, it.lowTop, it.highTop, it.period);
      case 'hint':
        this.pendingHints.push(it);
        return null;
    }
  }

  private pendingHints: { x: number; id: string }[] = [];

  private isClearSpot(x: number): boolean {
    const margin = 150;
    // Solid floor for a stretch around the spot (no pits nearby).
    for (const dx of [-margin, 0, margin]) {
      const sx = x + dx;
      if (!this.solids.some((s) => s.kind === 'ground' && sx >= s.x && sx <= s.x + s.w)) return false;
    }
    for (const e of this.entities) {
      if (!e.alive || e instanceof Bone || e instanceof Squirrel || e instanceof Acorn) continue;
      const r = e.hazard() ?? e.solid;
      if (!r || r.y === undefined) continue;
      if (e instanceof GroundPiece) continue;
      if (x + margin > r.x && x - margin < r.x + r.w) return false;
    }
    return true;
  }

  private burstStack(stack: string): void {
    if (this.stackBursts.has(stack)) return;
    this.stackBursts.add(stack);
    const boxes = this.entities.filter((e): e is Cardboard => e instanceof Cardboard && e.stack === stack && !e.broken);
    boxes.sort((a, b) => (b.solid?.y ?? 0) - (a.solid?.y ?? 0));
    boxes.forEach((b, i) => b.burst(0.06 + i * 0.06));
  }

  private spawnAhead(initial = false): void {
    const limit = this.cameras.main.scrollX + this.scale.width + WORLD.spawnAhead;
    while (this.cursor < this.layout.items.length && this.layout.items[this.cursor].x < limit) {
      const it = this.layout.items[this.cursor++];
      if (initial && it.type === 'hint' && it.x < this.pc.x) continue;
      const e = this.createEntity(it);
      if (e) this.entities.push(e);
      if (it.type === 'ground') this.groundEnd = Math.max(this.groundEnd, it.x + it.w);
    }
    // Past the authored content the street simply continues (the encounter has no length limit).
    if (this.cursor >= this.layout.items.length) {
      while (this.groundEnd < limit) {
        this.entities.push(new GroundPiece(this, this.groundEnd, 1024, false, false));
        this.groundEnd += 1024;
      }
    }
  }

  private groundEnd = -Infinity;

  private layoutCamera(): void {
    this.cameras.main.scrollX = Math.round(this.camX);
    this.ctx.cameraLeft = this.cameras.main.scrollX;
    this.ctx.cameraRight = this.cameras.main.scrollX + this.scale.width;
  }

  // ------------------------------------------------------------ flow

  /** True while fighting a boss that holds the camera still. */
  private get arena(): boolean {
    return this.phase === 'encounter' && this.boss?.speed === 0;
  }

  private startEncounter(): void {
    this.phase = 'encounter';
    this.phaseT = 0;
    progress.setCheckpoint({ chapter: this.chapter.id, at: 'encounter' });
    Audio.playMusic('chase');
    const id = this.chapter.encounterId;
    const pattern = id === 'boss' && this.chapter.art ? new PatternBoss(this, this.chapter.art, (x, w, top) => new Platform(this, x, w, top, false)) : null;
    const boss: Boss = pattern ?? (id === 'trolley' ? new TrolleyBoss(this) : id === 'pigeon' ? new PigeonBoss(this) : new SquirrelSwarm(this));
    const name = pattern ? `${pattern.def.name.charAt(0)}${pattern.def.name.slice(1).toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase())}!` : id === 'trolley' ? 'The dogcatcher!' : id === 'pigeon' ? 'The Pigeon Captain!' : 'Squirrel swarm!';
    this.hud.banner(name, 'Boss fight! Move, dodge, bark!', 2.2);
    this.boss = boss;
    this.boss.onEvent = (e) => {
      if (e === 'start' && pattern) this.hud.showHint(pattern.def.hint, 4.2);
      else if (e === 'start') this.showHint(id === 'pigeon' ? 'encounter_pigeon' : 'encounter', true);
      if (e === 'defeated') {
        Audio.play('boss_clear');
        Audio.stopMusic();
      }
      if (e === 'done') this.victory();
    };
    this.entities.push(this.boss);
  }

  private showHint(id: string, force = false): void {
    const h = HINTS[id];
    if (!h) return;
    if (!force && progress.state.hintsSeen.includes(id)) return;
    progress.markHint(id);
    this.hud.showHint(InputManager.touchMode ? h.touch : h.keys, 3.4);
  }

  private damage(): void {
    if (this.pc.invulnerable > 0 || this.phase === 'defeat' || this.phase === 'victory' || debugFlags.god) return;
    if (this.power.shield) {
      // The Soap Bubble Shield takes the hit instead.
      delete this.power.shield;
      this.pc.invulnerable = POWERUP_TUNING.shieldGraceInvulnerability;
      Audio.play('shield_pop');
      this.fx.puff(this.pc.x, this.pc.y - 40, 8, 1.2);
      this.fx.sparkle(this.pc.x, this.pc.y - 40, 10);
      this.cameras.main.shake(120, 0.005);
      return;
    }
    this.hearts--;
    this.pc.hit();
    this.hero.hit();
    Audio.play('hit');
    if (this.pc.hovering) Audio.stopTail();
    this.fx.stars(this.pc.x + 20, this.pc.y - 50, 6);
    this.cameras.main.shake(160, 0.006);
    if (this.hearts <= 0) this.defeat(false);
  }

  private defeat(pit: boolean): void {
    if (this.phase === 'defeat' || this.phase === 'victory') return;
    this.phase = 'defeat';
    this.phaseT = 0;
    Audio.setThreat(false);
    Audio.stopTail(true);
    Audio.stopMusic();
    Audio.play('defeat');
    this.hero.setMode('defeat');
    this.pitFall = pit;
  }

  private pitFall = false;

  private victory(): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = 'victory';
    this.phaseT = 0;
    Audio.setThreat(false);
    this.hero.setMode('victory');
    Audio.stopTail(true);
    Audio.playMusic('home');
  }

  private metres(): number {
    return Math.max(0, Math.floor((this.pc.x - this.layout.startX) / SCORING.pxPerMetre));
  }

  private finish(success: boolean): void {
    if (this.resultsSent) return;
    this.resultsSent = true;
    const metres = this.metres();
    let bonus = 0;
    if (success) {
      if (progress.claimReward(`chapter${this.chapter.id}_clear`, SCORING.firstClearBonus)) bonus = SCORING.firstClearBonus;
      progress.completeChapter(this.chapter.id);
    }
    const newBest = progress.recordRun(this.chapter.id, metres);
    const data: ResultsData = {
      chapter: this.chapter.id,
      success,
      metres,
      bones: this.bones,
      bonus,
      newBest,
      checkpoint: !success && progress.state.checkpoint?.chapter === this.chapter.id,
    };
    Audio.stopTail(true);
    this.scene.start('Results', data);
  }

  // ------------------------------------------------------------ loop

  private lastWall = 0;

  update(_time: number, deltaMs: number): void {
    if (this.paused) {
      this.lastWall = 0;
      return;
    }
    if (debugFlags.realtime) {
      const now = performance.now();
      deltaMs = this.lastWall ? now - this.lastWall : deltaMs;
      this.lastWall = now;
    }
    const dt = Math.min(deltaMs / 1000, TUNING.maxFrameDelta);
    // Presses made during a freeze-frame stay latched for the next frame.
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.render(dt);
      return;
    }
    const frame = this.input2.consume();
    if (frame.pausePressed) {
      this.pauseGame();
      return;
    }
    this.paceInput = frame.pace;
    const steps = Math.max(1, Math.ceil(dt / TUNING.maxStep));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const inp: FrameInput = i === 0 ? frame : { jumpPressed: false, jumpHeld: frame.jumpHeld, barkPressed: false, duckHeld: frame.duckHeld };
      this.simulate(h, inp);
      if (this.resultsSent) return;
    }
    this.render(dt);
  }

  private simulate(dt: number, inp: FrameInput): void {
    this.phaseT += dt;

    if (this.phase === 'defeat') {
      // Let the hero settle (or keep falling into the pit), then show results.
      this.pc.speed = 0;
      this.pc.step(dt, { jumpPressed: false, jumpHeld: false, barkPressed: false }, this.pitFall ? [] : this.solids);
      this.layoutCamera();
      if (this.phaseT > (this.pitFall ? 1.1 : 1.7)) this.finish(false);
      this.updateEntities(dt);
      return;
    }

    if (this.phase === 'victory') {
      this.pc.speed = Math.max(0, this.pc.speed - 500 * dt);
      this.pc.step(dt, { jumpPressed: false, jumpHeld: false, barkPressed: false }, this.solids);
      this.camX = Math.max(this.camX, this.pc.x - 520);
      this.layoutCamera();
      this.updateEntities(dt);
      if (this.phaseT > 2.6) this.finish(true);
      return;
    }

    // Scroll speed ramps through the chapter; constant during the encounter.
    if (this.phase === 'run') {
      const k = Phaser.Math.Clamp((this.pc.x - this.layout.startX) / Math.max(1, this.layout.encounterX - this.layout.startX), 0, 1);
      this.scrollSpeed = Math.min(TUNING.scrollSpeedCap, this.chapter.speedStart + (this.chapter.speedEnd - this.chapter.speedStart) * k);
    } else if (this.boss && (this.boss.phase === 'defeat' || this.boss.phase === 'done')) {
      this.scrollSpeed = Math.max(0, this.scrollSpeed - 260 * dt);
    } else if (this.arena) {
      this.scrollSpeed = Math.max(0, this.scrollSpeed - 520 * dt);
    } else {
      this.scrollSpeed = Math.min(TUNING.scrollSpeedCap, this.boss?.speed ?? 360);
    }
    // Pacing: forward/back nudges the hero's speed relative to the scroll, inside a band of the screen.
    // In a boss arena the camera stops and he runs freely left and right.
    const screenX = this.pc.x - this.camX;
    const arena = this.arena;
    const minX = arena ? ARENA.minX : TUNING.paceMinX;
    const maxX = arena ? ARENA.maxX : this.phase === 'encounter' ? 430 : TUNING.paceMaxX;
    let pace = this.paceInput;
    if ((screenX <= minX && pace < 0) || (screenX >= maxX && pace > 0)) pace = 0;
    this.pc.speed = arena ? this.scrollSpeed + pace * ARENA.speed : Math.max(0, this.scrollSpeed + pace * TUNING.paceSpeed);
    // Drift back inside the band if a burst carried him past it.
    if (screenX > maxX + 4 && !this.pc.bursting) this.pc.speed = this.scrollSpeed - 60;

    const wasGrounded = this.pc.grounded;
    const events = this.pc.step(dt, inp, this.solids);
    for (const ev of events) {
      switch (ev.type) {
        case 'jump':
          Audio.play('jump');
          this.hero.takeoff();
          this.fx.dust(this.pc.x - 30, this.pc.y, 2);
          break;
        case 'land':
          if (ev.impact > 250) {
            Audio.play('land');
            this.fx.dust(this.pc.x, this.pc.y, 3);
          }
          this.hero.land(ev.impact);
          break;
        case 'hoverStart':
          Audio.startTail();
          break;
        case 'hoverStop':
          Audio.stopTail();
          break;
        case 'doubleJump':
          Audio.play('double_jump');
          this.hero.flip();
          this.fx.puff(this.pc.x, this.pc.y + 4, 5, 0.7);
          break;
        case 'duckStart':
          Audio.play('duck');
          break;
        case 'burstStart':
          this.hero.burst();
          Audio.play('burst_stretch');
          this.fx.dust(this.pc.x - 40, this.pc.y, 6);
          break;
        case 'bark':
          if (this.power.whistle) this.pc.barkCooldown = POWERUP_TUNING.whistleCooldown;
          this.pulseId++;
          this.pulseT = TUNING.barkLifetime;
          this.hero.bark();
          Audio.play('bark');
          this.fx.barkRing(this.pc.stats.barkRange, () => {
            const r = this.pc.barkRect();
            return { x: r.x, y: r.y + r.h / 2 };
          });
          break;
        case 'bonk':
          this.damage();
          break;
      }
    }
    if (!wasGrounded && this.pc.grounded && this.pc.hovering) Audio.stopTail();

    if (debugFlags.god && this.pc.y > WORLD.groundY + 60) {
      this.pc.y = WORLD.groundY - 40;
      this.pc.vy = -700;
    }

    // The camera scrolls steadily; a burst surges the hero ahead and pushes it along at the edge.
    this.camX += this.scrollSpeed * dt;
    const push = this.arena ? ARENA.maxX + 40 : this.phase === 'encounter' ? 520 : TUNING.paceMaxX + 140;
    if (this.pc.x - this.camX > push) this.camX = this.pc.x - push;
    if (this.pc.x - this.camX < 60) this.camX = this.pc.x - 60;
    if (this.pc.burstMeter >= 1 && !this.burstWasReady) Audio.play('burst_ready');
    this.burstWasReady = this.pc.burstMeter >= 1;
    this.layoutCamera();
    this.ctx.heroX = this.pc.x;
    this.ctx.heroY = this.pc.y;

    // Bark pulse: each target at most once per pulse.
    if (this.pulseT > 0) {
      this.pulseT -= dt;
      const br = this.pc.barkRect();
      for (const e of this.entities) {
        if (e.lastPulse === this.pulseId || !e.alive) continue;
        const t = e.barkTarget();
        if (t && overlaps(br, t)) {
          e.lastPulse = this.pulseId;
          e.onBark(this.ctx);
        }
      }
    }

    this.updateEntities(dt);
    this.updatePowerUps(dt);
    Audio.setThreat(this.entities.some((e) => e instanceof Squirrel && e.pestering));
    // Carry a hero standing on a moving lift.
    if (this.pc.grounded) {
      for (const e of this.entities) {
        if (!(e instanceof LiftPlatform) || !e.solid) continue;
        const s = e.solid;
        if (Math.abs(this.pc.y - e.prevTop) < 0.75 && this.pc.x + 46 > s.x && this.pc.x - 46 < s.x + s.w) {
          this.pc.y = s.y;
          break;
        }
      }
    }

    // Contact damage.
    if (this.pc.invulnerable <= 0) {
      const hurt = this.pc.hurtRect();
      for (const e of this.entities) {
        const hz = e.alive ? e.hazard() : null;
        if (hz && overlaps(hurt, hz)) {
          this.damage();
          e.onHeroHit(this.ctx);
          break;
        }
      }
    }

    // Pickups.
    const pick = this.pc.pickupRect();
    for (const e of this.entities) {
      const r = e.alive ? e.pickup() : null;
      if (r && overlaps(pick, r)) e.onPickup(this.ctx);
    }

    // Hints, encounter trigger, pits.
    for (let i = this.pendingHints.length - 1; i >= 0; i--) {
      if (this.pc.x >= this.pendingHints[i].x) {
        this.showHint(this.pendingHints[i].id);
        this.pendingHints.splice(i, 1);
      }
    }
    if (this.phase === 'run' && this.pc.x >= this.layout.encounterX) this.startEncounter();
    if (this.pc.y > WORLD.pitDeathY) this.defeat(true);

    this.spawnAhead();
  }

  private updateEntities(dt: number): void {
    const left = this.ctx.cameraLeft - WORLD.despawnBehind;
    // Keep last frame's solids while entities update: squirrels test for a fair,
    // solid landing spot (isClearSpot) during their update.
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.alive) e.update(dt, this.ctx);
      if (!e.alive || e.right < left) {
        e.destroy();
        this.entities.splice(i, 1);
        continue;
      }
    }
    this.solids.length = 0;
    for (const e of this.entities) if (e.solid) this.solids.push(e.solid);
    this.fx.update(dt);
  }

  private render(dt: number): void {
    const cam = this.cameras.main;
    this.scenery.update(dt, cam.scrollX, this.pc.x);

    // In a boss arena the dog turns to face the boss, so his bark always points at it.
    if (this.arena && this.boss instanceof PatternBoss) {
      this.pc.facing = this.pc.x > this.camX + this.boss.screenX ? -1 : 1;
    } else this.pc.facing = 1;
    this.hero.root.scaleX = this.pc.facing;
    this.hero.setPosition(this.pc.x, this.pc.y);
    this.hero.update(dt, {
      grounded: this.pc.grounded,
      vy: this.pc.vy,
      hovering: this.pc.hovering,
      speed: Math.abs(this.pc.effectiveSpeed),
      invulnerable: this.pc.invulnerable,
      bursting: this.pc.bursting,
      ducking: this.pc.ducking,
    });
    this.touch.update(dt, 1 - this.pc.barkCooldown / TUNING.barkCooldown, this.pc.bursting ? 0 : this.pc.burstMeter);
    const shieldLeft = this.power.shield ?? 0;
    this.shieldImg
      .setVisible(shieldLeft > 0 && (shieldLeft > 2 || Math.floor(shieldLeft * 8) % 2 === 0))
      .setPosition(this.pc.x + 10, this.pc.y - 40)
      .setAlpha(0.75 + Math.sin(this.time.now / 120) * 0.2);
    if (this.power.bacon && Math.random() < dt * 25) this.fx.sparkle(this.pc.x - 50, this.pc.y - 30 - Math.random() * 40, 1);
    if (this.pc.bursting && Math.random() < dt * 40) {
      this.fx.streak(this.pc.x - 60 - Math.random() * 60, this.pc.y - 15 - Math.random() * 55);
    }
    if (this.pc.hovering && Math.random() < dt * 20) {
      const t = this.hero.tailWorld;
      this.fx.propeller(t.x, t.y);
    }

    const surf = this.phase === 'defeat' && this.pitFall ? null : this.surfaceBelow(this.pc.x, this.pc.y);
    if (surf === null) this.shadow.setVisible(false);
    else {
      const k = Phaser.Math.Clamp(1 - (surf - this.pc.y) / 260, 0.35, 1);
      this.shadow.setVisible(true).setPosition(this.pc.x - 4, surf).setScale(ART_SCALE * k * 0.95, ART_SCALE * k).setAlpha(k);
    }

    this.hud.update(dt, {
      hearts: this.hearts,
      bones: this.bones,
      metres: this.metres(),
      wagFraction: this.pc.wagFraction,
      hovering: this.pc.hovering,
      burstFraction: this.pc.burstMeter,
      bursting: this.pc.bursting,
      progress: this.phase === 'run' ? (this.pc.x - this.layout.startX) / Math.max(1, this.layout.encounterX - this.layout.startX) : 1,
      powerups: (Object.keys(this.power) as PowerUpKind[]).map((k) => ({ icon: POWERUPS[k].icon, frac: this.power[k]! / POWERUPS[k].duration })),
      barkCooldown: this.pc.barkCooldown,
      bossHits: this.boss ? this.boss.hits : null,
      bossMax: this.boss?.maxHits ?? 1,
      bossTitle: this.boss?.title ?? '',
      bossIcon: this.boss?.icon ?? '',
    });

    this.drawDebug();
  }

  private drawDebug(): void {
    const g = this.debugG;
    if (!g) return;
    g.clear();
    if (!(debugFlags.hitboxes || progress.state.settings.showHitboxes)) return;
    const r = (rect: Rect, color: number, alpha = 1) => {
      g.lineStyle(2, color, alpha);
      g.strokeRect(rect.x, rect.y, rect.w, rect.h);
    };
    for (const s of this.solids) if (s.kind !== 'ground') r(s, 0xffffff, 0.6);
    r(this.pc.bodyRect(), 0x41d16b);
    r(this.pc.hurtRect(), 0xff3b3b);
    if (this.pulseT > 0) r(this.pc.barkRect(), 0x42b7f0);
    else r(this.pc.barkRect(), 0x42b7f0, 0.25);
    for (const e of this.entities) {
      const hz = e.hazard();
      if (hz) r(hz, 0xff9a2e);
      const bt = e.barkTarget();
      if (bt) r(bt, 0xffe14a, 0.8);
      const pk = e.pickup();
      if (pk) r(pk, 0xffffff, 0.35);
    }
  }
}
