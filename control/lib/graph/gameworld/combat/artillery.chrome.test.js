// THE ARTILLERY RANGE in the browser (the e2e tier: it launches Chrome, and passes saying nothing when none is installed).
// The gun laid by its sight's mark onto a stand and fired: the page marks what the round did by the measures' own law
// (terminal.js): a kinetic round through a plate it out-cuts, a blast shell's breach of a brick wall, a crater where a
// round falls on the ground; the next round loaded by its key.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { artilleryHtml } from './artillery.js';
import { ORDNANCE } from './ordnance.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
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
});
