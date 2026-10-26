// The holo arena on the World page (an e2e suite: a real browser, skipped when none is installed): the duel the minds
// play in the page is the duel Node plays, move for move; every live piece stands as a hologram; the end is posted.
// MOJULO_SHOTS=<dir> keeps a frame of the summon and of the duel.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { holoArenaData } from './holo-arena.js';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-40, -4, 0], [40, -4, 0], [40, 60, 0], [-40, 60, 0]], fill: '#20242c' };
const SHOTS = process.env.MOJULO_SHOTS || null;
let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function open(data, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 620 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(emitThreeWorld({ faces: [FLOOR], holo: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojHolo && window.__mojHolo.phase !== undefined, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2200));   // the summon plays out
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `holo-${name}-summon.png`) });
  return { page, errors };
}
function nodeLine(data, n) {
  const T = buildTabletop(), M = buildTabletopMind(T), K = T.compile(data.L, data.G);
  let S = T.start(K);
  const line = [];
  for (let i = 0; i < n && !S.over; i++) {
    if (T.outcome(K, S, T.legal(K, S))) break;
    const r = M.think(K, S, Object.assign({}, M.LEVELS[data.level], { seed: data.seed + line.length }));
    if (!r) break;
    S = T.apply(K, S, r.move); line.push(r.move.name);
  }
  return { S, line };
}

describe('the holo arena on the World page', () => {
  it('stages a capture in real time: an attack, then the victim destroyed, then the move', async () => {
    if (!browser) return;
    // checkers: the minds trade men early; the page plays at its own pace until a capture is staged
    const data = holoArenaData({ game: 'checkers', players: 0, level: 'easy', seed: 2 });
    const { page, errors } = await open(data, 'capture');
    let seen = [];
    for (let i = 0; i < 160; i++) {
      const b = await page.evaluate(() => window.__mojHolo.beat);
      if (SHOTS && (b === 'attack' || b === 'destroy')) await page.screenshot({ path: join(SHOTS, `holo-capture-${b}.png`) });
      seen = await page.evaluate(() => window.__mojHolo.seen);
      if (seen.includes('destroy') && seen.lastIndexOf('move') > seen.indexOf('destroy')) break;
      await new Promise((r) => setTimeout(r, 120));
    }
    await page.close();
    expect(errors).toEqual([]);
    const at = seen.indexOf('attack');
    expect(at).toBeGreaterThan(-1);
    expect(seen.slice(at, at + 3)).toEqual(['attack', 'destroy', 'move']);
  }, 180000);

  it('a person\'s seat waits for them: two clicks play a move, the computer answers', async () => {
    if (!browser) return;
    const data = holoArenaData({ game: 'chess', players: 1, level: 'easy', seed: 5 });
    const { page, errors } = await open(data, 'you');
    await new Promise((r) => setTimeout(r, 1500));
    expect(await page.evaluate(() => window.__mojHolo.line)).toEqual([]);
    await page.evaluate(() => { window.__mojHolo.click('E2'); window.__mojHolo.click('E4'); });
    await page.waitForFunction(() => window.__mojHolo.line.length >= 2, { timeout: 30000 });
    const line = await page.evaluate(() => window.__mojHolo.line);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'holo-you.png') });
    await page.close();
    expect(errors).toEqual([]);
    expect(line[0]).toBe('E2-E4');
  }, 120000);

  for (const [game, name] of [['checkers', 'checkers'], ['chess', 'chess']]) {
    it(`${name}: the minds' duel in the page is Node's, move for move; every live piece a hologram`, async () => {
      if (!browser) return;
      const data = holoArenaData({ game, players: 0, level: 'easy', seed: 2 });
      const { page, errors } = await open(data, name);
      const out = await page.evaluate(() => { const H = window.__mojHolo; H.run(16); return { line: H.line, live: H.state.pieces.filter((P) => P.at >= 0).length, holos: H.holograms(), lp: H.lp() }; });
      await new Promise((r) => setTimeout(r, 1200));   // a beat or two of the duel itself
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `holo-${name}-duel.png`) });
      const later = await page.evaluate(() => window.__mojHolo.line);
      await page.close();
      expect(errors).toEqual([]);
      expect(out.line.length).toBeGreaterThanOrEqual(16);
      const N = nodeLine(data, later.length);
      expect(later).toEqual(N.line);
      expect(out.holos).toBe(out.live);
      expect(out.lp.every((x) => x >= 0 && x <= 4000)).toBe(true);
    }, 180000);
  }
});
