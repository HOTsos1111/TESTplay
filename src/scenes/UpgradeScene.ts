import Phaser from 'phaser';
import { DEPTH, TUNING, UPGRADE_EFFECTS, UPGRADE_MAX_LEVEL, UPGRADE_PRICES } from '../data/config';
import { COPY } from '../data/copy';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress, type UpgradeKey } from '../systems/ProgressStore';
import { Backdrop, panel } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';

const TRACKS: { key: UpgradeKey; name: string; icon: string; describe: (lvl: number) => string }[] = [
  {
    key: 'tail', name: 'Tail Stamina', icon: 'icon_tail',
    describe: (l) => `Hover ${(TUNING.wagCapacity + UPGRADE_EFFECTS.tail * l).toFixed(1)} s`,
  },
  {
    key: 'recharge', name: 'Zoomie Recharge', icon: 'icon_tail_empty',
    describe: (l) => `Recharge +${Math.round(UPGRADE_EFFECTS.recharge * l * 100)}%`,
  },
  {
    key: 'bark', name: 'Bigger Bark', icon: 'icon_bark',
    describe: (l) => `Reach ${TUNING.barkRange + UPGRADE_EFFECTS.bark * l} px`,
  },
];

export class UpgradeScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private from = 'Title';
  private balance!: Phaser.GameObjects.Text;
  private cards: { pips: Phaser.GameObjects.Graphics; info: Phaser.GameObjects.Text; buy: Button; key: UpgradeKey }[] = [];

  constructor() {
    super('Upgrade');
  }

  create(data: { from?: string }): void {
    this.from = data.from ?? 'Title';
    this.cards = [];
    this.backdrop = new Backdrop(this, 0.55, 15);
    Audio.playMusic('title');
    this.add.text(640, 70, COPY.shop, textStyle(54, CSS.butter, 10)).setOrigin(0.5).setDepth(DEPTH.hud);
    this.add.image(570, 135, 'bone').setScale(ART_SCALE * 1.4).setDepth(DEPTH.hud);
    this.balance = this.add.text(600, 135, '', textStyle(30)).setOrigin(0, 0.5).setDepth(DEPTH.hud);

    const buttons: Button[] = [];
    TRACKS.forEach((t, i) => {
      const x = 240 + i * 400;
      panel(this, x, 380, 360, 330).setDepth(DEPTH.hud);
      this.add.image(x, 265, t.icon).setScale(ART_SCALE * 2.2).setDepth(DEPTH.hud);
      this.add.text(x, 325, t.name, textStyle(30, CSS.white)).setOrigin(0.5).setDepth(DEPTH.hud);
      const info = this.add.text(x, 370, '', textStyle(22, CSS.cream, 4)).setOrigin(0.5).setDepth(DEPTH.hud);
      const pips = this.add.graphics().setDepth(DEPTH.hud);
      pips.setPosition(x, 410);
      const buy = new Button(this, x, 480, '', () => this.buy(t.key), { width: 280, height: 62, fontSize: 24, color: COLOR.coral });
      buy.setDepth(DEPTH.hud);
      buttons.push(buy);
      this.cards.push({ pips, info, buy, key: t.key });
    });
    this.add.text(640, 585, 'Every route and boss can be finished without upgrades.', textStyle(20, CSS.cream, 4)).setOrigin(0.5).setDepth(DEPTH.hud);
    const back = new Button(this, 640, 650, COPY.back, () => this.back(), { width: 240, height: 58, fontSize: 24, color: 0x6f86a8 });
    back.setDepth(DEPTH.hud);
    buttons.push(back);
    new MenuNav(this, buttons, () => this.back());
    this.refresh();
  }

  private back(): void {
    this.scene.start(this.from === 'ChapterMap' ? 'ChapterMap' : 'Title');
  }

  private buy(key: UpgradeKey): void {
    const lvl = progress.state.upgrades[key];
    if (lvl >= UPGRADE_MAX_LEVEL) return;
    if (progress.buyUpgrade(key, UPGRADE_PRICES[lvl])) {
      Audio.play('bone');
      this.cameras.main.flash(150, 255, 214, 110);
    } else Audio.play('ui_back');
    this.refresh();
  }

  private refresh(): void {
    const p = progress.state;
    this.balance.setText(String(p.boneBalance));
    for (const c of this.cards) {
      const lvl = p.upgrades[c.key];
      const track = TRACKS.find((t) => t.key === c.key)!;
      c.info.setText(track.describe(lvl));
      c.pips.clear();
      for (let i = 0; i < UPGRADE_MAX_LEVEL; i++) {
        const x = (i - 1) * 40;
        c.pips.fillStyle(COLOR.outline, 1);
        c.pips.fillCircle(x, 0, 14);
        c.pips.fillStyle(i < lvl ? COLOR.butter : 0x5c4560, 1);
        c.pips.fillCircle(x, 0, 10);
      }
      if (lvl >= UPGRADE_MAX_LEVEL) c.buy.setText('Maxed out!').setDisabled(true);
      else {
        const price = UPGRADE_PRICES[lvl];
        c.buy.setText(`Buy · ${price} bones`).setDisabled(p.boneBalance < price);
      }
    }
  }

  update(_t: number, dms: number): void {
    this.backdrop.update(Math.min(dms / 1000, 0.1));
  }
}
