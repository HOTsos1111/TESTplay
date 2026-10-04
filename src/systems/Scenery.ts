import Phaser from 'phaser';
import { DEPTH, VIEW } from '../data/config';
import { ART_SCALE } from './AssetRegistry';
import { BAND, rng } from './art/canvas';
import { DECALS, ZONE_ACTORS, ZONE_DECALS } from './art/decorArt';

export interface SceneryZone {
  /** World x where this zone takes over. */
  x: number;
  near: string;
  mid: string;
  /** Indoor zones get ceiling chains and lamps in the foreground. */
  indoor: boolean;
}

const FAR = 0.08;
const MID = 0.3;
const NEAR = 0.62;
const FG = 1.35;

interface Actor {
  kind: string;
  /** Wall-space x of the actor's anchor. */
  x: number;
  objs: Phaser.GameObjects.Image[];
  t: number;
  /** Pigeons: per-bird flight velocity once startled. */
  fly?: { vx: number; vy: number }[];
}

interface Placed {
  img: Phaser.GameObjects.Image;
  x: number;
  w: number;
  sway?: number;
}

/**
 * Background and foreground dressing. Purely cosmetic: nothing here collides.
 * - The near wall and mid layer change by zone with a crossfade.
 * - Wall decals ride on the near wall (same parallax) so the wall never repeats exactly.
 * - Dark silhouettes hang from the top edge in front of the action (never at floor level).
 * - Flocks of birds cross the sky now and then.
 */
export class Scenery {
  private far: Phaser.GameObjects.TileSprite;
  private mids: Phaser.GameObjects.TileSprite[];
  private nears: Phaser.GameObjects.TileSprite[];
  private front = 0;
  private fade = 1;
  private zoneIndex = -1;
  private decals: Placed[] = [];
  private decalCursor = 0;
  private fgItems: Placed[] = [];
  private fgCursor = 0;
  private birds: { img: Phaser.GameObjects.Image; vx: number; flap: number }[] = [];
  private birdT = 4;
  private actors: Actor[] = [];
  private actorCursor = 0;
  private rand = rng(1234);
  private camX = 0;

  constructor(private scene: Phaser.Scene, private zones: SceneryZone[], startCamX: number) {
    const w = scene.scale.width;
    const ts = (key: string, depth: number, band: { y0: number; h: number } = { y0: 0, h: VIEW.height }) =>
      scene.add.tileSprite(0, band.y0, w, band.h, key).setOrigin(0).setScrollFactor(0).setDepth(depth).setTileScale(ART_SCALE);
    const z0 = this.zoneAt(startCamX + VIEW.width * VIEW.heroScreenX);
    this.far = ts('depot_far', DEPTH.farBg);
    this.mids = [ts(z0.mid, DEPTH.midBg, BAND.mid), ts(z0.mid, DEPTH.midBg + 0.5, BAND.mid).setAlpha(0)];
    this.nears = [ts(z0.near, DEPTH.nearBg, BAND.near), ts(z0.near, DEPTH.nearBg + 0.5, BAND.near).setAlpha(0)];
    this.zoneIndex = this.zones.indexOf(z0);
    this.camX = startCamX;
    this.decalCursor = startCamX * NEAR - 200;
    this.fgCursor = startCamX * FG + 300;
    this.actorCursor = startCamX * NEAR + 500;
  }

  private zoneAt(worldX: number): SceneryZone {
    let z = this.zones[0];
    for (const zone of this.zones) if (worldX >= zone.x) z = zone;
    return z;
  }

  get debug(): unknown {
    return { zone: this.zoneIndex, front: this.front, fade: this.fade, nears: this.nears.map((n) => [n.texture.key, n.alpha, n.depth]), mids: this.mids.map((n) => [n.texture.key, n.alpha, n.depth]) };
  }

  layout(width: number): void {
    this.far.setSize(width, VIEW.height);
    for (const t of this.mids) t.setSize(width, BAND.mid.h);
    for (const t of this.nears) t.setSize(width, BAND.near.h);
  }

  update(dt: number, camX: number, heroX: number): void {
    this.camX = camX;
    const width = this.scene.scale.width;

    // Zone change: put the new art on the back layer and fade it in.
    const zone = this.zoneAt(heroX + width * 0.4);
    const zi = this.zones.indexOf(zone);
    if (zi !== this.zoneIndex) {
      this.zoneIndex = zi;
      const back = 1 - this.front;
      this.nears[back].setTexture(zone.near).setAlpha(0).setDepth(DEPTH.nearBg + 0.5);
      this.nears[this.front].setDepth(DEPTH.nearBg);
      this.mids[back].setTexture(zone.mid).setAlpha(0).setDepth(DEPTH.midBg + 0.5);
      this.mids[this.front].setDepth(DEPTH.midBg);
      this.front = back;
      this.fade = 0;
    }
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.9);
      this.nears[this.front].setAlpha(this.fade);
      this.mids[this.front].setAlpha(this.fade);
      // Once the new zone is fully in, hide the old one so it can't show through transparent areas.
      if (this.fade >= 1) {
        this.nears[1 - this.front].setAlpha(0);
        this.mids[1 - this.front].setAlpha(0);
      }
    }

    this.far.tilePositionX = (camX * FAR) / ART_SCALE;
    for (const m of this.mids) m.tilePositionX = (camX * MID) / ART_SCALE;
    for (const n of this.nears) n.tilePositionX = (camX * NEAR) / ART_SCALE;

    this.updateDecals(width, zone);
    this.updateActors(dt, width, zone, heroX - camX);
    this.updateForeground(dt, width, zone);
    this.updateBirds(dt, width);
  }

  private updateDecals(width: number, zone: SceneryZone): void {
    const viewL = this.camX * NEAR;
    const viewR = viewL + width;
    while (this.decalCursor < viewR + 200) {
      const keys = ZONE_DECALS[zone.near] ?? ZONE_DECALS.depot_near;
      const key = keys[Math.floor(this.rand() * keys.length)];
      const spec = DECALS.find((d) => d.key === key)!;
      const hanging = key === 'decor_lamp' || key === 'decor_bunting';
      const y = hanging ? 362 : key === 'decor_pipe' ? 380 + this.rand() * 30 : 390 + this.rand() * 70;
      const img = this.scene.add
        .image(this.decalCursor, y, key)
        .setOrigin(0, 0)
        .setScale(ART_SCALE)
        .setScrollFactor(NEAR, 0)
        .setDepth(DEPTH.nearBg + 1)
        .setAlpha(0.92);
      this.decals.push({ img, x: this.decalCursor, w: spec.w });
      this.decalCursor += spec.w + 120 + this.rand() * 320;
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      if (d.x + d.w < viewL - 100) {
        d.img.destroy();
        this.decals.splice(i, 1);
      }
    }
  }

  private wallImage(key: string, x: number, y: number): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, key).setScale(ART_SCALE).setScrollFactor(NEAR, 0).setDepth(DEPTH.nearBg + 2);
  }

  private spawnActor(kind: string, x: number): Actor {
    const a: Actor = { kind, x, objs: [], t: this.rand() * 10 };
    switch (kind) {
      case 'forklift':
        // Washed out so it reads as background, never as an obstacle.
        a.objs.push(this.wallImage('actor_forklift', x, 598).setOrigin(0.5, 1).setTint(0xe6dce8).setAlpha(0.9));
        break;
      case 'pigeons':
        for (let i = 0; i < 3; i++) a.objs.push(this.wallImage('actor_pigeon', x + i * 30, 358).setOrigin(0.5, 1));
        break;
      case 'beacon':
        a.objs.push(this.wallImage('actor_beacon_on', x, 380));
        break;
      case 'cat':
        a.objs.push(this.wallImage('actor_cat_tail', x + 14, 470).setOrigin(0.05, 0.5));
        a.objs.push(this.wallImage('actor_cat', x, 480).setOrigin(0.5, 1));
        break;
      case 'steam':
        break;
    }
    return a;
  }

  private updateActors(dt: number, width: number, zone: SceneryZone, heroScreenX: number): void {
    const viewL = this.camX * NEAR;
    while (this.actorCursor < viewL + width + 250) {
      const kinds = ZONE_ACTORS[zone.near] ?? [];
      if (kinds.length) this.actors.push(this.spawnActor(kinds[Math.floor(this.rand() * kinds.length)], this.actorCursor));
      this.actorCursor += 650 + this.rand() * 700;
    }
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      a.t += dt;
      const screenX = a.x - viewL;
      switch (a.kind) {
        case 'forklift': {
          const img = a.objs[0];
          const v = Math.cos(a.t * 0.45);
          img.x = a.x + Math.sin(a.t * 0.45) * 170;
          img.setFlipX(v < 0);
          img.y = 598 - Math.abs(Math.sin(a.t * 9)) * 1.5;
          break;
        }
        case 'pigeons': {
          if (!a.fly && screenX - heroScreenX < 260) {
            a.fly = a.objs.map(() => ({ vx: 80 + this.rand() * 140, vy: -(200 + this.rand() * 120) }));
          }
          a.objs.forEach((p, j) => {
            if (a.fly) {
              p.x += a.fly[j].vx * dt;
              p.y += a.fly[j].vy * dt;
              p.setTexture(Math.floor(a.t / 0.09 + j) % 2 ? 'bird_down' : 'bird_up');
            } else {
              p.rotation = Math.max(0, Math.sin(a.t * 3 + j * 1.7)) * 0.5;
            }
          });
          break;
        }
        case 'beacon':
          a.objs[0].setTexture(Math.floor(a.t / 0.45) % 2 ? 'actor_beacon_on' : 'actor_beacon_off');
          break;
        case 'cat':
          a.objs[0].rotation = Math.sin(a.t * 2.2) * 0.45;
          break;
        case 'steam':
          if (Math.floor(a.t / 1.4) !== Math.floor((a.t - dt) / 1.4)) {
            const puff = this.wallImage('fx_puff', a.x, 420).setAlpha(0.7).setScale(ART_SCALE * 0.4);
            a.objs.push(puff);
          }
          for (let j = a.objs.length - 1; j >= 0; j--) {
            const p = a.objs[j];
            p.y -= 40 * dt;
            p.setScale(p.scale + dt * 0.5);
            p.setAlpha(p.alpha - dt * 0.55);
            if (p.alpha <= 0) {
              p.destroy();
              a.objs.splice(j, 1);
            }
          }
          break;
      }
      if (screenX < -400) {
        for (const o of a.objs) o.destroy();
        this.actors.splice(i, 1);
      }
    }
  }

  private updateForeground(dt: number, width: number, zone: SceneryZone): void {
    const viewL = this.camX * FG;
    const viewR = viewL + width;
    while (this.fgCursor < viewR + 300) {
      if (zone.indoor) {
        const r = this.rand();
        const key = r < 0.35 ? 'fg_chain' : r < 0.6 ? 'fg_chain_short' : r < 0.85 ? 'fg_lamp' : 'fg_beam';
        const img = this.scene.add
          .image(this.fgCursor, -6, key)
          .setOrigin(0.5, 0)
          .setScale(ART_SCALE * (key === 'fg_beam' ? 1.6 : 1.3))
          .setScrollFactor(FG, 0)
          .setDepth(DEPTH.fx + 12)
          .setAlpha(0.92);
        this.fgItems.push({ img, x: this.fgCursor, w: 260, sway: key.startsWith('fg_chain') ? this.rand() * 6 : undefined });
      }
      this.fgCursor += 700 + this.rand() * 900;
    }
    for (let i = this.fgItems.length - 1; i >= 0; i--) {
      const f = this.fgItems[i];
      if (f.sway !== undefined) {
        f.sway += dt;
        f.img.rotation = Math.sin(f.sway * 1.6) * 0.06;
      }
      if (f.x + f.w < viewL - 200) {
        f.img.destroy();
        this.fgItems.splice(i, 1);
      }
    }
  }

  private updateBirds(dt: number, width: number): void {
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 7 + this.rand() * 9;
      const n = 3 + Math.floor(this.rand() * 4);
      const y0 = 70 + this.rand() * 140;
      const vx = -(120 + this.rand() * 110);
      for (let i = 0; i < n; i++) {
        const img = this.scene.add
          .image(width + 40 + i * 34, y0 + (i % 2) * 16 + i * 4, 'bird_up')
          .setScale(ART_SCALE * (0.8 + this.rand() * 0.4))
          .setScrollFactor(0)
          .setDepth(DEPTH.farBg + 1);
        this.birds.push({ img, vx, flap: this.rand() });
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.img.x += b.vx * dt;
      b.flap += dt;
      b.img.setTexture(Math.floor(b.flap / 0.14) % 2 ? 'bird_down' : 'bird_up');
      if (b.img.x < -60) {
        b.img.destroy();
        this.birds.splice(i, 1);
      }
    }
  }
}
