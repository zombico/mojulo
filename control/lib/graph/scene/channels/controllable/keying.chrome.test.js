// Keying in play, drawn (the e2e tier: it launches a browser, and passes saying nothing when none is installed). A body
// walking on twos is posed on every fifth frame of sixty and holds the pose between, while its place moves every frame;
// `root: 'held'` steps the place with the pose; unkeyed, the pose changes every frame.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';
import { readKeying } from '../../../worlds/controllable/keying.js';

// one bone, a stride clip that lifts it 0.1 over its loop (four floats a quaternion, three a place, a key)
const part = { pos: 'AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', col: 'AAAAAAAAAAAAAAAA', faces: 1 };
const stride = { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1] };
const fig = { rig: true, bones: [{ id: 'root', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [part], clips: { idle: stride, forward: stride }, figH: 1 };
const floor = { corners: [[-40, -40, 0], [40, -40, 0], [40, 40, 0], [-40, 40, 0]], fill: '#556' };
const pilot = { id: 'p', pilotable: true, rule: { type: 'walk', speed: 4 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, body: { type: 'figure-rig', figure: 'hero' } };

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// how many times, over `n` frames of walking, the body's pose (its clip's phase and blend) and its place changed
async function changesOver(keying, n = 60) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(emitThreeWorld({ faces: [floor], entities: [pilot], figures: { hero: fig }, camera: { rule: 'follow', target: 'p' }, viewBox: { width: 160, height: 120 }, inline: true, capture: true, hud: false, ...(keying ? { keying } : {}) }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.p), { timeout: 60000 });
  const got = await page.evaluate((n) => {
    const C = window.__mojCtrl, out = { pose: 0, place: 0 };
    for (let i = 0; i < 20; i++) C.step(1 / 60, { forward: 1, strafe: 0 });   // (up to its pace)
    const B = C.bodies.p, bone = () => JSON.stringify(B.userData.rigFig.mix);   // (the clip's phase and its blend: what the bones are posed from)
    let pose = bone(), place = [B.position.x, B.position.y].map((v) => v.toFixed(5)).join();
    for (let i = 0; i < n; i++) {
      C.step(1 / 60, { forward: 1, strafe: 0 });
      const p = bone(), q = [B.position.x, B.position.y].map((v) => v.toFixed(5)).join();
      if (p !== pose) out.pose++;
      if (q !== place) out.place++;
      pose = p; place = q;
    }
    return out;
  }, n);
  await page.close();
  return { got, errors };
}

describe('keying in play, drawn', () => {
  it('on twos the pose changes on every fifth frame, the place on every frame; unkeyed both every frame', async () => {
    if (!browser) return;
    const ones = await changesOver(null), twos = await changesOver(readKeying('twos'));
    expect(ones.errors).toEqual([]); expect(twos.errors).toEqual([]);
    expect(ones.got.place).toBe(60);
    expect(ones.got.pose).toBeGreaterThan(50);
    expect(twos.got.place).toBe(60);
    expect(twos.got.pose).toBeGreaterThanOrEqual(11);
    expect(twos.got.pose).toBeLessThanOrEqual(13);
  }, 180000);

  it('a held root steps the place with the pose', async () => {
    if (!browser) return;
    const held = await changesOver(readKeying({ cast: 'threes', root: 'held' }));
    expect(held.errors).toEqual([]);
    expect(held.got.place).toBeGreaterThanOrEqual(7);
    expect(held.got.place).toBeLessThanOrEqual(9);
    expect(held.got.pose).toBeLessThanOrEqual(9);
  }, 180000);
});
