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

  it('a world with no palette carries no recipes: its stages are as they were', async () => {
    const { MEADOWMARK, HALDEN_REACH } = await import('../gameworld/examples.js');
    const { gameStages } = await import('../gameworld/levels.js');
    for (const W of [MEADOWMARK, HALDEN_REACH]) expect(gameStages(W).some((s) => s.manifest?.looks)).toBe(false);
  });
});
