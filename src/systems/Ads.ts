import { Audio } from './AudioManager';

/**
 * Placeholder adverts for the Play Store version.
 *
 * Nothing here talks to a real ad network yet: each advert plays one of our own
 * Parodee commercials (public/ads/) full screen over the game, so the timing and
 * flow can be tried out. When the Android app is wrapped (e.g. Capacitor +
 * AdMob), only showInterstitial() and showRewarded() need their insides swapped.
 *
 * Ads are off unless switched on:
 *   HH_ADS=1 at build time  -> on in that build (Play Store builds)
 *   ?ads=1 / ?ads=0 in URL  -> force on / off (playtesting)
 * Builds without HH_ADS also leave the ads/ videos out (see vite.config.ts).
 */
const param = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('ads') : null;

/** Bones paid for watching a reward advert in the bone shop. */
export const AD_BONE_REWARD = 150;
/** Seconds before the after-level advert can be closed. */
const INTERSTITIAL_SKIP_SECONDS = 5;
/** Used only if a video can't play: seconds the fallback card stays up. */
const FALLBACK_SECONDS = 8;

const VIDEOS = [1, 2, 3, 4, 5, 6, 7].map((n) => `./ads/idrather-parodee0${n}.mp4`);

class AdService {
  readonly enabled = param === '1' ? true : param === '0' ? false : __ADS__;
  showing = false;
  private lastVideo = -1;

  /** Full-screen advert that plays by itself after a level is beaten; resolves once it's closed. */
  async showInterstitial(): Promise<void> {
    if (!this.enabled || this.showing) return;
    await this.play(false);
  }

  /** Opt-in advert for a reward; resolves true only if it was watched to the end. */
  async showRewarded(): Promise<boolean> {
    if (!this.enabled || this.showing) return false;
    return this.play(true);
  }

  private pickVideo(): string {
    let i = Math.floor(Math.random() * VIDEOS.length);
    if (i === this.lastVideo) i = (i + 1) % VIDEOS.length;
    this.lastVideo = i;
    return VIDEOS[i];
  }

  private play(rewarded: boolean): Promise<boolean> {
    this.showing = true;
    Audio.suspend();
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.id = 'ad-placeholder';
      el.style.cssText =
        'position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:#000;' +
        'color:#FFE1AA;font:bold 18px "Trebuchet MS",sans-serif;text-align:center;touch-action:none;user-select:none;';
      const pill = 'position:absolute;padding:8px 16px;border-radius:12px;border:3px solid #302331;font:bold 18px \'Trebuchet MS\',sans-serif;';
      el.innerHTML =
        '<video data-video playsinline preload="auto" style="width:100%;height:100%;object-fit:contain"></video>' +
        `<div style="${pill}top:14px;left:14px;background:#FFD66E;color:#302331">AD</div>` +
        `<div data-count style="${pill}bottom:14px;left:50%;transform:translateX(-50%);background:rgba(48,35,49,.85);color:#FFE1AA"></div>` +
        `<button data-close style="${pill}top:14px;right:14px;background:#FFFDF6;color:#302331;cursor:pointer"></button>`;
      document.body.appendChild(el);
      const video = el.querySelector<HTMLVideoElement>('[data-video]')!;
      const count = el.querySelector<HTMLElement>('[data-count]')!;
      const close = el.querySelector<HTMLButtonElement>('[data-close]')!;

      let earned = false;
      let fallbackLeft = -1; // counts down only when the video can't play
      const secondsLeft = (): number => {
        if (fallbackLeft >= 0) return fallbackLeft;
        const d = Number.isFinite(video.duration) ? video.duration : 15;
        return Math.max(0, Math.ceil(d - video.currentTime));
      };
      const canClose = (): boolean =>
        earned || (!rewarded && (fallbackLeft >= 0 ? fallbackLeft <= 0 : video.currentTime >= INTERSTITIAL_SKIP_SECONDS));

      const tick = () => {
        if (rewarded) {
          count.textContent = earned ? `+${AD_BONE_REWARD} bones earned!` : `Reward in ${secondsLeft()}…`;
          close.textContent = earned ? 'Close ✕' : 'Skip (no reward)';
          close.disabled = false;
        } else {
          const wait = fallbackLeft >= 0 ? fallbackLeft : Math.ceil(INTERSTITIAL_SKIP_SECONDS - video.currentTime);
          count.textContent = canClose() ? '' : `You can close this in ${wait}…`;
          count.style.display = count.textContent ? '' : 'none';
          close.textContent = canClose() ? 'Close ✕' : '…';
          close.disabled = !canClose();
        }
      };

      const fallback = () => {
        if (fallbackLeft >= 0) return;
        video.remove();
        el.insertAdjacentHTML('afterbegin', '<div style="font-size:40px;color:#FFD66E">AD PLACEHOLDER</div>');
        fallbackLeft = FALLBACK_SECONDS;
        tick();
      };
      video.addEventListener('timeupdate', tick);
      video.addEventListener('ended', () => {
        earned = true;
        tick();
      });
      video.addEventListener('error', fallback);
      video.src = this.pickVideo();
      // Sound needs an earlier tap; if the browser refuses, play muted instead.
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(fallback);
      });
      tick();

      const timer = window.setInterval(() => {
        if (fallbackLeft > 0 && --fallbackLeft === 0) earned = rewarded;
        tick();
      }, 1000);

      // Keep key presses from reaching the game underneath.
      const swallow = (e: KeyboardEvent) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (e.type === 'keydown' && (e.code === 'Escape' || e.code === 'Enter') && (canClose() || rewarded)) finish();
      };
      window.addEventListener('keydown', swallow, true);
      window.addEventListener('keyup', swallow, true);

      const finish = () => {
        window.clearInterval(timer);
        window.removeEventListener('keydown', swallow, true);
        window.removeEventListener('keyup', swallow, true);
        video.pause();
        el.remove();
        this.showing = false;
        Audio.resume();
        resolve(earned);
      };
      close.addEventListener('click', finish);
    });
  }
}

export const Ads = new AdService();
