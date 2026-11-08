// A body that carries a loadout, drawn (the e2e tier: it launches a browser, and passes saying nothing when none is
// installed). A loadout whose slots each name a figure (a mobile suit's weapons) builds a body per slot and shows the
// one in hand; a carried kit's slots (arms-kit.js: guns, no figures) have none to build, and the body is its own figure.
// Before, the second was never drawn: a third-person shooter's hero carrying `arms` had no body on the page.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';

const fig = { rig: true, bones: [{ id: 'root', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [{ pos: 'AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', col: 'AAAAAAAAAAAAAAAA', faces: 1 }], clips: { idle: { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1] } }, figH: 1 };
const gun = { fireClass: 'sight', auto: true, rof: 9, magazine: 30, damage: 1, range: 60 };
const pilot = (loadout, figure = 'hero') => ({ id: 'p', pilotable: true, rule: { type: 'platform', eye: 0, loadout }, weapon: gun, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, body: { type: 'figure-rig', figure } });

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function bodyOf(entity, figures) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(emitThreeWorld({ entities: [entity], figures, camera: { rule: 'follow', target: 'p' }, viewBox: { width: 160, height: 120 }, inline: true, capture: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.bodies), { timeout: 60000 });
  const got = await page.evaluate(() => { const B = window.__mojCtrl.bodies.p; return B ? { visible: B.visible, rig: !!(B.userData && B.userData.rigFig) } : null; });
  await page.close();
  return { got, errors };
}

describe('a body that carries a loadout', () => {
  it('a carried kit (slots that name no figure): the body is its own figure, drawn', async () => {
    if (!browser) return;
    const { got, errors } = await bodyOf(pilot([{ name: 'rifle', weapon: gun }, { name: 'handgun', weapon: gun }]), { hero: fig });
    expect(errors).toEqual([]);
    expect(got).toEqual({ visible: true, rig: true });
  }, 120000);
  it('a suit\'s loadout (each slot its figure): the body in hand is built and shown', async () => {
    if (!browser) return;
    const { got, errors } = await bodyOf(pilot([{ name: 'a', figure: 'hero', weapon: gun }, { name: 'b', figure: 'hero-b', weapon: gun }]), { hero: fig, 'hero-b': fig });
    expect(errors).toEqual([]);
    expect(got).toEqual({ visible: true, rig: true });
  }, 120000);
});
