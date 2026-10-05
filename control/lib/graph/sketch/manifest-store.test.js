// manifest-store — a row stores a layered recipe without the parts it copies whole from the plan's include (the anime
// head), and the read puts them back: unpack(pack(m)) is m, byte for byte, whatever the manifest.
import { describe, it, expect } from 'vitest';
import { packManifest, packRecipe, unpackManifest } from './manifest-store.js';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';

const hero = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
const bytes = (m) => Buffer.byteLength(JSON.stringify(m));
const roundTrip = (m) => JSON.parse(JSON.stringify(unpackManifest(JSON.parse(JSON.stringify(packManifest(m))))));

describe('the stored manifest', () => {
  const anime = hero({ cast: 'male', head: 'anime' });

  it('stores the anime head once: the recipe names the include for every part it copied whole', () => {
    const packed = packManifest(anime);
    const named = Object.entries(packed.recipe.parts).filter(([, p]) => p.$include).map(([n]) => n);
    expect(named.length).toBeGreaterThan(30);
    for (const n of named) expect(Object.keys(anime.plan.include[0].parts)).toContain(n);
    expect(bytes(anime) - bytes(packed)).toBeGreaterThan(1e6);
    expect(Object.keys(packed.recipe.parts)).toEqual(Object.keys(anime.recipe.parts));   // the key order kept
    expect(packed.plan).toBe(anime.plan);
    expect(packRecipe(anime.plan, anime.recipe)).toEqual(packed.recipe);
  });

  it('reads back byte for byte: the anime, a bare and a landmark hero', () => {
    for (const m of [anime, hero({ cast: 'female', head: 'anime', detail: 'swimsuit' }), hero({ cast: 'male' })]) {
      expect(JSON.stringify(roundTrip(m))).toBe(JSON.stringify(m));
    }
  });

  it('a head part edited by hand under /recipe is stored as edited', () => {
    const edited = structuredClone(anime); const name = Object.keys(edited.plan.include[0].parts).find((n) => edited.recipe.parts[n]?.layer === 2);
    const [k] = Object.keys(edited.recipe.parts[name].offsets); edited.recipe.parts[name].offsets[k] = edited.recipe.parts[name].offsets[k].map((x) => x + 0.001);
    const packed = packManifest(edited);
    expect(packed.recipe.parts[name]).toEqual(edited.recipe.parts[name]);
    expect(JSON.stringify(roundTrip(edited))).toBe(JSON.stringify(edited));
  });

  it('a read part is its own copy: an edit to the recipe never reaches the plan', () => {
    const read = unpackManifest(JSON.parse(JSON.stringify(packManifest(anime))));
    const name = Object.keys(read.plan.include[0].parts).find((n) => read.recipe.parts[n]?.layer === 2);
    const [k] = Object.keys(read.recipe.parts[name].offsets); const before = JSON.stringify(read.plan.include[0].parts[name]);
    read.recipe.parts[name].offsets[k] = [9, 9, 9];
    expect(JSON.stringify(read.plan.include[0].parts[name])).toBe(before);
  });

  it('anything else passes through as the same object; a marker the plan cannot answer stays as stored', () => {
    for (const m of [null, { kind: 'figure', parts: {} }, { kind: 'layered', recipe: { parts: { a: { $include: 'head' } } } }, { kind: 'layered', plan: { segments: [] }, recipe: { parts: {} } }]) {
      expect(packManifest(m)).toBe(m); expect(unpackManifest(m)).toBe(m);
    }
    const stray = { kind: 'layered', plan: { include: [{ name: 'head', parts: { eye: { layer: 2 } } }] }, recipe: { parts: { eye: { $include: 'hat' }, nose: { $include: 'head' } } } };
    expect(unpackManifest(stray)).toBe(stray);
  });
});
