/**
 * THE WARNING — a cue's `warning` effect (playscape/ui/cues.js WARNING_VARS): the moment a boss, or a fight that plays as
 * one, is coming. Not a banner among the others: a band across the screen in translucent red over a dim of the world,
 * hazard stripes along its edges, its title (WARNING, CAUTION) large and spaced and its words under it, the band
 * blinking as it comes and the screen's edges washed red, gone after its seconds; and a sound of its own, a two-tone
 * klaxon synthesised on the page (no file: a square wave stepped between two pitches through a low-pass, three times),
 * through the page's audio where it has it, silent while it is muted. Read off the bus each frame, as the screen layer
 * is; emitted only where a level's events carry the warning's vars, so a level that raises none carries none of it.
 *
 *   WARNING              the look and the sound: { red (the band's rgba), edge (the stripes'), ttl (s), blinks, tones
 *                        ([hz, hz]), beat (s a tone), rounds, gain }
 *   warningOn(events)    → the events carry the warning's vars
 *   warningScript()      → the page's layer: `__stepWarning()`, called each frame after the bus is synced;
 *                          window.__mojWarning { shown, text, title, sounded } (a probe's: what the screen said)
 */
import { WARNING_VARS } from '../../playscape/ui/cues.js';

export const WARNING = Object.freeze({ red: 'rgba(150,18,22,0.58)', edge: 'rgba(255,72,60,0.85)', dim: 'rgba(40,0,0,0.28)', ttl: 3.2, blinks: 3, tones: [740, 555], beat: 0.24, rounds: 3, gain: 0.16 });

export const warningOn = (events) => !!events && !!events.vars && WARNING_VARS.n in events.vars;

export function warningScript() {
  const V = WARNING_VARS, W = WARNING;
  return `
// THE WARNING (warning.js): a boss coming, a band of red across the screen and its klaxon
const __wrnW = ${JSON.stringify(W)};
const __wrnHost = (typeof wrap !== 'undefined' && wrap) || document.body;
const __wrnRoot = document.createElement('div');
__wrnRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:45;opacity:0;transition:opacity .35s ease;display:flex;align-items:center;justify-content:center;';
__wrnRoot.innerHTML = '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,' + __wrnW.dim + ' 100%)"></div>'
  + '<div class="wrn-band" style="position:relative;width:100%;margin-top:-18vh;padding:14px 0 16px;background:' + __wrnW.red + ';backdrop-filter:blur(2px);text-align:center;font-family:system-ui,sans-serif;color:#fff2ee;text-shadow:0 0 12px rgba(255,60,50,.7)">'
  + '<div style="position:absolute;left:0;right:0;top:0;height:7px;background:repeating-linear-gradient(135deg,' + __wrnW.edge + ' 0 14px,transparent 14px 28px)"></div>'
  + '<div style="position:absolute;left:0;right:0;bottom:0;height:7px;background:repeating-linear-gradient(135deg,' + __wrnW.edge + ' 0 14px,transparent 14px 28px)"></div>'
  + '<div class="wrn-title" style="font-size:clamp(28px,6vw,64px);font-weight:900;letter-spacing:.5em;padding-left:.5em;line-height:1.05"></div>'
  + '<div class="wrn-text" style="font-size:clamp(13px,1.8vw,20px);font-weight:600;letter-spacing:.24em;text-transform:uppercase;margin-top:6px;opacity:.92"></div></div>';
__wrnHost.appendChild(__wrnRoot);
const __wrnBand = __wrnRoot.querySelector('.wrn-band'), __wrnTitle = __wrnRoot.querySelector('.wrn-title'), __wrnText = __wrnRoot.querySelector('.wrn-text');
window.__mojWarning = { shown: false, text: '', title: '', sounded: 0 };
let __wrnN = 0, __wrnUntil = 0, __wrnT0 = 0, __wrnCtx = null;
function __wrnSound() {
  try {
    if (typeof __beatsMuted !== 'undefined' && __beatsMuted) return;
    const ctx = (typeof __beatsCtx !== 'undefined' && __beatsCtx) || __wrnCtx || (__wrnCtx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02, out = ctx.createGain(), lp = ctx.createBiquadFilter(), o = ctx.createOscillator();
    lp.type = 'lowpass'; lp.frequency.value = 2400; o.type = 'square';
    o.connect(lp); lp.connect(out); out.connect(ctx.destination);
    out.gain.setValueAtTime(0, t0);
    for (let r = 0; r < __wrnW.rounds; r++) for (let k = 0; k < 2; k++) {
      const t = t0 + (r * 2 + k) * __wrnW.beat;
      o.frequency.setValueAtTime(__wrnW.tones[k], t);
      out.gain.setValueAtTime(__wrnW.gain, t); out.gain.setValueAtTime(__wrnW.gain, t + __wrnW.beat * 0.82); out.gain.linearRampToValueAtTime(0.0001, t + __wrnW.beat * 0.98);
    }
    o.start(t0); o.stop(t0 + __wrnW.rounds * 2 * __wrnW.beat + 0.05);
    window.__mojWarning.sounded++;
  } catch (e) { /* (no audio on this page: the band says it alone) */ }
}
function __stepWarning() {
  const V = __busState.vars, n = V[${JSON.stringify(V.n)}] || 0, now = performance.now() / 1000;
  if (n !== __wrnN) {
    __wrnN = n;
    __wrnTitle.textContent = V[${JSON.stringify(V.title)}] || 'WARNING'; __wrnText.textContent = V[${JSON.stringify(V.text)}] || '';
    __wrnT0 = now; __wrnUntil = now + (V[${JSON.stringify(V.ttl)}] || __wrnW.ttl);
    __wrnRoot.style.opacity = '1';
    window.__mojWarning.shown = true; window.__mojWarning.text = __wrnText.textContent; window.__mojWarning.title = __wrnTitle.textContent;
    __wrnSound();
  }
  if (!window.__mojWarning.shown) return;
  // (the band blinks as it comes, then holds; gone after its seconds)
  const u = now - __wrnT0, blink = u < __wrnW.blinks * 0.5 ? (Math.floor(u / 0.25) % 2 ? 0.35 : 1) : 1;
  __wrnBand.style.opacity = String(blink);
  if (now >= __wrnUntil) { __wrnRoot.style.opacity = '0'; window.__mojWarning.shown = false; }
}
`;
}
