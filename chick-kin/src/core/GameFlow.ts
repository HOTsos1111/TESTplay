// GameFlow: explicit state machine for every screen and the play loop (brief §3).
// Boot → Title → ChickSelect/Continue → ChapterMap → LevelIntro → Playing → Results → Next | Growth → …
// after 5-5 → AdultCelebration → NewBrood → ChickSelect (next generation).
import { h, FocusNav } from '../ui/dom';
import { portrait } from '../ui/Portraits';
import { Hud } from '../ui/Hud';
import { Renderer } from '../render/Renderer';
import { MenuScene } from '../render/MenuScene';
import { Session } from './Session';
import { InputRouter, ACTIONS, ACTION_LABEL, keyName, DEFAULT_KEYS, DEFAULT_PAD, type Action } from './InputRouter';
import { SaveManager, type LevelRecord, type Settings } from './SaveManager';
import { siblingsFor, withVariants, hazardSpeedFor, perkChoices, perkById, PLAYER_NAMES, type SiblingProfile } from './Generation';
import { AudioDirector } from '../audio/AudioDirector';
import { LEVELS, levelById } from '../data/levels';
import { CHAPTERS } from '../data/chapters';
import { CLASS_INFO, CLASSES, ABILITIES, type ChickClass } from '../data/classes';
import { GROWTH, type Stage } from '../data/growth';
import { PERSONALITIES } from '../sim/ai';
import type { LevelDef } from '../sim/types';
import type { MatchResult } from '../sim/match';
import type { Perk } from '../sim/actor';
import { makeRng } from '../sim/math';

export type FlowState = 'boot' | 'title' | 'select' | 'map' | 'intro' | 'play' | 'results' | 'growth' | 'adult' | 'brood' | 'family' | 'credits';

const STAR = (on: boolean) => `<span class="${on ? '' : 'off'}">★</span>`;

export class GameFlow {
  readonly r: Renderer;
  readonly input = new InputRouter();
  readonly save = new SaveManager();
  readonly audio = new AudioDirector();
  readonly nav = new FocusNav();
  readonly menu: MenuScene;
  state: FlowState = 'boot';
  session: Session | null = null;
  private hud: Hud | null = null;
  private base: HTMLElement | null = null;
  private overlays: { el: HTMLElement; back: (() => void) | null }[] = [];
  private paused = false;
  private last = performance.now();
  private level: LevelDef | null = null;
  private result: MatchResult | null = null;
  private stepDist = 0;
  private stemHold = { rival: 0, final: 0, rivalOn: false, finalOn: false };
  private selectedChapter: Stage = 1;
  private selectedLevel = '1-1';
  private pendingPerk: Perk | null = null;
  private savingEl: HTMLElement;
  readonly debug: boolean;
  autopilot = false;

  constructor(stage: HTMLElement, readonly ui: HTMLElement) {
    const params = new URLSearchParams(location.search);
    this.debug = params.has('debug');
    this.r = new Renderer(stage);
    this.menu = new MenuScene(this.r);
    const s = this.save.data.settings;
    if (this.save.lastStatus === 'fresh' && this.input.isTouch) s.quality = 'medium';
    this.applySettings(s);
    if (params.get('quality')) this.r.setQuality(params.get('quality') as Settings['quality']);
    if (this.save.data.bindings.keys) this.input.keys = this.save.data.bindings.keys;
    if (this.save.data.bindings.pad) this.input.pad = this.save.data.bindings.pad;
    this.input.onNav = (d) => this.onNav(d);
    this.nav.onMove = () => this.audio.play('ui.focus');
    this.savingEl = h('div', { class: 'saving' }, '✔ Saved');
    document.body.append(h('div', { class: 'rotate-hint' }, h('div', { class: 'phone' }), 'Turn your phone sideways to play'));
    this.save.onSaved = () => { this.savingEl.classList.add('on'); this.audio.play('ui.saved'); setTimeout(() => this.savingEl.classList.remove('on'), 1400); };
    this.audio.onCaption = (t, k) => { if (this.save.data.settings.captions) this.hud?.showCaption(t, k); };
    this.menu.onBeat = (b) => { if (b === 'bloom') this.audio.play('story.bloom'); if (b === 'crack') this.audio.play('story.crack'); if (b === 'grown') this.audio.voice(this.save.data.current?.cls ?? 'speedy'); };
    // audio needs a user gesture
    const unlock = () => { this.audio.unlock(); this.audio.apply(this.save.data.settings); this.musicFor(this.state); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    // focus loss policy
    const lost = () => { if (this.state === 'play' && this.save.data.settings.pauseOnBlur && !this.paused) this.pause(); this.audio.suspend(); };
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', () => { if (document.hidden) lost(); else this.audio.resume(); });
    window.addEventListener('focus', () => this.audio.resume());
    if (this.save.lastStatus === 'recovered') setTimeout(() => this.toast('Your save was restored from a backup.'), 600);
    (window as unknown as { __ck: unknown }).__ck = this.testHooks();
    const direct = params.get('play');
    if (direct && levelById(direct)) this.debugStart(direct, (params.get('cls') as ChickClass) ?? 'speedy', Number(params.get('gen') ?? 1), params.get('auto') === '1');
    else this.goTitle();
    requestAnimationFrame(() => this.loop());
  }

  // =================================================================== loop
  private loop() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const gp = this.input.poll(dt);
    if (this.state === 'play' && this.session) {
      if (!this.paused && this.input.pausePressed(gp) && this.overlays.length === 0) this.pause();
      const inp = this.input.sample(gp);
      if (!this.paused) {
        const evs = this.session.frame(dt, inp);
        this.audio.listenerX = this.session.match.player.x;
        this.audio.onSim(evs, this.session.match);
        this.hud?.onEvents(evs);
        this.footsteps(dt);
        this.adaptiveMusic(dt);
        if (this.session.match.state === 'done' && !this.result) this.onMatchDone();
      } else {
        this.session.view.update(0, 1);
      }
      this.hud?.update(dt);
    } else {
      this.input.sample(gp);
      this.menu.update(dt);
    }
    this.audio.tick(dt);
    this.r.render();
    requestAnimationFrame(() => this.loop());
  }

  private footsteps(dt: number) {
    const m = this.session!.match;
    const p = m.player;
    const ar = m.arenaOf(p);
    const sp = ar.mode === 'side' ? Math.abs(p.vx) : Math.hypot(p.vx, p.vy);
    if (!p.grounded || sp < 0.5) return;
    this.stepDist += sp * dt;
    const stride = 0.32 + p.stage * 0.06;
    if (this.stepDist > stride) {
      this.stepDist = 0;
      const theme = ar.def.theme;
      const cue = p.onMud ? 'move.step.mud' : ar.mode === 'side' && theme !== 'championship' ? 'move.step.wood' : 'move.step.straw';
      this.audio.play(cue, { x: p.x, gain: p.cls === 'mighty' ? 1.2 : p.cls === 'nimble' ? 0.75 : 1, pitch: p.cls === 'mighty' ? 0.85 : p.cls === 'nimble' ? 1.15 : 1 });
      if (p.onMud) this.audio.play('haz.mud', { x: p.x, gain: 0.4 });
    }
  }

  /** Adaptive stems with hysteresis: rivalry nearby, final stretch / timer window. */
  private adaptiveMusic(dt: number) {
    const m = this.session!.match;
    const p = m.player;
    const ar = m.arenaOf(p);
    const near = m.participants().some((a) => a !== p && m.arenaOf(a) === ar && Math.hypot(a.x - p.x, a.y - p.y) < 3.2);
    const obj = m.phaseOf(p).objective;
    const prog = m.progress(obj, p);
    const final = prog > 0.75 || (obj.kind === 'mostDeliveries' && obj.seconds - m.t < 20) || m.currentOrder().slice(0, 2).some((id) => id !== p.id && m.progress(obj, m.actors[id]) > 0.8);
    const H = this.stemHold;
    H.rival = near === H.rivalOn ? 0 : H.rival + dt;
    H.final = final === H.finalOn ? 0 : H.final + dt;
    if (H.rival > 1.5) { H.rivalOn = near; H.rival = 0; this.audio.stems({ rival: near ? 0.9 : 0 }); }
    if (H.final > 1.5) { H.finalOn = final; H.final = 0; this.audio.stems({ final: final ? 1 : 0 }); }
  }

  // =================================================================== layers & nav
  private setBase(el: HTMLElement, back: (() => void) | null = null, focus?: HTMLElement | null) {
    this.ui.innerHTML = '';
    this.overlays = [];
    this.base = el;
    this.ui.append(el, this.savingEl);
    this.nav.setRoot(el, back, focus);
  }
  private pushOverlay(el: HTMLElement, back: (() => void) | null) {
    this.overlays.push({ el, back });
    this.ui.append(el);
    this.nav.setRoot(el, back);
  }
  private popOverlay() {
    const o = this.overlays.pop();
    o?.el.remove();
    const top = this.overlays[this.overlays.length - 1];
    if (top) this.nav.setRoot(top.el, top.back);
    else if (this.base) this.nav.setRoot(this.base, this.baseBack);
  }
  private baseBack: (() => void) | null = null;

  private onNav(d: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause') {
    if (this.state === 'play' && this.overlays.length === 0) return; // gameplay owns input
    this.nav.nav(d);
    if (d === 'confirm') this.audio.play('ui.confirm');
  }

  private btn(label: string, onClick: () => void, cls = '', icon = '', attrs: Record<string, unknown> = {}) {
    return h('button', { class: `btn ${cls}`, onclick: () => { this.audio.unlock(); onClick(); }, ...attrs }, icon ? h('span', { class: 'ico' }, icon) : null, label);
  }

  private toast(text: string) {
    const t = h('div', { class: 'caption', style: { bottom: '40px' } }, text);
    this.ui.append(t);
    setTimeout(() => t.remove(), 2600);
  }

  private musicFor(s: FlowState) {
    const gen = this.save.data.current?.generation ?? 1;
    const id = s === 'title' ? 'title' : s === 'play' && this.level ? CHAPTERS[this.level.chapter].music : s === 'results' ? 'results' : s === 'brood' || s === 'family' || s === 'adult' || s === 'credits' ? 'family' : 'select';
    this.audio.playMusic(id, gen - 1);
    this.audio.ambience(s === 'play' && this.level ? CHAPTERS[this.level.chapter].theme : null);
  }

  private enter(s: FlowState) {
    this.state = s;
    this.musicFor(s);
    if (s !== 'play') {
      if (this.session) { this.session.dispose(); this.session = null; this.hud = null; }
      this.menu.attach();
    }
  }

  // =================================================================== title
  goTitle() {
    this.enter('title');
    const cur = this.save.data.current;
    this.menu.setChicks(cur && cur.phase === 'playing' ? CLASSES.map((c) => ({ cls: c, stage: cur.chapter as Stage })) : CLASSES.map((c) => ({ cls: c, stage: 1 as Stage })), 'title');
    const logo = h('div', { class: 'logo wood' }, h('span', { class: 'c' }, 'CHICK'), ' ', h('span', { class: 'k' }, 'KIN'));
    const play = cur ? this.btn('Continue', () => (cur.phase === 'adult' ? this.goBrood() : this.goMap()), 'primary', '▶', { 'data-autofocus': true }) : this.btn('Play', () => this.goSelect(), 'primary', '▶', { 'data-autofocus': true });
    const row = h('div', { class: 'row' },
      play,
      cur ? this.btn('New Family', () => this.confirm('Start a brand-new family? Your current progress will be erased.', () => { this.save.reset(); this.goSelect(); })) : null,
      this.btn('Family Tree', () => this.goFamily(), '', '🌳'),
      this.btn('Settings', () => this.openSettings(), '', '⚙'),
      this.btn('Credits', () => this.goCredits(), '', '♥'),
      this.debug ? this.btn('Debug', () => this.openDebug(), '', '🛠') : null,
    );
    const el = h('div', { class: 'layer title-screen fade-in' },
      logo,
      h('div', { class: 'title-side-sign left wood' }, 'Small Chicks', h('br'), 'Big', h('br'), 'Adventures ♥'),
      h('div', { class: 'title-side-sign right wood' }, 'Same Nest', h('br'), 'Brighter', h('br'), 'Tomorrows ♥'),
      row,
      h('div', { class: 'save-note' }, cur ? `Generation ${cur.generation} · ${CHAPTERS[cur.chapter as Stage].name}` : 'Three siblings · one big farm'),
    );
    this.baseBack = null;
    this.setBase(el, null);
  }

  // =================================================================== chick select
  goSelect(generation = (this.save.data.family.completedGenerations + 1)) {
    this.enter('select');
    this.menu.setChicks(CLASSES.map((c) => ({ cls: c, stage: 1 as Stage })), 'menu');
    let chosen: ChickClass = 'speedy';
    const cards = CLASSES.map((c) => {
      const info = CLASS_INFO[c];
      const bar = (name: string, v: number, col: string) => h('div', { class: 'stat' }, h('span', {}, name), h('div', { class: 'bar' }, h('i', { style: { width: `${v * 100}%`, background: col } })));
      const card = h('div', { class: 'card chick-card focusable', tabindex: 0, role: 'button', 'aria-label': `${info.name}, ${info.epithet}` },
        h('img', { src: portrait(c, 1), alt: info.name }),
        h('div', { class: 'chick-name', style: { color: info.colors.uiDark } }, h('span', { class: 'class-icon', style: { background: info.colors.ui } }, info.icon), info.name.toUpperCase()),
        h('div', { class: 'tag muted' }, info.epithet + ' · ' + info.look.split(',')[0]),
        bar('Speed', info.bars.speed, '#f2a12e'), bar('Strength', info.bars.strength, '#e2483d'), bar('Agility', info.bars.agility, '#3bb8b0'),
        h('div', { class: 'pros' }, ...info.strengths.map((s) => h('div', { class: 'up' }, s)), ...info.weaknesses.map((s) => h('div', { class: 'down' }, s))),
        h('div', { class: 'small muted', style: { marginTop: '6px' } }, `${ABILITIES[c].name}: ${ABILITIES[c].summary}`),
        h('div', { class: 'small muted' }, `${info.routeName} (optional advantage)`),
      );
      card.addEventListener('click', () => { chosen = c; cards.forEach((x) => x.classList.toggle('selected', x === card)); this.audio.voice(c); });
      return card;
    });
    cards[0].classList.add('selected');
    const perkNote = this.pendingPerk ? h('div', { class: 'card', style: { padding: '8px 12px', marginBottom: '10px' } }, `Family perk: ${this.pendingPerk.name} — ${this.pendingPerk.summary}`) : null;
    const confirm = this.btn('Confirm', () => this.startGeneration(chosen, generation), 'primary', '✔');
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood select-wrap' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'sign title-l' }, `🌿 Choose Your Chick 🌿`), h('div', { class: 'sign title-m' }, `Generation ${generation}`)),
        h('div', { class: 'select-cards' }, ...cards),
        perkNote,
        h('div', { class: 'row' }, this.btn('Back', () => (this.save.data.current ? this.goMap() : this.goTitle()), '', '←'), confirm),
      ),
    );
    this.baseBack = () => this.goTitle();
    this.setBase(el, this.baseBack, cards[0]);
  }

  private startGeneration(cls: ChickClass, generation: number) {
    const d = this.save.data;
    const seed = (d.family.seed + generation * 7919) >>> 0;
    const name = PLAYER_NAMES[(generation - 1) % PLAYER_NAMES.length];
    d.family.generation = generation;
    d.current = { cls, name, perk: this.pendingPerk?.id ?? null, generation, seed, chapter: 1, unlocked: ['1-1'], levels: {}, phase: 'playing' };
    this.pendingPerk = null;
    this.save.save();
    this.selectedChapter = 1;
    this.selectedLevel = '1-1';
    this.goMap();
  }

  // =================================================================== chapter map
  goMap(focusLevel?: string) {
    const cur = this.save.data.current;
    if (!cur) return this.goSelect();
    this.enter('map');
    this.menu.setChicks([{ cls: cur.cls, stage: cur.chapter as Stage }], 'menu');
    if (focusLevel) { this.selectedLevel = focusLevel; this.selectedChapter = levelById(focusLevel)!.chapter; }
    else if (!levelById(this.selectedLevel) || levelById(this.selectedLevel)!.chapter > cur.chapter) { this.selectedChapter = cur.chapter as Stage; this.selectedLevel = this.nextLevelId(); }
    const render = () => {
      const ch = CHAPTERS[this.selectedChapter];
      const tabs = ([1, 2, 3, 4, 5] as Stage[]).map((s) => {
        const c = CHAPTERS[s];
        const locked = s > cur.chapter;
        const t = h('div', { class: `chapter-tab ${s === this.selectedChapter ? 'current' : ''} ${locked ? 'locked' : ''} focusable`, tabindex: 0, role: 'tab', 'aria-label': `${c.name}${locked ? ' (locked)' : ''}` },
          h('div', { class: 'ct-ico' }, locked ? '🔒' : c.icon), h('div', { class: 'ct-name' }, c.name.split(' ')[0]), h('div', { class: 'ct-sub' }, c.sub));
        t.addEventListener('click', () => { if (locked) { this.audio.play('ui.denied'); return; } this.selectedChapter = s; this.selectedLevel = LEVELS.find((l) => l.chapter === s)!.id; render(); });
        return t;
      });
      const levels = LEVELS.filter((l) => l.chapter === this.selectedChapter);
      const nodes = levels.map((l) => {
        const rec = cur.levels[l.id];
        const unlocked = cur.unlocked.includes(l.id);
        const stars = rec?.done ? this.stars(l, rec) : 0;
        const n = h('button', { class: `node ${rec?.done ? 'done' : ''} ${l.id === this.selectedLevel ? 'current' : ''} ${unlocked ? '' : 'locked'}`, 'aria-label': `Level ${l.id} ${l.title}${unlocked ? '' : ' (locked)'}` },
          h('div', { class: 'egg' }, unlocked ? String(l.index) : '🔒'),
          h('div', { class: 'stars', html: [0, 1, 2].map((i) => STAR(i < stars)).join('') }));
        n.addEventListener('click', () => {
          if (!unlocked) { this.audio.play('ui.denied'); return; }
          if (this.selectedLevel === l.id) { this.goIntro(l.id); return; }
          this.selectedLevel = l.id; render();
        });
        return n;
      });
      const sel = levelById(this.selectedLevel)!;
      const rec = cur.levels[sel.id];
      const detail = h('div', { class: 'card level-detail' },
        h('div', {},
          h('div', { class: 'title-m' }, `${sel.id}  ${sel.title}`),
          h('div', {}, sel.brief),
          h('div', { class: 'small muted' }, rec?.done ? `Best: ${rec.bestTime ? rec.bestTime.toFixed(1) + 's' : '—'} · Place ${rec.placement} · ${rec.medals.join(', ') || 'no medals yet'}` : (sel.medals?.time ? `Time medal: ${sel.medals.time}s` : 'New!')),
        ),
        this.btn('Play', () => this.goIntro(sel.id), 'primary', '▶', { 'data-autofocus': true }),
      );
      const el = h('div', { class: 'layer dim fade-in' },
        h('div', { class: 'wood map-wrap' },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', { class: 'sign title-l' }, `Generation ${cur.generation}`),
            h('div', { class: 'row' }, h('img', { src: portrait(cur.cls, cur.chapter as Stage), alt: '', style: { width: '54px', height: '54px' } }), h('div', { class: 'sign title-m' }, `${cur.name} the ${CLASS_INFO[cur.cls].name}${cur.perk ? ' · ' + perkById(cur.perk)?.name : ''}`))),
          h('div', { class: 'chapter-tabs', role: 'tablist' }, ...tabs),
          h('div', { class: 'map-body' },
            h('div', { class: 'card chapter-info' },
              h('div', { class: 'title-m' }, `${ch.icon} ${ch.name}`),
              h('div', { class: 'small muted' }, `${GROWTH[ch.stage].name} · ${ch.format}`),
              h('p', {}, ch.blurb),
              h('div', { class: 'small' }, ...ch.learn.map((x) => h('div', {}, '• ' + x))),
            ),
            h('div', { class: 'card level-path' }, h('div', { class: 'title-m' }, `${ch.name.split(' ')[0]} Levels`), h('div', { class: 'nodes' }, ...nodes), detail),
          ),
          h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'space-between' } }, this.btn('Title', () => this.goTitle(), '', '⌂'), h('div', { class: 'row' }, this.btn('Family Tree', () => this.goFamily(), '', '🌳'), this.btn('Settings', () => this.openSettings(), '', '⚙'))),
        ),
      );
      this.baseBack = () => this.goTitle();
      const focusNode = nodes[levels.findIndex((l) => l.id === this.selectedLevel)] ?? null;
      this.setBase(el, this.baseBack, focusNode);
    };
    render();
  }

  private stars(l: LevelDef, rec: LevelRecord) {
    let s = rec.done ? 1 : 0;
    if (rec.medals.includes('First')) s++;
    if (rec.medals.includes('Time') || rec.medals.includes('Feathers')) s++;
    if (!l.medals?.time && !l.medals?.feathers && rec.medals.includes('First') && rec.done) s = Math.max(s, 3);
    return Math.min(3, s);
  }

  private nextLevelId() {
    const cur = this.save.data.current!;
    const inCh = LEVELS.filter((l) => l.chapter === cur.chapter);
    return (inCh.find((l) => cur.unlocked.includes(l.id) && !cur.levels[l.id]?.done) ?? inCh.filter((l) => cur.unlocked.includes(l.id)).pop() ?? inCh[0]).id;
  }

  // =================================================================== intro / briefing
  private siblings(): SiblingProfile[] {
    const cur = this.save.data.current!;
    return siblingsFor(cur.generation, this.save.data.family.seed, cur.cls);
  }

  goIntro(id: string) {
    const cur = this.save.data.current!;
    const l = levelById(id)!;
    this.enter('intro');
    this.menu.setChicks([{ cls: cur.cls, stage: l.chapter }], 'menu');
    const sibs = this.siblings();
    const ch = CHAPTERS[l.chapter];
    const firstOfChapter = l.index === 1 && !cur.levels[l.id]?.done;
    const tip = (l.tip ?? '').replace(/WASD \/ left stick/g, this.input.device === 'gamepad' ? 'the left stick' : 'WASD / arrows').replace(/Space/g, this.input.prompt('jump')).replace(/\bE\b/g, this.input.prompt('interact')).replace(/Shift/g, this.input.prompt('ability')).replace(/Ctrl/g, this.input.prompt('duck'));
    const route = CLASS_INFO[cur.cls];
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood modal' },
        h('div', { class: 'sign title-l' }, `${l.id}  ${l.title}`),
        firstOfChapter ? h('div', { class: 'card', style: { padding: '10px 14px', margin: '8px 0' } }, h('div', { class: 'title-m' }, `New format: ${ch.format}`), h('div', {}, ch.learn.join(' · '))) : null,
        h('div', { class: 'card', style: { padding: '12px 14px', margin: '8px 0' } },
          h('div', { class: 'title-m' }, '🎯 ' + l.brief),
          tip ? h('div', { style: { marginTop: '6px' } }, '💡 ' + tip) : null,
          h('div', { class: 'small muted', style: { marginTop: '6px' } }, `${route.routeName}: look for ${route.route} route markers — optional, every route can be completed by every chick.`),
          this.objectiveRule(l),
        ),
        h('div', { class: 'title-m', style: { margin: '8px 0 4px' } }, 'Your siblings'),
        h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, ...sibs.map((s) => h('div', { class: 'card', style: { padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' } },
          h('img', { src: portrait(s.cls, l.chapter), alt: '', style: { width: '48px', height: '48px' } }),
          h('div', {}, h('div', { class: 'title-m', style: { fontSize: '17px' } }, s.name), h('div', { class: 'small muted' }, `${CLASS_INFO[s.cls].name} · ${PERSONALITIES[s.personality].label}`))))),
        h('div', { class: 'row', style: { marginTop: '14px' } }, this.btn('Back', () => this.goMap(l.id), '', '←'), this.btn('Start!', () => this.startLevel(l.id), 'primary', '▶', { 'data-autofocus': true })),
      ),
    );
    this.baseBack = () => this.goMap(l.id);
    this.setBase(el, this.baseBack);
  }

  private objectiveRule(l: LevelDef) {
    const o = l.phases[0].objective;
    const relaxed = this.save.data.settings.difficulty === 'relaxed';
    const needsFirst = (o.kind === 'race' && o.requireFirst) || ((o.kind === 'deliver' || o.kind === 'reach') && o.requireFirst) || l.format !== 'single' || o.kind === 'mostDeliveries';
    const text = l.format === 'showdown' ? 'Three rounds: race, perch, haul. 5/3/2/1 points per round; highest total wins. Ties go to a crumb scramble.'
      : needsFirst ? (relaxed ? 'Relaxed mode: finishing counts, any place.' : 'Finish first to pass.') : 'Complete the objective to pass — finish order earns medals.';
    return h('div', { class: 'small', style: { marginTop: '4px' } }, '🏅 ' + text);
  }

  // =================================================================== play
  startLevel(id: string, autopilot = this.autopilot) {
    const cur = this.save.data.current!;
    const base = levelById(id)!;
    const level = withVariants(base, cur.generation, cur.seed);
    this.level = base;
    this.result = null;
    this.menu.detach();
    if (this.session) this.session.dispose();
    const sibs = this.siblings();
    const perk = perkById(cur.perk);
    const s = new Session(this.r, {
      level, stage: base.chapter, seed: (cur.seed ^ (base.chapter * 100 + base.index)) >>> 0,
      difficulty: this.save.data.settings.difficulty, generation: cur.generation, hazardSpeed: hazardSpeedFor(cur.generation),
      competitors: [{ cls: cur.cls, name: cur.name, isPlayer: true, perk }, ...sibs.map((x) => ({ cls: x.cls, name: x.name, isPlayer: false }))],
    }, sibs.map((x) => x.personality), autopilot);
    s.view.cam.shakeScale = this.save.data.settings.reducedMotion ? 0 : this.save.data.settings.shake;
    s.view.fx.intensity = this.save.data.settings.reduceFlash || this.save.data.settings.reducedMotion ? 0.5 : 1;
    this.session = s;
    this.state = 'play';
    this.paused = false;
    this.input.resetToggles();
    this.input.interactToggle = this.save.data.settings.interactToggle;
    this.hud = new Hud(s.match, this.input, this.r.camera);
    this.hud.onPause = () => this.pause();
    const layer = h('div', { class: 'layer passthrough' }, this.hud.el);
    this.ui.innerHTML = '';
    this.overlays = [];
    this.base = layer;
    this.ui.append(layer, this.savingEl);
    this.musicFor('play');
    this.stemHold = { rival: 0, final: 0, rivalOn: false, finalOn: false };
  }

  pause() {
    if (!this.session || this.paused) return;
    this.hud?.touch?.release();
    this.paused = true;
    this.session.paused = true;
    this.audio.stems({ melody: 0.25, perc: 0.2, rival: 0, final: 0 });
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood modal', style: { width: 'min(460px, 100%)', textAlign: 'center' } },
        h('div', { class: 'sign title-l' }, 'Paused'),
        h('div', { class: 'card', style: { padding: '8px 12px', margin: '8px 0 14px' } }, this.level ? `${this.level.id} ${this.level.title} — ${this.level.brief}` : ''),
        h('div', { class: 'col' },
          this.btn('Resume', () => this.resume(), 'primary', '▶', { 'data-autofocus': true }),
          this.btn('Restart level', () => { this.popOverlay(); this.startLevel(this.level!.id); }, '', '↻'),
          this.btn('Settings', () => this.openSettings(), '', '⚙'),
          this.btn('Exit to map', () => { this.popOverlay(); this.goMap(this.level!.id); }, '', '⌂'),
        ),
      ),
    );
    this.pushOverlay(el, () => this.resume());
  }

  resume() {
    if (!this.session) return;
    this.popOverlay();
    this.paused = false;
    this.session.paused = false;
    this.input.clearHeld();
    this.audio.stems({ melody: 1, perc: 1 });
  }

  private onMatchDone() {
    const m = this.session!.match;
    this.result = m.result;
    this.session!.view.react(m.result!.order);
    const r = m.result!;
    this.audio.play(r.success ? 'comp.win' : 'comp.nearmiss');
    // record + unlock + autosave
    const cur = this.save.data.current!;
    const l = this.level!;
    if (r.success) {
      const rec = cur.levels[l.id] ?? { done: false, bestTime: null, placement: 4, medals: [], feathers: 0, variantSeed: cur.seed };
      rec.done = true;
      rec.bestTime = rec.bestTime === null ? r.time : Math.min(rec.bestTime, r.time);
      rec.placement = Math.min(rec.placement, r.placement);
      const medals = new Set(rec.medals);
      medals.add('Complete');
      if (r.medals.first) medals.add('First');
      if (r.medals.time) medals.add('Time');
      if (r.medals.feathers) medals.add('Feathers');
      rec.medals = [...medals];
      rec.feathers = Math.max(rec.feathers, m.player.st.feathers);
      cur.levels[l.id] = rec;
      const key = `${l.id}:g${cur.generation}:s${cur.seed}`;
      this.save.data.records[key] = Math.min(this.save.data.records[key] ?? Infinity, r.time);
      const next = LEVELS.find((x) => x.chapter === l.chapter && x.index === l.index + 1);
      if (next && !cur.unlocked.includes(next.id)) cur.unlocked.push(next.id);
      this.save.save();
    }
    setTimeout(() => this.goResults(), 1600);
  }

  // =================================================================== results
  goResults() {
    const m = this.session!.match;
    const r = this.result!;
    const l = this.level!;
    const cur = this.save.data.current!;
    this.state = 'results';
    this.musicFor('results');
    const rows = r.order.map((id, i) => {
      const a = m.actors[id];
      const val = l.format === 'showdown' ? `${r.points![id]} pts` : a.st.completeAt >= 0 ? `${a.st.completeAt.toFixed(1)}s` : l.phases[0].objective.kind === 'mostDeliveries' ? `${a.st.delivered} delivered` : '—';
      const medal = ['#f2b632', '#b8c0c8', '#cd8a4a', '#9a8a7a'][i];
      return h('div', { class: `rank ${a.isPlayer ? 'me' : ''}` }, h('div', { class: 'medal', style: { background: medal } }, String(i + 1)), h('img', { src: portrait(a.cls, a.stage, i === 0 ? 'victory' : 'happy'), alt: '' }), h('div', { style: { color: CLASS_INFO[a.cls].colors.uiDark } }, a.isPlayer ? `${a.name} (You)` : a.name), h('div', {}, val));
    });
    const recStars = r.success ? this.stars(l, cur.levels[l.id]) : 0;
    const lastInChapter = l.index === 5;
    const medals = h('div', { class: 'medals' },
      h('span', { class: `medal-chip ${r.medals.complete ? 'got' : ''}` }, '✔ Complete'),
      h('span', { class: `medal-chip ${r.medals.first ? 'got' : ''}` }, '🥇 First'),
      l.medals?.time ? h('span', { class: `medal-chip ${r.medals.time ? 'got' : ''}` }, `⏱ Under ${l.medals.time}s`) : null,
      l.medals?.feathers ? h('span', { class: `medal-chip ${r.medals.feathers ? 'got' : ''}` }, `🪶 ${l.medals.feathers} feathers`) : null,
    );
    let right: HTMLElement;
    let primary: HTMLElement;
    if (r.success && lastInChapter) {
      const to: Stage | 'adult' = l.chapter < 5 ? ((l.chapter + 1) as Stage) : 'adult';
      right = h('div', { class: 'card grow-panel' },
        h('div', { class: 'title-l' }, "You're Growing!"),
        h('div', { class: 'stages' },
          h('div', {}, h('img', { src: portrait(cur.cls, l.chapter), alt: '' }), h('div', { class: 'small' }, `Stage ${l.chapter}`, h('br'), GROWTH[l.chapter].name)),
          h('div', { class: 'title-l' }, '➜'),
          h('div', {}, h('img', { class: 'silhouette', src: portrait(cur.cls, to), alt: '' }), h('div', { class: 'small' }, to === 'adult' ? 'All grown up' : `Stage ${to}`, h('br'), to === 'adult' ? 'Adult' : GROWTH[to].name))),
      );
      primary = this.btn(l.chapter < 5 ? 'Grow Up!' : 'Celebrate!', () => (l.chapter < 5 ? this.goGrowth(l.chapter) : this.goAdult()), 'green', '🌱', { 'data-autofocus': true });
    } else {
      right = h('div', { class: 'card grow-panel' },
        h('div', { class: 'title-m' }, r.success ? 'Nicely done!' : 'Wobble, then try again!'),
        h('p', {}, r.reason),
        h('img', { src: portrait(cur.cls, l.chapter, r.success ? 'victory' : 'sulking'), alt: '' }),
      );
      const next = LEVELS.find((x) => x.chapter === l.chapter && x.index === l.index + 1);
      primary = r.success && next ? this.btn('Next Level', () => this.goIntro(next.id), 'primary', '▶', { 'data-autofocus': true }) : this.btn('Try Again', () => this.startLevel(l.id), 'primary', '↻', { 'data-autofocus': true });
    }
    const el = h('div', { class: 'layer dim fade-in', style: { flexDirection: 'column', gap: '10px' } },
      h('div', { class: 'banner wood' }, r.success ? (l.format === 'showdown' ? 'Champion!' : 'Stage Complete!') : 'Not quite!'),
      h('div', { class: 'big-stars', html: [0, 1, 2].map((i) => STAR(i < recStars)).join('') }),
      h('div', { class: 'results-wrap' },
        h('div', { class: 'card rank-list' }, ...rows, medals),
        right),
      h('div', { class: 'row' }, this.btn('Map', () => this.goMap(l.id), '', '⌂'), r.success ? this.btn('Retry', () => this.startLevel(l.id), '', '↻') : null, primary),
    );
    this.ui.innerHTML = '';
    this.overlays = [];
    this.base = el;
    this.ui.append(el, this.savingEl);
    this.baseBack = () => this.goMap(l.id);
    this.nav.setRoot(el, this.baseBack);
  }

  // =================================================================== growth
  goGrowth(from: Stage) {
    const cur = this.save.data.current!;
    const to = (from + 1) as Stage;
    cur.chapter = to;
    const first = LEVELS.find((l) => l.chapter === to && l.index === 1)!;
    if (!cur.unlocked.includes(first.id)) cur.unlocked.push(first.id);
    this.save.save(); // save before the transition
    this.enter('growth');
    this.menu.playGrowth(cur.cls, from, to);
    const el = h('div', { class: 'layer story', style: { justifyContent: 'flex-end', paddingBottom: '8vh' } },
      h('div', { class: 'big' }, `${cur.name} is growing!`),
      h('div', { class: 'sub' }, `${GROWTH[from].name} → ${GROWTH[to].name}. Next: ${CHAPTERS[to].name} — ${CHAPTERS[to].format}.`),
      this.btn('Continue', () => { this.selectedChapter = to; this.selectedLevel = first.id; this.goMap(first.id); }, 'primary', '▶', { 'data-autofocus': true }),
    );
    this.baseBack = null;
    this.setBase(el, null);
  }

  // =================================================================== adult celebration → new brood
  goAdult() {
    const d = this.save.data;
    const cur = d.current!;
    cur.phase = 'adult';
    const medals = Object.values(cur.levels).reduce((s, r) => s + r.medals.length, 0);
    const feathers = Object.values(cur.levels).reduce((s, r) => s + r.feathers, 0);
    d.family.lineage.push({ generation: cur.generation, cls: cur.cls, name: cur.name, perk: cur.perk, seed: cur.seed, siblings: this.siblings().map((s) => ({ name: s.name, cls: s.cls, personality: s.personality })), medals, feathers, finishedAt: new Date().toISOString() });
    d.family.completedGenerations = Math.max(d.family.completedGenerations, cur.generation);
    if (!d.achievements.includes('first-generation')) d.achievements.push('first-generation');
    if (!d.cosmetics.includes(`ribbon-g${cur.generation}`)) d.cosmetics.push(`ribbon-g${cur.generation}`);
    this.save.save();
    this.enter('adult');
    this.menu.playGrowth(cur.cls, 5, 'adult');
    const el = h('div', { class: 'layer story', style: { justifyContent: 'flex-end', paddingBottom: '8vh' } },
      h('div', { class: 'big' }, 'All grown up!'),
      h('div', { class: 'sub' }, `${cur.name} won the Barnyard Championship and became a fine ${CLASS_INFO[cur.cls].name} parent. The family cheers — and there are eggs in the nest…`),
      h('div', { class: 'row' }, this.btn('Credits', () => this.goCredits(() => this.goBrood())), this.btn('Hatch the new brood', () => this.goBrood(), 'primary', '🥚', { 'data-autofocus': true })),
    );
    this.setBase(el, null);
  }

  goBrood() {
    const d = this.save.data;
    const parent = d.current ?? null;
    const lastGen = d.family.lineage[d.family.lineage.length - 1];
    const pcls: ChickClass = parent?.cls ?? lastGen?.cls ?? 'speedy';
    const gen = (lastGen?.generation ?? 0) + 1;
    this.enter('brood');
    this.menu.playHatch([...CLASSES]);
    const rng = makeRng(d.family.seed + gen);
    const partner: ChickClass = rng.pick(CLASSES);
    const choices = perkChoices(pcls, gen, d.family.seed);
    let pick = choices[0];
    const perkCards = choices.map((p, i) => {
      const c = h('div', { class: `card perk focusable ${i === 0 ? 'selected' : ''}`, tabindex: 0, role: 'button' }, h('div', { class: 'title-m', style: { fontSize: '17px' } }, p.name), h('div', { class: 'small' }, p.summary));
      c.addEventListener('click', () => { pick = p; perkCards.forEach((x) => x.classList.toggle('selected', x === c)); });
      return c;
    });
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood family-wrap' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'sign title-l' }, `Generation ${gen}`), h('div', { class: 'sign title-m' }, 'A brighter flock')),
        h('div', { class: 'tree' },
          h('div', { class: 'card parent' }, h('img', { src: portrait(pcls, 'adult'), alt: '' }), h('div', { class: 'title-m' }, `${parent?.name ?? lastGen?.name ?? 'Parent'} (Parent)`), h('div', { class: 'small muted' }, CLASS_INFO[pcls].name)),
          h('div', { class: 'card', style: { padding: '12px' } },
            h('div', { class: 'title-m' }, 'Inherited family perk'),
            h('div', { class: 'small muted' }, 'One modest perk (max 5%). Perks never stack across generations. Any class may be chosen — parents never lock the class.'),
            h('div', { class: 'col', style: { marginTop: '8px' } }, ...perkCards)),
          h('div', { class: 'card parent' }, h('img', { src: portrait(partner, 'adult'), alt: '' }), h('div', { class: 'title-m' }, `${rng.pick(['Rocco', 'Sunny', 'Maple', 'Juniper'])} (Partner)`), h('div', { class: 'small muted' }, CLASS_INFO[partner].name)),
        ),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          this.btn('Family Tree', () => this.goFamily(() => this.goBrood()), '', '🌳'),
          d.family.completedGenerations >= 1 ? this.btn('Credits', () => this.goCredits(() => this.goBrood()), '', '♥') : null,
          this.btn('Choose Your Chick', () => { this.pendingPerk = pick; this.goSelect(gen); }, 'primary', '♥', { 'data-autofocus': true })),
      ),
    );
    this.baseBack = () => this.goTitle();
    this.setBase(el, this.baseBack);
  }

  // =================================================================== family tree
  goFamily(back: () => void = () => this.goTitle()) {
    const d = this.save.data;
    this.enter('family');
    const gens = d.family.lineage;
    const cur = d.current;
    this.menu.setChicks(gens.length ? gens.slice(-3).map((g) => ({ cls: g.cls, stage: 'adult' as const })) : CLASSES.map((c) => ({ cls: c, stage: 1 as Stage })), 'menu');
    const cards = gens.map((g) => h('div', { class: 'card gen' }, h('img', { src: portrait(g.cls, 'adult'), alt: '' }), h('div', { class: 'title-m', style: { fontSize: '16px' } }, `Gen ${g.generation}`), h('div', {}, g.name), h('div', { class: 'small muted' }, `${CLASS_INFO[g.cls].name}${g.perk ? ' · ' + perkById(g.perk)?.name : ''}`), h('div', { class: 'small' }, `🏅 ${g.medals} · 🪶 ${g.feathers}`), h('div', { class: 'small muted' }, 'Siblings: ' + g.siblings.map((s) => s.name).join(', '))));
    if (cur && cur.phase === 'playing') cards.push(h('div', { class: 'card gen', style: { borderColor: '#f6b62a' } }, h('img', { src: portrait(cur.cls, cur.chapter as Stage), alt: '' }), h('div', { class: 'title-m', style: { fontSize: '16px' } }, `Gen ${cur.generation}`), h('div', {}, cur.name + ' (now)'), h('div', { class: 'small muted' }, `${CLASS_INFO[cur.cls].name} · ${GROWTH[cur.chapter as Stage].name}`)));
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood family-wrap' },
        h('div', { class: 'sign title-l' }, `🌳 ${d.family.name}`),
        h('div', { class: 'card', style: { padding: '10px 14px', margin: '8px 0' } }, gens.length ? `${gens.length} generation${gens.length > 1 ? 's' : ''} grown. Achievements: ${d.achievements.join(', ') || '—'}. Cosmetics: ${d.cosmetics.join(', ') || '—'}.` : 'No grown-up chickens yet — finish the Barnyard Championship to start the family tree!'),
        h('div', { class: 'lineage' }, ...cards),
        h('div', { class: 'row', style: { marginTop: '12px' } }, this.btn('Back', back, 'primary', '←', { 'data-autofocus': true })),
      ),
    );
    this.baseBack = back;
    this.setBase(el, back);
  }

  // =================================================================== credits
  goCredits(back: () => void = () => this.goTitle()) {
    this.enter('credits');
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood modal credits' },
        h('div', { class: 'sign title-l' }, '♥ Credits & Licences'),
        h('div', { class: 'card', style: { padding: '12px 16px', margin: '8px 0' } },
          h('h3', {}, 'CHICK KIN'), h('div', {}, 'Game design & reference boards: the CHICK KIN creative team.'), h('div', {}, 'Programming, procedural art, synthesized audio: built with Claude Code.'),
          h('h3', {}, 'Libraries'), h('div', {}, 'three.js — MIT Licence · Vite — MIT Licence'),
          h('h3', {}, 'Fonts'), h('div', {}, 'Fredoka and Nunito — SIL Open Font Licence 1.1 (bundled via @fontsource)'),
          h('h3', {}, 'Art & audio status'), h('div', {}, 'All 3D models, textures, sound effects and music in this build are TEMPORARY procedural placeholders generated in code. They are not final production assets.'),
        ),
        h('div', { class: 'row' }, this.btn('Back', back, 'primary', '←', { 'data-autofocus': true })),
      ),
    );
    this.baseBack = back;
    this.setBase(el, back);
  }

  // =================================================================== confirm
  confirm(text: string, yes: () => void) {
    const el = h('div', { class: 'layer dim fade-in' },
      h('div', { class: 'wood modal', style: { width: 'min(480px, 100%)', textAlign: 'center' } },
        h('div', { class: 'sign title-m' }, 'Are you sure?'),
        h('div', { class: 'card', style: { padding: '12px', margin: '10px 0 14px' } }, text),
        h('div', { class: 'row' }, this.btn('Cancel', () => this.popOverlay(), 'primary', '←', { 'data-autofocus': true }), this.btn('Yes', () => { this.popOverlay(); yes(); }, '', '✔'))),
    );
    this.pushOverlay(el, () => this.popOverlay());
  }

  // =================================================================== settings
  applySettings(s: Settings) {
    this.r.setQuality(s.quality);
    this.audio.apply(s);
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    this.input.interactToggle = s.interactToggle;
    if (this.session) { this.session.view.cam.shakeScale = s.reducedMotion ? 0 : s.shake; this.session.view.fx.intensity = s.reduceFlash || s.reducedMotion ? 0.5 : 1; }
  }

  openSettings(tab: 'audio' | 'access' | 'controls' | 'game' = 'audio') {
    const s = this.save.data.settings;
    const commit = () => { this.applySettings(s); this.save.save(); };
    const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'voice' | 'ambience' | 'shake') => {
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key], 'aria-label': label }) as HTMLInputElement;
      inp.addEventListener('input', () => { s[key] = Number(inp.value); this.applySettings(s); });
      inp.addEventListener('change', commit);
      return h('div', { class: 'setting' }, h('label', {}, label), inp);
    };
    const seg = <T extends string>(label: string, val: T, opts: [T, string][], set: (v: T) => void) => {
      const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
      opts.forEach(([v, name]) => {
        const b = h('button', { class: v === val ? 'on' : '', role: 'radio', 'aria-checked': v === val }, name);
        b.addEventListener('click', () => { set(v); wrap.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); commit(); this.audio.play('ui.confirm'); });
        wrap.append(b);
      });
      return h('div', { class: 'setting' }, h('label', {}, label), wrap);
    };
    const toggle = (label: string, key: 'muted' | 'reducedMotion' | 'reduceFlash' | 'captions' | 'interactToggle' | 'pauseOnBlur') => seg(label, s[key] ? 'on' : 'off', [['off', 'Off'], ['on', 'On']], (v) => { (s as unknown as Record<string, boolean>)[key] = v === 'on'; });
    const body = h('div', {});
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const show = (t: typeof tab) => {
      tab = t;
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
      body.innerHTML = '';
      if (t === 'audio') body.append(slider('Master volume', 'master'), slider('Music', 'music'), slider('Sound effects', 'sfx'), slider('Voices', 'voice'), slider('Ambience', 'ambience'), toggle('Mute all', 'muted'),
        seg('Dynamic range', s.dynamics, [['standard', 'Standard'], ['night', 'Night'], ['headphones', 'Headphones']], (v) => { s.dynamics = v; }));
      if (t === 'access') body.append(toggle('Reduced motion', 'reducedMotion'), slider('Camera shake', 'shake'), toggle('Reduce flashes', 'reduceFlash'), toggle('Captions for sound cues', 'captions'),
        toggle('Toggle (not hold) to scratch / tug', 'interactToggle'), toggle('Pause when the window loses focus', 'pauseOnBlur'),
        h('div', { class: 'small muted', style: { padding: '6px 12px' } }, 'Class identity always uses colour + shape + icon. Critical alerts show captions as well as sound.'));
      if (t === 'controls') {
        ACTIONS.forEach((a: Action) => {
          const b = h('button', { class: 'btn bind' }, this.input.keys[a].map(keyName).join(' / '));
          b.addEventListener('click', async () => {
            b.textContent = 'Press a key…';
            const code = await this.input.captureKey();
            if (code !== 'Escape' || a === 'pause') {
              for (const other of ACTIONS) if (other !== a) this.input.keys[other] = this.input.keys[other].filter((c) => c !== code);
              this.input.keys[a] = [code, ...this.input.keys[a].filter((c) => c !== code)].slice(0, 2);
              this.save.data.bindings.keys = this.input.keys;
              this.save.save();
            }
            show('controls');
          });
          body.append(h('div', { class: 'setting' }, h('label', {}, ACTION_LABEL[a]), b));
        });
        body.append(h('div', { class: 'small muted', style: { padding: '6px 12px' } }, 'Controller: left stick move · Ⓐ jump/flap · Ⓧ interact · Ⓑ ability · LB duck/brace · Start pause.'),
          h('div', { class: 'row', style: { marginTop: '8px' } }, this.btn('Reset to defaults', () => { this.input.keys = structuredClone(DEFAULT_KEYS); this.input.pad = { ...DEFAULT_PAD }; this.save.data.bindings = { keys: null, pad: null }; this.save.save(); show('controls'); })));
      }
      if (t === 'game') body.append(
        seg('Difficulty', s.difficulty, [['relaxed', 'Relaxed'], ['standard', 'Standard'], ['expert', 'Expert']], (v) => { s.difficulty = v; }),
        h('div', { class: 'small muted', style: { padding: '0 12px 6px' } }, 'Relaxed: finishing counts in first-place events and siblings hesitate more. Difficulty is separate from generation.'),
        seg('Graphics quality', s.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], (v) => { s.quality = v; }),
        h('div', { class: 'row', style: { marginTop: '10px' } }, this.btn('Reset all progress…', () => this.confirm('Erase all family progress? Settings and controls are kept.', () => { this.save.reset(); this.goTitle(); }), '', '🗑')),
      );
    };
    for (const [t, name] of [['audio', 'Audio'], ['access', 'Accessibility'], ['controls', 'Controls'], ['game', 'Game']] as const) {
      const b = h('button', { class: 'btn', 'data-t': t }, name);
      b.addEventListener('click', () => show(t));
      tabs.append(b);
    }
    show(tab);
    const el = h('div', { class: 'layer dim fade-in' }, h('div', { class: 'wood modal' }, h('div', { class: 'sign title-l' }, '⚙ Settings'), tabs, h('div', { class: 'card', style: { padding: '8px' } }, body), h('div', { class: 'row', style: { marginTop: '12px' } }, this.btn('Done', () => { this.save.save(); this.popOverlay(); }, 'primary', '✔'))));
    this.pushOverlay(el, () => { this.save.save(); this.popOverlay(); });
  }

  // =================================================================== debug
  openDebug() {
    let gen = this.save.data.current?.generation ?? 1;
    let cls: ChickClass = this.save.data.current?.cls ?? 'speedy';
    const levelSel = h('select', { class: 'focusable', style: { fontSize: '16px', padding: '6px' } }, ...LEVELS.map((l) => h('option', { value: l.id }, `${l.id} ${l.title}`))) as HTMLSelectElement;
    const genSel = h('select', { class: 'focusable', style: { fontSize: '16px', padding: '6px' } }, ...[1, 2, 3, 4, 5].map((g) => h('option', { value: g }, `Generation ${g}`))) as HTMLSelectElement;
    genSel.value = String(gen);
    genSel.addEventListener('change', () => (gen = Number(genSel.value)));
    const clsSel = h('select', { class: 'focusable', style: { fontSize: '16px', padding: '6px' } }, ...CLASSES.map((c) => h('option', { value: c }, CLASS_INFO[c].name))) as HTMLSelectElement;
    clsSel.value = cls;
    clsSel.addEventListener('change', () => (cls = clsSel.value as ChickClass));
    const auto = h('input', { type: 'checkbox', class: 'focusable' }) as HTMLInputElement;
    const cues = h('div', { class: 'row', style: { justifyContent: 'flex-start', gap: '6px' } }, ...this.audio.cueNames().map((n) => { const b = h('button', { class: 'btn', style: { minHeight: '30px', minWidth: '0', fontSize: '12px', padding: '2px 8px' } }, n); b.addEventListener('click', () => { this.audio.unlock(); this.audio.play(n); }); return b; }));
    const stems = h('div', { class: 'row' }, ...(['base', 'melody', 'perc', 'rival', 'final'] as const).map((st) => { let on = st !== 'rival' && st !== 'final'; const b = h('button', { class: 'btn' }, `${st}: ${on ? 'on' : 'off'}`); b.addEventListener('click', () => { on = !on; this.audio.stems({ [st]: on ? 1 : 0 }); b.textContent = `${st}: ${on ? 'on' : 'off'}`; }); return b; }));
    const music = h('div', { class: 'row' }, ...['title', 'select', 'nest', 'coop', 'rafters', 'farmyard', 'championship', 'results', 'family'].map((id) => this.btn(id, () => { this.audio.unlock(); this.audio.playMusic(id); })));
    const stats = h('div', { class: 'small' });
    const tick = setInterval(() => { stats.textContent = `voices ${this.audio.stats.voices} · played ${this.audio.stats.played} · stolen ${this.audio.stats.stolen} · skipped ${this.audio.stats.skipped}`; }, 500);
    const el = h('div', { class: 'layer dim' }, h('div', { class: 'wood modal', style: { width: 'min(900px,100%)' } },
      h('div', { class: 'sign title-l' }, '🛠 Debug'),
      h('div', { class: 'card', style: { padding: '10px' } },
        h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, levelSel, clsSel, genSel, h('label', {}, auto, ' autopilot'),
          this.btn('Play level', () => { clearInterval(tick); this.debugStart(levelSel.value, cls, gen, auto.checked); }, 'primary'),
          this.btn('Growth vignette', () => { clearInterval(tick); this.debugStart(levelSel.value, cls, gen, false, true); }),
          this.btn('Adult + brood', () => { clearInterval(tick); this.debugStart('5-5', cls, gen, false, false, true); })),
        h('div', { class: 'small muted' }, 'URL shortcuts: ?play=2-3&cls=mighty&gen=2&auto=1 · ?view=models · ?debug'),
      ),
      h('div', { class: 'card', style: { padding: '10px', marginTop: '8px' } }, h('div', { class: 'title-m' }, 'Audio audition (all cues TEMP)'), cues, h('div', { class: 'title-m' }, 'Music cues & stems'), music, stems, stats),
      h('div', { class: 'row', style: { marginTop: '10px' } }, this.btn('Close', () => { clearInterval(tick); this.popOverlay(); }, 'primary')),
    ));
    this.pushOverlay(el, () => { clearInterval(tick); this.popOverlay(); });
  }

  /** Debug path to any stage, class, level and generation (brief §10). */
  debugStart(id: string, cls: ChickClass, gen: number, auto: boolean, growth = false, adult = false) {
    const l = levelById(id)!;
    const d = this.save.data;
    d.family.generation = gen;
    d.family.completedGenerations = Math.max(d.family.completedGenerations, gen - 1);
    const unlocked = LEVELS.filter((x) => x.chapter < l.chapter || (x.chapter === l.chapter && x.index <= l.index)).map((x) => x.id);
    d.current = { cls, name: PLAYER_NAMES[(gen - 1) % PLAYER_NAMES.length], perk: null, generation: gen, seed: (d.family.seed + gen * 7919) >>> 0, chapter: l.chapter, unlocked, levels: {}, phase: 'playing' };
    this.autopilot = auto;
    if (adult) { this.goAdult(); return; }
    if (growth) { this.goGrowth(Math.min(4, l.chapter) as Stage); return; }
    this.startLevel(id, auto);
  }

  // =================================================================== test hooks
  private testHooks() {
    return {
      flow: this,
      state: () => this.state,
      paused: () => this.paused,
      save: () => this.save.data,
      match: () => this.session?.match ?? null,
      result: () => this.result,
      /** Advance the simulation quickly without rendering (browser checks under software GL). */
      fastForward: (seconds: number) => {
        const s = this.session;
        if (!s) return null;
        const n = Math.ceil(seconds * 120);
        for (let i = 0; i < n && s.match.state !== 'done'; i++) {
          const evs = s.frame(1 / 120, { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false });
          this.audio.onSim(evs, s.match);
          this.hud?.onEvents(evs);
        }
        if (s.match.state === 'done' && !this.result) this.onMatchDone();
        return s.match.state;
      },
      click: (text: string) => {
        const b = Array.from(this.ui.querySelectorAll('button')).find((x) => x.textContent?.includes(text));
        b?.click();
        return !!b;
      },
    };
  }
}
