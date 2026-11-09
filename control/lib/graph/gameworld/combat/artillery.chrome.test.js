// THE ARTILLERY RANGE in the browser (the e2e tier: it launches Chrome, and passes saying nothing when none is installed).
// The gun laid by its sight's mark onto a stand and fired: the page marks what the round did by the measures' own law
// (terminal.js): a kinetic round through a plate it out-cuts, a blast shell's breach of a brick wall, a crater where a
// round falls on the ground; the next round loaded by its key.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { artilleryHtml } from './artillery.js';
import { ORDNANCE, WEAPON_ROUNDS } from './ordnance.js';
import { MECHA_ARCHETYPES } from '../../mecha-shelf/index.js';
import { MECHA_BACKPACKS } from '../../mecha-shelf/mecha-backpacks.js';
import { VEHICLES, handlesOf } from '../../vehicle-registry/roster.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: [...CHROMIUM_WEBGL_ARGS, '--autoplay-policy=no-user-gesture-required'] });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// (one kinetic round and one blast shell, by what they are)
const rod = Object.keys(ORDNANCE).find((k) => ORDNANCE[k].rod), blast = Object.keys(ORDNANCE).find((k) => ORDNANCE[k].kind === 'blast' && !ORDNANCE[k].indirect);

describe('the artillery range, played', () => {
  it('laid by the sight\'s mark and fired: a hole through the plate, a breached wall, a crater, the next round by its key', async () => {
    if (!browser) return;
    const html = artilleryHtml({ ordnance: [rod, blast], quiet: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.turret), { timeout: 60000 });
    const got = await page.evaluate(async () => {
      const C = window.__mojCtrl, g = C.world.byId.gun, T = g.turret, R = T.range, out = {};
      const go = (n, inp) => { for (let f = 0; f < n; f++) C.step(1 / 60, inp); };
      // (the gun laid as a gunner lays it: the stand's centre under the loaded round's mark for its band)
      const lay = (id, yaw, pitch) => {
        const st = id && R.stands.find((s) => s.id === id), word = T.rounds[T.loaded].ordnance;
        if (st) { const m = R.table[word].find((x) => x[0] === st.band); yaw = Math.atan2((st.min[1] + st.max[1]) / 2, st.min[0]) * 180 / Math.PI; pitch = Math.atan2(1.2 - ((T.mount.at[2] || 0) + 0.35), st.min[0]) * 180 / Math.PI + m[1]; }
        T.want.yaw = yaw; T.want.pitch = pitch;
        go(Math.max(300, Math.ceil((g.weapon.reloadT || 0) * 60) + 5), {});
      };
      const fire = () => { const n0 = C.turret().marks.length; go(1, { fire: 1 }); go(200, {}); return C.turret().marks.slice(n0); };
      out.plate = (lay('rha-300@1000'), fire());
      go(1, { slot: 2 }); out.loaded = T.rounds[T.loaded].ordnance;
      out.wall = (lay('brick-250@500'), fire());
      out.ground = (lay(null, -30, 0.3), fire());
      out.sight = C.turret().sight;
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.plate).toMatchObject([{ stand: 'rha-300@1000', effect: 'hole', perforated: true }]);
    expect(got.loaded).not.toBe(got.plate[0].word);
    expect(got.wall).toMatchObject([{ stand: 'brick-250@500', effect: 'breach', perforated: true }]);
    expect(got.ground).toMatchObject([{ stand: 'ground', effect: 'crater' }]);
    expect(got.sight).toBe(true);
  }, 180000);

  it('on a tank from the vehicle library: its own turret and gun bones turned by the mount, held on its aim as it drives, its round marked', async () => {
    if (!browser) return;
    const html = artilleryHtml({ base: { vehicle: 'light tank' }, ordnance: [rod], quiet: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.turret), { timeout: 90000 });
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, g = C.world.byId.gun, T = g.turret, R = T.range, out = {};
      const go = (n, inp) => { for (let f = 0; f < n; f++) C.step(1 / 60, inp); };
      T.want.yaw = 40; T.want.pitch = 8; go(240, {});
      out.rig = C.turret().rig;
      // (driven and steered: the stabilized gun holds its line in the world)
      go(120, { forward: 1, turn: 0.6 });
      out.turned = g.transform.heading * 180 / Math.PI; out.world = T.yaw + out.turned;
      // (back on the firing line, laid on the 500 m plate by its mark)
      g.transform.pos = [0, 0, g.transform.pos[2]]; g.transform.heading = 0; T.want.yaw = 0; go(240, {});
      for (const k of ['speed', 'v']) if (typeof g[k] === 'number') g[k] = 0;
      const st = R.stands.find((s) => s.id === 'rha-100@500'), m = R.table[T.rounds[0].ordnance].find((x) => x[0] === 500);
      T.want.yaw = Math.atan2((st.min[1] + st.max[1]) / 2 - g.transform.pos[1], st.min[0] - g.transform.pos[0]) * 180 / Math.PI;
      T.want.pitch = Math.atan2(1.2 - (T.mount.at[2] + 0.35), st.min[0]) * 180 / Math.PI + m[1];
      go(300, {});
      const n0 = C.turret().marks.length; go(1, { fire: 1 }); go(150, {});
      out.marks = C.turret().marks.slice(n0);
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.rig.yaw).toBeCloseTo(40, 0);
    expect(got.rig.pitch).toBeCloseTo(8, 0);
    expect(Math.abs(got.turned)).toBeGreaterThan(5);
    expect(Math.abs(got.world - 40)).toBeLessThan(1);   // (the stabilizer a little behind a hull still turning)
    expect(got.marks).toMatchObject([{ stand: 'rha-100@500', effect: 'hole', perforated: true }]);
  }, 240000);

  it('on a walker of the mecha shelf: both mounts turned by the one aim, its kinetic round fired from its own mount; it walks its gait, and transforming, drives', async () => {
    if (!browser) return;
    // (the lightest frame carrying its own guns, found on the shelf)
    const armed = Object.keys(MECHA_ARCHETYPES).filter((a) => MECHA_ARCHETYPES[a].backpack && MECHA_BACKPACKS[MECHA_ARCHETYPES[a].backpack].takes.some((w) => WEAPON_ROUNDS[w])).sort((a, b) => MECHA_ARCHETYPES[a].mass - MECHA_ARCHETYPES[b].mass)[0];
    const frame = VEHICLES[Object.keys(VEHICLES).find((id) => (handlesOf(id).mecha ?? []).includes(armed))].label;
    const kinetic = Object.keys(ORDNANCE).find((k) => ORDNANCE[k].rod && Object.values(WEAPON_ROUNDS).flat().includes(k));
    const html = artilleryHtml({ base: { frame }, ordnance: [kinetic], quiet: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.turret), { timeout: 90000 });
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, g = C.world.byId.gun, T = g.turret, R = T.range, r = T.rounds[0];
      const go = (n, inp) => { for (let f = 0; f < n; f++) C.step(1 / 60, inp); };
      const st = R.stands.find((s) => s.id === 'rha-100@500'), m = R.table[r.ordnance].find((x) => x[0] === 500);
      T.want.yaw = Math.atan2((st.min[1] + st.max[1]) / 2 + r.at[1], st.min[0] - r.at[0]) * 180 / Math.PI;
      T.want.pitch = Math.atan2(1.2 - (r.at[2] + 0.35), st.min[0]) * 180 / Math.PI + m[1];
      go(400, {});
      // (the muzzle on the round's own mount's side)
      const side = Math.sign(-(T.muzzle[1]));
      const n0 = C.turret().marks.length; go(1, { fire: 1 }); go(150, {});
      const marks = C.turret().marks.slice(n0);
      // (then it walks two seconds: its gait's pace, its clip's phase the distance over its stride)
      const p0 = g.transform.pos.slice(), ph0 = g.gaitPhase || 0;
      go(120, { forward: 1 });
      const walked = Math.hypot(g.transform.pos[0] - p0[0], g.transform.pos[1] - p0[1]);
      const out = { rig: C.turret().rig, yaw: T.yaw, side, right: Math.sign(r.at[1]), marks, walked, phase: g.gaitPhase - ph0, speed: g.rule.speed, stride: g.rule.stride };
      // (a walker that transforms: B, through its beat, into its tank form; it drives a second at its drive's pace)
      if (g.forms) {
        const z0 = T.muzzle[2];
        go(30, {}); go(1, { transform: 1 }); go(Math.ceil(g.transformDur * 60) + 10, {});
        const p1 = g.transform.pos.slice();
        go(60, { forward: 1 });
        Object.assign(out, { form: g.form, drove: Math.hypot(g.transform.pos[0] - p1[0], g.transform.pos[1] - p1[1]), driveSpeed: g.rule.speed, lower: T.muzzle[2] < z0 - 0.2 });
        // (steered right at full lock: its wheels turned, its heading turning at v·tan(lock) over its steering wheelbase)
        // (standing at full right lock: each front wheel turned right, the inner (right) one more: Ackermann)
        go(60, { turn: 1 });
        out.wheels = C.turret().wheels;
        go(90, { forward: 1, turn: 1 });
        const h0 = g.transform.heading; go(30, { forward: 1, turn: 1 });
        Object.assign(out, { steer: g.steer, lock: g.rule.steer.max, yawRate: -(g.transform.heading - h0) * 2, wantRate: (g.rule.speed * Math.tan(g.rule.steer.max * Math.PI / 180)) / g.rule.steer.wheelbase, cap: g.rule.turn, gripLock: Math.atan((g.rule.steer.wheelbase * g.rule.turn) / g.rule.speed) * 180 / Math.PI });
        // (the chase: O once from the sight; driven on round the curve, the camera behind the hull and over it, the pip on)
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO' }));
        go(120, { forward: 1, turn: 1 });
        const cam = C.turret().camera, fwd = [Math.cos(g.transform.heading), Math.sin(g.transform.heading)];
        Object.assign(out, { view: C.turret().view, behind: (cam[0] - g.transform.pos[0]) * fwd[0] + (cam[1] - g.transform.pos[1]) * fwd[1], above: cam[2] - g.transform.pos[2], pip: C.turret().pip || null });
      }
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.rig.yaw).toBeCloseTo(got.yaw, 3);
    expect(got.side).toBe(got.right);
    expect(got.marks).toMatchObject([{ stand: 'rha-100@500', effect: 'hole', perforated: true }]);
    expect(got.walked).toBeCloseTo(got.speed * 2, 1);
    expect(got.phase).toBeCloseTo(got.walked / got.stride, 2);
    if (got.form !== undefined) {
      expect(got.form).toBe('tank');
      expect(got.drove).toBeCloseTo(got.driveSpeed, 1);
      expect(got.lower).toBe(true);
      // (at its pace, its lock what its grip allows: its heading's rate its turn's cap, its wheels along that circle)
      expect(got.steer).toBeCloseTo(Math.min(got.lock, got.gripLock), 2);
      expect(got.yawRate).toBeCloseTo(Math.min(got.wantRate, got.cap), 2);
      expect(got.view).toBe('chase');
      expect(got.behind).toBeLessThan(0);
      expect(got.above).toBeGreaterThan(1);
      expect(got.pip).toHaveLength(2);
      const W = Object.entries(got.wheels), byName = (re) => W.filter(([id]) => re.test(id)).map(([, a]) => a);
      expect(W.length).toBeGreaterThan(1);
      for (const [, a] of W) expect(a).toBeGreaterThan(0);
      expect(Math.max(...byName(/R$/))).toBeGreaterThan(Math.max(...byName(/L$/)));
    }
  }, 240000);

  it('a walker heard: its engine held as it stands, a footfall at each foot planted as it walks, none as it drives', async () => {
    if (!browser) return;
    const armed = Object.keys(MECHA_ARCHETYPES).filter((a) => MECHA_ARCHETYPES[a].backpack && MECHA_ARCHETYPES[a].wheels).sort((a, b) => MECHA_ARCHETYPES[a].mass - MECHA_ARCHETYPES[b].mass)[0];
    const frame = VEHICLES[Object.keys(VEHICLES).find((id) => (handlesOf(id).mecha ?? []).includes(armed))].label;
    const kinetic = Object.keys(ORDNANCE).find((k) => ORDNANCE[k].rod && Object.values(WEAPON_ROUNDS).flat().includes(k));
    const html = artilleryHtml({ base: { frame }, ordnance: [kinetic] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.turret), { timeout: 90000 });
    // (the page makes its audio at the first press: every source it starts is counted)
    await page.evaluate(() => {
      window.__src = 0;
      const AC = window.AudioContext || window.webkitAudioContext;
      for (const k of ['createOscillator', 'createBufferSource']) { const f = AC.prototype[k]; AC.prototype[k] = function () { window.__src++; return f.apply(this, arguments); }; }
    });
    await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    const got = await page.evaluate(async () => {
      const C = window.__mojCtrl, g = C.world.byId.gun, out = {};
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const go = async (n, inp) => { for (let f = 0; f < n; f++) { C.step(1 / 60, inp); await frame(); } };
      await go(30, {});
      const s0 = window.__src; await go(40, {}); out.still = window.__src - s0;
      const s1 = window.__src, p0 = g.gaitPhase || 0; await go(90, { forward: 1 }); out.walk = window.__src - s1; out.cycles = (g.gaitPhase || 0) - p0;
      // (transformed, it drives: its wheels make no footfalls)
      await go(1, { transform: 1 }); await go(Math.ceil(g.transformDur * 60) + 10, {});
      const s2 = window.__src; await go(60, { forward: 1 }); out.drive = window.__src - s2; out.form = g.form;
      out.heard = C.turret().heard || null;
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.heard).toEqual({ engine: true, hydraulics: true });
    expect(got.still).toBe(0);
    expect(got.walk).toBeGreaterThan(0);
    expect(got.cycles).toBeGreaterThan(1);
    expect(got.form).toBe('tank');
    expect(got.drive).toBe(0);
  }, 240000);

  it('a field vehicle without a turret: its weapon station fires, it drives on its class, its front wheels steer', async () => {
    if (!browser) return;
    const html = artilleryHtml({ base: { vehicle: 'armoured personnel carrier' }, ordnance: [Object.keys(ORDNANCE).find((k) => ORDNANCE[k].rod && Object.values(WEAPON_ROUNDS).flat().includes(k))], quiet: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.turret), { timeout: 90000 });
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, g = C.world.byId.gun, T = g.turret, R = T.range;
      const go = (n, inp) => { for (let i = 0; i < n; i++) C.step(1 / 60, inp); };
      go(5, {});
      const st = R.stands.find((s) => s.id === 'rha-100@500'), m = R.table[T.rounds[0].ordnance].find((x) => x[0] === 500);
      T.want.yaw = Math.atan2((st.min[1] + st.max[1]) / 2, st.min[0] - T.mount.at[0]) * 180 / Math.PI;
      T.want.pitch = Math.atan2(1.2 - (T.mount.at[2] + 0.35), st.min[0]) * 180 / Math.PI + m[1];
      go(300, {}); const n0 = C.turret().marks.length; go(1, { fire: 1 }); go(120, {});
      const marks = C.turret().marks.slice(n0), p0 = g.transform.pos.slice();
      go(120, { forward: 1 }); const h0 = g.transform.heading; go(60, { forward: 1, turn: 1 });
      return { marks, drove: Math.hypot(g.transform.pos[0] - p0[0], g.transform.pos[1] - p0[1]), turned: g.transform.heading - h0, wheels: C.turret().wheels || {} };
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.marks).toMatchObject([{ stand: 'rha-100@500', effect: 'hole', perforated: true }]);
    expect(got.drove).toBeGreaterThan(5);
    expect(got.turned).toBeLessThan(0);   // (D: a right turn)
    const W = Object.entries(got.wheels);
    expect(W.length).toBe(4);
    for (const [, a] of W) expect(a).toBeGreaterThan(0);
    expect(got.wheels.wheelFR).toBeGreaterThan(got.wheels.wheelFL);
    expect(got.wheels.wheelFR).toBeGreaterThan(got.wheels.wheelRR);
  }, 240000);

  it('an aircraft: flown from the chase, its fixed gun fired in a dive, its rounds marked where they strike', async () => {
    if (!browser) return;
    const html = artilleryHtml({ base: { aircraft: 'jet fighter' }, quiet: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojCtrl && window.__mojCtrl.turret), { timeout: 90000 });
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, g = C.world.byId.gun, out = {};
      const go = (n, inp) => { for (let i = 0; i < n; i++) C.step(1 / 60, inp); };
      go(60, {});
      out.view = C.turret().view; out.v = g.airspeed; out.z = g.transform.pos[2];
      go(40, { lookDY: -6 });
      const n0 = C.turret().marks.length; go(40, { fire: 1 }); go(240, {});
      out.marks = C.turret().marks.slice(n0); out.pitch = g.transform.pitch;
      return out;
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.view).toBe('chase');
    expect(got.z).toBeGreaterThan(200);
    expect(got.v).toBeGreaterThan(200);
    expect(got.marks.length).toBeGreaterThan(3);
    expect(got.marks.some((m) => m.stand === 'ground' && m.effect === 'crater')).toBe(true);
  }, 240000);
});
