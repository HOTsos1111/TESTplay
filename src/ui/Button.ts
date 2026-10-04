import Phaser from 'phaser';
import { Audio } from '../systems/AudioManager';
import { COLOR, textStyle } from './theme';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
  disabled?: boolean;
}

/** Rounded live-text button with hover, press, focus and disabled states. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private color: number;
  private hovered = false;
  private pressed = false;
  focused = false;
  disabled: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private onClick: () => void, o: ButtonOptions = {}) {
    super(scene, x, y);
    this.bw = o.width ?? 280;
    this.bh = o.height ?? 72;
    this.color = o.color ?? COLOR.teal;
    this.disabled = o.disabled ?? false;
    this.bg = scene.add.graphics();
    this.label = scene.add.text(0, -2, text, textStyle(o.fontSize ?? 30)).setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      this.redraw();
    });
    this.on('pointerdown', () => {
      this.pressed = true;
      this.redraw();
    });
    this.on('pointerup', () => {
      if (this.pressed) this.activate();
      this.pressed = false;
      this.redraw();
    });
    this.redraw();
    scene.add.existing(this);
  }

  setText(t: string): this {
    this.label.setText(t);
    return this;
  }

  setDisabled(d: boolean): this {
    this.disabled = d;
    this.redraw();
    return this;
  }

  setFocused(f: boolean): this {
    this.focused = f;
    this.redraw();
    return this;
  }

  activate(): void {
    if (this.disabled) {
      Audio.play('ui_back');
      return;
    }
    Audio.unlock();
    Audio.play('ui_confirm');
    this.onClick();
  }

  private redraw(): void {
    const g = this.bg;
    const w = this.bw;
    const h = this.bh;
    const lift = this.pressed ? 2 : this.hovered || this.focused ? -2 : 0;
    g.clear();
    g.fillStyle(COLOR.outline, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 20);
    const fill = this.disabled ? 0x8a7f8c : this.color;
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + lift, w, h, 20);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-w / 2 + 10, -h / 2 + lift + 6, w - 20, h * 0.32, 12);
    g.lineStyle(4, COLOR.outline, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + lift, w, h, 20);
    if (this.focused) {
      g.lineStyle(4, COLOR.white, 1);
      g.strokeRoundedRect(-w / 2 - 8, -h / 2 + lift - 8, w + 16, h + 16, 26);
    }
    this.label.y = -2 + lift;
    this.label.setAlpha(this.disabled ? 0.7 : 1);
  }
}

/**
 * Keyboard navigation for a set of buttons: arrows/Tab move focus,
 * Enter/Space activate, Esc triggers the back action.
 */
export class MenuNav {
  private index = -1;
  private handlers: [string, () => void][] = [];

  constructor(private scene: Phaser.Scene, private buttons: Button[], onBack?: () => void) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const on = (ev: string, fn: () => void) => {
      kb.on(ev, fn);
      this.handlers.push([ev, fn]);
    };
    on('keydown-DOWN', () => this.move(1));
    on('keydown-RIGHT', () => this.move(1));
    on('keydown-TAB', () => this.move(1));
    on('keydown-UP', () => this.move(-1));
    on('keydown-LEFT', () => this.move(-1));
    on('keydown-ENTER', () => this.fire());
    on('keydown-SPACE', () => this.fire());
    if (onBack) {
      on('keydown-ESC', () => {
        Audio.play('ui_back');
        onBack();
      });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  setButtons(buttons: Button[]): void {
    this.buttons = buttons;
    this.index = -1;
  }

  focus(i: number): void {
    const list = this.buttons.filter((b) => b.active && b.visible);
    if (!list.length) return;
    this.index = (i + list.length) % list.length;
    list.forEach((b, j) => b.setFocused(j === this.index));
    Audio.play('ui_select');
  }

  private move(d: number): void {
    this.focus(this.index < 0 ? 0 : this.index + d);
  }

  private fire(): void {
    const list = this.buttons.filter((b) => b.active && b.visible);
    if (!list.length) return;
    list[Math.max(0, this.index)].activate();
  }

  destroy(): void {
    const kb = this.scene.input.keyboard;
    for (const [ev, fn] of this.handlers) kb?.off(ev, fn);
    this.handlers = [];
  }
}
