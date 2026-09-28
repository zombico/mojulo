// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * compose_world({ base: 'terrain' }) — the on-ramp. Claims under test: an inline painted
 * scene mints and resolves; a stored painted-landscape promotes by `{ ref }` and the world follows it; the live
 * /world resolve ships the recipe while an export resolve carries the baked world; a placed sketch lands in the
 * payload's faces fitted and seated; a bad recipe refuses at mint, a dangling ref at resolve.
 */
import { describe, expect, it } from 'vitest';

import { composeWorld } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { mintPaintedLandscape } from './painted-landscape.js';

const FROM = { heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'ct', landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 3, side: 'right' }] };
const MUG = {
  kind: 'workbench', units: 'cm',
  lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 9 }, profile: [{ t: 0, radius: 3.6 }, { t: 1, radius: 4 }], tint: '#b8342c' }],
};

describe("compose_world base 'terrain'", () => {
  it('an inline painted scene mints and resolves: the live page gets the recipe, exports get the bake', async () => {
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, span: 1600 } });
    expect(r.ok).toBe(true);
    const stored = SketchRepository.getByRef(r.ref);
    expect(stored.manifest.kind).toBe('terrain');
    const live = await resolveWorldScene(stored, { live: true });
    expect(live.kind).toBe('terrain'); expect(live.payload.faces).toEqual([]); expect(live.payload.terrain.K.s).toBe(1600 / 24);
    const exp = await resolveWorldScene(stored);
    expect(exp.payload.faces.length).toBeGreaterThan(1000);
  });
  it('a stored painting promotes by ref, and the world follows its source', async () => {
    const painting = mintPaintedLandscape({ title: 'ridge', ...FROM });
    const r = composeWorld({ base: 'terrain', overrides: { from: { ref: painting.ref } } });
    const w = SketchRepository.getByRef(r.ref);
    const before = (await resolveWorldScene(w, { live: true })).payload.terrain.K.hMin;
    SketchRepository.update({ ref: painting.ref, manifest: { ...SketchRepository.getByRef(painting.ref).manifest, landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 6, side: 'right' }] } });
    const after = (await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true })).payload.terrain;
    expect(after.K.hMin + after.K.hStep * 65535).toBeGreaterThan(before + 2);   // the taller scarp raised the top
  });
  it('a placed sketch stands in the world', async () => {
    SketchRepository.create({ ref: 'sk_terrain_mug', title: 'mug', manifest: MUG });
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, place: [{ ref: 'sk_terrain_mug', at: [0, 300], size: 30, name: 'mug' }] } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true });
    const mug = payload.faces.filter((f) => f.group === 'item:mug');
    expect(mug.length).toBeGreaterThan(20);
    const xs = mug.flatMap((f) => f.corners.map((c) => c[0])); expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(30 + 1e-6);
  });
  it('refuses a bad recipe at mint and a dangling ref at resolve', async () => {
    expect(() => composeWorld({ base: 'terrain', overrides: {} })).toThrow(/`from` is required/);
    expect(() => composeWorld({ base: 'terrain', overrides: { from: { heartbeat: 'nope', splatch: 'verdure-trio' } } })).toThrow(/terrain\.from/);
    const m = { kind: 'terrain', from: { ref: 'sk_does_not_exist' } };
    await expect(resolveWorldScene({ ref: 'x', title: 't', manifest: m })).rejects.toThrow(/not a stored sketch/);
  });
});
