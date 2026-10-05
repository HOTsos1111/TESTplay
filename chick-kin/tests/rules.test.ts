// Gameplay rule invariants (brief §15): powers, shields, magnets, Double Crumb, cooldowns,
// perch contests, cargo drops and showdown scoring.
import { describe, it, expect } from 'vitest';
import { Actor, NO_INPUT, type ActorInput } from '../src/sim/actor';
import { EventLog } from '../src/sim/events';
import { applyPower, bump, tickTimers, type RuleCtx } from '../src/sim/rules';
import { Match } from '../src/sim/match';
import type { LevelDef, ArenaDef } from '../src/sim/types';
import { border, wall } from '../src/data/levels/kit';
import { levelById } from '../src/data/levels';

const ctx = (): RuleCtx => ({ ev: new EventLog(), time: 0, assist: false, drop: () => {} });
const mk = (cls: 'speedy' | 'mighty' | 'nimble' = 'speedy', stage: 1 | 2 | 3 | 4 | 5 = 2) => new Actor({ id: 0, cls, stage, name: 't', isPlayer: true });

describe('power-ups', () => {
  it('same power refreshes duration without stacking', () => {
    const a = mk(); const c = ctx();
    applyPower(a, 'PU-01', c);
    for (let i = 0; i < 300; i++) tickTimers(a, 1 / 120, c);
    applyPower(a, 'PU-01', c);
    expect(a.powers.length).toBe(1);
    expect(a.powers[0].t).toBeCloseTo(6);
  });
  it('limits simultaneous timed powers to two and replaces the one closest to expiring', () => {
    const a = mk(); const c = ctx();
    applyPower(a, 'PU-01', c);
    tickTimers(a, 1, c);
    applyPower(a, 'PU-05', c);
    applyPower(a, 'PU-03', c);
    expect(a.powers.map((p) => p.id).sort()).toEqual(['PU-03', 'PU-05']);
    expect(c.ev.list.some((e) => e.type === 'power' && e.replaced === 'PU-01')).toBe(true);
  });
  it('Shell Shield absorbs exactly one bump then expires', () => {
    const a = mk(); const c = ctx();
    applyPower(a, 'PU-04', c);
    expect(bump(a, 1, 0, 6, 'hazard', c)).toBe(false);
    expect(a.shield).toBe(false);
    a.protectT = 0;
    expect(bump(a, 1, 0, 6, 'hazard', c)).toBe(true);
  });
  it('Shell Shield expires after 10 s', () => {
    const a = mk(); const c = ctx();
    applyPower(a, 'PU-04', c);
    for (let i = 0; i < 10.1 * 120; i++) tickTimers(a, 1 / 120, c);
    expect(a.shield).toBe(false);
  });
  it('Cool Breeze restores 40% stamina instantly and is not a timed power', () => {
    const a = mk('nimble', 3); const c = ctx();
    a.stamina = 0;
    applyPower(a, 'PU-08', c);
    expect(a.stamina).toBeCloseTo(a.staminaMax * 0.4);
    expect(a.powers.length).toBe(0);
  });
  it('Power Corn raises pushing strength only', () => {
    const a = mk('speedy', 2); const c = ctx();
    const before = a.pushForce;
    applyPower(a, 'PU-05', c);
    expect(a.pushForce).toBeCloseTo(before * 1.35);
  });
});

describe('bumps and recovery', () => {
  it('recovery protection prevents chain-stun', () => {
    const a = mk(); const c = ctx();
    expect(bump(a, 1, 0, 6, 'hazard', c)).toBe(true);
    for (let i = 0; i < 60; i++) tickTimers(a, 1 / 120, c);
    expect(bump(a, 1, 0, 6, 'hazard', c)).toBe(false);
  });
  it('Fancy Feathers dodge window ignores sibling bumps but not hazards', () => {
    const a = mk('nimble'); const c = ctx();
    a.dodgeT = 0.3;
    expect(bump(a, 1, 0, 6, 1, c)).toBe(false);
    expect(bump(a, 1, 0, 6, 'hazard', c)).toBe(true);
  });
});

// ---- small synthetic top-down arenas
const topArena = (extra: Partial<ArenaDef>): ArenaDef => ({ mode: 'top', theme: 'nest', w: 14, h: 10, starts: [[3, 5], [11, 5], [3, 8], [11, 8]], solids: [...border(14, 10)], entities: [], ...extra });
const level = (arena: ArenaDef, objective: LevelDef['phases'][0]['objective']): LevelDef => ({ id: 't', chapter: 4, index: 1, title: 't', brief: '', format: 'single', timeLimit: 600, music: 'nest', phases: [{ name: 't', objective, arena }] });
const match = (l: LevelDef, stage: 1 | 2 | 3 | 4 | 5 = 4) => new Match({ level: l, stage, seed: 1, difficulty: 'standard', generation: 1, noCountdown: true, competitors: [{ cls: 'speedy', name: 'p', isPlayer: true }, { cls: 'mighty', name: 'a', isPlayer: false }, { cls: 'nimble', name: 'b', isPlayer: false }, { cls: 'speedy', name: 'c', isPlayer: false }] });
const run = (m: Match, secs: number, inp: (t: number) => ActorInput[] = () => []) => { for (let i = 0; i < secs * 120; i++) m.step(1 / 120, inp(i / 120)); };

describe('collection accounting', () => {
  it('Double Crumb doubles loose crumbs only and never banked/delivered score', () => {
    const l = level(topArena({ entities: [{ t: 'crumb', x: 3.4, y: 5 }, { t: 'basket', x: 7, y: 2, r: 1 }, { t: 'scratch', x: 10, y: 2 }] }), { kind: 'collect', count: 10 });
    const m = match(l);
    applyPower(m.player, 'PU-07', { ev: m.ev, time: 0, assist: false, drop: () => {} });
    run(m, 0.2);
    expect(m.player.st.crumbs).toBe(2);
    m.player.carryTreats = 2;
    m.player.x = 7; m.player.y = 2.8;
    run(m, 0.05, () => [{ ...NO_INPUT, interact: true }]);
    expect(m.player.st.delivered).toBe(2);
  });
  it('Worm Magnet does not pull through walls', () => {
    const l = level(topArena({ solids: [...border(14, 10), wall(5, 0.6, 0.6, 8.8, 1.4, 'fence')], entities: [{ t: 'crumb', x: 6.4, y: 5 }] }), { kind: 'collect', count: 10 });
    const m = match(l);
    m.player.x = 4.2; m.player.y = 5;
    applyPower(m.player, 'PU-03', { ev: m.ev, time: 0, assist: false, drop: () => {} });
    run(m, 0.3);
    expect(m.player.st.crumbs).toBe(0);
  });
  it('bumped carriers drop cargo as recoverable loose items', () => {
    const l = level(topArena({}), { kind: 'deliver', cargo: 'treat', count: 5 });
    const m = match(l);
    m.player.carryTreats = 3;
    bump(m.player, 1, 0, 6, 1, { ev: m.ev, time: 0, assist: false, drop: (a, t, b) => (m as unknown as { dropCargo: (a: Actor, t: number, b: boolean) => void }).dropCargo(a, t, b) });
    expect(m.player.carryTreats).toBe(0);
    expect(m.arenas[0].loose.filter((x) => x.alive && x.kind === 'treat').length).toBe(3);
  });
});

describe('perch contests', () => {
  it('contested occupancy pauses accumulation; a lone owner accrues', () => {
    const l = level(topArena({ entities: [{ t: 'perch', x: 6, y: 4, w: 2, h: 2 }] }), { kind: 'perch', seconds: 15 });
    const m = match(l, 1);
    for (const a of m.actors) { a.x = 1 + a.id; a.y = 1; }
    m.player.x = 7; m.player.y = 5;
    run(m, 1);
    expect(m.player.st.perchTime).toBeGreaterThan(0.9);
    m.actors[1].x = 7.2; m.actors[1].y = 5;
    const before = m.player.st.perchTime;
    run(m, 0.5);
    expect(m.player.st.perchTime - before).toBeLessThan(0.05);
  });
});

describe('abilities', () => {
  it('signature ability respects its cooldown', () => {
    const l = level(topArena({}), { kind: 'collect', count: 99 });
    const m = match(l, 2);
    let uses = 0;
    for (let i = 0; i < 120 * 10; i++) {
      m.step(1 / 120, [{ ...NO_INPUT, ability: i % 2 === 0 }]);
      uses += m.ev.drain().filter((e) => e.type === 'ability' && e.a === 0).length;
    }
    expect(uses).toBe(2); // 6 s cooldown over 10 s
  });
});

describe('showdown', () => {
  it('awards 5/3/2/1 per round and gates success on the total', () => {
    const l = levelById('5-5')!;
    const m = new Match({ level: l, stage: 5, seed: 2, difficulty: 'standard', generation: 1, noCountdown: true, competitors: [{ cls: 'speedy', name: 'p', isPlayer: true }, { cls: 'mighty', name: 'a', isPlayer: false }, { cls: 'nimble', name: 'b', isPlayer: false }, { cls: 'speedy', name: 'c', isPlayer: false }] });
    // force round results through the public step loop: teleport the player into each finish and let rounds resolve
    let guard = 0;
    while (m.state !== 'done' && guard++ < 120 * 600) {
      const ar = m.arenaOf(m.player);
      const fin = ar.ents.find((e) => e.t === 'finish');
      if (m.state === 'play' && fin && !m.player.finished) { m.player.x = fin.x + 1; m.player.y = fin.y; }
      const per = ar.ents.find((e) => e.t === 'perch');
      if (m.state === 'play' && per && !m.player.finished) { m.player.x = per.x + per.w / 2; m.player.y = per.y; m.player.grounded = true; for (const o of m.actors) if (!o.isPlayer) { o.x = 2; o.y = 0; } }
      if (m.state === 'play' && ar.def.mode === 'top' && !m.player.finished) m.player.st.delivered = 3;
      m.step(1 / 120, []);
    }
    expect(m.state).toBe('done');
    expect(m.points.reduce((s, p) => s + p, 0)).toBe(11 * 3);
    expect(m.result!.points![m.player.id]).toBe(15);
    expect(m.result!.success).toBe(true);
  });
});
