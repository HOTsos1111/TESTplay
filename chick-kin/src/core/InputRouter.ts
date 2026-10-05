// Central input: keyboard + gamepad → semantic actions. All gameplay actions are remappable and
// prompts read the active binding and device.
import type { ActorInput } from '../sim/actor';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'interact' | 'ability' | 'duck' | 'pause';
export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'jump', 'interact', 'ability', 'duck', 'pause'];
export const ACTION_LABEL: Record<Action, string> = {
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  jump: 'Jump / Flap / Hop', interact: 'Peck / Interact / Carry', ability: 'Signature ability', duck: 'Duck / Brace', pause: 'Pause',
};

export type KeyMap = Record<Action, string[]>;
export const DEFAULT_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], interact: ['KeyE'], ability: ['ShiftLeft', 'ShiftRight'], duck: ['ControlLeft', 'KeyC'], pause: ['Escape', 'KeyP'],
};
/** Standard-mapping gamepad buttons: south 0, east 1, west 2, north 3, LB 4, RB 5, start 9. */
export type PadMap = Record<'jump' | 'interact' | 'ability' | 'duck' | 'pause', number>;
export const DEFAULT_PAD: PadMap = { jump: 0, interact: 2, ability: 1, duck: 4, pause: 9 };

export type Device = 'keyboard' | 'gamepad';

export class InputRouter {
  keys: KeyMap = structuredClone(DEFAULT_KEYS);
  pad: PadMap = { ...DEFAULT_PAD };
  device: Device = 'keyboard';
  /** Hold vs toggle for repeated interactions (scratch / tug). */
  interactToggle = false;
  private down = new Set<string>();
  private pressedQ = new Set<string>();
  private padPrev: boolean[] = [];
  private padPressed = new Set<number>();
  private toggled = false;
  private listeners: ((code: string) => void)[] = [];
  /** UI navigation callbacks (menus). */
  onNav: ((dir: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause') => void) | null = null;
  private navRepeat = 0;
  private navDir = '';

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.listeners.length) { e.preventDefault(); const l = this.listeners.shift()!; l(e.code); return; }
      this.device = 'keyboard';
      if (!e.repeat) this.pressedQ.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
      if (!e.repeat) this.navFromKey(e.code);
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  private navFromKey(code: string) {
    if (!this.onNav) return;
    const k = this.keys;
    if (k.up.includes(code)) this.onNav('up');
    else if (k.down.includes(code)) this.onNav('down');
    else if (k.left.includes(code)) this.onNav('left');
    else if (k.right.includes(code)) this.onNav('right');
    else if (code === 'Enter' || k.jump.includes(code)) this.onNav('confirm');
    else if (code === 'Backspace' || k.pause.includes(code)) this.onNav(k.pause.includes(code) ? 'pause' : 'back');
  }

  /** Wait for the next key press (rebinding UI). */
  captureKey(): Promise<string> { return new Promise((r) => this.listeners.push(r)); }

  private held(a: Action) { return this.keys[a].some((c) => this.down.has(c)); }
  private pressed(a: Action) { return this.keys[a].some((c) => this.pressedQ.has(c)); }

  /** Poll gamepads once per frame; also drives menu navigation. */
  poll(dt: number) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p) => p && p.connected) ?? null;
    this.padPressed.clear();
    if (gp) {
      gp.buttons.forEach((b, i) => {
        const now = b.pressed;
        if (now && !this.padPrev[i]) { this.padPressed.add(i); this.device = 'gamepad'; }
        this.padPrev[i] = now;
      });
      if (Math.hypot(gp.axes[0] ?? 0, gp.axes[1] ?? 0) > 0.5) this.device = 'gamepad';
      if (this.onNav) {
        const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
        const dir = ay < -0.6 || gp.buttons[12]?.pressed ? 'up' : ay > 0.6 || gp.buttons[13]?.pressed ? 'down' : ax < -0.6 || gp.buttons[14]?.pressed ? 'left' : ax > 0.6 || gp.buttons[15]?.pressed ? 'right' : '';
        if (dir && (dir !== this.navDir || (this.navRepeat -= dt) <= 0)) { this.onNav(dir as 'up'); this.navRepeat = dir === this.navDir ? 0.12 : 0.35; }
        this.navDir = dir;
        if (this.padPressed.has(0)) this.onNav('confirm');
        if (this.padPressed.has(1)) this.onNav('back');
        if (this.padPressed.has(this.pad.pause)) this.onNav('pause');
      }
    }
    return gp;
  }

  pausePressed(gp: Gamepad | null) {
    return this.pressed('pause') || (!!gp && this.padPressed.has(this.pad.pause));
  }

  /** Gameplay sample. Call once per rendered frame; edge-detection happens inside the sim. */
  sample(gp: Gamepad | null): ActorInput {
    let mx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let my = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    let jump = this.held('jump');
    let interactHeld = this.held('interact');
    let interactPressed = this.pressed('interact');
    let ability = this.held('ability');
    let duck = this.held('duck');
    if (gp) {
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) { mx = ax; my = ay; }
      if (gp.buttons[14]?.pressed) mx = -1;
      if (gp.buttons[15]?.pressed) mx = 1;
      if (gp.buttons[12]?.pressed) my = -1;
      if (gp.buttons[13]?.pressed) my = 1;
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      jump = jump || b(this.pad.jump);
      interactHeld = interactHeld || b(this.pad.interact);
      interactPressed = interactPressed || this.padPressed.has(this.pad.interact);
      ability = ability || b(this.pad.ability) || b(5);
      duck = duck || b(this.pad.duck) || (gp.buttons[6]?.value ?? 0) > 0.5;
    }
    let interact = interactHeld;
    if (this.interactToggle) {
      if (interactPressed) this.toggled = !this.toggled;
      interact = this.toggled || interactHeld;
    }
    this.pressedQ.clear();
    return { mx, my, jump, interact, ability, duck };
  }

  resetToggles() { this.toggled = false; this.pressedQ.clear(); }
  clearHeld() { this.down.clear(); this.pressedQ.clear(); }

  /** Human-readable prompt for an action on the active device. */
  prompt(a: Action): string {
    if (this.device === 'gamepad') {
      const names: Record<number, string> = { 0: 'Ⓐ', 1: 'Ⓑ', 2: 'Ⓧ', 3: 'Ⓨ', 4: 'LB', 5: 'RB', 9: 'Start' };
      if (a === 'left' || a === 'right' || a === 'up' || a === 'down') return 'Left stick';
      return names[this.pad[a as keyof PadMap]] ?? `Button ${this.pad[a as keyof PadMap]}`;
    }
    return this.keys[a].map(keyName).join(' / ');
  }
}

export function keyName(code: string) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', Escape: 'Esc', Enter: 'Enter' };
  return map[code] ?? code;
}
