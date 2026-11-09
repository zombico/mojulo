// Riding on the World page (an e2e suite: a whole world with a hero resolved, and a real browser, skipped when none is
// installed): a player world with `mounts` lays a horse beside the hero, its figure one welded skin (the page's skinned rig)
// with its loose and ridden clips, and teaches the hero to ride it (its riding clips of the same names, solved on its own
// rig). In the page: E in reach gets the hero on (the walk to the near side, the mount), the horse is then the pilot and W
// rides it up through its gaits; letting go halts it; E gets the hero off beside it, the pilot again.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { playerWorld } from '../playscape/player.js';
import { resolveWorldScene } from './world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { RIDDEN_CLIPS } from '../mount/game.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const cast = JSON.parse(readFileSync(new URL('../../../../docs/examples/humanoid/cast/heroine.json', import.meta.url), 'utf8'));
const HEROINE = { ...cast.hero, palette: { ...cast.hero.palette, ...cast.palette } };

let payload = null, browser = null;
beforeAll(async () => {
  const manifest = { ...playerWorld({ hero: HEROINE, id: 'hero' }), mounts: [{ at: [2, -2.6], heading: Math.PI / 2, coat: 'bay' }] };
  ({ payload } = await resolveWorldScene({ ref: 'sk_mount_ride', title: 'ride', manifest }));
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 400000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('riding on the World page', () => {
  it('lays the horse, its skinned figure and its rule; the hero rides, its riding clips its own', () => {
    const hero = payload.entities.find((e) => e.id === 'hero'), horse = payload.entities.find((e) => e.mount);
    expect(hero.rides).toBe(true);
    expect(horse).toMatchObject({ rule: { type: 'ride' }, body: { figure: 'mount:bay' } });
    expect(horse.rule.gaits.map((g) => g.clip)).toEqual(['ride_walk', 'ride_trot', 'ride_canter', 'ride_gallop']);
    const H = payload.figures['mount:bay'], F = payload.figures.hero;
    expect(H.skin).toBe(true);
    // every ridden clip on both, keyed alike (the runtime plays them together at one phase)
    for (const n of Object.keys(RIDDEN_CLIPS)) { expect(H.clips[n], n).toBeTruthy(); expect(F.clips[n], n).toBeTruthy(); expect(F.clips[n].k).toBe(H.clips[n].k); }
    expect(H.clips.idle).toBeTruthy();
  });

  it('E gets on, W rides it up through the gaits, letting go halts it, E gets off', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(emitThreeWorld({ ...payload, inline: true }), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.byId.hero, { timeout: 120000 });
    const S = () => page.evaluate(() => { const W = window.__mojCtrl.world, h = W.entities.find((e) => e.mount); return { pilot: W.pilotId, phase: W.byId.hero.mountPhase || null, gait: h.locomotion, v: h.speed || 0, reach: document.querySelector('.moj-reach')?.textContent || '' }; });
    const until = (fn, ms = 90000) => page.waitForFunction(fn, { timeout: ms, polling: 100 });
    const press = async (k) => { await page.keyboard.down(k); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.keyboard.up(k); };
    await page.mouse.click(400, 300);
    await until(() => document.querySelector('.moj-reach')?.textContent.includes('ride'));
    await press('KeyE');
    await until(() => window.__mojCtrl.world.byId.hero.mountPhase === 'mount');
    expect((await S()).gait).toBe('mount');
    await until(() => window.__mojCtrl.world.pilotId === 'mount-1');
    await page.keyboard.down('KeyW');
    await until(() => window.__mojCtrl.world.byId['mount-1'].locomotion === 'ride_canter');
    expect(await page.evaluate(() => window.__mojCtrl.world.byId.hero.locomotion)).toBe('ride_canter');
    await page.keyboard.up('KeyW');
    await until(() => (window.__mojCtrl.world.byId['mount-1'].speed || 0) === 0);
    expect((await S()).reach).toMatch(/get off/);
    await press('KeyE');
    await until(() => window.__mojCtrl.world.pilotId === 'hero');
    expect((await S()).phase).toBeNull();
    // (and the horse, unridden, stands at ease)
    await until(() => window.__mojCtrl.world.byId['mount-1'].locomotion === 'idle', 10000);
    expect(errors).toEqual([]);
    await page.close();
  }, 400000);
});
