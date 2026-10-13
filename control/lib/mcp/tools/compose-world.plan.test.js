// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld, composeWorldHandler } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { cityBookHtml } from '@/lib/graph/city/plan/book-html';

// A city with a plan is the city on rails (kind 'city'); a city without one is the frozen legacy city, untouched.
describe('compose_world: a city plan', () => {
  it('stores the plan flat as kind city, with what the mint gave it, and answers with laws and next', () => {
    const r = composeWorld({ base: 'city', seed: 9, overrides: { plan: { grammar: 'tokyo', districts: [{ at: 'D2:F4', use: 'core' }] } } });
    expect(r.recipe).toMatchObject({ kind: 'city', seed: 9, grammar: 'tokyo', play: 'game', districts: [{ at: 'D2:F4', use: 'core' }] });
    expect(r.recipe.notes.inferred.map((i) => i.field)).toEqual(['play', 'board', 'spine']);
    expect(r.bookUrl).toMatch(/\/bible$/);
    expect(r.city.blocks).toBeGreaterThan(10);
    expect(r.laws.find((l) => l.id === 'connected').ok).toBe(true);
    expect(r.next.map((n) => n.id)).not.toContain('districts');
    expect(r.note).toBeUndefined();
    expect(SketchRepository.getByRef(r.ref).manifest.kind).toBe('city');
  });
  it('draws and writes a seed when none is given', () => {
    const r = composeWorld({ base: 'city', overrides: { plan: {} } });
    expect(Number.isInteger(r.recipe.seed)).toBe(true);
  });
  it('refuses a plan off the card by name, pointing at the manual', () => {
    expect(() => composeWorld({ base: 'city', overrides: { plan: { grammar: 'atlantis' } } })).toThrow(/grammar is one of .*get_view_vocab\(\{ id: 'city-plan' \}\)/);
  });
  it('a stored plan resolves as a walkable world, and reads as its book', async () => {
    const r = await composeWorldHandler({ base: 'city', seed: 4, overrides: { plan: { grammar: 'paris', sites: [{ at: 'E3', use: 'plaza', name: 'the square' }], transit: [{ path: 'A3>J3' }] }, weather: 'rain' } });
    const row = SketchRepository.getByRef(r.ref);
    expect(row.manifest.weather).toBe('rain');
    const scene = await resolveWorldScene(row);
    expect(scene).toBeTruthy();
    const html = cityBookHtml({ ...row.manifest, title: row.title }, { ref: r.ref });
    expect(html).toContain('the square');
  });
  it('a world grammar written as a document, with a maglev, resolves as a walkable world', async () => {
    const r = await composeWorldHandler({ base: 'city', seed: 5, overrides: { plan: {
      grammar: { from: 'neon-sprawl', label: 'Night market', wear: { crown: 'parapet' } },
      transit: [{ path: 'A3>J3', mode: 'maglev' }],
    } } });
    expect(r.city.look).toBe('Night market');
    const row = SketchRepository.getByRef(r.ref);
    const { payload } = await resolveWorldScene(row);
    expect(payload.metersPerUnit).toBe(3.66);
    expect(payload.faces.some((f) => f.group === 'city:guideway')).toBe(true);
  });
  it('leaves the legacy city as it was', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { profile: 'metro' } });
    expect(r.recipe.kind).toBe('fractal-city');
  });
});
