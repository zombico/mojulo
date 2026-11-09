// THE FIRING RANGE, HEARD, in the browser (the e2e tier: it launches Chrome, and passes saying nothing when none is
// installed). Headless audio cannot be listened to, but every cue the page plays starts sources; each action's sources
// are counted. A still range is silent; a shot, a reload, a switch, a knife's cut and a rocket's burst each sound.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rangeBody } from './range.js';
import { gymOf, gymPageHtml } from './gym.js';
import { measureCombat, combatLaws } from './measure.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: [...CHROMIUM_WEBGL_ARGS, '--autoplay-policy=no-user-gesture-required'] });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the firing range, heard', () => {
  it('silent standing; a shot, a reload, a switch, a cut and a rocket\'s burst each sound', async () => {
    if (!browser) return;
    // (the page, without the measures' time: the gym laid from a stand-in's numbers is enough to stand in)
    const spec = { weapons: ['rifle', { name: 'boom', fire: 'projectile', speed: 40 }, { name: 'cut', fire: 'melee' }] };
    const { pilot, foe, payload } = rangeBody(spec), m = measureCombat({ ...pilot, rule: { ...pilot.rule, loadout: pilot.rule.loadout.slice(0, 1) } }, foe, { name: 'range' });
    m.laws = combatLaws(m);
    const G = gymOf(pilot, m), html = gymPageHtml({ pilot, foe, payload }, m, G.gym, G.gate, { kind: 'firing range' });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.world), { timeout: 60000 });
    // (the page makes its audio context at the first press: the count is laid before it)
    await page.evaluate(() => {
      window.__src = 0;
      const AC = window.AudioContext || window.webkitAudioContext;
      for (const k of ['createOscillator', 'createBufferSource']) { const f = AC.prototype[k]; AC.prototype[k] = function () { window.__src++; return f.apply(this, arguments); }; }
    });
    await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    const got = await page.evaluate(async () => {
      const C = window.__mojCtrl, e = Object.values(C.world.byId).find((x) => x.pilotable), out = {};
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const go = async (n, inp) => { for (let f = 0; f < n; f++) { C.step(1 / 60, typeof inp === 'function' ? inp(f) : inp); await frame(); } };
      const count = async (k, n, inp) => { const s0 = window.__src; await go(n, inp); out[k] = window.__src - s0; };
      await go(20, {});
      await count('still', 20, {});
      await count('shot', 12, (f) => ({ fire: f === 0 ? 1 : 0 }));
      await count('reload', 12, (f) => ({ reload: f === 0 ? 1 : 0 })); await go(150, {});
      await count('cut', 30, (f) => ({ melee: f === 0 ? 1 : 0 })); await go(30, {});
      await count('switch', 30, (f) => ({ slot: f === 0 ? 2 : 0 })); await go(20, {});
      e.transform.heading = 0; e.transform.pitch = -0.02;
      const b0 = C.world.burstSeq || 0;
      await count('rocket', 90, (f) => ({ fire: f === 0 ? 1 : 0 }));
      out.burst = (C.world.burstSeq || 0) - b0;
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.still).toBe(0);
    for (const k of ['shot', 'reload', 'cut', 'switch', 'rocket']) expect(got[k], k).toBeGreaterThan(0);
    expect(got.burst).toBe(1);
  }, 180000);
});
