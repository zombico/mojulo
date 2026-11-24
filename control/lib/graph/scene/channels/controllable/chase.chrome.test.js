// A set piece's chase line under its track camera, drawn (the e2e tier: it launches a browser, and passes saying nothing
// when none is installed). The page runs the line (the stick down it, round its corner), the camera stands where its key
// says (ahead of the hero on `lead`, looking back), the key's field of view handed to the page; no page error.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';
import { readChase } from '../../../worlds/controllable/chase-line.js';

const floor = { corners: [[-40, -40, 0], [60, -40, 0], [60, 60, 0], [-40, 60, 0]], fill: '#a98' };
const path = [[0, 0], [20, 0], [20, 20]];
const pilot = { id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0.5, 0, 0], heading: 0, pitch: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
const camera = { rule: 'track', target: 'h', path, keys: [{ s: 0, frame: 'chase' }, { s: 8, frame: 'lead', fov: 70 }, { s: 22, frame: 'profile', cut: true }] };

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('a chase line under its track camera, drawn', () => {
  it('runs the line, stands the camera on its key, hands the page the key\'s field of view', async () => {
    if (!browser) return;
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(emitThreeWorld({ faces: [floor], entities: [pilot], camera, chase: readChase({ lines: [{ id: 'roofs', path, half: 2 }] }), viewBox: { width: 160, height: 120 }, inline: true, capture: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.h), { timeout: 60000 });
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, out = {};
      for (let i = 0; i < 150; i++) C.step(1 / 60, { forward: 1, strafe: 0 });   // 15 m: on the lead key
      const B = C.bodies.h, cam = C.world.camera;
      out.hero = [B.position.x, B.position.y];
      out.cam = [cam.transform.pos[0], cam.transform.pos[1]];
      out.key = cam.track;
      for (let i = 0; i < 200; i++) C.step(1 / 60, { forward: 1, strafe: 0 });   // round the corner and up
      out.after = [B.position.x, B.position.y];
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.after[1]).toBeGreaterThan(5);                // up the second leg: the stick ran the line round its corner
    expect(got.cam[0]).toBeGreaterThan(got.hero[0]);        // the lead: ahead of the hero
    expect(got.key).toEqual({ key: 1, fov: 70 });            // the key the page lays its field of view from
  }, 180000);
});
