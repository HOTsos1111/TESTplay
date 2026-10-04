import type Phaser from 'phaser';

export const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", "Segoe UI", sans-serif';

export const COLOR = {
  outline: 0x302331,
  chestnut: 0xb66b38,
  cream: 0xffe1aa,
  teal: 0x42b7b0,
  coral: 0xf07562,
  butter: 0xffd66e,
  sky: 0xa9d9eb,
  white: 0xfffdf6,
} as const;

export const CSS = {
  outline: '#302331',
  cream: '#FFE1AA',
  teal: '#42B7B0',
  coral: '#F07562',
  butter: '#FFD66E',
  white: '#FFFDF6',
} as const;

export function textStyle(size: number, color: string = CSS.white, stroke = Math.max(4, Math.round(size / 6))): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: CSS.outline,
    strokeThickness: stroke,
    align: 'center',
  };
}
