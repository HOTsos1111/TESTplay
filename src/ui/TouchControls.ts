import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { InputManager } from '../systems/InputManager';

type Action = 'jump' | 'bark' | 'burst';

/**
 * Two-thumb touch layout: the left half of the screen jumps, the right half
 * barks, and a BURST button sits above BARK under the right thumb. Supports
 * simultaneous presses (multitouch) so hover, bark and burst combine freely.
 */
export class TouchControls {
  private jumpBtn: Phaser.GameObjects.Image;
  private barkBtn: Phaser.GameObjects.Image;
  private burstBtn: Phaser.GameObjects.Image;
  private pointerAction = new Map<number, Action>();
  private t = 0;
  static readonly BURST_RADIUS = 80;

  constructor(private scene: Phaser.Scene, private input: InputManager, private isBlocked: (p: Phaser.Input.Pointer) => boolean) {
    scene.input.addPointer(3);
    const btn = (key: string, scale: number) =>
      scene.add.image(0, 0, key).setScale(ART_SCALE * scale).setScrollFactor(0).setDepth(DEPTH.touch).setAlpha(0.85);
    this.jumpBtn = btn('btn_jump', 1.15);
    this.barkBtn = btn('btn_bark', 1.15);
    this.burstBtn = btn('btn_burst', 0.95);
    this.layout(scene.scale.width);
    this.setVisible(scene.sys.game.device.input.touch || InputManager.touchMode);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.up, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  layout(width: number): void {
    this.jumpBtn.setPosition(120, 600);
    this.barkBtn.setPosition(width - 120, 600);
    this.burstBtn.setPosition(width - 120, 448);
  }

  setVisible(v: boolean): void {
    this.jumpBtn.setVisible(v);
    this.barkBtn.setVisible(v);
    this.burstBtn.setVisible(v);
  }

  /** Dim the burst button while its meter refills; pulse it when ready. */
  update(dt: number, burstReady: boolean): void {
    this.t += dt;
    const pressed = [...this.pointerAction.values()].includes('burst');
    this.burstBtn.setAlpha(burstReady ? 0.95 : 0.4);
    if (!pressed) this.burstBtn.setScale(ART_SCALE * (burstReady ? 0.95 + Math.sin(this.t * 7) * 0.04 : 0.9));
  }

  private actionAt(p: Phaser.Input.Pointer): Action {
    const b = this.burstBtn;
    if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < TouchControls.BURST_RADIUS) return 'burst';
    return p.x < this.scene.scale.width / 2 ? 'jump' : 'bark';
  }

  private buttonFor(a: Action): Phaser.GameObjects.Image {
    return a === 'jump' ? this.jumpBtn : a === 'bark' ? this.barkBtn : this.burstBtn;
  }

  private down(p: Phaser.Input.Pointer): void {
    if (this.isBlocked(p)) return;
    if (p.wasTouch) {
      this.setVisible(true);
      InputManager.touchMode = true;
    }
    const action = this.actionAt(p);
    this.pointerAction.set(p.id, action);
    this.input.touchDown(action, p.id);
    const btn = this.buttonFor(action);
    btn.setScale(ART_SCALE * (action === 'burst' ? 0.85 : 1.05)).setAlpha(1);
  }

  private up(p: Phaser.Input.Pointer): void {
    const action = this.pointerAction.get(p.id);
    this.pointerAction.delete(p.id);
    this.input.touchUp(p.id);
    if (!action) return;
    const still = [...this.pointerAction.values()].includes(action);
    if (!still && action !== 'burst') this.buttonFor(action).setScale(ART_SCALE * 1.15).setAlpha(0.85);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.up, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
  }
}
