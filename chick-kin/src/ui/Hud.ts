// Gameplay HUD: only what the current objective needs, kept to the screen edges (outside sightlines).
import { h } from './dom';
import { portrait } from './Portraits';
import type { Match } from '../sim/match';
import type { InputRouter } from '../core/InputRouter';
import { CLASS_INFO, ABILITIES } from '../data/classes';
import { POWERS } from '../data/items';
import type { SimEvent } from '../sim/events';
import { rectOverlap } from '../sim/math';
import * as THREE from 'three';

const PLACE = ['1st', '2nd', '3rd', '4th'];

export class Hud {
  readonly el: HTMLElement;
  private tl: HTMLElement; private tc: HTMLElement; private tr: HTMLElement; private bl: HTMLElement; private br: HTMLElement;
  private objective: HTMLElement;
  private rivals: HTMLElement;
  private powers: HTMLElement;
  private ability: HTMLElement;
  private stamina: HTMLElement;
  private prompt: HTMLElement;
  private caption: HTMLElement;
  private countdown: HTMLElement;
  private pop: HTMLElement;
  private offscreen: HTMLElement[] = [];
  private capT = 0;
  private popT = 0;
  private lastKey = '';
  onPause: (() => void) | null = null;

  constructor(private m: Match, private input: InputRouter, private cam: THREE.PerspectiveCamera) {
    this.tl = h('div', { class: 'tl' });
    this.tc = h('div', { class: 'tc' });
    this.tr = h('div', { class: 'tr' });
    this.bl = h('div', { class: 'bl' });
    this.br = h('div', { class: 'br' });
    this.objective = h('div', { class: 'chip wood' });
    this.rivals = h('div', { class: 'rivals' });
    this.powers = h('div', { class: 'row', style: { gap: '8px' } });
    this.ability = h('div', { class: 'ability' });
    this.stamina = h('div', { class: 'stamina chip wood' });
    this.prompt = h('div', { class: 'prompt card', style: { display: 'none' } });
    this.caption = h('div', { class: 'caption', style: { display: 'none' } });
    this.countdown = h('div', { class: 'countdown', style: { display: 'none' } });
    this.pop = h('div', { class: 'objective-pop wood', style: { display: 'none' } });
    const pause = h('button', { class: 'btn round', 'aria-label': 'Pause', title: 'Pause', onclick: () => this.onPause?.() }, h('span', { class: 'ico' }, '❚❚'));
    this.tl.append(this.objective);
    this.tc.append(this.powers);
    this.tr.append(pause);
    this.bl.append(this.rivals);
    this.br.append(this.stamina, this.ability);
    const p = m.player;
    const ab = ABILITIES[p.cls];
    this.ability.style.background = `radial-gradient(circle at 40% 35%, ${CLASS_INFO[p.cls].colors.ui}, ${CLASS_INFO[p.cls].colors.uiDark})`;
    this.ability.innerHTML = `<div class="cd"></div><div class="ab-ico">${CLASS_INFO[p.cls].icon}</div><div>${ab.name}</div><div class="ab-state small"></div>`;
    this.el = h('div', { class: 'hud' }, this.tl, this.tc, this.tr, this.bl, this.br, this.prompt, this.caption, this.countdown, this.pop);
    for (let i = 0; i < 4; i++) {
      const o = h('div', { class: 'offscreen', style: { display: 'none' } }, h('img', { alt: '' }));
      this.offscreen.push(o);
      this.el.append(o);
    }
    this.announce(m.level.phases[0].name === m.level.title ? m.level.brief : `${m.level.phases[0].name}: ${m.level.brief}`, 2.6);
  }

  announce(text: string, secs = 2) {
    this.pop.textContent = text;
    this.pop.style.display = '';
    this.popT = secs;
  }

  showCaption(text: string, kind: 'alert' | 'info') {
    this.caption.textContent = text;
    this.caption.className = 'caption' + (kind === 'alert' ? ' alert' : '');
    this.caption.style.display = '';
    this.capT = 2.2;
  }

  onEvents(evs: SimEvent[]) {
    const m = this.m;
    for (const e of evs) {
      if (e.type === 'round') this.announce(`Round ${e.round + 1}: ${m.level.phases[e.round].name}`, 2.4);
      if (e.type === 'roundEnd') {
        const w = m.actors[e.order[0]];
        this.announce(`${w.isPlayer ? 'You win' : w.name + ' wins'} the round!`, 2.6);
      }
      if (e.type === 'phase' && e.a === m.player.id) this.announce(`Leg ${e.phase + 1}: ${m.level.phases[e.phase].name}`, 2.2);
      if (e.type === 'tiebreak') this.announce('Tie-break: Crumb Scramble!', 2.6);
      if (e.type === 'power' && e.a === m.player.id) this.showCaption(`${POWERS[e.pu as keyof typeof POWERS].name}${e.replaced ? ` (replaced ${POWERS[e.replaced as keyof typeof POWERS].name})` : e.refreshed ? ' refreshed' : ''}: ${POWERS[e.pu as keyof typeof POWERS].summary}`, 'info');
      if (e.type === 'complete' && e.a === m.player.id) this.announce(e.place === 1 ? 'First!' : 'Done!', 1.6);
    }
  }

  update(dt: number) {
    const m = this.m, p = m.player;
    const ar = m.arenaOf(p);
    const ph = m.phaseOf(p);
    const obj = ph.objective;
    // countdown
    if (m.state === 'countdown') {
      const n = Math.ceil(m.countdown);
      this.countdown.style.display = '';
      if (this.countdown.textContent !== String(n)) { this.countdown.textContent = String(n); this.countdown.style.animation = 'none'; void this.countdown.offsetWidth; this.countdown.style.animation = ''; }
    } else if (this.countdown.style.display !== 'none') {
      if (this.countdown.textContent !== 'GO!') { this.countdown.textContent = 'GO!'; setTimeout(() => (this.countdown.style.display = 'none'), 600); }
    }
    if (this.popT > 0) { this.popT -= dt; if (this.popT <= 0) this.pop.style.display = 'none'; }
    if (this.capT > 0) { this.capT -= dt; if (this.capT <= 0) this.caption.style.display = 'none'; }

    // objective chip
    const order = m.currentOrder();
    const place = order.indexOf(p.id);
    let icon = '🌾', label = '', value = '';
    switch (obj.kind) {
      case 'collect': icon = '🟡'; label = 'Crumbs'; value = `${Math.min(p.st.crumbs, obj.count)}/${obj.count}`; break;
      case 'tug': icon = '🪱'; label = 'Worms'; value = `${p.st.worms}/${obj.count}`; break;
      case 'perch': icon = '👑'; label = 'Perch'; value = `${Math.min(obj.seconds, p.st.perchTime).toFixed(1)}/${obj.seconds}s`; break;
      case 'race': icon = '🏁'; label = 'Position'; value = `${place + 1}/${m.participants().length}`; break;
      case 'reach': icon = '⬆'; label = obj.feathers ? 'Feathers' : 'Position'; value = obj.feathers ? `${p.st.feathers}/${obj.feathers}` : `${place + 1}/${m.participants().length}`; break;
      case 'deliver': icon = obj.cargo === 'bundle' ? '🌽' : '🧺'; label = 'Delivered'; value = `${Math.min(p.st.delivered, obj.count)}/${obj.count}` + (p.carryTreats ? `  (+${p.carryTreats})` : p.carryBundle ? '  (+1)' : ''); break;
      case 'mostDeliveries': icon = '⏱'; label = `Delivered · ${PLACE[place]}`; value = `${p.st.delivered}  ·  ${Math.max(0, Math.ceil(obj.seconds - m.t))}s`; break;
    }
    let extra = '';
    if (m.level.format === 'relay') extra = `Leg ${p.phase + 1}/${m.level.phases.length}`;
    if (m.level.format === 'showdown') extra = m.tiebreak ? 'Tie-break' : `Round ${m.round + 1}/${m.level.phases.length}`;
    const key = `${icon}|${label}|${value}|${extra}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.objective.innerHTML = `<div class="icon">${icon}</div><div><div class="lbl">${extra ? extra + ' · ' : ''}${label}</div><div class="val">${value}</div></div>`;
    }

    // standings (showdown shows points)
    const parts = m.participants();
    const rows = order.map((id, i) => {
      const a = m.actors[id];
      const pts = m.level.format === 'showdown' ? `${m.points[id]} pts` : obj.kind === 'perch' ? `${a.st.perchTime.toFixed(0)}s` : obj.kind === 'collect' ? `${a.st.crumbs}` : obj.kind === 'tug' ? `${a.st.worms}` : obj.kind === 'deliver' || obj.kind === 'mostDeliveries' ? `${a.st.delivered}` : PLACE[i];
      return `<div class="rival-row card ${a.isPlayer ? 'me' : ''}"><img alt="" src="${portrait(a.cls, a.stage, a.finished ? 'victory' : 'happy')}"/>${a.isPlayer ? 'You' : a.name}<span class="rp">${pts}</span></div>`;
    }).join('');
    if (this.rivals.dataset.k !== rows) { this.rivals.dataset.k = rows; this.rivals.innerHTML = rows; }
    void parts;

    // powers
    const pk = p.powers.map((pw) => `${pw.id}:${Math.ceil(pw.t)}`).join(',');
    if (this.powers.dataset.k !== pk) {
      this.powers.dataset.k = pk;
      this.powers.innerHTML = p.powers.map((pw) => { const info = POWERS[pw.id]; return `<div class="chip wood power-chip"><div class="ring" style="background:${info.color}">${info.glyph}</div><div><div class="lbl">${info.name}</div><div class="val">${Math.ceil(pw.t)}s</div></div></div>`; }).join('');
    }

    // ability cooldown sweep
    const ab = ABILITIES[p.cls];
    const cdFrac = Math.max(0, p.abilityCd) / ab.cooldown;
    (this.ability.querySelector('.cd') as HTMLElement).style.background = cdFrac > 0 ? `conic-gradient(rgba(30,18,8,0.65) ${cdFrac * 360}deg, transparent 0)` : 'none';
    this.ability.classList.toggle('ready', cdFrac <= 0);
    (this.ability.querySelector('.ab-state') as HTMLElement).textContent = cdFrac <= 0 ? `Ready! [${this.input.prompt('ability')}]` : `${Math.ceil(p.abilityCd)}s`;

    // stamina (chapter 3+ in side arenas)
    const showStamina = p.g.canFlap && ar.mode === 'side';
    this.stamina.style.display = showStamina ? '' : 'none';
    if (showStamina) {
      const f = p.staminaMax > 0 ? p.stamina / p.staminaMax : 0;
      this.stamina.innerHTML = `<div style="width:100%"><div class="lbl">Flap stamina${f < 0.05 ? ' — rest on a perch!' : ''}</div><div class="bar"><i style="width:${(f * 100).toFixed(0)}%;background:${f < 0.25 ? '#e2483d' : '#5fc7e8'}"></i></div></div>`;
    }

    // contextual prompt
    this.prompt.style.display = 'none';
    const show = (txt: string, act: 'interact' | 'duck' | 'jump') => { this.prompt.innerHTML = `<span class="keycap">${this.input.prompt(act)}</span> ${txt}`; this.prompt.style.display = ''; };
    if (m.state === 'play' && !p.finished) {
      if (ar.mode === 'top') {
        const t = m.interactTargetTop(p, ar);
        if (t) {
          const txt: Record<string, string> = { basket: 'Deliver', cornpile: 'Take corn bundle', gate: 'Open gate', straw: 'Peck straw', scratch: this.input.interactToggle ? 'Scratch (toggle)' : 'Hold to scratch', tugworm: this.input.interactToggle ? 'Tug (toggle) — lean away!' : 'Hold to tug — lean away!' };
          if (p.interactTarget < 0 || t.t === 'tugworm') show(txt[t.t] ?? 'Interact', 'interact');
        }
      } else {
        const dir = p.facing;
        const probe = { x: p.x + dir * (p.w / 2) - (dir < 0 ? 0.6 : 0), y: p.y, w: 0.6, h: p.h };
        const straw = ar.ents.find((e) => e.alive && e.t === 'straw' && rectOverlap(probe, e));
        const fence = ar.solids.find((s) => s.lowFence && rectOverlap({ ...probe, x: probe.x + dir * 0.5 }, s));
        if (straw) show('Peck the straw', 'interact');
        else if (fence && !p.ducking) show('Duck under', 'duck');
      }
    }

    // offscreen sibling indicators (side view)
    const w = window.innerWidth, hgt = window.innerHeight;
    m.actors.forEach((a, i) => {
      const o = this.offscreen[i];
      if (a.isPlayer || m.arenaOf(a) !== ar || ar.mode !== 'side' || !parts.includes(a)) { o.style.display = 'none'; return; }
      const v = new THREE.Vector3(a.x, a.y + 0.5, 0).project(this.cam);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * hgt;
      const off = sx < 0 || sx > w || sy < 0 || sy > hgt;
      o.style.display = off ? '' : 'none';
      if (off) {
        o.style.left = `${Math.min(w - 30, Math.max(30, sx))}px`;
        o.style.top = `${Math.min(hgt - 140, Math.max(80, sy))}px`;
        o.style.borderColor = CLASS_INFO[a.cls].colors.ui;
        const img = o.querySelector('img')!;
        const src = portrait(a.cls, a.stage);
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      }
    });
  }
}
