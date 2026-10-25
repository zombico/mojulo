// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// A run that fails partway keeps the record of what it made: the steps made before the throw are rows, and the world's
// `made` says so, so the next run keeps or remakes them as usual and never reads them as edited by hand. The failing
// step is a stub (a level whose write throws), the game a stub row and the first-frame gate left out, so no browser
// runs here.
const fail = vi.hoisted(() => ({ ref: null }));
vi.mock('./sketches.js', async (importOriginal) => {
  const real = await importOriginal();
  const guard = (fn) => async (args, ...rest) => {
    if (fail.ref && args?.ref === fail.ref) throw new Error(`stub: the stage at '${fail.ref}' throws`);
    return fn(args, ...rest);
  };
  return { ...real, createSketchHandler: guard(real.createSketchHandler), updateSketchHandler: guard(real.updateSketchHandler) };
});
vi.mock('./create-game.js', async (importOriginal) => {
  const real = await importOriginal();
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  return { ...real, createGameHandler: async ({ ref, title, levels, store }) => { SketchRepository.create({ ref, title, manifest: { kind: 'game', title, levels, store } }); return { ref }; } };
});
vi.mock('@/lib/graph/game/first-frame-check.js', async (importOriginal) => ({ ...(await importOriginal()), firstFrameReadout: async () => ({}) }));

const { closeDb } = await import('@/lib/db/index');
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { designGameHandler } = await import('./design-game.js');
const { fingerprint, runSteps, gameworldOf } = await import('@/lib/graph/gameworld/index');

beforeEach(() => { closeDb(); fail.ref = null; });
const world = (ref) => SketchRepository.getByRef(ref).manifest;
const levelKeys = (W) => Object.keys(W.made ?? {}).filter((k) => k.startsWith('level-'));
const stageKeys = (ref) => runSteps(gameworldOf(world(ref)), { ref, lookup: () => null }).map((s) => s.key).filter((k) => k.startsWith('level-'));
const actions = (out) => Object.fromEntries(out.ran.map((r) => [r.key, r.action]));

describe('design_game: a run that fails partway', () => {
  it('records the steps made before the throw, so the next run keeps or remakes them, never edited', async () => {
    const ref = 'vale';
    await designGameHandler({ compose: { prompt: 'a misty river valley with a ruined castle at the end', levels: 1, seed: 3 }, ref });
    // the stages in the order a run makes them: the last one throws
    const stages = stageKeys(ref);
    expect(stages.length).toBeGreaterThan(1);
    const last = stages.at(-1), before = stages.slice(0, -1);
    fail.ref = `${ref}-${last}`;

    // a first run fails at the last stage: the error reaches the caller, and the stages before it are recorded
    await expect(designGameHandler({ ref, run: true })).rejects.toThrow(/stub: the stage at 'vale-level-.*' throws/);
    let W = world(ref);
    expect(levelKeys(W)).toEqual(before);
    for (const k of before) expect(W.made[k].stored).not.toBeNull();
    expect(W.made[last]).toBeUndefined();

    // the next run keeps what was made and makes the rest
    fail.ref = null;
    let out = await designGameHandler({ ref, run: true });
    expect(actions(out)).toMatchObject({ ...Object.fromEntries(before.map((k) => [k, 'keep'])), [last]: 'make', game: 'make' });

    // a change that moves every stage, and a run that fails at the last: the stages remade before it are recorded as remade
    await designGameHandler({ ref, patch: [{ op: 'set', path: '/style/weather', value: { climate: { clear: 1 } } }] });
    fail.ref = `${ref}-${last}`;
    await expect(designGameHandler({ ref, run: true })).rejects.toThrow(/stub: the stage at/);
    W = world(ref);
    for (const k of before) expect(W.made[k].stored).toBe(fingerprint(SketchRepository.getByRef(W.made[k].ref).manifest));
    fail.ref = null;
    out = await designGameHandler({ ref, run: true });
    const a = actions(out);
    for (const k of before) expect(a[k]).toBe('keep');
    expect(a[last]).toBe('remake');
    expect(Object.values(a)).not.toContain('edited');
  }, 300_000);

  it('a run with nothing made before the throw writes nothing', async () => {
    const ref = 'vale0';
    await designGameHandler({ compose: { prompt: 'a misty river valley', levels: 1, seed: 3 }, ref });
    const [first] = stageKeys(ref);
    const head = JSON.stringify(world(ref));
    fail.ref = `${ref}-${first}`;
    await expect(designGameHandler({ ref, run: true })).rejects.toThrow(/stub: the stage at/);
    expect(JSON.stringify(world(ref))).toBe(head);
  }, 300_000);
});
