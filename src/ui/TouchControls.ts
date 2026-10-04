import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { InputManager } from '../systems/InputManager';

/**
 * Two-thumb touch layout: left half of the screen jumps, right half barks.
 * Each half shows a large button. Supports simultaneous presses (multitouch)
 * so hover and bark can be held/pressed together.
 */
export class TouchControls {
  private jumpBtn: Phaser.GameObjects.Image;
  private barkBtn: Phaser.GameObjects.Image;
  private pointerAction = new Map<number, 'jump' | 'bark'>();

  constructor(private scene: Phaser.Scene, private input: InputManager, private isBlocked: (p: Phaser.Input.Pointer) => boolean) {
    scene.input.addPointer(3);
    this.jumpBtn = scene.add.image(120, 600, 'btn_jump').setScale(ART_SCALE * 1.15).setScrollFactor(0).setDepth(DEPTH.touch).setAlpha(0.85);
    this.barkBtn = scene.add.image(1160, 600, 'btn_bark').setScale(ART_SCALE * 1.15).setScrollFactor(0).setDepth(DEPTH.touch).setAlpha(0.85);
    this.setVisible(scene.sys.game.device.input.touch || InputManager.touchMode);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.up, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  setVisible(v: boolean): void {
    this.jumpBtn.setVisible(v);
    this.barkBtn.setVisible(v);
  }

  private down(p: Phaser.Input.Pointer): void {
    if (this.isBlocked(p)) return;
    if (p.wasTouch) this.setVisible(true);
    const action = p.x < this.scene.scale.width / 2 ? 'jump' : 'bark';
    this.pointerAction.set(p.id, action);
    if (p.wasTouch) InputManager.touchMode = true;
    this.input.touchDown(action, p.id);
    const btn = action === 'jump' ? this.jumpBtn : this.barkBtn;
    btn.setScale(ART_SCALE * 1.05).setAlpha(1);
  }

  private up(p: Phaser.Input.Pointer): void {
    const action = this.pointerAction.get(p.id);
    this.pointerAction.delete(p.id);
    this.input.touchUp(p.id);
    if (!action) return;
    const still = [...this.pointerAction.values()].includes(action);
    if (!still) (action === 'jump' ? this.jumpBtn : this.barkBtn).setScale(ART_SCALE * 1.15).setAlpha(0.85);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.up, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
  }
}
