// A MOVER'S HOUSE in a real browser (an e2e suite: skipped when no browser is installed). The house's page comes up with no
// error; standing at a sofa, the page says what E does; E lifts it, carried in the hands; walked into the drop zone at the
// front door it is loaded, and the truck's count on the page's bus goes up.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { interiorStage } from './levels.js';
import { withBuildingLevel } from '../structure/level.js';
import { WALKINS } from '../geocity/walkins.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 600000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('a mover\'s house in a browser', () => {
  it('lifts a sofa on E, carries it in the hands, and loads it at the front door: the truck\'s count goes up', async () => {
    if (!browser) return;
    const W = WALKINS.house;
    const m = withBuildingLevel(interiorStage({ use: W.program, seed: 5, kit: W.kit, compose: { ...W.compose }, scale: 1.5, exit: false, name: W.name, basement: true, movers: { ...W.movers } }), 'house-ref');
    const r = await resolveWorldScene({ ref: 'house', manifest: m }), P = r.payload ?? r;
    const p = await browser.newPage();
    await p.setViewport({ width: 960, height: 540 });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setContent(emitThreeWorld({ ...P, inline: true }), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojCtrl.world.heave, { timeout: 180000 });
    // (the mover stood beside the sofa nearest the door's side, facing it)
    const id = await p.evaluate(() => {
      const W2 = window.__mojCtrl.world, H = W2.entities.find((e) => e.pilotable), S = W2.heave;
      const Q = S.pieces.filter((q) => q.name === 'sofa').sort((a, b) => a.min[0] - b.min[0])[0];
      H.transform.pos[0] = (Q.min[0] + Q.max[0]) / 2; H.transform.pos[1] = Q.min[1] - 0.7; H.transform.pos[2] = Q.min[2] + (H.rule.eye || 0); H.transform.heading = Math.PI / 2;
      return Q.id;
    });
    await wait(400);
    const hint = await p.evaluate(() => { const d = [...document.querySelectorAll('div')].find((x) => /lift the|set down/.test(x.textContent || '')); return d ? d.textContent : null; });
    expect(hint).toMatch(/E\s+·\s+lift the sofa/);
    await p.keyboard.down('KeyE'); await wait(120); await p.keyboard.up('KeyE'); await wait(400);
    const held = await p.evaluate(() => { const S = window.__mojCtrl.world.heave; return { held: S.held, z: S.pieces.find((q) => q.id === S.held)?.min[2] ?? null }; });
    expect(held.held).toBe(id);
    expect(held.z).toBeGreaterThan(4.6);
    const after = await p.evaluate(async () => {
      const W2 = window.__mojCtrl.world, H = W2.entities.find((e) => e.pilotable), Z = W2.heave.drop;
      H.transform.pos[0] = Z.at[0]; H.transform.pos[1] = Z.at[1]; H.transform.pos[2] = Z.at[2] + (H.rule.eye || 0);
      await new Promise((r2) => setTimeout(r2, 500));
      const B = window.__mojBus && window.__mojBus.state;
      return { loaded: W2.heave.loaded, held: W2.heave.held, count: B ? B.vars['loaded-movers'] : null };
    });
    expect(after).toEqual({ loaded: 1, held: null, count: 1 });
    expect(errors).toEqual([]);
    await p.close();
  }, 900000);
});
