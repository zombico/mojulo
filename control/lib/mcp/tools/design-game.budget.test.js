// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { updateSketchHandler } from './sketches.js';
import { designGameHandler, runBudgetMs, RUN_BUDGET_MS } from './design-game.js';

// The run's budget and its audit steps (design-game.js runWorld, gameworld/runner.js auditSteps): a run starts no step
// past its budget and leaves the rest pending, the next run takes up where it stopped, and the world it leaves is the
// one a single call leaves. A run that asks to check (`check: true`) then walks each reach level a step at a time, its
// verdict kept in the record; a run that does not walks none.

// the walk and the browser, stubbed: a level walk is tens of seconds in a real headless browser (test the gate itself
// with a stub runTraversal, CLAUDE.md); the first frame is the first-frame suite's
const walk = vi.fn(async () => ({ game: { ended: true, result: 'success' } }));
vi.mock('@/lib/graph/game/auto-audit-runner', () => ({ runLevelTraversal: (...a) => walk(...a), runLevelWalk: async (...a) => ({ probe: await walk(...a), legs: [] }) }));
vi.mock('@/lib/graph/game/first-frame-check.js', async (orig) => ({
  ...(await orig()),
  levelBrowser: async () => (process.env.STUB_BROWSER ? { path: '/stub/chrome', why: null } : { path: null, why: 'no browser (stubbed off)' }),
  firstFrameReadout: async () => ({}),
}));

const COMPOSE = { prompt: 'a sunny island coast', levels: 1, seed: 3 };
const record = (ref) => SketchRepository.getByRef(ref).manifest.made;
// the composed world as stored once (its palette stamped when it is first stored: a fresh seed each time it is made
// from words, color-theorist/stamp.js), so two databases run the same recipe
async function recipe() {
  closeDb();
  await designGameHandler({ compose: COMPOSE, ref: 'gw-words' });
  const W = SketchRepository.getByRef('gw-words').manifest;
  closeDb();
  return W;
}

beforeEach(() => { closeDb(); walk.mockClear(); delete process.env.STUB_BROWSER; });
afterEach(() => { process.env.MOJULO_RUN_BUDGET_MS = '0'; delete process.env.STUB_BROWSER; });

describe('design_game: the run\'s budget', () => {
  it('reads MOJULO_RUN_BUDGET_MS, else about two minutes; 0 is no budget', () => {
    expect(runBudgetMs({})).toBe(RUN_BUDGET_MS);
    expect(runBudgetMs({ MOJULO_RUN_BUDGET_MS: '0' })).toBe(0);
    expect(runBudgetMs({ MOJULO_RUN_BUDGET_MS: '5000' })).toBe(5000);
    expect(runBudgetMs({ MOJULO_RUN_BUDGET_MS: 'soon' })).toBe(RUN_BUDGET_MS);
  });

  it('a spent budget leaves the rest pending, each run moves at least one step, and the world left is the one call\'s', async () => {
    const W = await recipe();
    // one call, no budget
    process.env.MOJULO_RUN_BUDGET_MS = '0';
    const whole = await designGameHandler({ world: W, ref: 'gb', run: true, check: true });
    expect(whole.ran.some((r) => r.action === 'pending')).toBe(false);
    const once = record('gb');
    expect(Object.keys(once)).toEqual(expect.arrayContaining(['game']));

    // the same world again from nothing, a budget so small every run makes one step and stops
    closeDb();
    process.env.MOJULO_RUN_BUDGET_MS = '1';
    let out = await designGameHandler({ world: W, ref: 'gb', run: true, check: true });
    const calls = [out];
    while (out.ran.some((r) => r.action === 'pending')) {
      // the run is the next move, before any other, and says how much is left
      expect(out.next[0]).toEqual({ step: 'run', pending: out.ran.filter((r) => r.action === 'pending').length, card: 'gameworld-next' });
      // each run made exactly one step (it always moves; the budget stops it before the next)
      expect(out.ran.filter((r) => r.action === 'make' || r.action === 'remake')).toHaveLength(1);
      expect(calls.length).toBeLessThan(20);
      out = await designGameHandler({ ref: 'gb', run: true, check: true });
      calls.push(out);
    }
    expect(calls.length).toBeGreaterThan(2);
    // the record it leaves, made a step a call, is the one call's: the same rows, from the same orders, stored the same
    expect(record('gb')).toEqual(once);
    // and a run after it makes nothing
    expect((await designGameHandler({ ref: 'gb', run: true, check: true })).ran.every((r) => r.action === 'keep')).toBe(true);
  }, 300000);
});

describe('design_game: the audit steps', () => {
  it('walks each reach level after the game, keeps the verdict, and walks it again only when what it walked moved', async () => {
    process.env.STUB_BROWSER = '1';
    const out = await designGameHandler({ compose: COMPOSE, ref: 'ga', run: true, check: true });
    const levels = out.ran.filter((r) => r.key.startsWith('level-'));
    const audits = out.ran.filter((r) => r.key.startsWith('audit-'));
    expect(levels.length).toBeGreaterThan(1);
    expect(audits.map((a) => a.ref)).toEqual(levels.map((l) => l.ref));
    // after the game, one walk each, the verdict said with the step
    expect(out.ran.findIndex((r) => r.key.startsWith('audit-'))).toBeGreaterThan(out.ran.findIndex((r) => r.key === 'game'));
    expect(walk).toHaveBeenCalledTimes(levels.length);
    for (const a of audits) expect(a).toMatchObject({ action: 'make', audit: { completable: true, note: expect.stringMatching(/reach-exit.*success/) } });
    // a climb's level is walked up its own way (its flights, then its ladder: levels.js climbRoute), a trail's straight
    const plans = walk.mock.calls.map(([arg]) => arg.plan.waypoints);
    expect(plans.some((w) => w.some((p) => p?.climb))).toBe(true);
    expect(plans.some((w) => w.length === 1)).toBe(true);
    // the readout counts them (a machine gate), and its `made` names only what the run made
    expect(out.audits).toEqual({ gate: 'machine', proved: levels.length, of: levels.length });
    expect(Object.keys(out.made).some((k) => k.startsWith('audit-'))).toBe(false);
    // kept in the record beside the levels'
    expect(record('ga')[audits[0].key]).toMatchObject({ ref: audits[0].ref, verdict: { completable: true } });

    // a run that does not ask to check walks nothing (a run compiles), and the verdicts kept still read
    const plain = await designGameHandler({ ref: 'ga', run: true });
    expect(plain.ran.some((r) => r.key.startsWith('audit-'))).toBe(false);
    expect(plain.audits).toEqual(out.audits);
    expect(walk).toHaveBeenCalledTimes(levels.length);

    // nothing moved: kept, not walked again
    const again = await designGameHandler({ ref: 'ga', run: true, check: true });
    expect(again.ran.filter((r) => r.key.startsWith('audit-')).every((r) => r.action === 'keep')).toBe(true);
    expect(walk).toHaveBeenCalledTimes(levels.length);

    // a level edited by hand: the level is left as it is (its own rule), and its walk is taken again on what it is now
    const lv = levels[0].ref;
    const M = SketchRepository.getByRef(lv).manifest;
    await updateSketchHandler({ ref: lv, manifest: { ...M, seed: (Number.isInteger(M.seed) ? M.seed : 1) + 1 } });
    const edited = await designGameHandler({ ref: 'ga', run: true, check: true });
    expect(edited.ran.find((r) => r.ref === lv && r.key.startsWith('level-')).action).toBe('edited');
    expect(edited.ran.find((r) => r.ref === lv && r.key.startsWith('audit-')).action).toBe('remake');
    expect(edited.ran.find((r) => r.ref === levels[1].ref && r.key.startsWith('audit-')).action).toBe('keep');
    expect(walk).toHaveBeenCalledTimes(levels.length + 1);
  }, 300000);

  it('with no browser, the walk is said as skipped, kept, and taken once a browser can walk it', async () => {
    const out = await designGameHandler({ compose: COMPOSE, ref: 'gn', run: true, check: true });
    const n = out.ran.filter((r) => r.key.startsWith('audit-')).length;
    expect(n).toBeGreaterThan(1);
    expect(walk).not.toHaveBeenCalled();
    expect(out.audits).toMatchObject({ proved: 0, of: n });
    expect(out.audits.unproved.every((u) => /skipped: no browser/.test(u.note))).toBe(true);
    // kept while nothing can walk it (a rerun makes nothing)
    expect((await designGameHandler({ ref: 'gn', run: true, check: true })).ran.every((r) => r.action === 'keep')).toBe(true);
    // a browser installed since: walked
    process.env.STUB_BROWSER = '1';
    const walked = await designGameHandler({ ref: 'gn', run: true, check: true });
    expect(walked.ran.filter((r) => r.key.startsWith('audit-')).every((r) => r.action === 'remake')).toBe(true);
    expect(walked.audits).toEqual({ gate: 'machine', proved: n, of: n });
  }, 300000);
});
