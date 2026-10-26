// The sports' athletes on the World page (an e2e suite: a real browser, skipped when none is installed): a character made
// with create_character plays each sport in its own body. Each arena given an athlete and its body draws that slot in it
// and plays on without a page error; given none, it draws its own figures. MOJULO_SHOTS=<dir> keeps a frame of each.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { meetArenaData } from './meet-arena.js';
import { matchArenaData } from './match-arena.js';
import { turnsArenaData } from './turn-arena.js';
import { teamArenaData } from './team-arena.js';
import { characterBody } from '../versus/versus-character.js';
import { heroRecord } from '../../mcp/tools/layered.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

const FLOOR = { corners: [[-60, -4, 0], [60, -4, 0], [60, 80, 0], [-60, 80, 0]], fill: '#4f8a5a' };
const SHOTS = process.env.MOJULO_SHOTS || null;
let browser = null, bodies = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
  // two characters as create_character's hero door makes them: the default male and female heroes
  bodies = { him: await characterBody({ kind: 'layered', hero: heroRecord({ cast: 'male' }) }), her: await characterBody({ kind: 'layered', hero: heroRecord({ cast: 'female' }) }) };
}, 120000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function play(key, probe, data, seconds, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(emitThreeWorld({ faces: [FLOOR], [key]: data, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((p) => window[p] && window[p].phase !== undefined, { timeout: 20000 }, probe);
  await page.evaluate(([p, s]) => window[p].run(s), [probe, seconds]);
  await new Promise((r) => setTimeout(r, 400));
  const athletes = await page.evaluate((p) => window[p].athletes(), probe);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `athletes-${name}.png`) });
  await page.close();
  return { athletes, errors };
}

describe('the sports\' athletes on the World page', () => {
  const cases = [
    ['meet', '__mojMeet', () => meetArenaData({ event: 'hurdles', lanes: 3, players: 0, athletes: ['him', 'her'] }, { bodies }), 4, 3],
    ['court', '__mojCourt', () => matchArenaData({ sport: 'tennis', players: 0, register: 'action', athletes: ['her', 'him'] }, { bodies }), 3, 2],
    ['turns', '__mojTurns', () => turnsArenaData({ sport: 'golf', seats: 2, players: 0, athletes: ['him', 'her'] }, { bodies }), 0.5, 1],
    ['pitch', '__mojPitch', () => teamArenaData({ sport: 'soccer', players: 0, athletes: ['him', 'her', null] }, { bodies }), 3, 7],
  ];
  for (const [key, probe, data, seconds, drawn] of cases) {
    it(`${key}: each slot with an athlete is drawn in its body, cycled over the slots`, async () => {
      if (!browser) return;
      const out = await play(key, probe, data(), seconds, key);
      expect(out.errors).toEqual([]);
      expect(out.athletes).toBe(drawn);
    }, 120000);
  }
  it('a sport with no athletes draws its own figures, nobody in a body', async () => {
    if (!browser) return;
    const out = await play('court', '__mojCourt', matchArenaData({ sport: 'tennis', players: 0 }), 1, 'court-sticks');
    expect(out.errors).toEqual([]);
    expect(out.athletes).toBe(0);
  }, 120000);
});
