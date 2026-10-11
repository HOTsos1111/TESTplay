import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { UPGRADES, maxLevel, type UpgradeDef, type UpgradeIntro } from '../data/upgrades';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { InputManager } from '../systems/InputManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop, panel } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';

interface Card {
  def: UpgradeDef;
  pips: Phaser.GameObjects.Graphics;
  info: Phaser.GameObjects.Text;
  buy: Button;
}

/**
 * The bone shop: cash in bones for skills, three columns of upgrade cards. Every
 * purchase opens a card explaining what it does and how to use it.
 */
export class UpgradeScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private from = 'Title';
  private balance!: Phaser.GameObjects.Text;
  private cards: Card[] = [];
  private nav!: MenuNav;
  private buttons: Button[] = [];
  private popup: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Upgrade');
  }

  create(data: { from?: string }): void {
    this.from = data.from ?? 'Title';
    this.cards = [];
    this.buttons = [];
    this.popup = null;
    this.backdrop = new Backdrop(this, 0.55, 15);
    Audio.playMusic('title');
    this.add.text(640, 46, COPY.shop, textStyle(46, CSS.butter, 10)).setOrigin(0.5).setDepth(DEPTH.hud);
    this.add.image(1088, 46, 'bone').setScale(ART_SCALE * 1.4).setDepth(DEPTH.hud);
    this.balance = this.add.text(1118, 46, '', textStyle(30)).setOrigin(0, 0.5).setDepth(DEPTH.hud);

    UPGRADES.forEach((def, i) => {
      const x = 225 + (i % 3) * 415;
      const y = 190 + Math.floor(i / 3) * 178;
      panel(this, x, y, 395, 162).setDepth(DEPTH.hud);
      const icon = this.add.image(x - 150, y - 18, def.icon).setDepth(DEPTH.hud);
      icon.setScale(Math.min(64 / icon.width, 64 / icon.height));
      this.add.text(x - 104, y - 52, def.name, textStyle(24, CSS.white)).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      const info = this.add.text(x - 104, y - 18, '', { ...textStyle(17, CSS.cream, 3), wordWrap: { width: 280 } }).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      const pips = this.add.graphics().setDepth(DEPTH.hud).setPosition(x - 92, y + 22);
      const buy = new Button(this, x + 98, y + 46, '', () => this.buy(def), { width: 176, height: 46, fontSize: 18, color: COLOR.coral });
      buy.setDepth(DEPTH.hud);
      this.buttons.push(buy);
      this.cards.push({ def, pips, info, buy });
    });
    const back = new Button(this, 110, 46, COPY.back, () => this.back(), { width: 170, height: 52, fontSize: 22, color: 0x6f86a8 });
    back.setDepth(DEPTH.hud);
    this.buttons.push(back);
    this.nav = new MenuNav(this, this.buttons, () => (this.popup ? this.closePopup() : this.back()));
    this.refresh();
  }

  private back(): void {
    this.scene.start(this.from === 'ChapterMap' ? 'ChapterMap' : 'Title');
  }

  private buy(def: UpgradeDef): void {
    if (this.popup) return;
    const lvl = progress.state.upgrades[def.key];
    if (lvl >= maxLevel(def.key)) return;
    if (progress.buyUpgrade(def.key, def.prices[lvl])) {
      Audio.play('powerup');
      this.cameras.main.flash(150, 255, 214, 110);
      this.refresh();
      this.showPopup(def, def.intro[lvl]);
    } else {
      Audio.play('ui_back');
      this.refresh();
    }
  }

  /** What the new skill does and how to use it. */
  private showPopup(def: UpgradeDef, intro: UpgradeIntro): void {
    const c = this.add.container(0, 0).setDepth(DEPTH.hud + 20);
    const dim = this.add.rectangle(640, 360, 1280, 720, COLOR.outline, 0.72).setInteractive();
    c.add(dim);
    c.add(panel(this, 640, 360, 820, 470, 0.97));
    const icon = this.add.image(640, 190, def.icon);
    icon.setScale(Math.min(110 / icon.width, 110 / icon.height));
    c.add(icon);
    c.add(this.add.text(640, 268, intro.title, textStyle(40, CSS.butter, 8)).setOrigin(0.5));
    c.add(this.add.text(640, 350, intro.body, { ...textStyle(24, CSS.white, 4), align: 'center', wordWrap: { width: 720 } }).setOrigin(0.5));
    const how = InputManager.touchMode ? intro.touch : intro.keys;
    if (how) {
      const box = this.add.graphics();
      box.fillStyle(COLOR.teal, 0.9).fillRoundedRect(640 - 330, 418, 660, 52, 16);
      c.add(box);
      c.add(this.add.text(640, 444, `HOW: ${how}`, textStyle(22, CSS.white, 4)).setOrigin(0.5));
    }
    const ok = new Button(this, 640, 528, 'Got it!', () => this.closePopup(), { width: 240, height: 58, fontSize: 26, color: COLOR.coral });
    c.add(ok);
    c.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    // Centre the pop-up's scale on the screen middle.
    c.setPosition(640 * (1 - c.scale), 360 * (1 - c.scale));
    this.tweens.add({ targets: c, x: 0, y: 0, duration: 220, ease: 'Back.Out' });
    this.popup = c;
    this.nav.setButtons([ok]);
    this.nav.focus(0);
  }

  private closePopup(): void {
    if (!this.popup) return;
    this.popup.destroy();
    this.popup = null;
    Audio.play('ui_confirm');
    this.nav.setButtons(this.buttons);
    this.refresh();
  }

  private refresh(): void {
    const p = progress.state;
    this.balance.setText(String(p.boneBalance));
    for (const c of this.cards) {
      const lvl = p.upgrades[c.def.key];
      const max = maxLevel(c.def.key);
      c.info.setText(c.def.describe(lvl));
      c.pips.clear();
      for (let i = 0; i < max; i++) {
        const x = i * 30;
        c.pips.fillStyle(COLOR.outline, 1).fillCircle(x, 0, 11);
        c.pips.fillStyle(i < lvl ? COLOR.butter : 0x5c4560, 1).fillCircle(x, 0, 8);
      }
      if (lvl >= max) c.buy.setText('Maxed out!').setDisabled(true);
      else {
        const price = c.def.prices[lvl];
        const verb = c.def.unlock && lvl === 0 ? 'Unlock' : 'Buy';
        c.buy.setText(`${verb} · ${price}`).setDisabled(p.boneBalance < price);
      }
    }
  }

  update(_t: number, dms: number): void {
    this.backdrop.update(Math.min(dms / 1000, 0.1));
  }
}
