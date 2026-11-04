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

  it('one frame per level: a one-colour frame fails, a frame that reads passes, a level with no world is skipped, a frame that does not render fails', async () => {
    let calls = 0;
    const capture = async (items, o) => {
      calls++;
      expect(o).toMatchObject({ executablePath: '/chrome' });
      return items.map(({ ref }) => (ref === 'lv-bad' ? { rgba: solid(), scene: {} } : ref === 'lv-err' ? { error: 'page crashed\nstack' } : { rgba: halves(), scene: {} }));
    };
    const out = await firstFrameCheck(['lv-good', 'lv-bad', 'no-world', 'lv-err', 'lv-good'], { findBrowser: found, page, capture });
    expect(calls).toBe(1);   // one browser for every level
    expect(out.status).toBe('failed');
    // (2026-11-02: a page that times out or crashes fails; it was skipped, and a black flight page went through ungated)
    expect(out.levels.map((l) => [l.ref, l.status])).toEqual([['lv-good', 'pass'], ['lv-bad', 'failed'], ['no-world', 'skipped'], ['lv-err', 'failed']]);
    expect(out.levels[1].says[0]).toMatch(/one colour/);
    expect(out.levels[3].says).toEqual(['the frame did not render: page crashed']);
    // the same pages again: kept verdicts, nothing rendered
    const again = await firstFrameCheck(['lv-good', 'lv-bad'], { findBrowser: found, page, capture });
    expect(calls).toBe(1);
    expect(again.levels.map((l) => l.status)).toEqual(['pass', 'failed']);
  });

  it('a level made for a screen is rendered in its own frame; the rest at the check\'s', async () => {
    const framed = async (ref) => ({ html: `<html>${ref}</html>`, ...(ref === 'lv-tall' ? { frame: { width: 180, height: 320 } } : {}) });
    let items = null;
    const capture = async (xs) => { items = xs; return xs.map(() => ({ rgba: halves(), scene: {} })); };
    await firstFrameCheck(['lv-tall', 'lv-wide'], { findBrowser: found, page: framed, capture });
    expect(items.map((x) => x.frame ?? null)).toEqual([{ width: 180, height: 320 }, null]);
  });

  it('the pages are handed over packed: each read from its item when the browser loads it, never all held as text', async () => {
    let seen = null;
    const capture = async (xs) => {
      // (nothing read yet: each item's page is a getter over its deflated bytes)
      seen = xs.map((x) => typeof Object.getOwnPropertyDescriptor(x, 'html').get);
      return xs.map((x) => (x.html.includes(x.ref) ? { rgba: halves(), scene: {} } : { error: 'not its page' }));
    };
    const out = await firstFrameCheck(['lv-a', 'lv-b'], { findBrowser: found, page, capture });
    expect(seen).toEqual(['function', 'function']);
    expect(out.levels.map((l) => l.status)).toEqual(['pass', 'pass']);
  });

  it('design_game\'s readout: nothing without a run; the levels no run has gated as they stand, whatever this run did', async () => {
    SketchRepository.create({ ref: 'g-game', title: 'g', manifest: { kind: 'game', title: 'g', store: { slices: [] }, levels: [{ ref: 'g-level-a-0' }, { ref: 'g-level-a-1' }] } });
    const world = { made: { game: { ref: 'g-game' }, 'level-a-0': { ref: 'g-level-a-0', stored: 's0' }, 'level-a-1': { ref: 'g-level-a-1', stored: 's1' } } };
    expect(await firstFrameReadout(world, undefined)).toEqual({});
    let seen = null;
    const capture = async (items) => { seen = items.map((x) => x.ref); return items.map(() => ({ rgba: halves(), scene: {} })); };
    const out = await firstFrameReadout(world, [{ key: 'game', action: 'make' }], { findBrowser: found, page, capture });
    expect(seen).toEqual(['g-level-a-0', 'g-level-a-1']);
    expect(out.first_frame).toMatchObject({ gate: 'machine', status: 'pass' });
    // what the run keeps: each level's verdict beside the print of the row it judged
    expect(out.record).toEqual({ 'level-a-0': { stored: 's0', status: 'pass' }, 'level-a-1': { stored: 's1', status: 'pass' } });
    // (2026-11-02) a run resumed after the tool's budget kept everything: it gates what no run gated (it was skipped)
    _resetFirstFrameMemo(); seen = null;
    const resumed = await firstFrameReadout(world, [{ key: 'game', action: 'keep' }], { findBrowser: found, page, capture });
    expect(seen).toEqual(['g-level-a-0', 'g-level-a-1']);
    expect(resumed.first_frame.status).toBe('pass');
    // gated as they stand: nothing renders, the kept verdicts are said; a level remade since is gated again
    const recorded = { made: { ...world.made, 'level-a-0': { ...world.made['level-a-0'], frame: out.record['level-a-0'] }, 'level-a-1': { ...world.made['level-a-1'], stored: 's1b', frame: out.record['level-a-1'] } } };
    _resetFirstFrameMemo(); seen = null;
    const later = await firstFrameReadout(recorded, [{ key: 'game', action: 'keep' }], { findBrowser: found, page, capture });
    expect(seen).toEqual(['g-level-a-1']);
    expect(later.first_frame.levels.map((l) => [l.ref, l.status, !!l.kept])).toEqual([['g-level-a-0', 'pass', true], ['g-level-a-1', 'pass', false]]);
    // a frame that did not render is not kept: the next run tries it again
    const broke = await firstFrameReadout(world, [{ key: 'game', action: 'make' }], { findBrowser: found, page: async (r) => ({ html: `<x>${r}</x>` }), capture: async (items) => items.map(() => ({ error: 'Waiting failed: 60000ms exceeded' })) });
    expect(broke.first_frame.status).toBe('failed');
    expect(broke.record).toBeUndefined();
    // under test the environment keeps the browser off (vitest.setup.js): the real finder says so
    expect((await firstFrameReadout(world, [{ key: 'game', action: 'make' }])).first_frame).toMatchObject({ status: 'skipped', skipped: 'skipped: no browser (MOJULO_GAME_BROWSER=off)' });
  });
});
