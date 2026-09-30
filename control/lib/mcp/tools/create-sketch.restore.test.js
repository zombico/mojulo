process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_DISABLE_SCENE_WARM = '1';
import { describe, expect, it } from 'vitest';
import { createSketchHandler, updateSketchHandler } from './sketch-mint.js';
import { composeWorld } from './compose-world.js';
import { mintSolidHandler } from './mint-solid.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const cylinder = { kind: 'workbench', units: 'cm', lathes: [{ id: 'body', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] }] };
describe('create_sketch restores exported world recipes', () => {
  it('preserves an edited city manifest without requiring diagram fields', async () => {
    composeWorld({ base: 'city', seed: 91, ref: 'restore_city_source', title: 'City', overrides: { context: { depth: 2 }, region: { x: 0, y: 0, w: 16, d: 16 } } });
    await updateSketchHandler({ ref: 'restore_city_source', patch: [{ op: 'set', path: '/seed', value: 92 }] });
    const original = SketchRepository.getByRef('restore_city_source').manifest;
    const copy = structuredClone(original);
    const result = await createSketchHandler({ ref: 'restore_city_copy', title: 'City', manifest: copy });
    expect(result.ok).toBe(true);
    expect(SketchRepository.getByRef('restore_city_copy').manifest).toEqual(original);
    expect(copy).toEqual(original);
  });

  it('refuses duplicate refs without replacing the existing recipe', async () => {
    composeWorld({ base: 'city', seed: 4, ref: 'restore_city_conflict', overrides: { context: { depth: 1 }, region: { x: 0, y: 0, w: 8, d: 8 } } });
    const original = SketchRepository.getByRef('restore_city_conflict').manifest;
    await expect(createSketchHandler({ ref: 'restore_city_conflict', title: 'Conflict', manifest: { ...original, seed: 1 } })).rejects.toThrow(/exists/i);
    expect(SketchRepository.getByRef('restore_city_conflict').manifest).toEqual(original);
  });

  it('keeps world validation before persistence', async () => {
    await expect(createSketchHandler({ ref: 'restore_bad_solid', title: 'Bad solid', manifest: { ...cylinder, lathes: [{ ...cylinder.lathes[0], material: 'unobtainium' }] } })).rejects.toThrow(/Invalid world manifest/);
    expect(SketchRepository.getByRef('restore_bad_solid')).toBeNull();
  });

  it('recomputes a workbench ledger with the same gates as whole-manifest updates', async () => {
    await createSketchHandler({ ref: 'restore_solid', title: 'Cylinder', manifest: cylinder });
    const first = SketchRepository.getByRef('restore_solid').manifest;
    expect(first.ledger).toBeTruthy();
    await updateSketchHandler({ ref: 'restore_solid', manifest: cylinder });
    expect(SketchRepository.getByRef('restore_solid').manifest).toEqual(first);
  });

  it('keeps a hero row\'s hand edits under /plan and /recipe instead of regenerating them', async () => {
    await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'restore_hero_source', spec: { cast: 'female', register: 'lowpoly' } });
    await updateSketchHandler({ ref: 'restore_hero_source', patch: [{ op: 'set', path: '/plan/segments/0/stations/0/r/0', value: 0.3 }] });
    const planEdited = SketchRepository.getByRef('restore_hero_source').manifest;
    expect(planEdited.plan.segments[0].stations[0].r[0]).toBe(0.3);
    await createSketchHandler({ ref: 'restore_hero_plan', title: 'Hero', manifest: structuredClone(planEdited) });
    expect(SketchRepository.getByRef('restore_hero_plan').manifest).toEqual(planEdited);
    // a recipe-level edit on a plan-carrying row comes back as exported too
    const recipeEdited = structuredClone(planEdited);
    const station = recipeEdited.recipe.parts.torso.stations[0];
    const slot = Object.keys(station.points)[0];
    station.points[slot] = station.points[slot].map((v) => Math.round(v * 1.01 * 1e6) / 1e6);
    await createSketchHandler({ ref: 'restore_hero_recipe', title: 'Hero', manifest: structuredClone(recipeEdited) });
    const stored = SketchRepository.getByRef('restore_hero_recipe').manifest;
    expect(stored.recipe.parts.torso.stations[0].points[slot]).toEqual(station.points[slot]);
    expect(stored.recipe.parts.torso.stations[0].points[slot]).not.toEqual(planEdited.recipe.parts.torso.stations[0].points[slot]);
    expect(stored.plan).toEqual(planEdited.plan);
    // a hero with no plan or recipe yet still generates them
    await createSketchHandler({ ref: 'restore_hero_bare', title: 'Hero', manifest: { kind: 'layered', hero: planEdited.hero } });
    expect(SketchRepository.getByRef('restore_hero_bare').manifest.recipe.parts.torso).toBeTruthy();
  });

  it('still validates title and ref for world creation', async () => {
    await expect(createSketchHandler({ title: '', manifest: cylinder })).rejects.toThrow(/title/);
    await expect(createSketchHandler({ ref: '../bad', title: 'Cylinder', manifest: cylinder })).rejects.toThrow(/ref/);
  });
});
