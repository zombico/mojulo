// THE FIGHT'S SHOT KEPT CLEAR, on the World page (a real browser, skipped when none is installed): a party RPG's fight on
// the map (rules.stage 'live', the default) clears its footprint and the corridor from its camera to it (rpg-channel.js
// stage, scene-three.js __mojClip: the props discarded there, the flora left out, whoever is not in the fight hidden),
// so what stands nearer than the fight covers next to nothing of the frame. Measured as the fight-clear spike measures it
// (control/scripts/spikes/fight-clear/): a grid of rays through the screen, a cell covered where something not the land
// stands nearer than the nearest fighter, a hit the clearing discards not seen. The whole party fights, as after the town.
// And the command window opens beside the acting member's bar, parked over its head, never over its figure, nor much of
// the rest of the party's (each member's figure, head to feet, a share under the window).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { composeGameworld, runSteps } from './index.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null, levels = [];
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
// (at most this share of the frame covered by what stands before the fight)
const COVER = 5;
beforeAll(async () => {
  const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel to save the princess', seed: 3 });
  levels = runSteps(W, { ref: 'fc' }).filter((s) => s.key.startsWith('level-') && s.order.manifest?.play?.rpg?.encounters?.length).slice(0, 3);
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  // (one page call may wait out many frames: a runner drawing these levels in software under load draws one every few
  // seconds, past puppeteer's 180 s for a call; the waits are bounded in frames and by the test's own timeout)
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS, protocolTimeout: 600000 });
}, 900000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// (waits in the page's frames, beside a floor in seconds: the runtime steps once a frame, and a runner drawing a frame every
// few seconds is read between them after a wait in seconds alone)
const frames = (page, n) => page.evaluate((k) => new Promise((ok) => { let i = 0; const f = () => (++i >= k ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const withinFrames = (page, fn, n) => page.evaluate((src, k) => new Promise((ok, no) => {
  const f = new Function(`return (${src})`)(); let i = 0;
  const tick = () => { let v = false; try { v = f(); } catch { /* not yet */ } if (v) ok(true); else if (++i > k) no(new Error(`not within ${k} frames`)); else requestAnimationFrame(tick); };
  tick();
}), fn.toString(), n);
const settle = async (page, ms, n) => { await nap(ms); await frames(page, n); };

async function fightOn(L) {
  const M = structuredClone(L.order.manifest);
  Object.entries(M.figures ?? {}).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB }; });
  for (const e of M.entities ?? []) if (/^foe-/.test(e.id) && e.rule?.collideHeight < 1.5) e.body = { ...(e.body ?? {}), scale: Math.round((e.rule.collideHeight / 1.8) * 1000) / 1000 };
  const { payload } = await resolveWorldScene({ ref: `fc_${L.key}`, title: L.key, manifest: M });
  // (the scene and the camera handed to the test: the page keeps them to itself)
  const html = emitThreeWorld({ ...payload, inline: true, hud: false })
    .replace('const scene = new THREE.Scene();', 'const scene = new THREE.Scene(); window.__fcScene = scene; window.__fcTHREE = THREE;')
    .replace('const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.1, 8000);', 'const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.1, 8000); window.__fcCam = camera;');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojRpg && window.__fcScene && window.__fcCam, { timeout: 300000 });
  const PM = Array.isArray(M.play?.party) ? M.play.party : [];
  await page.evaluate((js, ids) => { const B = window.__mojBus, ev = []; for (const j of js) { B.state.vars[`flag-${j}`] = 1; ev.push({ type: `flag-carried:${j}` }); } for (const id of ids) ev.push({ type: `rpg-join:${id}` }); B.bus.processEvents(B.state, ev); }, PM.map((m) => m.joins).filter(Boolean), PM.map((m) => m.who));
  await settle(page, 1500, 5);
  await page.evaluate((a) => { const w = window.__mojCtrl.world, me = w.byId[w.pilotId]; me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; me.transform.pos[2] += 2; if (me.vel) me.vel[2] = 0; }, M.play.rpg.encounters[0].at);
  await withinFrames(page, () => window.__mojRpg.state().mode === 'battle', 120);
  await settle(page, 2500, 10);
  const seen = await page.evaluate(() => {
    const T = window.__fcTHREE, sc = window.__fcScene, C = window.__fcCam, w = window.__mojCtrl.world, R = window.__mojRpg.R, cp = w.camera.transform.pos;
    const meshes = []; sc.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
    const fighters = [...R.b.ids.filter((id) => w.byId[id]), ...Object.keys(w.byId).filter((k) => w.byId[k].staged && !R.b.ids.includes(k) && !w.byId[k].gone)];
    const LAND = /(ground|trail|cliff|core|ridge|cloud|terrain|land|water|sky|road|floor|path)$/, land = (h) => LAND.test((h.object.userData && h.object.userData.g) || '');
    const CB = window.__mojClip.boxes, cut = (p) => CB.some((b) => { const dx = p.x - b.c[0], dy = p.y - b.c[1], a = dx * b.u[0] + dy * b.u[1], c = -dx * b.u[1] + dy * b.u[0]; return Math.abs(a) < b.half[0] && Math.abs(c) < b.half[1] && p.z > b.z[0] && p.z < b.z[1]; });
    const near = Math.min(...fighters.map((id) => { const q = w.byId[id].transform.pos; return Math.hypot(q[0] - cp[0], q[1] - cp[1], q[2] + 1 - cp[2]); })) - 1.5;
    const GX = 32, GY = 18, rc = new T.Raycaster(); let covered = 0;
    for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) {
      rc.setFromCamera(new T.Vector2(((i + 0.5) / GX) * 2 - 1, ((j + 0.5) / GY) * 2 - 1), C); rc.far = near;
      if (rc.intersectObjects(meshes, false).some((h) => !land(h) && !cut(h.point))) covered++;
    }
    return { covered: (100 * covered) / (GX * GY), boxes: CB.length, fighters: fighters.length };
  });
  // THE COMMAND WINDOW beside the acting member's bar, its figure (head to feet) uncovered
  await withinFrames(page, () => window.__mojRpg.state().phase === 'command' && document.querySelector('.moj-rpg .mana-anchor[data-key="acmd"]'), 240);
  // (measured once its place holds from one frame to the next: its first frame is placed by a guessed size, rpg-channel.js
  // besideAt)
  await settle(page, 1500, 2);
  await page.evaluate(() => new Promise((ok) => {
    let last = null, i = 0;
    const f = () => {
      const e = document.querySelector('.moj-rpg .mana-anchor[data-key="acmd"]'), r = e && e.getBoundingClientRect();
      const k = r ? [r.left, r.top, r.right, r.bottom].map(Math.round).join() : null;
      if ((k && k === last) || ++i > 60) ok(); else { last = k; requestAnimationFrame(f); }
    };
    requestAnimationFrame(f);
  }));
  seen.window = await page.evaluate(() => {
    const m = window.__mojRpg.state().member, w = window.__mojCtrl.world, P = window.__mojCtrl.project, q = document.querySelector('.moj-rpg .mana-anchor[data-key="acmd"]').getBoundingClientRect();
    // (each member's share of its figure, head to feet, under the window)
    const cover = (id) => { const e = w.byId[id] || w.byId[w.pilotId], top = (e.rule && e.rule.collideHeight) || 1.8, z = e.transform.pos[2] - ((e.rule && e.rule.eye) || 0), f = P(e.transform.pos[0], e.transform.pos[1], z), h = P(e.transform.pos[0], e.transform.pos[1], z + top);
      const half = Math.abs(f[1] - h[1]) * 0.2, body = { l: f[0] - half, r: f[0] + half, t: Math.min(f[1], h[1]), b: Math.max(f[1], h[1]) };
      return Math.max(0, Math.min(q.right, body.r) - Math.max(q.left, body.l)) * Math.max(0, Math.min(q.bottom, body.b) - Math.max(q.top, body.t)) / Math.max(1, (body.r - body.l) * (body.b - body.t)); };
    const ids = window.__mojRpg.R.b.ids.filter((id) => w.byId[id]);
    return { member: m, covered: cover(m), party: Math.max(0, ...ids.map(cover)), each: Object.fromEntries(ids.map((id) => [id, Math.round(cover(id) * 100) / 100])) };
  });
  await page.close();
  return seen;
}

describe('a party battle\'s shot is kept clear', () => {
  it('in Chrome: on the starter\'s first fighting levels, the whole party fighting, what stands before the fight covers next to nothing', async () => {
    if (!browser) return;
    expect(levels.length).toBeGreaterThan(0);
    for (const L of levels) {
      const S = await fightOn(L);
      expect(S.boxes, L.key).toBe(2);
      expect(S.fighters, L.key).toBeGreaterThan(3);
      expect(S.covered, L.key).toBeLessThanOrEqual(COVER);
      // (the command window opens beside the one acting, never over it)
      if (process.env.FC_OUT) (await import('node:fs')).appendFileSync(process.env.FC_OUT, JSON.stringify({ level: L.key, ...S.window }) + '\n');
      expect(S.window.covered, `${L.key}: ${S.window.member}`).toBeLessThan(0.05);
      // (nor over the rest of the party: a member beside the one acting kept in view, JSON the share of each)
      expect(S.window.party, `${L.key}: ${JSON.stringify(S.window.each)}`).toBeLessThan(0.15);
    }
  }, 1500000);
});
