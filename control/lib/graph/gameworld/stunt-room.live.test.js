// The stunt room played (the e2e tier: it launches a browser, and passes saying nothing when none is installed). A bot
// runs the roofs down the chase line, jumps the gap, presses Grab on its window's middle and mashes Climb: the set piece
// runs to its end under its track camera. Pressed late, Grab is missed and the hero is put back before it, the line
// taken again. No page error. The machine gate's; whether it reads as directed is the operator's to play.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { practiceHtml } from './practice-room-page.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// the bot, on the page's own frames (the level's bus runs as it does for a player): W and the sprint held down the way,
// Space at the first roof's edge, each prompt's button pressed `late` seconds past its window's middle (a mash: pressed
// and let go every few frames once it opens). The keys are the controls layer's for each action.
async function play(late) {
  // (on the plain stand-in: the mechanics are proved, not the star, whose body slows a headless page to a few frames)
  const { html } = await practiceHtml({ id: 'lost-nomad-test', name: 'Lost Nomad', feel: 'lost-nomad' }, 'stunt', { cast: 'stand-in' });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.chase), { timeout: 120000 });
  await page.evaluate((late) => {
    const C = window.__mojCtrl, W = C.world, h = W.byId[W.pilotId];
    const code = { forward: 'KeyW', boost: 'KeyF', jump: 'Space', act: 'KeyE' };
    const key = (k, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code[k], key: code[k], bubbles: true }));
    const out = window.__bot = { keys: [], prompts: [], backs: 0, done: false, leadSeen: 0, leadFrames: 0 };
    let lastKey = -1, jumpT = 0, actDown = false, n = 0, lastS = 0;
    key('forward', true); key('boost', true);
    (function frame() {
      if (W.chase.done.length || (late && out.backs)) { key('forward', false); key('boost', false); out.done = true; return; }
      requestAnimationFrame(frame);
      n++;
      if (W.chase.on && W.chase.s > 16.4 && W.chase.s < 17.6 && !jumpT && h.grounded !== false) { key('jump', true); jumpT = n; }
      if (jumpT && n - jumpT > 3) { key('jump', false); }
      const U = W.prompt && W.prompt.up;
      let want = false;
      if (U) {
        if (out.prompts[out.prompts.length - 1] !== U.id) out.prompts.push(U.id);
        const mid = U.opens + (U.closes - U.opens) / 2 + late;
        if (U.kind === 'press') want = U.t >= mid && U.t < mid + 0.1;
        if (U.kind === 'mash') want = U.t >= U.opens && n % 6 < 3;
      }
      if (want !== actDown) { key('act', want); actDown = want; }
      if (W.camera.track && W.camera.track.key !== lastKey) { lastKey = W.camera.track.key; out.keys.push(lastKey); }
      // on the lead key: is the first pursuer behind the hero and inside the frame (35° of the look)
      const q = W.byId['pursuer-1'];
      if (q && W.camera.track && W.camera.track.key === 1 && W.chase.s > 10) {
        const c = W.camera.transform.pos, L = W.camera.lookAt, lv = [L[0] - c[0], L[1] - c[1], L[2] - c[2]], pv = [q.transform.pos[0] - c[0], q.transform.pos[1] - c[1], q.transform.pos[2] + 1 - c[2]];
        const cos = (lv[0] * pv[0] + lv[1] * pv[1] + lv[2] * pv[2]) / (Math.hypot(...lv) * Math.hypot(...pv));
        out.leadFrames++; if (cos > Math.cos(35 * Math.PI / 180) && q.transform.pos[0] < h.transform.pos[0]) out.leadSeen++;
      }
      if (W.chase.on && W.chase.s < lastS - 3) out.backs++;
      if (W.chase.on) lastS = W.chase.s;
    })();
  }, late);
  await page.waitForFunction(() => window.__bot && window.__bot.done, { timeout: 90000 }).catch(() => {});
  const got = await page.evaluate(() => ({ ...window.__bot, results: window.__mojCtrl.world.prompt.results, chaseDone: window.__mojCtrl.world.chase.done.slice() }));
  await page.close();
  return { got, errors };
}

describe('the stunt room, played', () => {
  it('on the windows\' middles the set piece runs to its end, the camera through its keys', async () => {
    if (!browser) return;
    const { got, errors } = await play(0);
    expect(errors).toEqual([]);
    expect(got.results).toEqual({ grab: 'hit', climb: 'hit' });
    expect(got.chaseDone).toEqual(['rooftops']);
    expect(got.keys.length).toBeGreaterThanOrEqual(5);   // directed: chase, lead, the low cut, wide, profile, over
    expect(got.leadFrames).toBeGreaterThan(0);
    expect(got.leadSeen / got.leadFrames).toBeGreaterThan(0.8);   // the lead frame shows who chases them
  }, 240000);

  it('pressed late, Grab is missed and the hero put back before it', async () => {
    if (!browser) return;
    const { got, errors } = await play(0.6);
    expect(errors).toEqual([]);
    expect(got.results.grab).toBe('miss');
    expect(got.backs).toBeGreaterThanOrEqual(1);
  }, 240000);
});
