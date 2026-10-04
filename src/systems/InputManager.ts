import Phaser from 'phaser';
import type { FrameInput } from './PlayerController';

/**
 * Collects keyboard and multitouch input as edge-triggered presses plus held
 * state. Presses are latched until consumed so a press+release inside a single
 * frame is never lost, and key auto-repeat never produces a new press.
 */
export class InputManager {
  private jumpLatch = false;
  private barkLatch = false;
  private burstLatch = false;
  private pauseLatch = false;
  private keyJumpHeld = new Set<string>();
  private touchJump = new Set<number>();
  private touchBark = new Set<number>();
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private enabled = true;
  /** Set once a touch is seen so prompts can switch to touch wording. */
  static touchMode = false;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.bindKey(K.SPACE, 'jump');
      this.bindKey(K.UP, 'jump');
      this.bindKey(K.W, 'jump');
      this.bindKey(K.X, 'bark');
      this.bindKey(K.K, 'bark');
      this.bindKey(K.SHIFT, 'burst');
      this.bindKey(K.C, 'burst');
      this.bindKey(K.L, 'burst');
      this.bindKey(K.ESC, 'pause');
      this.bindKey(K.P, 'pause');
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private bindKey(code: number, action: 'jump' | 'bark' | 'burst' | 'pause'): void {
    const key = this.scene.input.keyboard!.addKey(code, true, false);
    const id = `k${code}`;
    key.on('down', () => {
      if (!this.enabled) return;
      if (action === 'jump') {
        this.keyJumpHeld.add(id);
        this.jumpLatch = true;
      } else if (action === 'bark') this.barkLatch = true;
      else if (action === 'burst') this.burstLatch = true;
      else this.pauseLatch = true;
    });
    key.on('up', () => {
      if (action === 'jump') this.keyJumpHeld.delete(id);
    });
    this.keys.push(key);
  }

  /** Touch buttons forward pointer presses here. */
  touchDown(action: 'jump' | 'bark' | 'burst', pointerId: number): void {
    InputManager.touchMode = true;
    if (!this.enabled) return;
    if (action === 'burst') {
      this.burstLatch = true;
    } else if (action === 'jump') {
      this.touchJump.add(pointerId);
      this.jumpLatch = true;
    } else {
      this.touchBark.add(pointerId);
      this.barkLatch = true;
    }
  }

  touchUp(pointerId: number): void {
    this.touchJump.delete(pointerId);
    this.touchBark.delete(pointerId);
  }

  requestPause(): void {
    this.pauseLatch = true;
  }

  get jumpHeld(): boolean {
    if (this.keyJumpHeld.size > 0) {
      // Guard against missed key-up events (e.g. focus loss).
      for (const k of this.keys) if (k.isDown && (k.keyCode === 32 || k.keyCode === 38 || k.keyCode === 87)) return true;
      this.keyJumpHeld.clear();
    }
    return this.touchJump.size > 0;
  }

  /** Consumes latched presses. Call once per rendered frame. */
  consume(): FrameInput & { burstPressed: boolean; pausePressed: boolean } {
    const out = {
      jumpPressed: this.jumpLatch,
      jumpHeld: this.jumpHeld,
      barkPressed: this.barkLatch,
      burstPressed: this.burstLatch,
      pausePressed: this.pauseLatch,
    };
    this.jumpLatch = false;
    this.barkLatch = false;
    this.burstLatch = false;
    this.pauseLatch = false;
    return out;
  }

  /** Drop latched presses and held state (pause/resume, scene transitions). */
  clear(): void {
    this.jumpLatch = false;
    this.barkLatch = false;
    this.burstLatch = false;
    this.pauseLatch = false;
    this.keyJumpHeld.clear();
    this.touchJump.clear();
    this.touchBark.clear();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.clear();
  }

  destroy(): void {
    for (const k of this.keys) {
      k.removeAllListeners();
      this.scene.input.keyboard?.removeKey(k, true);
    }
    this.keys = [];
  }
}
