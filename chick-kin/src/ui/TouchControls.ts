// On-screen touch controls for phones/tablets: a floating joystick on the left half and four
// action buttons on the right (Jump, Peck, Power, Duck). Multi-touch: move and act at the same time.
import { h } from './dom';
import type { InputRouter } from '../core/InputRouter';

export class TouchControls {
  readonly el: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private stickId: number | null = null;
  private ox = 0; private oy = 0;
  readonly abilityBtn: HTMLElement;

  constructor(private input: InputRouter, abilityLabel: string, abilityColor: string) {
    this.knob = h('div', { class: 'tc-knob' });
    this.stick = h('div', { class: 'tc-stick' }, this.knob);
    const zone = h('div', { class: 'tc-zone' }, this.stick);
    const btn = (label: string, cls: string, key: 'jump' | 'interact' | 'ability' | 'duck') => {
      const b = h('div', { class: `tc-btn ${cls}`, role: 'button', 'aria-label': label }, h('span', {}, label));
      const set = (on: boolean) => {
        if (key === 'interact' && on && !this.input.touch.interact) this.input.touch.interactPressed = true;
        this.input.touch[key] = on;
        b.classList.toggle('down', on);
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); this.input.device = 'touch'; set(true); });
      b.addEventListener('pointerup', () => set(false));
      b.addEventListener('pointercancel', () => set(false));
      b.addEventListener('lostpointercapture', () => set(false));
      return b;
    };
    this.abilityBtn = btn(abilityLabel, 'tc-ability', 'ability');
    this.abilityBtn.style.background = abilityColor;
    const pad = h('div', { class: 'tc-pad' }, btn('DUCK', 'tc-duck', 'duck'), this.abilityBtn, btn('PECK', 'tc-peck', 'interact'), btn('JUMP', 'tc-jump', 'jump'));
    this.el = h('div', { class: 'touch-controls' }, zone, pad);

    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.stickId = e.pointerId;
      this.input.device = 'touch';
      const r = zone.getBoundingClientRect();
      this.ox = e.clientX; this.oy = e.clientY;
      this.stick.style.left = `${e.clientX - r.left}px`;
      this.stick.style.top = `${e.clientY - r.top}px`;
      this.stick.classList.add('active');
      this.move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.move(e.clientX, e.clientY); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.input.touch.mx = 0; this.input.touch.my = 0;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.stick.classList.remove('active');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  private move(x: number, y: number) {
    const R = 52;
    let dx = x - this.ox, dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const k = Math.min(1, d / R);
    this.input.touch.mx = d > 6 ? (dx / (Math.hypot(dx, dy) || 1)) * k : 0;
    this.input.touch.my = d > 6 ? (dy / (Math.hypot(dx, dy) || 1)) * k : 0;
  }

  release() {
    const t = this.input.touch;
    t.mx = t.my = 0; t.jump = t.interact = t.ability = t.duck = false;
  }
}
