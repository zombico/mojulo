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

// THE GUN IN THE HERO'S HANDS (gunplay-view.js __gpHold): over the shoulder a body that carries a kit holds the arm in
// its hands, each hand closed on its station (arms/handling.js); in first person the eye's own view carries it instead,
// with the eye's own hands on it (the knife drawn in the free one through a cut).
// A humanoid skeleton at rest (the made hero's joints), each bone a speck.
const J = { pelvis: [[0, 0, 0.9], [0, 0, 1.134]], lumbar: [[0, 0, 0.9], [0, 0, 1.134]], torso: [[0, 0, 1.134], [0, 0, 1.413]], neck: [[0, 0, 1.413], [0, 0, 1.548]], head: [[0, 0, 1.548], [0, 0, 1.683]],
  clavicle: [[0.056, 0, 1.382], [0.223, 0, 1.382]], upperArm: [[0.223, 0, 1.382], [0.262, 0, 1.097]], foreArm: [[0.262, 0, 1.097], [0.328, 0, 0.851]], hand: [[0.328, 0, 0.851], [0.351, 0, 0.764]],
  index1: [[0.35, 0.027, 0.767], [0.353, 0.028, 0.735]], middle1: [[0.351, 0.009, 0.764], [0.351, 0.009, 0.726]], little1: [[0.348, -0.026, 0.774], [0.343, -0.027, 0.748]], thumb1: [[0.322, 0.019, 0.831], [0.323, 0.031, 0.788]],
  thigh: [[0.112, 0.05, 0.9], [0.11, 0.05, 0.48]], shank: [[0.11, 0.05, 0.48], [0.11, 0.05, 0.08]] };
const skeleton = () => {
  const bones = [];
  for (const [id, [h, t]] of Object.entries(J)) {
    if (h[0] === 0 && t[0] === 0) bones.push({ id, head: h, tail: t });
    else for (const [s, x] of [['R', 1], ['L', -1]]) bones.push({ id: id + s, head: [x * h[0], h[1], h[2]], tail: [x * t[0], t[1], t[2]] });
  }
  return { rig: true, bones, parts: bones.map(() => fig.parts[0]), clips: {}, figH: 1.75 };
};

async function heldOf(camera) {
  const { kitSlot, knifeOf } = await import('../../../gameworld/arms-kit.js');
  const loadout = [kitSlot('rifle', {})];
  const p = { id: 'p', pilotable: true, rule: { type: 'platform', eye: 0, gunplay: true, loadout, knife: knifeOf(4) }, weapon: loadout[0].weapon, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, body: { type: 'figure-rig', figure: 'hero' } };
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(emitThreeWorld({ entities: [p], figures: { hero: skeleton() }, camera, viewBox: { width: 160, height: 120 }, inline: true, capture: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.p), { timeout: 60000 });
  const got = await page.evaluate(() => {
    const C = window.__mojCtrl, out = {};
    for (const [k, inp] of [['ready', {}], ['aimed', { aim: 1 }]]) {
      for (let i = 0; i < 45; i++) C.step(1 / 60, inp);
      const B = C.bodies.p, H = B.userData.rigFig.__hold;
      out[k] = { held: B.children.some((o) => o.isGroup && o.visible && o.children.length > 3), missR: H ? H.R.miss : null, missL: H ? H.L.miss : null, hands: C.hands() };
    }
    // the knife cut on its key: out in the hand mid-cut, away after
    for (let i = 0; i < 12; i++) C.step(1 / 60, { melee: i === 0 ? 1 : 0 });
    out.cut = C.hands();
    for (let i = 0; i < 40; i++) C.step(1 / 60, {});
    out.after = C.hands();
    return out;
  });
  await page.close();
  return { got, errors };
}

describe('the gun in the hero\'s hands', () => {
  it('over the shoulder: the rifle carried, both hands closed on their stations, at the ready and aimed', async () => {
    if (!browser) return;
    const { got, errors } = await heldOf({ rule: 'follow', target: 'p', dist: 2.8, height: 1.8, shoulder: 0.75, lookH: 1.55, lead: 10 });
    expect(errors).toEqual([]);
    for (const k of ['ready', 'aimed']) {
      expect(got[k].held).toBe(true);
      expect(got[k].missR).toBeLessThan(0.01);
      expect(got[k].missL).toBeLessThan(0.01);
      expect(got[k].hands).toEqual({ R: false, L: false, knife: false });   // (the eye's hands are the eye's)
    }
  }, 120000);
  it('in first person the body carries nothing: the eye\'s view holds the gun, both hands on it; the knife out only through a cut', async () => {
    if (!browser) return;
    const { got, errors } = await heldOf({ rule: 'eye', target: 'p', height: 1.6, mouseLook: true, hideTarget: true });
    expect(errors).toEqual([]);
    expect(got.aimed.held).toBe(false);
    expect(got.ready.hands).toEqual({ R: true, L: true, knife: false });
    expect(got.cut).toEqual({ R: true, L: true, knife: true });
    expect(got.after).toEqual({ R: true, L: true, knife: false });
  }, 120000);
});
