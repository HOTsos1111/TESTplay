// Tiny DOM helpers + spatial focus navigation for keyboard/controller menus.
type Child = Node | string | number | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Focusable = buttons and anything marked .focusable inside the active screen. */
export class FocusNav {
  root: HTMLElement | null = null;
  onBack: (() => void) | null = null;
  onMove: (() => void) | null = null;

  setRoot(root: HTMLElement, onBack: (() => void) | null = null, initial?: HTMLElement | null) {
    this.root = root;
    this.onBack = onBack;
    const first = initial ?? (root.querySelector('[data-autofocus]') as HTMLElement | null) ?? this.items()[0];
    requestAnimationFrame(() => this.focus(first ?? null, false));
  }

  items(): HTMLElement[] {
    if (!this.root) return [];
    return Array.from(this.root.querySelectorAll<HTMLElement>('button, .focusable, input[type=range]')).filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null && !e.closest('[aria-hidden=true]'));
  }

  focus(el: HTMLElement | null, sound = true) {
    if (!el) return;
    document.querySelectorAll('.focus').forEach((e) => e.classList.remove('focus'));
    el.classList.add('focus');
    el.focus({ preventScroll: false });
    if (sound) this.onMove?.();
  }

  current(): HTMLElement | null {
    const a = document.activeElement as HTMLElement | null;
    if (a && this.root?.contains(a)) return a;
    return (this.root?.querySelector('.focus') as HTMLElement | null) ?? null;
  }

  nav(dir: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause') {
    if (!this.root) return;
    if (dir === 'back' || dir === 'pause') { this.onBack?.(); return; }
    const cur = this.current();
    if (dir === 'confirm') {
      if (cur) { cur.classList.add('pressed'); setTimeout(() => cur.classList.remove('pressed'), 120); cur.click(); }
      return;
    }
    if (cur instanceof HTMLInputElement && cur.type === 'range' && (dir === 'left' || dir === 'right')) {
      const step = Number(cur.step || 0.05);
      cur.value = String(Math.min(Number(cur.max), Math.max(Number(cur.min), Number(cur.value) + (dir === 'right' ? step : -step))));
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const items = this.items();
    if (!cur) { this.focus(items[0] ?? null); return; }
    const r0 = cur.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best: HTMLElement | null = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this.focus(best);
  }
}
