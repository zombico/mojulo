// The first-frame check's orchestration: the browser is an optional worker (absent → skipped, said so), one frame per
// level, a kept verdict per page. The finder, the page and the capture are injected: no browser runs here.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { levelBrowser, firstFrameCheck, firstFrameReadout, _resetFirstFrameMemo } from './first-frame-check.js';

beforeEach(() => { closeDb(); _resetFirstFrameMemo(); });

const W = 32, H = 24;
const solid = () => { const px = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) { px[i * 4] = 210; px[i * 4 + 1] = 30; px[i * 4 + 2] = 30; px[i * 4 + 3] = 255; } return px; };
const halves = () => { const px = solid(); for (let i = 0; i < (W * H) / 2; i++) { px[i * 4] = 100; px[i * 4 + 1] = 160; px[i * 4 + 2] = 230; } return px; };
const page = async (ref) => (ref === 'no-world' ? { skip: 'no World form to render' } : { html: `<html>${ref}</html>` });
const found = async () => ({ path: '/chrome', why: null });

describe('first-frame check', () => {
  it('no browser: skipped, and says so (the finder injected; nothing renders)', async () => {
    let captured = 0;
    const out = await firstFrameCheck(['lv-1'], { findBrowser: async () => ({ path: null, why: 'no browser' }), page, capture: async () => { captured++; return []; } });
    expect(out).toMatchObject({ gate: 'machine', status: 'skipped', skipped: 'skipped: no browser' });
    expect(out.note).toMatch(/eyes gate .* has not run/);
    expect(captured).toBe(0);
  });

  it('the finder: an installed browser only (never a download), off when the environment says so', async () => {
    let asked = null;
    expect(await levelBrowser({ env: {}, resolve: async (o) => { asked = o; return '/chrome'; } })).toEqual({ path: '/chrome', why: null });
    expect(asked).toEqual({ allowFetch: false });
    expect(await levelBrowser({ env: {}, resolve: async () => { throw new Error('No Chromium-family browser was found'); } })).toEqual({ path: null, why: 'no browser' });
    expect((await levelBrowser({ env: { MOJULO_GAME_BROWSER: 'off' }, resolve: async () => '/chrome' })).path).toBeNull();
  });

  it('one frame per level: a one-colour frame fails, a frame that reads passes, a level with no world is skipped', async () => {
    let calls = 0;
    const capture = async (items, o) => {
      calls++;
      expect(o).toMatchObject({ executablePath: '/chrome' });
      return items.map(({ ref }) => (ref === 'lv-bad' ? { rgba: solid(), scene: {} } : ref === 'lv-err' ? { error: 'page crashed\nstack' } : { rgba: halves(), scene: {} }));
    };
    const out = await firstFrameCheck(['lv-good', 'lv-bad', 'no-world', 'lv-err', 'lv-good'], { findBrowser: found, page, capture });
    expect(calls).toBe(1);   // one browser for every level
    expect(out.status).toBe('failed');
    expect(out.levels.map((l) => [l.ref, l.status])).toEqual([['lv-good', 'pass'], ['lv-bad', 'failed'], ['no-world', 'skipped'], ['lv-err', 'skipped']]);
    expect(out.levels[1].says[0]).toMatch(/one colour/);
    expect(out.levels[3].says).toEqual(['the frame did not render: page crashed']);
    // the same pages again: kept verdicts, nothing rendered
    const again = await firstFrameCheck(['lv-good', 'lv-bad'], { findBrowser: found, page, capture });
    expect(calls).toBe(1);
    expect(again.levels.map((l) => l.status)).toEqual(['pass', 'failed']);
  });

  it('design_game\'s readout: nothing without a run, skipped when the run kept everything, else the game\'s levels', async () => {
    SketchRepository.create({ ref: 'g-game', title: 'g', manifest: { kind: 'game', title: 'g', store: { slices: [] }, levels: [{ ref: 'g-level-a-0' }, { ref: 'g-level-a-1' }] } });
    const world = { made: { game: { ref: 'g-game' }, 'level-a-0': { ref: 'g-level-a-0' } } };
    expect(await firstFrameReadout(world, undefined)).toEqual({});
    expect((await firstFrameReadout(world, [{ key: 'game', action: 'keep' }])).first_frame).toMatchObject({ status: 'skipped', skipped: expect.stringMatching(/nothing made or remade/) });
    let seen = null;
    const out = await firstFrameReadout(world, [{ key: 'game', action: 'make' }], { findBrowser: found, page, capture: async (items) => { seen = items.map((x) => x.ref); return items.map(() => ({ rgba: halves(), scene: {} })); } });
    expect(seen).toEqual(['g-level-a-0', 'g-level-a-1']);
    expect(out.first_frame).toMatchObject({ gate: 'machine', status: 'pass' });
    // under test the environment keeps the browser off (vitest.setup.js): the real finder says so
    expect((await firstFrameReadout(world, [{ key: 'game', action: 'make' }])).first_frame).toMatchObject({ status: 'skipped', skipped: 'skipped: no browser (MOJULO_GAME_BROWSER=off)' });
  });
});
