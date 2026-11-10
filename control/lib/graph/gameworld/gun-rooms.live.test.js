// THE GUN ROOMS in a browser (the e2e tier: it launches Chrome, and passes saying nothing when none is installed): each
// opened by the practice door from a world alone, before any level. The firing range of a template that shoots: up with no
// error, a round fired at the near band lands on its body. The mech's artillery range on its own frame: up with no error,
// a round fired from its own mount marked where it strikes, and the frame transforming into its wheeled form.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { practiceHtml } from './practice-room-page.js';
import { TEMPLATE_FRAMES } from './practice.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// (a template whose loadout is guns alone, and the template that owns a frame)
const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const MECH = Object.keys(TEMPLATE_FRAMES)[0];

async function open(html, ready) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(ready, { timeout: 120000 });
  return { page, errors };
}

describe('the gun rooms, from a world', () => {
  it('the firing range: up with no error; a round at the near band lands on its body', async () => {
    const { html } = await practiceHtml({ id: 'range-live', feel: SHOOTER }, 'range', { sound: 'none' });
    if (!browser) return;
    const { page, errors } = await open(html, () => !!(window.__mojCtrl && window.__mojCtrl.world));
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, W = C.world, me = W.entities.find((e) => e.pilotable);
      const go = (n, inp) => { for (let f = 0; f < n; f++) C.step(1 / 60, inp); };
      const hp = (e) => e.body.hp;
      // (the nearest body ahead with health: the near band's; one round, as a body dropped is stood up whole again)
      const foes = W.entities.filter((e) => !e.pilotable && e.body && Number.isFinite(e.body.hp) && Number.isFinite(e.hpMax));
      const at = (e) => Math.hypot(e.transform.pos[0] - me.transform.pos[0], e.transform.pos[1] - me.transform.pos[1]);
      const near = foes.sort((a, b) => at(a) - at(b))[0];
      if (!near) return { near: null };
      go(30, {});
      const dx = near.transform.pos[0] - me.transform.pos[0], dy = near.transform.pos[1] - me.transform.pos[1];
      me.transform.heading = Math.atan2(dy, dx); me.transform.pitch = 0;
      const h0 = hp(near);
      go(1, { fire: 1 }); go(20, {});
      return { near: near.id, dist: Math.round(at(near)), h0, h1: hp(near) };
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.near).toBeTruthy();
    expect(got.dist).toBeLessThan(10);
    expect(got.h1).toBeLessThan(got.h0);
  }, 300000);

  it('the mech\'s artillery range on its own frame: a round from its own mount marked; it transforms into its wheeled form', async () => {
    const { html } = await practiceHtml({ id: 'mech-live', feel: MECH }, 'artillery', { sound: 'none' });
    if (!browser) return;
    const { page, errors } = await open(html, () => !!(window.__mojCtrl && window.__mojCtrl.turret));
    const got = await page.evaluate(() => {
      const C = window.__mojCtrl, g = C.world.byId.gun, T = g.turret, R = T.range, r = T.rounds[0];
      const go = (n, inp) => { for (let f = 0; f < n; f++) C.step(1 / 60, inp); };
      // (laid on the 500 m stand by the loaded round's mark, as a gunner lays it)
      const st = R.stands.find((s) => s.band === 500) ?? R.stands[0], m = (R.table[r.ordnance] ?? []).find((x) => x[0] === st.band) ?? [st.band, 0];
      T.want.yaw = Math.atan2((st.min[1] + st.max[1]) / 2 + r.at[1], st.min[0] - r.at[0]) * 180 / Math.PI;
      T.want.pitch = Math.atan2(1.2 - (r.at[2] + 0.35), st.min[0]) * 180 / Math.PI + m[1];
      go(400, {});
      const n0 = C.turret().marks.length; go(1, { fire: 1 }); go(240, {});
      const marks = C.turret().marks.slice(n0);
      const form0 = g.form;
      go(30, {}); go(1, { transform: 1 }); go(Math.ceil((g.transformDur || 1) * 60) + 10, {});
      return { marks: marks.length, forms: g.forms ? Object.keys(g.forms) : [], form0, form1: g.form };
    });
    await page.close();
    expect(errors).toEqual([]);
    expect(got.marks).toBeGreaterThan(0);
    expect(got.forms).toEqual(expect.arrayContaining(['walker', 'tank']));
    expect(got.form1).not.toBe(got.form0);
  }, 300000);
});
