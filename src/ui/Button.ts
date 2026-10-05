import Phaser from 'phaser';
import { Audio } from '../systems/AudioManager';
import { COLOR, textStyle } from './theme';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  fontSize?: number;
  disabled?: boolean;
  /** Optional icon texture shown left of the label. */
  icon?: string;
  iconScale?: number;
}

/** Rounded live-text button with hover, press, focus and disabled states. */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image | null = null;
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
    if (o.icon) {
      this.icon = scene.add.image(0, -2, o.icon).setScale(o.iconScale ?? 0.5);
      this.add(this.icon);
    }
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
    this.redraw();
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
    const r = Math.min(24, h / 2.6);
    const depth = 7;
    const lift = this.pressed ? depth - 2 : this.hovered || this.focused ? -2 : 0;
    const fill = this.disabled ? 0x8a7f8c : this.color;
    const c = Phaser.Display.Color.IntegerToColor(fill);
    const dark = Phaser.Display.Color.GetColor(c.red * 0.62, c.green * 0.62, c.blue * 0.62);
    g.clear();
    // Soft drop shadow, then the darker "lip" that gives the chunky 3D press.
    g.fillStyle(COLOR.outline, 0.35);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + depth + 6, w, h, r);
    g.fillStyle(COLOR.outline, 1);
    g.fillRoundedRect(-w / 2 - 2, -h / 2 + depth - 2, w + 4, h + 4, r + 2);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, r);
    // Face with a glossy top and a gentle shade at the bottom.
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(-w / 2 + 6, -h / 2 + lift + h * 0.55, w - 12, h * 0.4, { tl: 0, tr: 0, bl: r - 6, br: r - 6 });
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(-w / 2 + 12, -h / 2 + lift + 6, w - 24, h * 0.34, r - 8);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(-w / 2 + 22, -h / 2 + lift + 14, 4);
    g.lineStyle(4.5, COLOR.outline, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    if (this.focused) {
      g.lineStyle(5, COLOR.butter, 1);
      g.strokeRoundedRect(-w / 2 - 9, -h / 2 + lift - 9, w + 18, h + 18 + depth, r + 8);
    }
    // Lay out icon + label as one centred group.
    const iw = this.icon ? this.icon.displayWidth + 12 : 0;
    const total = iw + this.label.width;
    if (this.icon) this.icon.setPosition(-total / 2 + this.icon.displayWidth / 2, -2 + lift);
    this.label.setPosition(-total / 2 + iw + this.label.width / 2, -2 + lift);
    this.label.setAlpha(this.disabled ? 0.7 : 1);
    this.icon?.setAlpha(this.disabled ? 0.6 : 1);
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
