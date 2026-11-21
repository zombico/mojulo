// THE FIRST MISSION in a browser (the e2e tier: it launches Chrome, and passes saying nothing when none is installed):
// opened by the practice door from a world alone. Up with no error, its briefing on mana-ui over the held scene; Begin
// plays; the HUD reads the scene (the gun in hand, the level's hp), the gun drawn as the arms library builds it; a hit
// marks the damage ring where it came from; a way on
// still sealed puts the body back; the rounds
// taken, the tracker moves on to the next task; the pilot's pause opens the menu and holds the scene; a level lost opens
// the debrief.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { practiceHtml } from './practice-room-page.js';
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

// (a template whose loadout is guns alone)
const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));

describe('the first mission, from a world', () => {
  it('is briefed, played, paused and debriefed on mana-ui', async () => {
    const { html, level, proof } = await practiceHtml({ id: 'mission-live', name: 'Mission live', feel: SHOOTER }, 'mission', { sound: 'none' });
    expect(proof.proved).toBe(true);
    if (!browser) return;
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__mojMission && window.__mojMission.up), { timeout: 120000 });
    const st = () => page.evaluate(() => { const M = window.__mojMission, P = M.state.ms; return { up: M.up, screen: M.rt.state().screen, ended: M.ended, weapon: P.weapon, hp: P.hp, title: P.order.title, step: P.order.step, mag: P.magazine, mode: P.mode, peril: P.peril, done: P.objective.steps.filter((s) => s.done).length, t: window.__mojCtrl.world.time }; });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const stand = (at) => page.evaluate((p) => { const me = window.__mojCtrl.world.entities.find((e) => e.pilotable); me.transform.pos[0] = p[0]; me.transform.pos[1] = p[1]; }, at);
    const where = () => page.evaluate(() => window.__mojCtrl.world.entities.find((e) => e.pilotable).transform.pos.slice(0, 2));
    // the briefing, the scene held behind it
    const b0 = await st();
    expect(b0.screen).toBe('briefing');
    await wait(500);
    expect((await st()).t).toBe(b0.t);
    // Begin: the stack closes and the scene plays
    for (let i = 0; i < 8 && (await st()).up; i++) { await page.keyboard.press(i % 2 ? 'Enter' : 'ArrowDown'); await wait(200); }
    const p0 = await st();
    expect(p0.up).toBe(false);
    // (the scene plays: the clock moves. A frame drawn in software can take most of a second, so it is waited for, not timed)
    const T = (ms = 15000) => ({ timeout: ms });
    await page.waitForFunction((t) => window.__mojCtrl.world.time > t, T(), p0.t);
    expect((await st()).t).toBeGreaterThan(p0.t);
    expect(p0.weapon).toBe(TEMPLATE_LOADOUTS[SHOOTER].weapons[0]);
    // (the gun as a shooter shows it: its magazine's size for the belt, its fire mode; full health puts no edge on the screen)
    expect(p0.mag).toBeGreaterThan(0);
    expect(['Auto', 'Burst', 'Semi', 'Launcher']).toContain(p0.mode);
    expect(p0.peril).toBe(0);
    expect(await page.evaluate(() => !!document.querySelector('#mana .mana-magazine .mana-belt, #mana .mana-magazine .mana-track'))).toBe(true);
    // (a mission is played: its page fills the window its HUD is laid over)
    expect(await page.evaluate(() => { const w = document.getElementById('wrap'); return [w.clientWidth === innerWidth, w.clientHeight === innerHeight]; })).toEqual([true, true]);
    // (the gun in the hands is the arms library's own arm: its parts' faces, handed to the page at its resolve)
    const parts = await page.evaluate(() => { const me = window.__mojCtrl.world.entities.find((e) => e.pilotable), M = me.rule.loadout[0].gunplay.view.mesh; return M ? M.parts.length : 0; });
    expect(parts).toBeGreaterThan(8);
    expect(p0.title).toBe(level.mission.sections[0].task.text);
    // the damage ring: a hit from behind marks the bottom of the ring, and the mark goes when its moment has passed
    const ring = () => page.evaluate(() => window.__mojMission.state.ms.ring);
    expect((await ring()).on).toBe(false);
    await page.evaluate(() => { const W = window.__mojCtrl.world, me = W.entities.find((e) => e.pilotable), f = W.entities.find((e) => e.team === 'foes'); f.transform.pos[0] = me.transform.pos[0] - 6; f.transform.pos[1] = me.transform.pos[1]; me.transform.heading = 0; me.hits = (me.hits || 0) + 1; me.lastHitBy = f.id; });
    await page.waitForFunction(() => window.__mojMission.state.ms.ring.on, T());
    expect(await ring()).toMatchObject({ on: true, hits: [{ bearing: 180 }] });
    // (its mark stands its life, damage-ring.js RING.life, in the world's time: a frame steps that time by a capped dt, so
    // on a loaded runner drawing a frame a second its 1.6 s take tens of seconds by the clock; waited for as long)
    await page.waitForFunction(() => !window.__mojMission.state.ms.ring.on, T(90000));
    // a way on still sealed puts the body back
    const S0 = level.mission.sections[0];
    await stand(S0.door.at);
    await page.waitForFunction((b) => { const p = window.__mojCtrl.world.entities.find((e) => e.pilotable).transform.pos; return Math.hypot(p[0] - b[0], p[1] - b[1]) < 1; }, T(), S0.door.back);
    const back = await where();
    expect(Math.hypot(back[0] - S0.door.back[0], back[1] - S0.door.back[1])).toBeLessThan(1);
    // the rounds taken: the first task met, the tracker on the next
    await stand(S0.task.at);
    await page.waitForFunction(() => window.__mojMission.state.ms.objective.steps[0].done, T());
    await page.waitForFunction((t) => window.__mojMission.state.ms.order.title === t, T(), level.mission.sections[1].task.text);
    const p1 = await st();
    expect(p1.done).toBe(1);
    expect(p1.title).toBe(level.mission.sections[1].task.text);
    expect(p1.step).toBe(`2/${level.mission.sections.length}`);
    // the pilot's pause: the menu up, the scene held
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__mojMission.rt.state().screen === 'pause', T());
    expect((await st()).screen).toBe('pause');
    // (a frame already in flight as the menu came up may step the clock once more: a software-drawn frame takes 270 to
    // 390 ms on a runner, so the hold is read once the clock has stood still for longer than one; a scene that never
    // holds times out here)
    await page.waitForFunction(() => new Promise((r) => { const t0 = window.__mojCtrl.world.time; setTimeout(() => r(window.__mojCtrl.world.time === t0), 600); }), T());
    const z = await st();
    await wait(1000);
    expect((await st()).t).toBe(z.t);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__mojMission.up, T());
    expect((await st()).up).toBe(false);
    // a level lost: its one envelope lands, the debrief opens
    // (low, the screen's edge closes in)
    await page.evaluate(() => { window.__mojBus.state.vars.hp = 10; });
    await page.waitForFunction(() => window.__mojMission.state.ms.peril > 0.5, { timeout: 5000 });
    await page.evaluate(() => { const B = window.__mojBus; B.state.vars.hp = 0; });
    await page.waitForFunction(() => window.__mojMission.ended && window.__mojMission.rt.state().screen === 'debrief', { timeout: 20000 });
    const end = await page.evaluate(() => ({ result: window.__mojGame.envelope.result, outcome: window.__mojMission.state.ms.result.outcome }));
    await page.close();
    expect(errors).toEqual([]);
    expect(end.result).toBe('fail');
    expect(end.outcome).toBe('Mission failed');
  }, 300000);
});
