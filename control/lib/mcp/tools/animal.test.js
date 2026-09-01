// Isolate to an in-memory SQLite — must run before any import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintSolidHandler, SOLID_KINDS } from '@/lib/mcp/tools/mint-solid';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { classifyBucket } from '@/lib/graph/sketch/sketch-manifest';
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';

beforeEach(() => { closeDb(); });

describe("mint_solid kind 'animal'", () => {
  it('mints a species as a recipe and renders it through the stored-sketch dispatch', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Grey wolf', ref: 'an_wolf1', spec: { species: 'wolf', view: 'lateral' } });
    expect(res.ok).toBe(true);
    expect(res.ref).toBe('an_wolf1');
    expect(res.stance).toBe('quadruped');

    const stored = SketchRepository.getByRef('an_wolf1');
    expect(stored.manifest.kind).toBe('animal');
    expect(stored.manifest.archetype).toBe('canine');   // the species RESOLVES at mint time
    expect(stored.manifest.species).toBe('wolf');
    expect(stored.manifest.view).toBe('lateral');
    expect(classifyBucket(stored.manifest)).toBe('illustration');

    const svg = await renderStoredSketchSvg(stored);
    expect(svg.startsWith('<svg')).toBe(true);
    // Recipes, not renders: the same stored recipe re-renders byte-identically.
    expect(await renderStoredSketchSvg(stored)).toBe(svg);
  });

  it('merges caller opts one level deep over the species recipe', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Long-faced wolf', spec: { species: 'wolf', opts: { skullCfg: { length: 0.3 } } } });
    const m = SketchRepository.getByRef(res.ref).manifest;
    expect(m.opts.skullCfg.length).toBe(0.3);       // the one knob retuned
    expect(m.opts.skullCfg.width).toBeDefined();    // …the rest of the species' skull survives
    expect(m.opts.coat).toBeDefined();
  });

  it('mints a bare archetype and reports a biped stance', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Rex', spec: { archetype: 'theropod' } });
    expect(res.stance).toBe('biped');
    expect(SketchRepository.getByRef(res.ref).manifest.archetype).toBe('theropod');
  });

  it('lets an explicit archetype override the species frame', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Bear-framed wolf', spec: { species: 'wolf', archetype: 'ursine' } });
    const m = SketchRepository.getByRef(res.ref).manifest;
    expect(m.archetype).toBe('ursine');
    expect(m.opts.coat).toBeDefined();              // …still wearing the wolf's dressing
  });

  it('errors teach: an unknown species / no door / a bad view name point at the card', async () => {
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'dragon' } }))
      .rejects.toThrow(/`species` must be one of[\s\S]*wolf[\s\S]*get_solid_vocab/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: {} }))
      .rejects.toThrow(/pass `species`[\s\S]*or `archetype`/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'wolf', view: 'sideways' } }))
      .rejects.toThrow(/`view` must be a number/);
  });

  it('is registered in the creature family and has a solid-vocab card', () => {
    expect(SOLID_KINDS.animal.family).toBe('creature');
    const card = getSolidVocabCatalog().get('animal');
    expect(card.entry).toBe('mint_solid');
    expect(card.family).toBe('creature');
  });
});
