import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/config';
import { PlayerController, type FrameInput, type Solid } from '../src/systems/PlayerController';

const G = 600;
const floor: Solid[] = [{ x: -100_000, y: G, w: 200_000, h: 400, oneWay: false, kind: 'ground' }];
const none: FrameInput = { jumpPressed: false, jumpHeld: false, barkPressed: false };
const dt = TUNING.maxStep;

function run(pc: PlayerController, seconds: number, input: Partial<FrameInput> = {}, solids = floor) {
  const events: string[] = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const ev = pc.step(dt, { ...none, ...input, jumpPressed: i === 0 && !!input.jumpPressed }, solids);
    events.push(...ev.map((e) => e.type));
  }
  return events;
}

describe('PlayerController', () => {
  it('jumps once on a fresh press and never re-jumps while held across landing', () => {
    const pc = new PlayerController(0, G);
    const ev = run(pc, 4, { jumpPressed: true, jumpHeld: true });
    expect(ev.filter((e) => e === 'jump')).toHaveLength(1);
    expect(pc.grounded).toBe(true);
  });

  it('early release gives a lower jump than holding', () => {
    const apex = (holdSteps: number) => {
      const pc = new PlayerController(0, G);
      let best = 0;
      for (let i = 0; i < 200; i++) {
        pc.step(dt, { jumpPressed: i === 0, jumpHeld: i < holdSteps, barkPressed: false }, floor);
        best = Math.max(best, G - pc.y);
      }
      return best;
    };
    const tap = apex(1);
    const full = apex(200);
    expect(full).toBeGreaterThan(100);
    expect(tap).toBeLessThan(full * 0.5);
  });

  it('hover caps fall speed, has no upward boost, and drains the meter only in the air', () => {
    const pc = new PlayerController(0, G);
    run(pc, 0.5, { jumpPressed: true, jumpHeld: true });
    expect(pc.hovering).toBe(true);
    expect(pc.vy).toBeLessThanOrEqual(TUNING.hoverMaxFall + 1e-6);
    expect(pc.vy).toBeGreaterThanOrEqual(0);
    const wagMid = pc.wag;
    expect(wagMid).toBeLessThan(TUNING.wagCapacity);
    run(pc, 3, { jumpHeld: true });
    expect(pc.wag).toBeLessThan(0.05 + TUNING.groundRecharge * 3);
  });

  it('cannot hover with an empty meter and recharges on the ground', () => {
    const pc = new PlayerController(0, G);
    pc.wag = 0;
    run(pc, 0.6, { jumpPressed: true, jumpHeld: true });
    expect(pc.hovering).toBe(false);
    run(pc, 3);
    expect(pc.wag).toBeCloseTo(TUNING.wagCapacity, 5);
  });

  it('coyote time allows a jump shortly after running off a ledge', () => {
    const ledge: Solid[] = [{ x: -1000, y: G, w: 1000, h: 400, oneWay: false, kind: 'ground' }];
    const pc = new PlayerController(-200, G);
    // Run until unsupported.
    let i = 0;
    while (pc.grounded && i++ < 1000) pc.step(dt, none, ledge);
    run(pc, 0.05, {}, ledge);
    const ev = run(pc, 0.02, { jumpPressed: true, jumpHeld: true }, ledge);
    expect(ev).toContain('jump');
  });

  it('jump buffer triggers a jump pressed just before landing', () => {
    const pc = new PlayerController(0, G - 200);
    pc.grounded = false;
    // Fall until ~0.08 s before landing (about 600px/s at that point → ~50px).
    let i = 0;
    while (G - pc.y > 45 && i++ < 2000) pc.step(dt, none, floor);
    const ev = run(pc, 0.3, { jumpPressed: true, jumpHeld: false });
    expect(ev).toContain('land');
    expect(ev).toContain('jump');
  });

  it('bark respects the cooldown', () => {
    const pc = new PlayerController(0, G);
    let barks = 0;
    for (let i = 0; i < Math.round(1 / dt); i++) {
      barks += pc.step(dt, { ...none, barkPressed: true }, floor).filter((e) => e.type === 'bark').length;
    }
    expect(barks).toBe(2); // t = 0 and t = 0.75
  });

  it('side contact with a crate bonks once, then passes during invulnerability', () => {
    const crate: Solid = { x: 200, y: G - 64, w: 64, h: 64, oneWay: false, kind: 'crate' };
    const pc = new PlayerController(0, G);
    const ev: string[] = [];
    for (let i = 0; i < Math.round(1.5 / dt); i++) {
      const e = pc.step(dt, none, [...floor, crate]);
      for (const x of e) {
        ev.push(x.type);
        if (x.type === 'bonk') pc.hit();
      }
    }
    expect(ev.filter((e) => e === 'bonk')).toHaveLength(1);
    expect(pc.x).toBeGreaterThan(crate.x + crate.w);
  });

  it('collision box is independent of any cosmetic state', () => {
    const pc = new PlayerController(100, G);
    const a = pc.bodyRect();
    run(pc, 0.4, { jumpPressed: true, jumpHeld: true });
    const b = pc.bodyRect();
    expect([b.w, b.h]).toEqual([a.w, a.h]);
  });
});
