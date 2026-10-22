import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop, panel } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export class SettingsScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private from = 'Title';

  constructor() {
    super('Settings');
  }

  create(data: { from?: string }): void {
    this.from = data.from ?? 'Title';
    this.backdrop = new Backdrop(this, 0.55, 15);
    panel(this, 640, 380, 760, 560).setDepth(DEPTH.hud);
    this.add.text(640, 60, COPY.settings, textStyle(54, CSS.butter, 10)).setOrigin(0.5).setDepth(DEPTH.hud);

    const buttons: Button[] = [];
    const row = (y: number, label: string, get: () => number, set: (v: number) => void) => {
      this.add.text(330, y, label, textStyle(28)).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      const val = this.add.text(760, y, pct(get()), textStyle(28, CSS.cream)).setOrigin(0.5).setDepth(DEPTH.hud);
      const change = (d: number) => {
        set(Math.round(Math.min(1, Math.max(0, get() + d)) * 10) / 10);
        val.setText(pct(get()));
        const s = progress.state.settings;
        Audio.setVolumes(s.musicVolume, s.sfxVolume);
        Audio.play('bark');
      };
      buttons.push(new Button(this, 670, y, '–', () => change(-0.1), { width: 64, height: 56, fontSize: 32 }).setDepth(DEPTH.hud));
      buttons.push(new Button(this, 850, y, '+', () => change(0.1), { width: 64, height: 56, fontSize: 32 }).setDepth(DEPTH.hud));
    };
    row(160, 'Music', () => progress.state.settings.musicVolume, (v) => progress.setSettings({ musicVolume: v }));
    row(240, 'Sound effects', () => progress.state.settings.sfxVolume, (v) => progress.setSettings({ sfxVolume: v }));

    const hitLabel = () => `Show hitboxes: ${progress.state.settings.showHitboxes ? 'On' : 'Off'}`;
    const hit = new Button(this, 640, 330, hitLabel(), () => {
      progress.setSettings({ showHitboxes: !progress.state.settings.showHitboxes });
      hit.setText(hitLabel());
    }, { width: 420, height: 60, fontSize: 24, color: 0x6f86a8 });
    buttons.push(hit);
    buttons.push(new Button(this, 640, 405, 'Replay opening', () => this.scene.start('Story', { next: 'settings' }), { width: 420, height: 60, fontSize: 24 }));

    // Fresh start: clears bones, every upgrade and every cleared level (after a confirm).
    this.resetBtn = new Button(this, 640, 480, 'Reset All Progress', () => this.askReset(), { width: 420, height: 60, fontSize: 24, color: 0xd6362b });
    buttons.push(this.resetBtn);

    if (!progress.available) {
      this.add.text(640, 545, 'Saving is unavailable in this browser.', textStyle(20, CSS.coral, 4)).setOrigin(0.5).setDepth(DEPTH.hud);
    }
    buttons.push(new Button(this, 640, 610, COPY.back, () => this.back(), { width: 240, height: 58, fontSize: 24, color: 0x6f86a8 }).setDepth(DEPTH.hud));
    for (const b of buttons) b.setDepth(DEPTH.hud);
    this.buttons = buttons;
    this.nav = new MenuNav(this, buttons, () => (this.dialog ? this.closeDialog() : this.back()));
  }

  private buttons: Button[] = [];
  private nav!: MenuNav;
  private resetBtn!: Button;
  private dialog: { box: Phaser.GameObjects.Container; buttons: Button[] } | null = null;

  /** Are you sure? Spells out what a reset erases and what it keeps. */
  private askReset(): void {
    if (this.dialog) return;
    const p = progress.state;
    const upgrades = Object.values(p.upgrades).reduce((n, l) => n + l, 0);
    const box = this.add.container(0, 0).setDepth(DEPTH.hud + 20);
    box.add(this.add.rectangle(640, 360, 1280, 720, COLOR.outline, 0.75).setInteractive());
    box.add(panel(this, 640, 360, 720, 380, 0.98));
    box.add(this.add.text(640, 230, 'Erase all progress?', textStyle(40, CSS.butter, 8)).setOrigin(0.5));
    const body = `This clears your ${p.boneBalance} bones, all ${upgrades} upgrade levels and all ${p.completedChapters.length} cleared levels. You start again from Level 1. Sound settings are kept.`;
    box.add(this.add.text(640, 320, body, { ...textStyle(23, CSS.white, 4), align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5));
    const erase = new Button(this, 520, 460, 'Erase everything', () => this.doReset(), { width: 260, height: 62, fontSize: 24, color: 0xd6362b }).setDepth(DEPTH.hud + 21);
    const cancel = new Button(this, 790, 460, 'Cancel', () => this.closeDialog(), { width: 200, height: 62, fontSize: 24, color: 0x6f86a8 }).setDepth(DEPTH.hud + 21);
    this.dialog = { box, buttons: [cancel, erase] };
    this.nav.setButtons([cancel, erase]);
    this.nav.focus(0);
  }

  private closeDialog(): void {
    if (!this.dialog) return;
    this.dialog.box.destroy();
    for (const b of this.dialog.buttons) b.destroy();
    this.dialog = null;
    this.nav.setButtons(this.buttons);
  }

  private doReset(): void {
    progress.reset();
    this.closeDialog();
    Audio.play('ui_confirm');
    this.resetBtn.setText('Progress erased!').setDisabled(true);
    this.cameras.main.flash(200, 255, 255, 255);
  }

  private back(): void {
    this.scene.start(this.from);
  }

  update(_t: number, dms: number): void {
    this.backdrop.update(Math.min(dms / 1000, 0.1));
  }
}
