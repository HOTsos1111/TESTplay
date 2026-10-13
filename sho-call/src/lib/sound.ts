// Optional, opt-in alert tone. Browsers may block audio until the user has
// interacted with the page, so silence is always possible; alerts are also
// shown as text and shape.
let ctx: AudioContext | null = null;

export async function playTone(kind: 'standby' | 'go' | 'test'): Promise<boolean> {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const notes = kind === 'go' ? [880, 1175] : kind === 'standby' ? [660] : [660, 880];
    let t = ctx.currentTime;
    for (const f of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
      t += 0.24;
    }
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
