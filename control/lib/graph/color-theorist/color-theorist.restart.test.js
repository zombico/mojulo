// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, vi } from 'vitest';

// The look registry is the process's own: a stage minted from a palette world names its kit by a composed id, so after
// a restart (here: the modules loaded afresh, an empty registry) it must carry what composes that kit again.
describe('a palette stage after a restart', () => {
  it('composes its kit again from the recipes it carries; without them its kit is not found', async () => {
    const { MEADOWMARK } = await import('../gameworld/examples.js');
    const { gameStages } = await import('../gameworld/levels.js');
    const W = { ...MEADOWMARK, style: { ...MEADOWMARK.style, look: 'rust plains, basalt cliffs', palette: { seed: 42 } } };
    const stored = JSON.parse(JSON.stringify(gameStages(W).find((s) => s.manifest?.kind === 'stage').manifest));
    expect(stored.looks.map((r) => Object.keys(r).includes('palette') ? 'palette' : 'look')).toEqual(['look', 'palette']);
    expect(stored.looks.at(-1).id).toBe(stored.kit);

    vi.resetModules();
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { lookOf } = await import('../era/style/looks.js');
    expect(lookOf(stored.kit)).toBeNull();
    const { looks: _l, ...bare } = stored;
    await expect(resolveWorldScene({ ref: 'bare', title: 'bare', manifest: bare })).rejects.toThrow(new RegExp(`kit '${stored.kit}'`));
    await resolveWorldScene({ ref: 'kept', title: 'kept', manifest: stored });
    expect(lookOf(stored.kit)?.base).toBe('isekai-meadow');
  }, 120_000);

  it('a world on a written kit carries no recipes: its stages are as they were', async () => {
    const { MEADOWMARK } = await import('../gameworld/examples.js');
    const { gameStages } = await import('../gameworld/levels.js');
    expect(gameStages(MEADOWMARK).some((s) => s.manifest?.looks)).toBe(false);
  });
});

// A world with look words and no palette names its kit by a composed id just the same: its level rows carry the one
// recipe that composes it, so a run that left them without it remakes them once, in place, with it.
describe('a look stage after a restart', () => {
  it('a level a run stores composes its kit again; a level stored before the recipes is remade, not kept', async () => {
    vi.resetModules();
    const { HALDEN_REACH, MEADOWMARK_HERO } = await import('../gameworld/examples.js');
    const { runSteps, decide } = await import('../gameworld/runner.js');
    const { fingerprint } = await import('../gameworld/review.js');
    const W = { ...HALDEN_REACH, characters: MEADOWMARK_HERO.characters };
    const step = runSteps(W, { ref: 'gw' }).find((s) => s.key.startsWith('level-') && s.order.manifest?.kind === 'stage');
    const stored = JSON.parse(JSON.stringify(step.order.manifest));
    expect(stored.looks).toEqual([expect.objectContaining({ id: stored.kit, look: HALDEN_REACH.style.look, base: 'isekai-meadow' })]);

    // a level a run made before its stage carried the recipes (its systems made, so the step is ready): the order
    // moved, the row is as the run left it
    const { looks: _l, ...before } = stored, was = fingerprint(before);
    expect(decide({ ...step, ready: true }, { ref: step.ref, order: fingerprint({ ...step.order, manifest: before }), stored: was }, was)).toBe('remake');

    vi.resetModules();
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { lookOf } = await import('../era/style/looks.js');
    expect(lookOf(stored.kit)).toBeNull();
    await expect(resolveWorldScene({ ref: 'bare', title: 'bare', manifest: before })).rejects.toThrow(new RegExp(`kit '${stored.kit}'`));
    // with its recipes it is past its kit, and stops only at the hero this test never made
    await expect(resolveWorldScene({ ref: 'kept', title: 'kept', manifest: stored })).rejects.toThrow(/heroRef 'gw-hero/);
    expect(lookOf(stored.kit)?.read).toBe(HALDEN_REACH.style.look);
  }, 120_000);
});
