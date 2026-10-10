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
  private touchBurst = new Set<number>();
  private burstKeys: Phaser.Input.Keyboard.Key[] = [];
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private dirKeys: { left: Phaser.Input.Keyboard.Key[]; right: Phaser.Input.Keyboard.Key[]; down: Phaser.Input.Keyboard.Key[] } = { left: [], right: [], down: [] };
  /** Virtual joystick vector (-1..1 each axis, y down), set by the touch layer. */
  private stick = { x: 0, y: 0, active: false };
  private stickUp = false;
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
      const dir = (code: number) => kb.addKey(code, true, false);
      this.dirKeys = {
        left: [dir(K.LEFT), dir(K.A)],
        right: [dir(K.RIGHT), dir(K.D)],
        down: [dir(K.DOWN), dir(K.S)],
      };
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
    if (action === 'burst') this.burstKeys.push(key);
  }

  /** Touch buttons forward pointer presses here. */
  touchDown(action: 'jump' | 'bark' | 'burst', pointerId: number): void {
    InputManager.touchMode = true;
    if (!this.enabled) return;
    if (action === 'burst') {
      this.touchBurst.add(pointerId);
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
    this.touchBurst.delete(pointerId);
  }

  /** SPEED held down: the burst lasts as long as it is held (and the meter lasts). */
  get burstHeld(): boolean {
    return this.touchBurst.size > 0 || this.burstKeys.some((k) => k.isDown);
  }

  /** Joystick update from the touch layer. Pushing up acts like pressing jump. */
  setStick(x: number, y: number, active: boolean): void {
    if (active && !this.enabled) return;
    InputManager.touchMode = true;
    this.stick = { x, y, active };
    const up = active && y < -0.5;
    if (up && !this.stickUp) this.jumpLatch = true;
    this.stickUp = up;
  }

  /** -1 (pace back) .. 1 (pace forward). */
  get pace(): number {
    const kb = (this.dirKeys.right.some((k) => k.isDown) ? 1 : 0) - (this.dirKeys.left.some((k) => k.isDown) ? 1 : 0);
    if (kb !== 0) return kb;
    if (!this.stick.active) return 0;
    const x = this.stick.x;
    return Math.abs(x) < 0.25 ? 0 : Math.max(-1, Math.min(1, (x - Math.sign(x) * 0.25) / 0.75));
  }

  get duckHeld(): boolean {
    return this.dirKeys.down.some((k) => k.isDown) || (this.stick.active && this.stick.y > 0.5);
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
    return this.touchJump.size > 0 || this.stickUp;
  }

  /** Consumes latched presses. Call once per rendered frame. */
  consume(): FrameInput & { burstPressed: boolean; burstHeld: boolean; pausePressed: boolean; pace: number } {
    const out = {
      jumpPressed: this.jumpLatch,
      jumpHeld: this.jumpHeld,
      duckHeld: this.duckHeld,
      pace: this.pace,
      barkPressed: this.barkLatch,
      burstPressed: this.burstLatch,
      burstHeld: this.burstHeld,
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
    this.touchBurst.clear();
    this.stick = { x: 0, y: 0, active: false };
    this.stickUp = false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.clear();
  }

  destroy(): void {
    for (const k of [...this.dirKeys.left, ...this.dirKeys.right, ...this.dirKeys.down]) this.scene.input.keyboard?.removeKey(k, true);
    for (const k of this.keys) {
      k.removeAllListeners();
      this.scene.input.keyboard?.removeKey(k, true);
    }
    this.keys = [];
  }
}
